import { protectedProcedure, publicProcedure, router } from "./trpc";

import { k8sRouter } from "./k8s";

export const appRouter = router({
  hello: publicProcedure.query(() => {
    return "world";
  }),
  k8s: k8sRouter,
});

export type RuntimeRouter = typeof appRouter;
