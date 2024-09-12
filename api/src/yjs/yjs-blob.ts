/**
 * This is an alternative to yjs-plain. The persietence layer here saves a
 * binary blob to the DB.
 *
 * Cons (and the reason why I'm not using this):
 * - This requires DB schame change and manual DB migration.
 *
 * Pros:
 * - Support history.
 * - The logic is simpler than yjs-plain, no need to save each entries to the
 *   DB, just the single entire Y.Doc blob.
 * - The plain version seems to have trouble syncing with reconnected clients.
 *   I.e., if a client disconnects, make some offline edits, and connect back,
 *   those offline edits are not synced. THIS is the reason why I'm using this
 *   binary blob version.
 */

// throw new Error("Experimental not implemented.");

import * as Y from "yjs";

import debounce from "lodash/debounce";

import prisma from "../prisma";

import {
  AppNode,
  CodeNodeType,
  RichNodeType,
} from "@/../../ui/src/lib/store/types";
import { getInitYXml, myNanoId } from "./utils";
import { docs } from "./yjs-setupWS";

const debounceRegistry = new Map<string, any>();
/**
 * Invoke the callback that debounce w.r.t. the key. Also register the callback
 * in the registry to make sure it's called before the connection is closed..
 */
function getDebouncedCallback(key) {
  if (!debounceRegistry.has(key)) {
    console.log("registering for", key);
    debounceRegistry.set(
      key,
      debounce(
        (cb) => {
          console.log("debounced callback for", key);
          cb();
        },
        // write if no new activity in 10s
        10000,
        {
          // write at least every 20s
          maxWait: 20000,
        }
      )
    );
  }
  // 2. call it
  return debounceRegistry.get(key);
}

async function handleSaveBlob({ repoId, yDocBlob }) {
  console.log("save blob", repoId, yDocBlob.length);
  // calculate the size of yDocBlob
  const size = Buffer.byteLength(yDocBlob);
  const repo = await prisma.repo.findFirst({
    where: { id: repoId },
    include: {
      yDocBlob: true,
    },
  });
  if (!repo) {
    throw new Error("repo not found");
  }
  let blobId: string;
  if (repo.yDocBlob) {
    blobId = repo.yDocBlob.id;
  } else {
    blobId = myNanoId();
  }
  await prisma.yDocBlob.upsert({
    where: { id: blobId },
    create: {
      id: myNanoId(),
      repo: {
        connect: { id: repoId },
      },
      blob: yDocBlob,
      size,
    },
    update: {
      blob: yDocBlob,
      size,
    },
  });
  return true;
}

/**
 * This function is called when setting up the WS connection, after the loadFromCodePod step.
 * TODO need to make sure this is only called once per repo, regardless of how many users are connected later.
 */
function setupObserversToDB(ydoc: Y.Doc, repoId: string) {
  console.log("setupObserversToDB for repo", repoId);
  //   just observe and save the entire doc
  function observer(_, transaction) {
    if (transaction.local) {
      // There shouldn't be local updates.
      console.log("[WARNING] Local update");
      return;
    }
    debouncedWriteState(repoId);
  }
  const rootMap = ydoc.getMap("rootMap");
  const nodesMap = rootMap.get("nodesMap") as Y.Map<any>;
  nodesMap.observe(observer);
  const edgesMap = rootMap.get("edgesMap") as Y.Map<any>;
  edgesMap.observe(observer);
  const codeMap = rootMap.get("codeMap") as Y.Map<Y.Text>;
  codeMap.observeDeep(observer);
  const richMap = rootMap.get("richMap") as Y.Map<Y.XmlFragment>;
  richMap.observeDeep(observer);
  const resultMap = rootMap.get("resultMap") as Y.Map<any>;
  resultMap.observeDeep(observer);
}

/**
 * This function is called when setting up the WS connection, as a first step.
 */
