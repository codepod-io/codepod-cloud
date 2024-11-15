import * as k8s from "@kubernetes/client-node";
import { Metrics } from "@kubernetes/client-node";

import { z } from "zod";
import { match, P } from "ts-pattern";
import net from "net";
import assert from "assert";

import { protectedProcedure, router } from "./trpc";
import { ZmqWire } from "./k8s-zmq";

import * as Y from "yjs";
import WebSocket from "ws";

import { WebsocketProvider } from "./y-websocket";
import { PodResult, RuntimeInfo } from "../yjs/types";
import prisma from "../prisma";

import { myenv, kernelMaxLifetime, repoId2wireMap, repoId2ydoc } from "./vars";
import { registerKernelActivity } from "./recycle";
import { SupportedLanguage } from "./types";

const kc = new k8s.KubeConfig();
kc.loadFromDefault();
const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
const k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api);
const k8sMetricsClient = new Metrics(kc);

function getDeploymentSpec({
  userId,
  repoId,
  image,
  kernelName,
}: {
  userId: string;
  repoId: string;
  image: string;
  kernelName: string;
}): k8s.V1Deployment {
  return {
    apiVersion: "apps/v1",
    kind: "Deployment",
    metadata: {
      name: `rt-${repoId}-${kernelName}`,
    },
    spec: {
      replicas: 1,
      selector: {
        matchLabels: { app: `rt-${repoId}-${kernelName}` },
      },
      template: {
        metadata: { labels: { app: `rt-${repoId}-${kernelName}` } },
        spec: {
          dnsPolicy: "None",
          dnsConfig: {
            nameservers: ["8.8.8.8", "1.1.1.1"],
          },
          containers: [
            {
              name: `rt-${repoId}-${kernelName}`,
              image,
              command: [
                "sh",
                "-c",
                // 1GiB memory limit
                // "ulimit -v 1024000; /run.sh",
                //
                // set ulimit to 8GiB
                // "ulimit -v 8192000; /run.sh",
                //
                // set ulimit to 40GiB
                // "ulimit -v 40960000; /run.sh",
                //
                `ulimit -v ${myenv.KERNEL_ULIMIT_MEMORY}; /run.sh`,
              ],
              ports: [
                // These are pre-defined in kernel/conn.json
                { containerPort: 55692 },
                { containerPort: 55693 },
                { containerPort: 55694 },
                { containerPort: 55695 },
                { containerPort: 55696 },
              ],
              volumeMounts: [
                {
                  name: "myvolume",
                  mountPath: "/mnt/data",
                },
                {
                  name: "pip-cache",
                  mountPath: "/root/.cache/pip",
                },
                {
                  name: "public",
                  mountPath: "/mnt/public",
                  readOnly: true,
                },
              ],
              resources: {
                // This k8s limit is larger than the ulimit, and won't be hit.
                // limits: {
                //   memory: "40Gi",
                //   cpu: "4",
                // },
                requests: {
                  memory: "128Mi",
                  cpu: "0.2",
                },
              },
            },
          ],
          volumes: [
            {
              name: "myvolume",
              persistentVolumeClaim: {
                claimName: `vol-${userId}`,
              },
            },
            {
              name: "pip-cache",
              persistentVolumeClaim: {
                claimName: "pvc-pip-cache",
              },
            },
            {
              name: "public",
              persistentVolumeClaim: {
                claimName: "pvc-public",
              },
            },
          ],
        },
      },
    },
  };
}

