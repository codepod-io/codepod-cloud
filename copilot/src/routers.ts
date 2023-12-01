import { z } from "zod";
import http from "http";

import { protectedProcedure, publicProcedure, router } from "./trpc";

require("dotenv").config();

const copilotIpAddress = process.env.LLAMA_CPP_SERVER;
const copilotPort = process.env.LLAMA_CPP_PORT;

export const appRouter = router({
  hello: protectedProcedure.query(() => {
    return "world";
  }),
  copilot: router({
    complete: protectedProcedure
      .input(
        z.object({
          inputPrefix: z.string(),
          inputSuffix: z.string(),
          podId: z.string(),
        })
      )
      .mutation(async ({ input: { inputPrefix, inputSuffix, podId } }) => {
        console.log(
          `======= codeAutoComplete of pod ${podId} ========\n`,
          inputPrefix,
          inputSuffix
        );
        let data = "";
        let options = {};
        if (inputSuffix.length == 0) {
          data = JSON.stringify({
            prompt: inputPrefix,
            temperature: 0.1,
            top_k: 40,
            top_p: 0.9,
            repeat_penalty: 1.05,
            // large n_predict significantly slows down the server, a small value is good enough for testing purposes
            n_predict: 128,
            stream: false,
          });

          options = {
            hostname: copilotIpAddress,
            port: copilotPort,
            path: "/completion",
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Content-Length": data.length,
            },
          };
        } else {
          data = JSON.stringify({
            prompt: inputPrefix, // FIXME, https://github.com/ggerganov/llama.cpp/pull/4028
            input_prefix: inputPrefix,
            input_suffix: inputSuffix,
            temperature: 0.1,
            top_k: 40,
            top_p: 0.9,
            repeat_penalty: 1.05,
            // large n_predict significantly slows down the server, a small value is good enough for testing purposes
            n_predict: 128,
          });

          options = {
            hostname: copilotIpAddress,
            port: copilotPort,
            path: "/infill",
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Content-Length": data.length,
            },
          };
        }

        return new Promise((resolve, reject) => {
          const req = http.request(options, (res) => {
            let responseData = "";

            res.on("data", (chunk) => {
              responseData += chunk;
            });

            res.on("end", () => {
              if (responseData.toString() === "") {
                resolve(""); // Resolve with an empty string if no data
              }
              const resData = JSON.parse(responseData.toString());
              console.log(res.statusCode, resData["content"]);
              let completion = resData["content"];
              if (inputSuffix !== "") {
                completion = completion.split("<EOT>")[0];
              }
              resolve(completion); // Resolve the Promise with the response data
            });
          });

          req.on("error", (error) => {
            console.error(error);
            reject(error); // Reject the Promise if an error occurs
          });

          req.write(data);
          req.end();
        });
      }),

  }),
});

export type CopilotRouter = typeof appRouter;
