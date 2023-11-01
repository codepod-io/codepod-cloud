import { startWsServer } from "./yjs-server";

// FIXME without calling startWsServer, the .env is not loaded.
// I could force loading it in package.json script:
//     env $(cat .env | grep -v \"#\" | xargs)
if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET env variable is not set.");
}

startWsServer({ jwtSecret: process.env.JWT_SECRET, port: 4233 });
// startAPIServer({ port: 4234 });

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
