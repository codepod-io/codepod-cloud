// nanoid v4 does not work with nodejs. https://github.com/ai/nanoid/issues/365
import { customAlphabet } from "nanoid/async";
import { lowercase, numbers } from "nanoid-dictionary";

import prisma from "../prisma";

import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "./trpc";
import { myenv } from "./vars";
import assert from "assert";

const nanoid = customAlphabet(lowercase + numbers, 20);

const me = protectedProcedure.query(async ({ ctx: { userId } }) => {
  if (!userId) throw Error("Unauthenticated");
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
    },
    include: {
      stars: {
        select: {
          id: true,
        },
      },
      setting: true,
    },
  });
  if (!user) throw Error("Authorization token is not valid");
  return user;
});

const updateUserSetting = protectedProcedure
  .input(
    z.object({
      debugMode: z.optional(z.boolean()),
      showLineNumbers: z.optional(z.boolean()),
    })
  )
  .mutation(async ({ ctx: { userId }, input }) => {
    if (!userId) throw Error("Unauthenticated");
    if (myenv.READ_ONLY) throw Error("Read only mode");
    let user = await prisma.user.findFirst({
      where: {
        id: userId,
      },
    });
    if (!user) throw Error("User not found.");
    assert(user.id === userId);
    // do the udpate
    await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        setting: {
          upsert: {
            create: input,
            update: input,
          },
        },
      },
    });
    return true;
  });

export const userRouter = router({
  me,
  updateUserSetting,
});
