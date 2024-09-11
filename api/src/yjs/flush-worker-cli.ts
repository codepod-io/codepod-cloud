/**
 * This script is used to flush the Yjs updates from the Redis database to the Yjs updates database.
 *
 * Command line usage:
 *
 *    npx ts-node src/yjs/flush-worker-cli.ts list
 *    npx ts-node src/yjs/flush-worker-cli.ts flush
 */

import { listKeysToFlush, doFlush } from "./yjs-blob-cache";

async function main() {
  const command = process.argv[2];

  if (command === "list") {
    await listKeysToFlush();
  } else if (command === "flush") {
    await doFlush();
  } else {
    console.error("Unknown command:", command);
  }

  process.exit();
}

main();
