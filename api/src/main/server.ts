import { WebSocketServer } from "ws";

import express from "express";
import http from "http";

import * as trpcExpress from "@trpc/server/adapters/express";
import cors from "cors";

import { createContext } from "./trpc";

import { appRouter } from "./routers";

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET env variable is not set.");
}
// FIXME even if this is undefined, the token verification still works. Looks
// like I only need to set client ID in the frontend?
if (!process.env.GOOGLE_CLIENT_ID) {
  console.log("WARNING: GOOGLE_CLIENT_ID env variable is not set.");
}

export async function startServer({ port }) {
  const expapp = express();
  expapp.use(express.json({ limit: "20mb" }));

  expapp.use(
    cors({
      origin: "http://localhost:3000", // Replace with the origin of your frontend app
      credentials: true,
    })
  );

  expapp.use(
    "/trpc",
    trpcExpress.createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  const http_server = http.createServer(expapp);
  const wss = new WebSocketServer({ server: http_server });

  http_server.listen({ port }, () => {
    console.log(`🚀 Server ready at http://localhost:${port}`);
  });
}
