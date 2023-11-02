import { z } from "zod";
import { publicProcedure, router } from "./trpc";

export const spawnerRouter = router({
  spawnRuntime: publicProcedure
    .input(z.object({ runtimeId: z.string(), repoId: z.string() }))
    .mutation(async ({ input: { runtimeId, repoId } }) => {
      return true;
    }),
  killRuntime: publicProcedure
    .input(z.object({ runtimeId: z.string(), repoId: z.string() }))
    .mutation(async ({ input: { runtimeId, repoId } }) => {
      return true;
    }),

  connectRuntime: publicProcedure
    .input(z.object({ runtimeId: z.string(), repoId: z.string() }))
    .mutation(async ({ input: { runtimeId, repoId } }) => {}),
  disconnectRuntime: publicProcedure
    .input(z.object({ runtimeId: z.string(), repoId: z.string() }))
    .mutation(async ({ input: { runtimeId, repoId } }) => {}),
  runCode: publicProcedure
    .input(
      z.object({
        runtimeId: z.string(),
        spec: z.object({ code: z.string(), podId: z.string() }),
      })
    )
    .mutation(
      async ({
        input: {
          runtimeId,
          spec: { code, podId },
        },
      }) => {}
    ),
  runChain: publicProcedure
    .input(
      z.object({
        runtimeId: z.string(),
        specs: z.array(z.object({ code: z.string(), podId: z.string() })),
      })
    )
    .mutation(async ({ input: { runtimeId, specs } }) => {
      return true;
    }),
  interruptKernel: publicProcedure
    .input(z.object({ runtimeId: z.string() }))
    .mutation(async ({ input: { runtimeId } }) => {
      return true;
    }),
  requestKernelStatus: publicProcedure
    .input(z.object({ runtimeId: z.string() }))
    .mutation(async ({ input: { runtimeId } }) => {
      return true;
    }),
});
