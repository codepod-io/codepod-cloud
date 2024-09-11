import { doFlush } from "./yjs-blob-cache";

// a worker that calls doFlush every 5 minutes
async function flushWorker() {
  console.log("flushWorker started");
  setInterval(async () => {
    await doFlush();
  }, 10000); // 10 seconds
}

flushWorker();

// ts-node-dev might fail to restart. Force the exiting and restarting. Ref:
// https://github.com/wclr/ts-node-dev/issues/69#issuecomment-493675960
process.on("SIGTERM", () => {
  console.log("Received SIGTERM. Exiting...");
  process.exit();
});

// FIXME Without this, the process won't exit on SIGINT (Ctrl-C).
process.on("SIGINT", () => {
  console.log("Received SIGINT. Exiting...");
  process.exit();
});
