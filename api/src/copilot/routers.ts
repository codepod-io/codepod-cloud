import { z } from "zod";
import http from "http";

import { protectedProcedure, router } from "./trpc";

import { LlamaModelParser } from "./llama";

require("dotenv").config();

const copilotIpAddress = process.env.LLAMA_CPP_SERVER;
const copilotPort = process.env.LLAMA_CPP_PORT;

if (!process.env.MODEL_DIR) {
  throw new Error("LLAMA model MODEL_DIR env variable is not set.");
}
if (!process.env.MODEL_NAME) {
  throw new Error("LLAMA model MODEL_NAME env variable is not set.");
}
const modelDir = process.env.MODEL_DIR;
const modelName = process.env.MODEL_NAME;
const contextSize = Number(process.env.CONTEXT_SIZE);
const threads = Number(process.env.THREADS);

const inferenceOptions = {
  nPredict: Number(process.env.N_PREDICT),
  temperature: Number(process.env.TEMPERATURE),
  topK: Number(process.env.TOP_K),
  topP: Number(process.env.TOP_P),
  repeatPenalty: Number(process.env.REPEAT_PENALTY),
};

const llamaModelParser = new LlamaModelParser(
  modelDir,
  modelName,
  contextSize,
  threads
);

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
            temperature: inferenceOptions["temperature"],
            top_k: inferenceOptions["topK"],
            top_p: inferenceOptions["topP"],
            repeat_penalty: inferenceOptions["repeatPenalty"],
            // large n_predict significantly slows down the server, a small value is good enough for testing purposes
            n_predict: inferenceOptions["nPredict"],
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
            temperature: inferenceOptions["temperature"],
            top_k: inferenceOptions["topK"],
            top_p: inferenceOptions["topP"],
            repeat_penalty: inferenceOptions["repeatPenalty"],
            // large n_predict significantly slows down the server, a small value is good enough for testing purposes
            n_predict: inferenceOptions["nPredict"],
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
    completeV2: protectedProcedure
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
          "inputPrefix\n",
          inputPrefix,
          "inputSuffix\n",
          inputSuffix
        );

        return new Promise((resolve, reject) => {
          const response = llamaModelParser.generate(
            inputPrefix,
            inputSuffix,
            inferenceOptions
          );
          resolve(response);
        });
      }),
  }),
});

export type CopilotRouter = typeof appRouter;
