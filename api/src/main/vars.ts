import { z } from "zod";

export const env = z
  .object({
    // only "true" and "false are allowed"
    READ_ONLY: z.enum(["true", "false"]).transform((x) => x === "true"),
  })
  .parse(process.env);
