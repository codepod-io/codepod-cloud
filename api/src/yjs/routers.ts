import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "./trpc";
import { writeState } from "./yjs-blob";
import prisma from "../prisma";
import { myNanoId } from "./utils";
import { ensureRepoEditAccess } from "../utils";
import { closeDocNoWrite } from "./yjs-setupWS";

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
  getPreviousVersion: protectedProcedure
    .input(z.object({ repoId: z.string() }))
    .query(async ({ input: { repoId }, ctx: { userId } }) => {
      const versions = await prisma.versionedYDocBlob.findMany({
        where: { repoId },
        orderBy: { time: "desc" },
        take: 1,
      });
      if (versions.length == 0) {
        return null;
      }
      return versions[0];
    }),
  restoreVersion: protectedProcedure
    .input(z.object({ repoId: z.string(), versionId: z.string() }))
    .mutation(async ({ input: { repoId, versionId }, ctx: { userId } }) => {
      // check permission
      await ensureRepoEditAccess({ repoId, userId });
      const version = await prisma.versionedYDocBlob.findFirst({
        where: { id: versionId },
      });
      if (!version) {
        throw new Error("version not found");
      }
      await prisma.repo.update({
        where: { id: repoId },
        data: {
          yDocBlob: {
            update: {
              blob: version.blob,
              size: version.size,
            },
          },
        },
      });
      // close existing connections
      closeDocNoWrite(repoId);
      return true;
    }),
  restoreYDoc: protectedProcedure
    .input(
      z.object({
        repoId: z.string(),
        yDocBlob: z.string(),
      })
    )
    .mutation(async ({ input: { repoId, yDocBlob }, ctx: { userId } }) => {
      // check permission
      await ensureRepoEditAccess({ repoId, userId });
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
      const decodedBlob = Buffer.from(yDocBlob, "base64");

      const size = Buffer.byteLength(yDocBlob);
      await prisma.repo.update({
        where: { id: repoId },
        data: {
          yDocBlob: {
            update: {
              blob: decodedBlob,
              size,
            },
          },
        },
      });
      // close existing connections
      closeDocNoWrite(repoId);
      return true;
    }),
});

export type YjsRouter = typeof appRouter;
