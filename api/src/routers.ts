import { userRouter } from "./resolver_user";
import { repoRouter } from "./resolver_repo";
import { router } from "./trpc";
import { spawnerRouter } from "./resolver_spawner";

export const appRouter = router({
  user: userRouter,
  repo: repoRouter,
  spawner: spawnerRouter,
});

// You can then access the merged route with
// http://localhost:3000/trpc/<NAMESPACE>.<PROCEDURE>

export type AppRouter = typeof appRouter;
