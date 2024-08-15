import { z } from "zod";

export const env = z
  .object({
    // only "true" and "false are allowed"
    GOOGLE_CLIENT_ID: z.string(),
    READ_ONLY: z.enum(["true", "false"]).transform((x) => x === "true"),
    BANNER: z.string(),
  })
  .parse({
    GOOGLE_CLIENT_ID: import.meta.env.DEV
      ? import.meta.env.VITE_APP_GOOGLE_CLIENT_ID
      : window.GOOGLE_CLIENT_ID,
    READ_ONLY: import.meta.env.DEV
      ? import.meta.env.VITE_APP_READ_ONLY
      : window.READ_ONLY,
    BANNER: import.meta.env.DEV
      ? import.meta.env.VITE_APP_BANNER
      : window.BANNER,
  });
