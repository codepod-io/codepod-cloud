import { initTRPC, TRPCError } from "@trpc/server";
import type { inferAsyncReturnType } from "@trpc/server";

import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";

export const createContext = async ({
  req,
  res,
}: CreateExpressContextOptions) => {
  const token = req?.headers?.authorization?.slice(7);

  return {
    token,
  };
};

const t = initTRPC.context<typeof createContext>().create();
export const router = t.router;
export const publicProcedure = t.procedure;

export type Context = inferAsyncReturnType<typeof createContext>;

const isAuthed = t.middleware(({ next, ctx }) => {
  if (!ctx.token) {
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
