import prisma from "./prisma";

// nanoid v4 does not work with nodejs. https://github.com/ai/nanoid/issues/365
import { customAlphabet } from "nanoid";

// https://github.com/CyberAP/nanoid-dictionary
const lowercase = "abcdefghijklmnopqrstuvwxyz";
const numbers = "0123456789";

export const myNanoId = customAlphabet(lowercase + numbers, 20);

export async function ensureRepoEditAccess({ repoId, userId }) {
  let repo = await prisma.repo.findFirst({
    where: {
      id: repoId,
      OR: [
        { owner: { id: userId } },
        { collaborators: { some: { id: userId } } },
      ],
    },
  });
  if (!repo) {
    // this might be caused by creating a pod and update it too soon before it
    // is created on server, which is a time sequence bug
    throw new Error("Repo not exists.");
  }
}

export async function ensureRepoReadAccess({ repoId, userId }) {
  let repo = await prisma.repo.findFirst({
    where: {
      id: repoId,
      OR: [
        { owner: { id: userId } },
        { collaborators: { some: { id: userId } } },
        { public: true },
      ],
    },
  });
  if (!repo) {
    // this might be caused by creating a pod and update it too soon before it
    // is created on server, which is a time sequence bug
    throw new Error("Repo not exists.");
  }
}
