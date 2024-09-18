// Code from https://github.com/yjs/y-protocols

import * as Y from "yjs";
import * as awarenessProtocol from "y-protocols/awareness";
import * as syncProtocol from "y-protocols/sync";

import { encoding, decoding, map } from "lib0";
import { WebSocket } from "ws";
import http from "http";
import { bindState, writeState } from "./yjs-blob";

const wsReadyStateConnecting = 0;
const wsReadyStateOpen = 1;

// disable gc when using snapshots!
const gcEnabled = process.env.GC !== "false" && process.env.GC !== "0";

/**
 * @type {Map<string,WSSharedDoc>}
 */
export const docs: Map<string, WSSharedDoc> = new Map();
// exporting docs so that others can use it

const messageSync = 0;
const messageAwareness = 1;
// const messageAuth = 2

/**
 * @param {Uint8Array} update
 * @param {any} origin
 * @param {WSSharedDoc} doc
 */
const updateHandler = (update, origin, doc) => {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, messageSync);
  syncProtocol.writeUpdate(encoder, update);
  const message = encoding.toUint8Array(encoder);
  doc.conns.forEach((_, conn) => send(doc, conn, message));
};

class WSSharedDoc extends Y.Doc {
  name: string;
  conns: Map<any, Set<number>>;
  awareness: awarenessProtocol.Awareness;

  constructor(name) {
    super({ gc: gcEnabled });
    this.name = name;
    /**
     * Maps from conn to set of controlled user ids. Delete all user ids from awareness when this conn is closed
     * @type {Map<Object, Set<number>>}
     */
    this.conns = new Map();
    /**
     * @type {awarenessProtocol.Awareness}
     */
    this.awareness = new awarenessProtocol.Awareness(this);
    this.awareness.setLocalState(null);
    /**
     * @param {{ added: Array<number>, updated: Array<number>, removed: Array<number> }} changes
     * @param {Object | null} conn Origin is the connection that made the change
     */
    const awarenessChangeHandler = ({ added, updated, removed }, conn) => {
      const changedClients = added.concat(updated, removed);
      if (conn !== null) {
        const connControlledIDs =
          /** @type {Set<number>} */ this.conns.get(conn);
        if (connControlledIDs !== undefined) {
          added.forEach((clientID) => {
            connControlledIDs.add(clientID);
          });
          removed.forEach((clientID) => {
            connControlledIDs.delete(clientID);
          });
        }
      }
      // broadcast awareness update
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageAwareness);
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients)
      );
      const buff = encoding.toUint8Array(encoder);
      this.conns.forEach((_, c) => {
        send(this, c, buff);
      });
    };
    this.awareness.on("update", awarenessChangeHandler);
    this.on("update", updateHandler);
  }
}

/**
 * Gets a Y.Doc by name, whether in memory or on disk
 *
 * @param docname - the name of the Y.Doc to find or create
 * @param  gc - whether to allow gc on the doc (applies only when created)
 */
export function getYDoc(
  repoId: string,
  gc = true
): { doc: WSSharedDoc; docLoadedPromise: Promise<any> | null } {
  let doc = docs.get(repoId);
  let docLoadedPromise: Promise<any> | null = null;
  if (doc === undefined) {
    doc = new WSSharedDoc(repoId);
    doc.gc = gc;
    // await bindState(doc, repoId);
    docLoadedPromise = bindState(doc, repoId);
    docs.set(repoId, doc);
  }
  return { doc, docLoadedPromise };
}

// 0,1,2 are used
// FIXME this is error-prone.
const messageYjsSyncDone = 3;
const writeSyncDone = (encoder) => {
  encoding.writeVarUint(encoder, messageYjsSyncDone);
};

/**
 * Support Read-only mode. Ref: https://discuss.yjs.dev/t/read-only-or-one-way-only-sync/135/4
 */
