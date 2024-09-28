import { z } from "zod";

export const myenv = z
  .object({
    // only "true" and "false are allowed"
    READ_ONLY: z.enum(["true", "false"]).transform((x) => x === "true"),
    JWT_SECRET: z.string(),
    GOOGLE_CLIENT_ID: z.string(),
    GOOGLE_CLIENT_SECRET: z.string(),
    AWS_ACCESS_KEY_ID: z.string(),
    AWS_SECRET_ACCESS_KEY: z.string(),
    AWS_REGION: z.string(),
    S3_BUCKET: z.string(),
  })
  .parse(process.env);
