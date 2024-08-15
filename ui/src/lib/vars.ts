import { z } from "zod";

// Ref: https://stackoverflow.com/a/76642589
const formatZodIssue = (issue: z.ZodIssue): string => {
  const { path, message } = issue;
  const pathString = path.join(".");

  return `${pathString}: ${message}`;
};

// Format the Zod error message with only the current error
export const formatZodError = (error: z.ZodError): string | undefined => {
  const { issues } = error;

  if (issues.length) {
    const currentIssue = issues[0];

    return formatZodIssue(currentIssue);
  }
};

function wrapper() {
  try {
    const env = z
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

    return env;
  } catch (e) {
    if (e instanceof z.ZodError) {
      console.error(formatZodError(e));
    }
    throw e;
  }
}

export const env = wrapper();