const readSyncMessage = (
  decoder,
  encoder,
  doc,
  transactionOrigin,
  readOnly = false
) => {
  const messageType = decoding.readVarUint(decoder);
  switch (messageType) {
    case syncProtocol.messageYjsSyncStep1:
      syncProtocol.readSyncStep1(decoder, encoder, doc);
      // immediately send sync step 1 to ask back what client has.
      syncProtocol.writeSyncStep1(encoder, doc);
      break;
    case syncProtocol.messageYjsSyncStep2:
      if (!readOnly) {
        syncProtocol.readSyncStep2(decoder, doc, transactionOrigin);
        // Write an additional SyncDone message to ACK the update.
        writeSyncDone(encoder);
      }
      break;
    case syncProtocol.messageYjsUpdate:
      if (!readOnly) {
        syncProtocol.readUpdate(decoder, doc, transactionOrigin);
        // Write an additional SyncDone message to ACK the update.
        writeSyncDone(encoder);
      }
      break;
    default:
      throw new Error("Unknown message type");
  }
  return messageType;
};

/**
 * @param {any} conn
 * @param {WSSharedDoc} doc
 * @param {Uint8Array} message
 */
const messageListener = (conn, doc, message, readOnly) => {
  try {
    const encoder = encoding.createEncoder();
    const decoder = decoding.createDecoder(message);
    const messageType = decoding.readVarUint(decoder);
    switch (messageType) {
      case messageSync:
        encoding.writeVarUint(encoder, messageSync);
        readSyncMessage(decoder, encoder, doc, conn, readOnly);

        // If the `encoder` only contains the type of reply message and no
        // message, there is no need to send the message. When `encoder` only
        // contains the type of reply, its length is 1.
        if (encoding.length(encoder) > 1) {
          send(doc, conn, encoding.toUint8Array(encoder));
        }
        break;
      case messageAwareness: {
        awarenessProtocol.applyAwarenessUpdate(
          doc.awareness,
          decoding.readVarUint8Array(decoder),
          conn
        );
        break;
      }
    }
  } catch (err) {
    console.error(err);
    doc.emit("error", [err]);
  }
};

const scheduledDelete = new Map();

const closeConn = (doc: WSSharedDoc, conn: WebSocket) => {
  if (doc.conns.has(conn)) {
    /**
     * @type {Set<number>}
     */
    // @ts-ignore
    const controlledIds = doc.conns.get(conn);
    if (!controlledIds) throw new Error("This should not happen");
    doc.conns.delete(conn);
    awarenessProtocol.removeAwarenessStates(
      doc.awareness,
      Array.from(controlledIds),
      null
    );
    console.log("=== closeConn, renaming conn size", doc.conns.size);
    if (doc.conns.size === 0) {
      writeState(doc.name);
      console.log("=== scheduled to destroy ydoc", doc.name, "in 3 seconds");
      // schedule to destroy the document if no new connections are made within 30 seconds
      if (scheduledDelete.has(doc.name)) throw new Error("should not happen");
      scheduledDelete.set(
        doc.name,
        setTimeout(() => {
          console.log("=== Destroy ydoc", doc.name);
          doc.destroy();
          docs.delete(doc.name);
          scheduledDelete.delete(doc.name);
        }, 30000)
      );
    }
  }
  conn.close();
};

/**
 * Close the connection without writing the state to the database.
 */
const closeConnNoWrite = (doc: WSSharedDoc, conn: WebSocket) => {
  if (doc.conns.has(conn)) {
    /**
     * @type {Set<number>}
     */
    // @ts-ignore
    const controlledIds = doc.conns.get(conn);
    if (!controlledIds) throw new Error("This should not happen");
    doc.conns.delete(conn);
    awarenessProtocol.removeAwarenessStates(
      doc.awareness,
      Array.from(controlledIds),
      null
    );
  }
  conn.close();
};

/**
 * Close all connections of a document without writing the state to the
 * database. This is to be used when we restore a document from a snapshot.
 */
export function closeDocNoWrite(repoId: string) {
  const doc = docs.get(repoId);
  if (doc) {
    doc.conns.forEach((_, conn) => {
      closeConnNoWrite(doc, conn);
    });
    doc.destroy();
    docs.delete(repoId);
  }
}