function getServiceSpec({
  repoId,
  kernelName,
}: {
  repoId: string;
  kernelName: string;
}): k8s.V1Service {
  return {
    apiVersion: "v1",
    kind: "Service",
    metadata: {
      name: `svc-${repoId}-${kernelName}`,
    },
    spec: {
      selector: {
        app: `rt-${repoId}-${kernelName}`,
      },
      ports: [
        // {
        //   protocol: "TCP",
        //   port: 4020,
        //   targetPort: 4020,
        // },
        // The ZMQ ports
        {
          name: "zmq-55692",
          protocol: "TCP",
          port: 55692,
          targetPort: 55692,
        },
        {
          name: "zmq-55693",
          protocol: "TCP",
          port: 55693,
          targetPort: 55693,
        },
        {
          name: "zmq-55694",
          protocol: "TCP",
          port: 55694,
          targetPort: 55694,
        },
        {
          name: "zmq-55695",
          protocol: "TCP",
          port: 55695,
          targetPort: 55695,
        },
        {
          name: "zmq-55696",
          protocol: "TCP",
          port: 55696,
          targetPort: 55696,
        },
      ],
    },
  };
}

export async function createDeployment(ns, deploy_spec) {
  try {
    // TODO if exists, skip
    // await k8sApi.createNamespacedPod(ns, getPodSpec(k8s_name));
    await k8sAppsApi.createNamespacedDeployment(ns, deploy_spec);
    // FIXME would this also do creation?
  } catch (e: any) {
    if (e.body.reason === "AlreadyExists") {
      console.log("Already exists, patching ..");
      try {
        await k8sAppsApi.patchNamespacedDeployment(
          deploy_spec.metadata.name,
          ns,
          deploy_spec,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          {
            headers: {
              "content-type": "application/strategic-merge-patch+json",
            },
          }
        );
      } catch (e: any) {
        console.log("ERROR", e.body.message);
        return false;
      }
    } else {
      console.log("ERROR", e.body.message);
      return false;
    }
  }
}

/**
 * Create volume named vol-{userId} in the namespace ns. The storage class is
 * longhorn. The volume type is RWX, and do not create if already exists.
 * @param ns
 * @param userId
 * @returns
 */
async function createVolume({ ns, userId }: { ns: string; userId: string }) {
  try {
    await k8sApi.createNamespacedPersistentVolumeClaim(ns, {
      apiVersion: "v1",
      kind: "PersistentVolumeClaim",
      metadata: {
        name: `vol-${userId}`,
        namespace: `${ns}`, // Ensure this matches your desired namespace
      },
      spec: {
        accessModes: ["ReadWriteMany"],
        storageClassName: "longhorn",
        resources: {
          requests: {
            storage: "1Gi",
          },
        },
      },
    });
  } catch (e: any) {
    if (e.body.reason === "AlreadyExists") {
      console.log("Volume already exists");
    } else {
      console.log("ERROR", e.body.message);
      return false;
    }
  }
}

export async function createService(ns: string, service_spec) {
  try {
    await k8sApi.createNamespacedService(ns, service_spec);

    // The DNS name of the service is
  } catch (e: any) {
    if (e.body.reason === "AlreadyExists") {
      console.log("Already exists, patching ..");
      try {
        await k8sApi.patchNamespacedService(
          service_spec.metadata.name,
          ns,
          service_spec,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          // Ref: https://github.com/kubernetes-client/javascript/issues/19
          //
          // FIXME actually the patch is not the same as kubectl apply -f. It
          // won't remove old selectors with a different label name. But it's
          // not a problem here, as we have only one selector "app".
          {
            headers: {
              "content-type": "application/strategic-merge-patch+json",
            },
          }
        );
      } catch (e: any) {
        console.log("ERROR", e.body.message);
        return false;
      }
    } else {
      console.log("ERROR", e.body.message);
      return false;
    }
  }
}

// check whether the ZMQ service is ready
function checkTcpService(host, port, timeout = 1000) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();

    socket.setTimeout(timeout);

    socket
      .on("connect", () => {
        socket.destroy();
        resolve(true);
      })
      .on("error", (err) => {
        reject(err);
      })
      .on("timeout", () => {
        socket.destroy();
        reject(new Error("Timeout"));
      })
      .connect(port, host);
  });
}

