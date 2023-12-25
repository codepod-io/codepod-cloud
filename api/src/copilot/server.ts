import express from "express";
import http from "http";

import * as trpcExpress from "@trpc/server/adapters/express";

import cors from "cors";
import { createContext, router } from "./trpc";
import { appRouter } from "./routers";

export async function startServer({ port }) {
  console.log("starting server ..");
  const app = express();
  app.use(express.json({ limit: "20mb" }));
  // support cors
  app.use(cors());

  app.use(
    "/copilot",
    trpcExpress.createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  const http_server = http.createServer(app);

  http_server.listen({ port }, () => {
    console.log(`🚀 Server ready at http://localhost:${port}`);
  });
}
