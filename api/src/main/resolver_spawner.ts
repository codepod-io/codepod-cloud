import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "./trpc";

const containerRouter = router({
  create: protectedProcedure
    .input(z.object({ repoId: z.string() }))
    .output(z.object({ containerId: z.string() }))
    .mutation(async ({ input: { repoId }, ctx: { userId } }) => {
      return { containerId: "TODO" };
    }),
  delete: protectedProcedure
    .input(z.object({ containerId: z.string() }))
    .mutation(async ({ input: { containerId }, ctx: { userId } }) => {
      return true;
    }),
});
