import { z } from "zod";

export const myenv = z
  .object({
    // only "true" and "false are allowed"
    READ_ONLY: z.enum(["true", "false"]).transform((x) => x === "true"),
    JWT_SECRET: z.string(),
  })
  .parse(process.env);
