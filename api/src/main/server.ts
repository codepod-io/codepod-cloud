import { WebSocketServer } from "ws";
import { z } from "zod";

import express from "express";
import http from "http";

import * as trpcExpress from "@trpc/server/adapters/express";
import cors from "cors";

import { ExpressAuth } from "@auth/express";

import { createContext } from "./trpc";

import { appRouter } from "./routers";
import { authConfig } from "../auth";

export async function startServer({ port }) {
  const expapp = express();
  expapp.use(express.json({ limit: "20mb" }));

  expapp.use(
    cors({
      // origin: "http://localhost:3000", // Replace with the origin of your frontend app
      origin: "*",
      credentials: true,
    })
  );

  expapp.use("/api/auth/*", ExpressAuth(authConfig));
  expapp.use(
    "/api",
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