async function wairForServiceReady(url) {
  while (true) {
    try {
      await checkTcpService(url, 55692);
      await checkTcpService(url, 55693);
      await checkTcpService(url, 55694);
      await checkTcpService(url, 55695);
      await checkTcpService(url, 55696);
      console.log("service is ready");
      break;
    } catch (e) {
      console.log("Waiting for service ready");
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

async function createKernel({
  userId,
  repoId,
  kernelName,
  image,
  ns,
}: {
  userId: string;
  kernelName: SupportedLanguage;
  ns: string;
  image: string;
  repoId: string;
}) {
  // python kernel
  console.log(`creating ${kernelName} kernel ..`);
  let deploy_spec = getDeploymentSpec({ userId, repoId, kernelName, image });
  let service_spec = getServiceSpec({ repoId, kernelName });

  await createVolume({ ns, userId });

  await createDeployment(ns, deploy_spec);
  await createService(ns, service_spec);

  await registerKernelActivity(repoId, kernelName);

  // wait for zmq service to be ready
  // 1. get the ZMQ url: ws://svc-repoId.{ns}:...
  const url = `svc-${repoId}-${kernelName}.${ns}`;
  await wairForServiceReady(url);
  // 2. connect ZMQ socket
  console.log("creating zmq wire");
  const wire = new ZmqWire(url);

  return wire;
}

/**
 * ensure the ydoc for the repo is created and connected.
 * @returns the ydoc
 */
async function ensureYDoc({ repoId, token }) {
  // create Y doc if not exists
  let ydoc = repoId2ydoc.get(repoId);
  if (!ydoc) {
    console.log("creating new ydoc ..");
    ydoc = await getYDoc({ repoId, token });
    // trying to handle race condition
    if (repoId2ydoc.has(repoId)) {
      console.warn("WARN: race condition. This should rarely occur.");
      ydoc.destroy();
      ydoc = repoId2ydoc.get(repoId);
    } else {
      console.log("setting ydoc");
      repoId2ydoc.set(repoId, ydoc);
    }
  }

  assert(ydoc);
  return ydoc;
}

export const k8sRouter = router({
  // Start the runtime containr for a repo if not already started.
  start: protectedProcedure
    .input(
      z.object({
        repoId: z.string(),
        kernelName: z.enum(["python", "julia", "javascript", "racket"]),
      })
    )
    .mutation(
      async ({ input: { repoId, kernelName }, ctx: { token, userId } }) => {
        console.log(`create ${kernelName} kernel ===== for repo ${repoId} ..`);
        assert(userId);
        if (myenv.READ_ONLY) throw Error("Read only mode");
        if (!repoId2wireMap.has(repoId)) {
          repoId2wireMap.set(repoId, new Map());
        }
        const wireMap = repoId2wireMap.get(repoId)!;
        if (wireMap.has(kernelName)) {
          console.log("kernel already exists");
          return false;
        }

        const ydoc = await ensureYDoc({ repoId, token });

        // set the runtime status to "starting"
        const runtimeMap = ydoc
          .getMap("rootMap")
          .get("runtimeMap") as Y.Map<RuntimeInfo>;
        console.log("setting runtime status to starting");
        runtimeMap.set(kernelName, { status: "starting" });

        // call k8s api to create a container
        console.log("Using k8s ns:", myenv.RUNTIME_NS);

        // python kernel
        const wire = await createKernel({
          repoId,
          userId,
          kernelName,
          image: match(kernelName)
            .with("python", () => myenv.KERNEL_IMAGE_PYTHON)
            .with("julia", () => myenv.KERNEL_IMAGE_JULIA)
            .with("javascript", () => myenv.KERNEL_IMAGE_JAVASCRIPT)
            .with("racket", () => myenv.KERNEL_IMAGE_RACKET)
            .exhaustive(),
          ns: myenv.RUNTIME_NS,
        });

        console.log("binding zmq and yjs");
        bindZmqYjs({ wire, ydoc, kernelName });

        wireMap.set(kernelName, wire);

        // set start time
        const kernel = await prisma.kernel.findFirst({
          where: {
            name: kernelName,
            repo: {
              id: repoId,
            },
          },
        });
        // convert from date to number
        // const createdAt = kernel?.createdAt
        assert(kernel);
        const createdAt = kernel.createdAt.getTime();
        runtimeMap.set(kernelName, {
          status: "refreshing",
          createdAt,
          recycledAt: createdAt + kernelMaxLifetime,
        });
        // 3. run some code to test
        console.log("requesting kernel status");
        wire.requestKernelStatus();
        wire.runCode({ code: "3+4", msg_id: "123" });

        return true;
      }
    ),
  // Stop the runtime container for a repo.
  stop: protectedProcedure
    .input(
      z.object({
        repoId: z.string(),
        kernelName: z.enum(["python", "julia", "javascript", "racket"]),
      })
    )
    .mutation(async ({ input: { repoId, kernelName }, ctx: { token } }) => {
      if (myenv.READ_ONLY) throw Error("Read only mode");
      // remove zmq wire and ydoc
      console.log("deleting ZMQ wire ..");
      const wireMap = repoId2wireMap.get(repoId);
      const wire = wireMap?.get(kernelName);
      wire?.shell.close();
      wire?.control.close();
      wire?.iopub.close();
      wireMap?.delete(kernelName);

      const ydoc = await ensureYDoc({ repoId, token });
      // set the runtime status to "starting"
      const runtimeMap = ydoc
        .getMap("rootMap")
        .get("runtimeMap") as Y.Map<RuntimeInfo>;
      console.log("runtimemap", runtimeMap?.has(kernelName));
      runtimeMap?.delete(kernelName);

      if (wireMap?.size === 0) {
        // FIXME race condition
        console.log("destroying ydoc");
        ydoc.destroy();
        repoId2ydoc.delete(repoId);
      }

      // remove k8s resources
      //
      // FIXME safe guard to make sure the pods exist.
      console.log("Deleting deployment");
      try {
        await k8sAppsApi.deleteNamespacedDeployment(
          `rt-${repoId}-${kernelName}`,
          myenv.RUNTIME_NS
        );
        console.log("Deleting service");
        await k8sApi.deleteNamespacedService(
          `svc-${repoId}-${kernelName}`,
          myenv.RUNTIME_NS
        );
      } catch (e: any) {
        throw new Error("Error deleting k8s resources");
      }

      // delete from database
      await prisma.kernel.deleteMany({
        where: {
          name: kernelName,
          repo: {
            id: repoId,
          },
        },
      });
    }),

  usageStatus: protectedProcedure
    .input(z.object({ repoId: z.string(), kernelName: z.string() }))
    .mutation(async ({ input: { repoId, kernelName }, ctx: { token } }) => {
      if (myenv.READ_ONLY) throw Error("Read only mode");
      console.log("usageStatus", repoId);
      const ydoc = await ensureYDoc({ repoId, token });
      const runtimeMap = ydoc
        .getMap("rootMap")
        .get("runtimeMap") as Y.Map<RuntimeInfo>;
      const oldInfo = runtimeMap.get(kernelName);
      // reset the CPU and Memory metrics
      runtimeMap.set(kernelName, {
        status: "unknown",
        ...oldInfo,
        cpu: undefined,
        memory: undefined,
      });
      // -- The resource limits.
      // get the pod name of the kernel deployment
      // const deploy = await k8sAppsApi.readNamespacedDeployment(
      //   `rt-${repoId}-${kernelName}`,
      //   myenv.RUNTIME_NS
      // );
      // deploy.body.spec?.template.spec?.containers[0].resources?.limits;
      // get the k8s pod resource usage
      console.log("--- list pods", `app=rt-${repoId}-${kernelName}`);
      const pods = await k8sApi.listNamespacedPod(
        myenv.RUNTIME_NS,
        undefined,
        undefined,
        undefined,
        undefined,
        `app=rt-${repoId}-${kernelName}`
      );
      console.log("pods found", pods.body.items.length);
      if (pods.body.items.length === 0) {
        throw new Error("Pod not found");
      }
      const podName = pods.body.items[0].metadata?.name!;
      console.log("pod name", podName);

      const metrics = await k8sMetricsClient.getPodMetrics(
        myenv.RUNTIME_NS,
        // "rt-jhhjqzbnmkpofcyu4cou-python-6784c59f99-xk956"
        podName
      );
      // res.containers[0].usage: { cpu: '19612n', memory: '48440Ki' }
      console.log("pod metrics", metrics.containers[0].usage);
      runtimeMap.set(kernelName, {
        status: "unknown",
        ...oldInfo,
        cpu: metrics.containers[0].usage.cpu,
        memory: metrics.containers[0].usage.memory,
      });
    }),

  status: protectedProcedure
    .input(z.object({ repoId: z.string(), kernelName: z.string() }))
    .mutation(async ({ input: { repoId, kernelName }, ctx: { token } }) => {
      if (myenv.READ_ONLY) throw Error("Read only mode");
      const ydoc = await ensureYDoc({ repoId, token });
      const runtimeMap = ydoc
        ?.getMap("rootMap")
        .get("runtimeMap") as Y.Map<RuntimeInfo>;
      const wireMap = repoId2wireMap.get(repoId);
      const wire = wireMap?.get(kernelName);
      if (!wire) {
        runtimeMap.delete(kernelName);
        return false;
      } else {
        if (wire.shell.closed) {
          console.log("shell closed");
          runtimeMap.delete(kernelName);
          return false;
        }
        const oldInfo = runtimeMap.get(kernelName);
        runtimeMap.set(kernelName, {
          ...oldInfo,
          status: "refreshing",
        });
        console.log("requestKernelStatus", repoId);
        wire.requestKernelStatus();
        return true;
      }
    }),
  interrupt: protectedProcedure
    .input(z.object({ repoId: z.string(), kernelName: z.string() }))
    .mutation(async ({ input: { repoId, kernelName } }) => {
      if (myenv.READ_ONLY) throw Error("Read only mode");
      console.log("interrupt", repoId);
      const wire = repoId2wireMap.get(repoId)?.get(kernelName);
      if (!wire) return false;
      wire.interrupt();
      return true;
    }),

  runChain: protectedProcedure
    .input(
      z.object({
        repoId: z.string(),
        specs: z.array(
          z.object({
            code: z.string(),
            podId: z.string(),
            kernelName: z.string(),
          })
        ),
      })
    )
    .mutation(async ({ input: { repoId, specs }, ctx: { token } }) => {
      console.log("runChain", repoId);
      if (myenv.READ_ONLY) throw Error("Read only mode");
      const wireMap = repoId2wireMap.get(repoId);
      if (!wireMap) {
        console.error("wireMap not found for repo", repoId);
        return false;
      }

      specs.forEach(({ code, podId, kernelName }) => {
        const wire = wireMap.get(kernelName);
        if (!wire) {
          console.error("Wire not found for kernel", kernelName);
          return false;
        }
        wire.runCode({ code, msg_id: podId });
      });
      return true;
    }),
});

export async function getYDoc({ repoId, token }): Promise<Y.Doc> {
  return new Promise((resolve, reject) => {
    const ydoc = new Y.Doc();
    // connect to primary database
    console.log("connecting to y-websocket provider", myenv.YJS_WS_URL);
    const provider = new WebsocketProvider(myenv.YJS_WS_URL, repoId, ydoc, {
      // resyncInterval: 2000,
      //
      // BC is more complex to track our custom Uploading status and SyncDone events.
      disableBc: true,
      params: {
        token,
      },
      // IMPORTANT: import websocket, because we're running it in node.js
      WebSocketPolyfill: WebSocket as any,
    });
    ydoc.on("destroy", () => {
      console.log("Yjs doc destroyed. Destroying WS provider ..");
      provider.destroy();
    });
    provider.on("status", ({ status }) => {
      console.log("provider status", status);
    });
    provider.once("synced", () => {
      console.log("Provider synced");
      resolve(ydoc);
    });
    provider.connect();
  });
}

/**
 * Listen on ZMQ wire, and send results to Yjs document.
 */
function bindZmqYjs({
  wire,
  ydoc,
  kernelName,
}: {
  wire: ZmqWire;
  ydoc: Y.Doc;
  kernelName: string;
}) {
  const rootMap = ydoc.getMap("rootMap");
  const runtimeMap = rootMap.get("runtimeMap") as Y.Map<RuntimeInfo>;
  const resultMap = rootMap.get("resultMap") as Y.Map<PodResult>;
  wire.listenShell((msgs) => {
    switch (msgs.header.msg_type) {
      case "execute_reply":
        {
          console.log("execute_reply");
          const podId = msgs.parent_header.msg_id;
          const oldresult = resultMap.get(podId) || { data: [] };
          oldresult.running = false;
          oldresult.lastExecutedAt = Date.now();
          oldresult.exec_count = msgs.content.execution_count;
          resultMap.set(podId, oldresult);
        }
        break;
      case "interrupt_reply":
        {
          console.log("interrupt_reply");
        }
        break;
      default: {
        console.log("Unhandled shell message", msgs.header.msg_type);
      }
    }
  });
  wire.listenIOPub((topic, msgs) => {
    switch (msgs.header.msg_type) {
      case "status": {
        const status = msgs.content.execution_state;
        console.log("status", status);
        runtimeMap.set(kernelName, { ...runtimeMap.get(kernelName), status });
        break;
      }
      case "execute_result": {
        console.log("IOPub execute_result");
        let podId = msgs.parent_header.msg_id;
        // // let count = msgs.content.execution_count;
        const oldresult = resultMap.get(podId) || { data: [] };
        const newdata = {
          type: msgs.header.msg_type,
          text: msgs.content.data["text/plain"],
          html: msgs.content.data["text/html"],
        };
        console.log("New data", newdata);
        // FIXME old results contain too much data, should be cleaned out.
        // console.log("Old", oldresult.data);
        oldresult.data.push(newdata);
        if (kernelName === "racket") {
          // racket doesn't have execute_reply message, so handle it here.
          oldresult.running = false;
          oldresult.lastExecutedAt = Date.now();
          oldresult.exec_count = msgs.content.execution_count;
        }
        resultMap.set(podId, oldresult);
        break;
      }
      // FIXME this should not exist.
      case "stdout":
        console.log("TODO stdout");
        assert(false);
        break;
      case "error": {
        console.log("error message");
        let podId = msgs.parent_header.msg_id;
        const oldresult = resultMap.get(podId) || { data: [] };
        oldresult.error = {
          ename: msgs.content.ename,
          evalue: msgs.content.evalue,
          stacktrace: msgs.content.traceback,
        };
        resultMap.set(podId, oldresult);
        break;
      }
      case "stream": {
        console.log("stream message");
        let podId = msgs.parent_header.msg_id;
        const oldresult = resultMap.get(podId) || { data: [] };
        const newdata = {
          type: "stream_" + msgs.content.name,
          text: msgs.content.text,
        };
        oldresult.data.push(newdata);
        resultMap.set(podId, oldresult);
        break;
      }
      case "display_data": {
        console.log("display_data message");
        let podId = msgs.parent_header.msg_id;
        const oldresult: PodResult = resultMap.get(podId) || { data: [] };
        oldresult.data.push({
          type: "display_data",
          text: msgs.content.data["text/plain"],
          image: msgs.content.data["image/png"],
          html: msgs.content.data["text/html"],
        });
        resultMap.set(podId, oldresult);
        break;
      }
      default:
        console.log(
          "Message Not handled",
          msgs.header.msg_type,
          "topic:",
          topic
        );
        // console.log("Message body:", msgs);
        break;
    }
  });
}
