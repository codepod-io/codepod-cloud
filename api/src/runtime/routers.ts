import * as Y from "yjs";
import WebSocket from "ws";
import { z } from "zod";

// import { WebsocketProvider } from "../../ui/src/lib/y-websocket";
import { WebsocketProvider } from "@codepod/yjs/src/y-websocket";

import { killRuntime, spawnRuntime } from "./spawner_native";

import { connectSocket, runtime2socket, RuntimeInfo } from "./yjs_runtime";
import { protectedProcedure, publicProcedure, router } from "./trpc";

// FIXME need to have a TTL to clear the ydoc.
const docs: Map<string, Y.Doc> = new Map();

async function getMyYDoc({ repoId, yjsServerUrl, token }): Promise<Y.Doc> {
  return new Promise((resolve, reject) => {
    const oldydoc = docs.get(repoId);
    if (oldydoc) {
      resolve(oldydoc);
      return;
    }
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
    provider.on("status", ({ status }) => {
      console.log("provider status", status);
    });
    provider.once("synced", () => {
      console.log("Provider synced");
      docs.set(repoId, ydoc);
      resolve(ydoc);
    });
    provider.connect();
  });
}

const routingTable: Map<string, string> = new Map();

const yjsServerUrl = z.string().parse(process.env.YJS_WS_URL);

export const appRouter = router({
  hello: publicProcedure.query(() => {
    return "world";
  }),
  kernel: router({
    create: protectedProcedure
      .input(z.object({ runtimeId: z.string(), repoId: z.string() }))
      .mutation(async ({ input: { runtimeId, repoId }, ctx: { token } }) => {
        console.log("spawnRuntime", runtimeId, repoId);
        // create the runtime container
        const wsUrl = await spawnRuntime(runtimeId);
        console.log("Runtime spawned at", wsUrl);
        routingTable.set(runtimeId, wsUrl);
        // set initial runtimeMap info for this runtime
        console.log("Loading yDoc ..");
        const doc = await getMyYDoc({ repoId, yjsServerUrl, token });
        console.log("yDoc loaded");
        const rootMap = doc.getMap("rootMap");
        const runtimeMap = rootMap.get("runtimeMap") as Y.Map<RuntimeInfo>;
        runtimeMap.set(runtimeId, {});
        //   console.log("=== runtimeMap", runtimeMap);
        let values = Array.from(runtimeMap.values());
        const keys = Array.from(runtimeMap.keys());
        console.log("all runtimes", keys);
        const nodesMap = rootMap.get("nodesMap") as Y.Map<any>;
        const nodes = Array.from(nodesMap.values());
        console.log("all nodes", nodes);
        return true;
      }),
    delete: protectedProcedure
      .input(z.object({ runtimeId: z.string(), repoId: z.string() }))
      .mutation(async ({ input: { runtimeId, repoId }, ctx: { token } }) => {
        await killRuntime(runtimeId);
        console.log("Removing route ..");
        // remove from runtimeMap
        const doc = await getMyYDoc({ repoId, yjsServerUrl, token });
        const rootMap = doc.getMap("rootMap");
        const runtimeMap = rootMap.get("runtimeMap") as Y.Map<RuntimeInfo>;
        runtimeMap.delete(runtimeId);
        routingTable.delete(runtimeId);
        return true;
      }),

    connect: protectedProcedure
      .input(z.object({ runtimeId: z.string(), repoId: z.string() }))
      .mutation(async ({ input: { runtimeId, repoId }, ctx: { token } }) => {
        console.log("=== connectRuntime", runtimeId, repoId);
        // assuming doc is already loaded.
        // FIXME this socket/ is the prefix of url. This is very prone to errors.
        const doc = await getMyYDoc({ repoId, yjsServerUrl, token });
        const rootMap = doc.getMap("rootMap");
        console.log("rootMap", Array.from(rootMap.keys()));
        const runtimeMap = rootMap.get("runtimeMap") as any;
        const resultMap = rootMap.get("resultMap") as any;
        await connectSocket({
          runtimeId,
          runtimeMap,
          resultMap,
          routingTable,
        });
      }),
    disconnect: protectedProcedure
      .input(z.object({ runtimeId: z.string(), repoId: z.string() }))
      .mutation(async ({ input: { runtimeId, repoId }, ctx: { token } }) => {
        console.log("=== disconnectRuntime", runtimeId);
        // get socket
        const socket = runtime2socket.get(runtimeId);
        if (socket) {
          socket.close();
          runtime2socket.delete(runtimeId);
        }

        const doc = await getMyYDoc({ repoId, yjsServerUrl, token });
        const rootMap = doc.getMap("rootMap");
        const runtimeMap = rootMap.get("runtimeMap") as Y.Map<RuntimeInfo>;
        runtimeMap.set(runtimeId, {});
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
          const socket = runtime2socket.get(runtimeId);
          if (!socket) return false;
          // clear old results
          // TODO move this to frontend, because it is hard to get ydoc in GraphQL handler.
          //
          // console.log("clear old result");
          // console.log("old", resultMap.get(runtimeId));
          // resultMap.set(podId, { data: [] });
          // console.log("new", resultMap.get(runtimeId));
          // console.log("send new result");
          socket.send(
            JSON.stringify({
              type: "runCode",
              payload: {
                lang: "python",
                code: code,
                raw: true,
                podId: podId,
                sessionId: runtimeId,
              },
            })
          );
          return true;
        }
      ),
    runChain: protectedProcedure
      .input(
        z.object({
          runtimeId: z.string(),
          specs: z.array(z.object({ code: z.string(), podId: z.string() })),
        })
      )
      .mutation(async ({ input: { runtimeId, specs } }) => {
        console.log("runChain", runtimeId);
        const socket = runtime2socket.get(runtimeId);
        if (!socket) return false;
        specs.forEach(({ code, podId }) => {
          socket.send(
            JSON.stringify({
              type: "runCode",
              payload: {
                lang: "python",
                code: code,
                raw: true,
                podId: podId,
                sessionId: runtimeId,
              },
            })
          );
        });
        return true;
      }),
    interrupt: protectedProcedure
      .input(z.object({ runtimeId: z.string() }))
      .mutation(async ({ input: { runtimeId } }) => {
        const socket = runtime2socket.get(runtimeId);
        if (!socket) return false;
        socket.send(
          JSON.stringify({
            type: "interruptKernel",
            payload: {
              sessionId: runtimeId,
            },
          })
        );
        return true;
      }),
    status: protectedProcedure
      .input(z.object({ runtimeId: z.string() }))
      .mutation(async ({ input: { runtimeId } }) => {
        console.log("requestKernelStatus", runtimeId);
        const socket = runtime2socket.get(runtimeId);
        if (!socket) {
          console.log("WARN: socket not found");
          return false;
        }
        socket.send(
          JSON.stringify({
            type: "requestKernelStatus",
            payload: {
              sessionId: runtimeId,
            },
          })
        );
        return true;
      }),
  }),
});

export type RuntimeRouter = typeof appRouter;
