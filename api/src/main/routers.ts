import { userRouter } from "./resolver_user";
import { repoRouter } from "./resolver_repo";
import { protectedProcedure, publicProcedure, router } from "./trpc";

export const appRouter = router({
  hello: publicProcedure.query(() => {
    return "world";
  }),
  user: userRouter,
  repo: repoRouter,
});

// You can then access the merged route with
// http://localhost:3000/trpc/<NAMESPACE>.<PROCEDURE>

export type AppRouter = typeof appRouter;
