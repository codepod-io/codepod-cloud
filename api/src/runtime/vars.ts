import * as k8s from "@kubernetes/client-node";

import { z } from "zod";

import { ZmqWire } from "./k8s-zmq";

import * as Y from "yjs";

export const env = z
  .object({
    KERNEL_IMAGE_PYTHON: z.string(),
    KERNEL_IMAGE_JULIA: z.string(),
    KERNEL_IMAGE_JAVASCRIPT: z.string(),
    KERNEL_IMAGE_RACKET: z.string(),
    RUNTIME_NS: z.string(),
    YJS_WS_URL: z.string(),
  })
  .parse(process.env);

export const repoId2ydoc = new Map<string, Y.Doc>();
export const repoId2wireMap = new Map<string, Map<string, ZmqWire>>();

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

export const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
export const k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api);

export const kernelMaxLifetime = 60 * 60 * 1000; // 1 hr
