import * as k8s from "@kubernetes/client-node";

import * as Y from "yjs";
import { RuntimeInfo } from "../yjs/types";
import prisma from "../prisma";
import { myenv, kernelMaxLifetime, repoId2wireMap, repoId2ydoc } from "./vars";
import { SupportedLanguage } from "./types";

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
const k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api);

/**
 * Register the newly created kernel to the database, or update the activity to latest.
 */
export async function registerKernelActivity(
  repoId: string,
  kernelName: SupportedLanguage
) {
  // check if the kernel already exists
  const kernel = await prisma.kernel.findFirst({
    where: {
      name: kernelName,
      repo: {
        id: repoId,
      },
    },
  });
  if (kernel) {
    await prisma.kernel.update({
      where: {
        id: kernel.id,
      },
      data: {
        dummyCount: {
          increment: 1,
        },
      },
    });
  } else {
    await prisma.kernel.create({
      data: {
        repo: {
          connect: {
            id: repoId,
          },
        },
        name: kernelName,
      },
    });
  }
  return true;
}

async function deleteK8sResource({
  repoId,
  kernelName,
}: {
  repoId: string;
  kernelName: string;
}) {
  console.log(`deleting rt-${repoId}-${kernelName} ..`);
  try {
    await k8sAppsApi.deleteNamespacedDeployment(
      `rt-${repoId}-${kernelName}`,
      myenv.RUNTIME_NS
    );
  } catch (e) {
    if (e instanceof k8s.HttpError) {
      console.error("error deleting deployment", e.body.reason);
    } else {
      throw e;
    }
  }

  console.log(`deleting svc-${repoId}-${kernelName} ..`);
  try {
    await k8sApi.deleteNamespacedService(
      `svc-${repoId}-${kernelName}`,
      myenv.RUNTIME_NS
    );
  } catch (e) {
    if (e instanceof k8s.HttpError) {
      console.error("error deleting service", e.body.reason);
    } else {
      throw e;
    }
  }
}

async function doRecycleKernel() {
  console.log("recycling kernels ..");
  const kernels = await prisma.kernel.findMany({
    where: {
      createdAt: {
        // greater than 1 hr
        // lt: new Date(Date.now() - 60 * 60 * 1000),
        lt: new Date(Date.now() - kernelMaxLifetime),
        //
        // greater than 30s
        // lt: new Date(Date.now() - 30 * 1000),
      },
    },
  });
  console.log("recycling kernels", kernels.length);
  for (const kernel of kernels) {
    // delete the k8s resources
    await deleteK8sResource({
      repoId: kernel.repoId,
      kernelName: kernel.name,
    });

    console.log("clean up data structures ..");
    // remove the zmq wire
    const wireMap = repoId2wireMap.get(kernel.repoId);
    const wire = wireMap?.get(kernel.name);
    wire?.shell.close();
    wire?.control.close();
    wire?.iopub.close();
    wireMap?.delete(kernel.name);
    // TODO FIXME remove the ydoc
    // set runtimeMap status to "stopped"
    const ydoc = repoId2ydoc.get(kernel.repoId);
    if (ydoc) {
      const runtimeMap = ydoc
        .getMap("rootMap")
        .get("runtimeMap") as Y.Map<RuntimeInfo>;
      runtimeMap.delete(kernel.name);
    }

    console.log("remove kernel entry from db ..");

    // delete the kernel
    await prisma.kernel.delete({
      where: {
        id: kernel.id,
      },
    });
  }
  console.log("recycling kernels done");
}

// a kernel cleaner thread that runs every 5 minutes to clean up kernels that are inactive for 1 hr.
export function recycleKernels() {
  console.log("recycle first time ..");
  doRecycleKernel();
  console.log("setting interval for recycling kernels ..");
  setInterval(
    doRecycleKernel,
    // every 5 min
    5 * 60 * 1000
    // 10s
    // 10 * 1000
  );
}
