import { z } from "zod";
import { initTRPC, TRPCError } from "@trpc/server";
import type { inferAsyncReturnType } from "@trpc/server";

import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";

import jwt from "jsonwebtoken";

import { getSession } from "@auth/express";

import { myenv } from "./vars";
import { authConfig } from "../auth";

export const createContext = async ({
  req,
  res,
}: CreateExpressContextOptions) => {
  // req.locals.session
  const session = (await getSession(req, authConfig)) ?? undefined;
  return {
    // userId,
    user: session?.user,
    userId: session?.user?.id,
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
