import * as k8s from "@kubernetes/client-node";

import { z } from "zod";

import { ZmqWire } from "./k8s-zmq";

import * as Y from "yjs";

export const myenv = z
  .object({
    KERNEL_IMAGE_PYTHON: z.string(),
    KERNEL_IMAGE_JULIA: z.string(),
    KERNEL_IMAGE_JAVASCRIPT: z.string(),
    KERNEL_IMAGE_RACKET: z.string(),
    RUNTIME_NS: z.string(),
    YJS_WS_URL: z.string(),
    READ_ONLY: z.enum(["true", "false"]).transform((x) => x === "true"),
    JWT_SECRET: z.string(),
    KERNEL_MAX_LIFETIME: z.string().transform((x) => parseInt(x)),
    KERNEL_ULIMIT_MEMORY: z.string(),
  })
  .parse(process.env);

export const repoId2ydoc = new Map<string, Y.Doc>();
export const repoId2wireMap = new Map<string, Map<string, ZmqWire>>();

// 60 * 60 * 1000; // 1 hr
export const kernelMaxLifetime = myenv.KERNEL_MAX_LIFETIME; // 1 hr
