import { z } from "zod";

export const env = z
  .object({
    // only "true" and "false are allowed"
    READ_ONLY: z.enum(["true", "false"]).transform((x) => x === "true"),
    AWS_ACCESS_KEY_ID: z.string(),
    AWS_SECRET_ACCESS_KEY: z.string(),
    AWS_REGION: z.string(),
    S3_BUCKET: z.string(),
  })
  .parse(process.env);