/**
 * @param {WSSharedDoc} doc
 * @param {any} conn
 * @param {Uint8Array} m
 */
const send = (doc: WSSharedDoc, conn: WebSocket, m: Uint8Array) => {
  if (
    conn.readyState !== wsReadyStateConnecting &&
    conn.readyState !== wsReadyStateOpen
  ) {
    closeConn(doc, conn);
  }
  try {
    conn.send(
      m,
      /** @param {any} err */ (err) => {
        err != null && closeConn(doc, conn);
      }
    );
  } catch (e) {
    closeConn(doc, conn);
  }
};

const pingTimeout = 30000;

/**
 * @param {any} conn
 * @param {any} req
 * @param {any} opts
 */
export function setupWSConnection(
  conn: WebSocket,
  req: http.IncomingMessage,
  {
    repoId,
    gc = true,
    readOnly = false,
  }: {
    repoId: string;
    gc: boolean;
    readOnly: boolean;
  }
) {
  conn.binaryType = "arraybuffer";
  console.log(`setupWSConnection for repo ${repoId}, read-only=${readOnly}`);
  // get doc, initialize if it does not exist yet
  const { doc, docLoadedPromise } = getYDoc(repoId, gc);
  doc.conns.set(conn, new Set());
  if (scheduledDelete.has(doc.name)) {
    console.log("=== cancel previous scheduled destroy ydoc", doc.name);
    clearTimeout(scheduledDelete.get(doc.name));
    scheduledDelete.delete(doc.name);
  }

  // It might take some time to load the doc, but before then we still need to
  // listen for websocket events, Ref:
  // https://github.com/yjs/y-websocket/issues/81#issuecomment-1453185788
  let isDocLoaded = docLoadedPromise ? false : true;
  let queuedMessages: Uint8Array[] = [];
  let isConnectionAlive = true;

  // listen and reply to events
  conn.on(
    "message",
    /** @param {ArrayBuffer} message */
    // FIXME message had type WebSocket.RawData, but I have to specify
    // ArrayBuffer here to avoid ts type error.
    (message: ArrayBuffer) => {
      if (isDocLoaded)
        messageListener(conn, doc, new Uint8Array(message), readOnly);
      else queuedMessages.push(new Uint8Array(message));
    }
  );

  // Check if connection is still alive
  let pongReceived = true;
  const pingInterval = setInterval(() => {
    if (!pongReceived) {
      if (doc.conns.has(conn)) {
        closeConn(doc, conn);
        isConnectionAlive = false;
      }
      clearInterval(pingInterval);
    } else if (doc.conns.has(conn)) {
      pongReceived = false;
      try {
        conn.ping();
      } catch (e) {
        closeConn(doc, conn);
        isConnectionAlive = false;
        clearInterval(pingInterval);
      }
    }
  }, pingTimeout);
  conn.on("close", () => {
    closeConn(doc, conn);
    isConnectionAlive = false;
    clearInterval(pingInterval);
  });
  conn.on("pong", () => {
    pongReceived = true;
  });
  // put the following in a variables in a block so the interval handlers don't keep in in
  // scope
  const sendSyncStep1 = () => {
    // send sync step 1
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);
    syncProtocol.writeSyncStep1(encoder, doc);
    send(doc, conn, encoding.toUint8Array(encoder));
    const awarenessStates = doc.awareness.getStates();
    if (awarenessStates.size > 0) {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageAwareness);
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(
          doc.awareness,
          Array.from(awarenessStates.keys())
        )
      );
      send(doc, conn, encoding.toUint8Array(encoder));
    }
  };
  if (docLoadedPromise) {
    docLoadedPromise.then(() => {
      if (!isConnectionAlive) return;

      isDocLoaded = true;
      queuedMessages.forEach((message) =>
        messageListener(conn, doc, message, readOnly)
      );
      queuedMessages = [];
      sendSyncStep1();
    });
  }
}
