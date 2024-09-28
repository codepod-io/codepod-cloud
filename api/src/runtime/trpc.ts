import { initTRPC, TRPCError } from "@trpc/server";
import type { inferAsyncReturnType } from "@trpc/server";

import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";

import jwt from "jsonwebtoken";
import { myenv } from "./vars";
import { getSession } from "@auth/express";
import { authConfig } from "../auth";
import assert from "assert";

export const createContext = async ({
  req,
  res,
}: CreateExpressContextOptions) => {
  const session = (await getSession(req, authConfig)) ?? undefined;
  // get the token to use to construct http request to other services
  // the token is not in req.headers, but in cookies
  assert(req.headers.cookie);

  return {
    user: session?.user,
    userId: session?.user?.id,
    cookie: req.headers.cookie,
  };
};

const t = initTRPC.context<typeof createContext>().create();
export const router = t.router;
export const publicProcedure = t.procedure;

export type Context = inferAsyncReturnType<typeof createContext>;

const isAuthed = t.middleware(({ next, ctx }) => {
  if (!ctx.userId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
    });
  }
  return next({
    ctx,
  });
});

export const middleware = t.middleware;

export const protectedProcedure = t.procedure.use(isAuthed);