async function loadFromDB(ydoc: Y.Doc, repoId: string) {
  // load from the database and write to the ydoc
  console.log("=== loadFromDB");
  // 1. query DB for repo.pods
  const repo = await prisma.repo.findFirst({
    where: { id: repoId },
    include: {
      owner: true,
      collaborators: true,
      yDocBlob: true,
    },
  });
  if (!repo) {
    throw new Error("repo not found");
  }

  if (repo.yDocBlob) {
    Y.applyUpdate(ydoc, repo.yDocBlob.blob);
  } else {
    // init the ydoc
    const rootMap = ydoc.getMap("rootMap");
    const nodesMap = new Y.Map<AppNode>();
    const richMap = new Y.Map<Y.XmlFragment>();
    const codeMap = new Y.Map<Y.Text>();
    rootMap.set("nodesMap", nodesMap);
    rootMap.set("edgesMap", new Y.Map<any>());
    rootMap.set("codeMap", codeMap);
    rootMap.set("richMap", richMap);
    rootMap.set("resultMap", new Y.Map<any>());
    rootMap.set("runtimeMap", new Y.Map<any>());
    const metaMap = new Y.Map();
    metaMap.set("version", "v0.0.1");
    rootMap.set("metaMap", metaMap);
    // the initial python pod id
    const pod1_id = myNanoId();
    const pod2_id = myNanoId();
    // add ROOT node
    const rootNode: RichNodeType = {
      id: "ROOT",
      type: "RICH",
      position: { x: 0, y: 0 },
      width: 300,
      data: {
        treeChildrenIds: [pod1_id, pod2_id],
        isScope: false,
        folded: false,
      },
    };
    nodesMap.set("ROOT", rootNode);

    const pod1: CodeNodeType = {
      // a python code pod
      id: pod1_id,
      type: "CODE",
      // This position is obtained after UI auto-layout.
      position: { x: 400, y: -74 },
      width: 300,
      data: {
        treeChildrenIds: [],
        parent: { id: "ROOT", relation: "TREE" },
        folded: false,
        isScope: false,
        lang: "python",
      },
    };
    nodesMap.set(pod1_id, pod1);
    const pod2: CodeNodeType = {
      // a python code pod
      id: pod2_id,
      type: "CODE",
      width: 300,
      // This position is obtained after UI auto-layout.
      position: { x: 400, y: 97 },
      data: {
        treeChildrenIds: [],
        parent: { id: "ROOT", relation: "TREE" },
        folded: false,
        isScope: false,
        lang: "python",
      },
    };
    nodesMap.set(pod2_id, pod2);
    const yxml = await getInitYXml();
    richMap.set("ROOT", yxml);
    codeMap.set(pod1_id, new Y.Text("def foo(x):\n    return x+1\n"));
    codeMap.set(pod2_id, new Y.Text("foo(3)\n"));
  }
}

export async function bindState(doc: Y.Doc, repoId: string) {
  // Load persisted document state from the database.
  await loadFromDB(doc, repoId);
  // Observe changes and write to the database.
  setupObserversToDB(doc, repoId);
  // setupObserversToRuntime(doc, repoId);
  // reset runtime status
  // clear runtimeMap status/commands but keep the ID
  const rootMap = doc.getMap("rootMap");
  if (rootMap.get("runtimeMap") === undefined) {
    rootMap.set("runtimeMap", new Y.Map<any>());
  }
}

export async function writeState(repoId: string) {
  // FIXME IMPORTANT make sure the observer events are finished.
  const ydoc = docs.get(repoId);
  if (!ydoc) {
    throw new Error("repo not found");
  }
  // encode state as update
  // FIXME it may be too expensive to update the entire doc.
  // FIXME history is discarded
  const update = Y.encodeStateAsUpdate(ydoc);
  await handleSaveBlob({ repoId, yDocBlob: Buffer.from(update) });
}

function debouncedWriteState(repoId: string) {
  // FIXME the waiting time could be used to reduce the cost of saving to DB.
  getDebouncedCallback(`update-blob-${repoId}`)(() => writeState(repoId));
}
