import { initTRPC, TRPCError } from "@trpc/server";
import type { inferAsyncReturnType } from "@trpc/server";

import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";

import jwt from "jsonwebtoken";

export const createContext = async ({
  req,
  res,
}: CreateExpressContextOptions) => {
  const token = req?.headers?.authorization?.slice(7);
  let userId;

  if (token) {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
      id: string;
    };
    userId = decoded.id;
  }
  return {
    userId,
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
