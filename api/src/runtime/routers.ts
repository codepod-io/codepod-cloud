import { protectedProcedure, publicProcedure, router } from "./trpc";

import { k8sRouter } from "./k8s";
import prisma from "../prisma";
import { z } from "zod";
import { ensureRepoReadAccess } from "../utils";

export const appRouter = router({
  hello: publicProcedure.query(() => {
    return "world";
  }),
  k8s: k8sRouter,
  getKernels: protectedProcedure
    .input(
      z.object({
        repoId: z.string(),
      })
    )
    .query(async ({ input: { repoId }, ctx: { userId } }) => {
      if (!userId) {
        throw new Error("Unauthorized");
      }
      await ensureRepoReadAccess({ userId, repoId });
      const kernels = await prisma.kernel.findMany({
        where: {
          repo: {
            id: repoId,
          },
        },
      });
      return kernels;
    }),
});

export type RuntimeRouter = typeof appRouter;
