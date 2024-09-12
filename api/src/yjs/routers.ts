import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "./trpc";
import { writeState } from "./yjs-blob";
import prisma from "../prisma";
import { myNanoId } from "./utils";
import { ensureRepoEditAccess } from "../utils";

export const appRouter = router({
  hello: publicProcedure.query(() => {
    return "world";
  }),
  createVersion: protectedProcedure
    .input(z.object({ repoId: z.string(), message: z.string().min(1) }))
    .mutation(async ({ input: { repoId, message }, ctx: { userId } }) => {
      console.log("[info] createVersion", repoId, message);
      // check permission
      await ensureRepoEditAccess({ repoId, userId });
      // Write pending yjs state to db.
      await writeState(repoId);
      // Commit a new version.
      // Make a copy of the current yDocBlob and insert into versions.
      const repo = await prisma.repo.findFirst({
        where: { id: repoId },
        include: {
          yDocBlob: true,
        },
      });
      if (!repo) {
        throw new Error("repo not found");
      }
      if (!repo.yDocBlob) {
        throw new Error("yDocBlob not found");
      }
      await prisma.versionedYDocBlob.create({
        data: {
          id: myNanoId(),
          time: new Date(),
          message: message,
          blob: repo.yDocBlob.blob,
          size: repo.yDocBlob.size,
          repo: {
            connect: { id: repoId },
          },
        },
      });
      return true;
    }),
});

export type YjsRouter = typeof appRouter;
