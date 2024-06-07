import * as k8s from "@kubernetes/client-node";

import { z } from "zod";

import { protectedProcedure, router } from "./trpc";
import { ZmqWire2 } from "./k8s-zmq";

import * as Y from "yjs";
import WebSocket from "ws";

import { WebsocketProvider } from "@codepod/yjs/src/y-websocket";
import { doc } from "lib0/dom";

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
const k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api);

export function getDeploymentSpec(name) {
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
          containers: [
            {
              name: `${name}-kernel`,
              // image: process.env.ZMQ_KERNEL_IMAGE,
              image: "lihebi/codepod-kernel-python:0.4.13-alpha.49",
              ports: [
                // These are pre-defined in kernel/conn.json
                { containerPort: 55692 },
                { containerPort: 55693 },
                { containerPort: 55694 },
                { containerPort: 55695 },
                { containerPort: 55696 },
              ],
            },
            // {
            //   name: `${name}-ws`,
            //   // image: process.env.WS_RUNTIME_IMAGE,
            //   image: "lihebi/codepod-runtime:0.4.13-alpha.49",
            //   // The out-facing port for proxy to talk to.
            //   ports: [{ containerPort: 4020 }],
            //   // It will talk to the above kernel container.
            //   env: [
            //     {
            //       name: "ZMQ_HOST",
            //       // value: `${name}-kernel`
            //       //
            //       // In k8s, the sidecar container doesn't get a IP/hostname.
            //       // Instead, I have to bind the port and use localhost for them
            //       // to connect.
            //       value: "localhost",
            //     },
            //   ],
            // },
          ],
        },
      },
    },
  };
}

export function getServiceSpec(name) {
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

import net from "net";
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

const repoId2wire = new Map<string, ZmqWire2>();
const repoId2ydoc = new Map<string, Y.Doc>();

export const k8sRouter = router({
  // Start the runtime containr for a repo if not already started.
  start: protectedProcedure
    .input(z.object({ repoId: z.string() }))
    .mutation(async ({ input: { repoId }, ctx: { token } }) => {
      console.log("create container for repo", repoId);
      if (repoId2wire.has(repoId)) {
        console.error("Container already exists for repo", repoId);
        return false;
      }
      if (repoId2ydoc.has(repoId)) {
        console.error("YDoc already exists for repo", repoId);
        return false;
      }
      // set the runtime status to "starting"
      const ydoc = await getYDoc({ repoId, token });
      const runtimeMap = ydoc.getMap("rootMap").get("runtimeMap") as any;
      runtimeMap.set("python", { status: "starting" });

      // call k8s api to create a container
      let ns = z.string().parse(process.env.RUNTIME_NS);
      console.log("Using k8s ns:", ns);

      let deploy_spec = getDeploymentSpec(repoId);
      let service_spec = getServiceSpec(repoId);

      console.log("deployment:", deploy_spec);
      console.log("service", service_spec);

      await createDeployment(ns, deploy_spec);
      console.log("Creating service ..");
      await createService(ns, service_spec);

      // wait for zmq service to be ready
      // 1. get the ZMQ url: ws://svc-repoId.{ns}:...
      const url = `svc-${repoId}.${z.string().parse(process.env.RUNTIME_NS)}`;
      await wairForServiceReady(url);
      // 2. connect ZMQ socket
      // FIXME do I need to close the ZMQ sockets?
      console.log("creating zmq wire");
      const wire = new ZmqWire2(url);

      console.log("binding zmq and yjs");
      bindZmqYjs(wire, ydoc);

      // 3. run some code to test
      console.log("requesting kernel status");
      wire.requestKernelStatus();
      wire.runCode({ code: "3+4", msg_id: "123" });
      repoId2wire.set(repoId, wire);
      repoId2ydoc.set(repoId, ydoc);

      return true;
    }),
  // Stop the runtime container for a repo.
  stop: protectedProcedure
    .input(z.object({ repoId: z.string() }))
    .mutation(async ({ input: { repoId }, ctx: { token } }) => {
      let ns = z.string().parse(process.env.RUNTIME_NS);
      let deploy_spec = getDeploymentSpec(repoId);
      let service_spec = getServiceSpec(repoId);
      // FIXME the container is deleted. But the status is not reset. There are
      // something wrong with yjs server handling runtime role.
      console.log("Deleting deployment ..");
      await k8sAppsApi.deleteNamespacedDeployment(
        deploy_spec.metadata.name,
        ns
      );
      console.log("Deleting service ..");
      await k8sApi.deleteNamespacedService(service_spec.metadata.name, ns);

      // remove zmq wire and ydoc
      console.log("deleting ZMQ wire ..");
      const wire = repoId2wire.get(repoId);
      wire?.shell.close();
      wire?.control.close();
      wire?.iopub.close();
      repoId2wire.delete(repoId);
      console.log("deleting ydoc ..");
      const ydoc = repoId2ydoc.get(repoId);
      // ydoc?.provider?.disconnect();
      ydoc?.destroy();
      repoId2ydoc.delete(repoId);
    }),

  status: protectedProcedure
    .input(z.object({ repoId: z.string() }))
    .mutation(async ({ input: { repoId } }) => {
      console.log("requestKernelStatus", repoId);
      const wire = repoId2wire.get(repoId);
      if (!wire) return false;
      wire.requestKernelStatus();
      return true;
    }),
  interrupt: protectedProcedure
    .input(z.object({ repoId: z.string() }))
    .mutation(async ({ input: { repoId } }) => {
      const wire = repoId2wire.get(repoId);
      if (!wire) return false;
      wire.interrupt();
      return true;
    }),

  run: protectedProcedure
    .input(
      z.object({
        runtimeId: z.string(),
        spec: z.object({ code: z.string(), podId: z.string() }),
      })
    )
    .mutation(
      async ({
        input: {
          runtimeId,
          spec: { code, podId },
        },
      }) => {
        console.log("runCode", runtimeId, podId);
        const wire = repoId2wire.get(runtimeId);
        if (!wire) return false;
        wire.runCode({ code, msg_id: podId });
        return true;
      }
    ),
  runChain: protectedProcedure
    .input(
      z.object({
        repoId: z.string(),
        specs: z.array(z.object({ code: z.string(), podId: z.string() })),
      })
    )
    .mutation(async ({ input: { repoId, specs }, ctx: { token } }) => {
      console.log("runChain", repoId);
      const wire = repoId2wire.get(repoId);
      if (!wire) return false;
      specs.forEach(({ code, podId }) => {
        wire.runCode({ code, msg_id: podId });
      });
      return true;
    }),
});

const yjsServerUrl = z.string().parse(process.env.YJS_WS_URL);
// const yjsServerUrl = "ws://codepod-yjs-service:4233/yjs";

export async function getYDoc({ repoId, token }): Promise<Y.Doc> {
  return new Promise((resolve, reject) => {
    const ydoc = new Y.Doc();
    // connect to primary database
    console.log("connecting to y-websocket provider", yjsServerUrl);
    const provider = new WebsocketProvider(yjsServerUrl, repoId, ydoc, {
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
function bindZmqYjs(wire, ydoc) {
  const rootMap = ydoc.getMap("rootMap");
  const runtimeMap = rootMap.get("runtimeMap") as any;
  const resultMap = rootMap.get("resultMap") as any;
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
      case "status":
        const status = msgs.content.execution_state;
        console.log("status for", status);
        runtimeMap.set("python", { status });
        break;
      case "execute_result":
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
        resultMap.set(podId, oldresult);
        break;
      case "stdout":
        break;
      case "error":
        break;
      case "stream":
        break;
      case "display_data":
        break;
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
