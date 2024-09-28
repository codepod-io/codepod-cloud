import { ExpressAuth, ExpressAuthConfig, getSession } from "@auth/express";
import Google from "@auth/express/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";

import { z } from "zod";

import prisma from "./prisma";

export const myenv = z
  .object({
    JWT_SECRET: z.string(),
    GOOGLE_CLIENT_ID: z.string(),
    GOOGLE_CLIENT_SECRET: z.string(),
  })
  .parse(process.env);

export const authConfig: ExpressAuthConfig = {
  trustHost: true,
  providers: [
    Google({
      allowDangerousEmailAccountLinking: true,
      clientId: myenv.GOOGLE_CLIENT_ID,
      clientSecret: myenv.GOOGLE_CLIENT_SECRET,
    }),
  ],
  secret: myenv.JWT_SECRET,
  pages: {
    // signIn: "/login",
    // signOut: "/signout",
  },
  adapter: PrismaAdapter(prisma),

  // By default, the `id` property does not exist on `token` or `session`.
  // Ref: https://authjs.dev/guides/extending-the-session
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        // User is available during sign-in
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      // FIXME type error
      // Even without this, the session.user.id is set.
      // session.user.id = token.id as string;
      // console.log("token", token);
      // console.log("111", session);
      return session;
    },
  },
};
