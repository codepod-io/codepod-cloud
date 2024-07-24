import * as k8s from "@kubernetes/client-node";

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

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
const k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api);

export function getDeploymentSpec(
  name: string,
  image: string
): k8s.V1Deployment {
  return {
    apiVersion: "apps/v1",
    kind: "Deployment",
    metadata: {
      name: `rt-${name}`,
    },
    spec: {
      replicas: 1,
      selector: {
        matchLabels: { app: `${name}` },
      },
      template: {
        metadata: { labels: { app: `${name}` } },
        spec: {
          // only schedule to runtime nodes
          nodeSelector: {
            runtime: "true",
          },
          // can tolerate runtime nodes taint
          tolerations: [
            {
              key: "runtime",
              operator: "Equal",
              value: "true",
              effect: "NoSchedule",
            },
          ],
          containers: [
            {
              name: `${name}-kernel`,
              image,
              ports: [
                // These are pre-defined in kernel/conn.json
                { containerPort: 55692 },
                { containerPort: 55693 },
                { containerPort: 55694 },
                { containerPort: 55695 },
                { containerPort: 55696 },
              ],
            },
          ],
        },
      },
    },
  };
}

export function getServiceSpec(name: string): k8s.V1Service {
  return {
    apiVersion: "v1",
    kind: "Service",
    metadata: {
      name: `svc-${name}`,
    },
    spec: {
      selector: {
        app: `${name}`,
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

const repoId2ydoc = new Map<string, Y.Doc>();
const repoId2wireMap = new Map<string, Map<string, ZmqWire>>();

async function createKernel({
  repoId,
  kernelName,
  image,
  ns,
}: {
  kernelName: string;
  ns: string;
  image: string;
  repoId: string;
}) {
  // python kernel
  console.log(`creating ${kernelName} kernel ..`);
  const containerName = `${repoId}-${kernelName}`;
  let deploy_spec = getDeploymentSpec(containerName, image);
  let service_spec = getServiceSpec(containerName);

  await createDeployment(ns, deploy_spec);
  await createService(ns, service_spec);

  // wait for zmq service to be ready
  // 1. get the ZMQ url: ws://svc-repoId.{ns}:...
  const url = `svc-${containerName}.${ns}`;
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

const env = z
  .object({
    KERNEL_IMAGE_PYTHON: z.string(),
    KERNEL_IMAGE_JULIA: z.string(),
    KERNEL_IMAGE_JAVASCRIPT: z.string(),
    KERNEL_IMAGE_RACKET: z.string(),
    RUNTIME_NS: z.string(),
    YJS_WS_URL: z.string(),
  })
  .parse(process.env);

export const k8sRouter = router({
  // Start the runtime containr for a repo if not already started.
  start: protectedProcedure
    .input(
      z.object({
        repoId: z.string(),
        kernelName: z.enum(["python", "julia", "javascript", "racket"]),
      })
    )
    .mutation(async ({ input: { repoId, kernelName }, ctx: { token } }) => {
      console.log(`create ${kernelName} kernel ===== for repo ${repoId} ..`);
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
      const runtimeMap = ydoc.getMap("rootMap").get("runtimeMap") as any;
      console.log("setting runtime status to starting");
      runtimeMap.set(kernelName, { status: "starting" });

      // call k8s api to create a container
      console.log("Using k8s ns:", env.RUNTIME_NS);

      // python kernel
      const wire = await createKernel({
        repoId,
        kernelName,
        image: match(kernelName)
          .with("python", () => env.KERNEL_IMAGE_PYTHON)
          .with("julia", () => env.KERNEL_IMAGE_JULIA)
          .with("javascript", () => env.KERNEL_IMAGE_JAVASCRIPT)
          .with("racket", () => env.KERNEL_IMAGE_RACKET)
          .exhaustive(),
        ns: env.RUNTIME_NS,
      });

      console.log("binding zmq and yjs");
      bindZmqYjs({ wire, ydoc, kernelName });

      // 3. run some code to test
      console.log("requesting kernel status");
      wire.requestKernelStatus();
      wire.runCode({ code: "3+4", msg_id: "123" });
      wireMap.set(kernelName, wire);
      return true;
    }),
  // Stop the runtime container for a repo.
  stop: protectedProcedure
    .input(
      z.object({
        repoId: z.string(),
        kernelName: z.enum(["python", "julia", "javascript", "racket"]),
      })
    )
    .mutation(async ({ input: { repoId, kernelName }, ctx: { token } }) => {
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
      const runtimeMap = ydoc.getMap("rootMap").get("runtimeMap") as any;
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
      //
      // FIXME the container is deleted. But the status is not reset. There are
      // something wrong with yjs server handling runtime role.
      console.log("Deleting deployment");
      await k8sAppsApi.deleteNamespacedDeployment(
        `rt-${repoId}-${kernelName}`,
        env.RUNTIME_NS
      );
      console.log("Deleting service");
      await k8sApi.deleteNamespacedService(
        `svc-${repoId}-${kernelName}`,
        env.RUNTIME_NS
      );
    }),

  status: protectedProcedure
    .input(z.object({ repoId: z.string(), kernelName: z.string() }))
    .mutation(async ({ input: { repoId, kernelName }, ctx: { token } }) => {
      const ydoc = await ensureYDoc({ repoId, token });
      const runtimeMap = ydoc?.getMap("rootMap").get("runtimeMap") as any;
      const wireMap = repoId2wireMap.get(repoId);
      const wire = wireMap?.get(kernelName);
      if (!wire) {
        runtimeMap.delete(kernelName);
        return false;
      } else {
        runtimeMap.set(kernelName, { status: "refreshing" });
        console.log("requestKernelStatus", repoId);
        wire.requestKernelStatus();
        return true;
      }
    }),
  interrupt: protectedProcedure
    .input(z.object({ repoId: z.string(), kernelName: z.string() }))
    .mutation(async ({ input: { repoId, kernelName } }) => {
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
    console.log("connecting to y-websocket provider", env.YJS_WS_URL);
    const provider = new WebsocketProvider(env.YJS_WS_URL, repoId, ydoc, {
      // resyncInterval: 2000,
      //
      // BC is more complex to track our custom Uploading status and SyncDone events.
      disableBc: true,
      params: {
        role: "runtime",
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
        runtimeMap.set(kernelName, { status });
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
