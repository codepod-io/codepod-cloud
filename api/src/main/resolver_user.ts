import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";

// nanoid v4 does not work with nodejs. https://github.com/ai/nanoid/issues/365
import { customAlphabet } from "nanoid/async";
import { lowercase, numbers } from "nanoid-dictionary";

import prisma from "../prisma";

import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "./trpc";
import { env } from "./vars";

const nanoid = customAlphabet(lowercase + numbers, 20);

const jwtSecret = z.string().parse(process.env.JWT_SECRET);

// FIXME even if this is undefined, the token verification still works. Looks
// like I only need to set client ID in the frontend?
const googleClientId = z.string().parse(process.env.GOOGLE_CLIENT_ID);

const me = protectedProcedure.query(async ({ ctx: { userId } }) => {
  if (!userId) throw Error("Unauthenticated");
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
    },
    select: {
      id: true,
      email: true,
      firstname: true,
      lastname: true,
      stars: {
        select: {
          id: true,
        },
      },
    },
  });
  if (!user) throw Error("Authorization token is not valid");
  return user;
});

const signup = publicProcedure
  .input(
    z.object({
      email: z.string().email(),
      password: z.string().min(1),
      firstname: z.string().min(1),
      lastname: z.string().min(1),
    })
  )
  .mutation(async ({ input: { email, password, firstname, lastname } }) => {
    if (env.READ_ONLY) throw Error("Read only mode");
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);
    // if user already exists, return error
    const userExists = await prisma.user.findFirst({
      where: {
        email,
      },
    });
    if (userExists) {
      throw Error(`User with email ${email} already exists.`);
    }
    const user = await prisma.user.create({
      data: {
        id: await nanoid(),
        email,
        firstname,
        lastname,
        hashedPassword: hashed,
      },
    });
    return {
      token: jwt.sign({ id: user.id }, jwtSecret, {
        expiresIn: "30d",
      }),
    };
  });

const updateUser = protectedProcedure
  .input(
    z.object({
      email: z.string().email(),
      firstname: z.string().min(1),
      lastname: z.string().min(1),
    })
  )
  .mutation(
    async ({ ctx: { userId }, input: { email, firstname, lastname } }) => {
      if (!userId) throw Error("Unauthenticated");
      if (env.READ_ONLY) throw Error("Read only mode");
      let user = await prisma.user.findFirst({
        where: {
          id: userId,
        },
      });
      if (!user) throw Error("User not found.");
      if (user.id !== userId) {
        throw new Error("You do not have access to the user.");
      }
      // do the udpate
      await prisma.user.update({
        where: {
          id: userId,
        },
        data: {
          firstname,
          lastname,
          email,
        },
      });
      return true;
    }
  );

const login = publicProcedure
  .input(z.object({ email: z.string().email(), password: z.string().min(1) }))
  .mutation(async ({ input: { email, password } }) => {
    // FIXME findUnique seems broken https://github.com/prisma/prisma/issues/5071
    const user = await prisma.user.findFirst({
      where: {
        email,
      },
    });
    if (!user) throw Error(`User does not exist`);
    if (!user.hashedPassword) throw Error(`User does not have a password`);
    const match = await bcrypt.compare(password, user.hashedPassword!);
    if (!match) {
      throw Error(`Email and password do not match.`);
    } else {
      return {
        id: user.id,
        email: user.email,
        token: jwt.sign({ id: user.id }, jwtSecret, {
          expiresIn: "30d",
        }),
      };
    }
  });

const client = new OAuth2Client(googleClientId);

const loginWithGoogle = publicProcedure
  .input(z.object({ idToken: z.string() }))
  .mutation(async ({ input: { idToken } }) => {
    console.log("login with google");
    const ticket = await client.verifyIdToken({
      idToken: idToken,
      audience: googleClientId, // Specify the CLIENT_ID of the app that accesses the backend
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
          id: await nanoid(),
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
      token: jwt.sign({ id: user.id }, jwtSecret, {
        expiresIn: "30d",
      }),
    };
  });

export const userRouter = router({
  me,
  login,
  loginWithGoogle,
  signup,
  updateUser,
});
