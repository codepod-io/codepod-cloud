import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";

import prisma from "../prisma";

import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "./trpc";
import { myenv } from "./vars";
import assert from "assert";
import { myNanoId } from "../utils";

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

// FIXME even if this is undefined, the token verification still works. Looks
// like I only need to set client ID in the frontend?
const client = new OAuth2Client(myenv.GOOGLE_CLIENT_ID);

const loginWithGoogle = publicProcedure
  .input(z.object({ idToken: z.string() }))
  .mutation(async ({ input: { idToken } }) => {
    console.log("login with google");
    const ticket = await client.verifyIdToken({
      idToken: idToken,
      audience: myenv.GOOGLE_CLIENT_ID, // Specify the CLIENT_ID of the app that accesses the backend
      // Or, if multiple clients access the backend:
      //[CLIENT_ID_1, CLIENT_ID_2, CLIENT_ID_3]
    });
    const payload = ticket.getPayload();
    if (!payload) throw Error(`Invalid token`);
    // check if registered
    let user = await prisma.user.findFirst({
      where: {
        email: payload["email"]!,
      },
    });
    if (!user) {
      // create a new user
      user = await prisma.user.create({
        data: {
          id: myNanoId(),
          email: payload["email"]!,
          firstname: payload["given_name"]!,
          lastname: payload["family_name"]!,
        },
      });
    }
    if (!user) throw Error("User create failed.");
    // return a token
    return {
      id: user.id,
      email: user.email,
      token: jwt.sign({ id: user.id }, myenv.JWT_SECRET, {
        expiresIn: "30d",
      }),
    };
  });

export const userRouter = router({
  me,
  loginWithGoogle,
  updateUserSetting,
});
