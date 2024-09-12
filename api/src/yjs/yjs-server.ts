import { WebSocketServer } from "ws";

import express from "express";
import http from "http";
import cors from "cors";

import * as trpcExpress from "@trpc/server/adapters/express";

import jwt from "jsonwebtoken";

import { setupWSConnection } from "./yjs-setupWS";

import prisma from "../prisma";
import { myenv } from "./vars";
import { createContext } from "./trpc";
import { appRouter } from "./routers";
interface TokenInterface {
  id: string;
}

/**
 * Check if user has permission to access document.
 * @param param0
 * @returns
 */
async function checkPermission({
  repoId,
  userId,
}: {
  repoId: string;
  userId?: string;
}): Promise<"read" | "write" | "none"> {
  // Query the DB for the pod
  const repo = await prisma.repo.findFirst({
    where: {
      id: repoId,
    },
    include: {
      collaborators: true,
      owner: true,
    },
  });
  if (!repo) return "none";
  if (
    repo.owner.id === userId ||
    repo.collaborators.find((collab) => collab.id === userId)
  ) {
    if (myenv.READ_ONLY) {
      return "read";
    } else {
      return "write";
    }
  }
  if (repo.public) {
    return "read";
  }
  return "none";
}

export async function startWsServer({ port }) {
  const expapp = express();
  expapp.use(express.json({ limit: "20mb" }));
  const http_server = http.createServer(expapp);
  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", setupWSConnection);

  expapp.use(cors());

  expapp.use(
    "/yjs",
    trpcExpress.createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  http_server.on("upgrade", async (request, socket, head) => {
    console.log("new WS connection");
    // You may check auth of request here..
    // See https://github.com/websockets/ws#client-authentication
    function deny() {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
    }
    if (!request.url) {
      console.log("No request url.");
      deny();
      return;
    }
    const url = new URL(`ws://${request.headers.host}${request.url}`);
    // request.url: /yjs/idt3wbfcob3qbchpqovl?
    // console.log("--- request.url", request.url);
    const docName = request.url.slice(1).split("?")[0];
    // docName: yjs/idt3wbfcob3qbchpqovl
    // console.log("--- docname", docName);
    const token = url.searchParams.get("token");
    const repoId = docName.split("/")[1];

    let userId: string | undefined;
    if (token) {
      const decoded = jwt.verify(token, myenv.JWT_SECRET) as TokenInterface;
      userId = decoded.id;
    }

    const permission = await checkPermission({ repoId, userId });
    switch (permission) {
      case "read":
        // TODO I should disable editing in the frontend as well.
        wss.handleUpgrade(request, socket, head, function done(ws) {
          wss.emit("connection", ws, request, { readOnly: true, repoId });
        });
        break;
      case "write":
        wss.handleUpgrade(request, socket, head, function done(ws) {
          wss.emit("connection", ws, request, { readOnly: false, repoId });
        });
        break;
      case "none":
        // This should not happen. This should be blocked by frontend code.
        deny();
        return;
    }
  });

  http_server.listen({ port }, () => {
    console.log(`🚀 Server ready at http://localhost:${port}`);
  });
}
