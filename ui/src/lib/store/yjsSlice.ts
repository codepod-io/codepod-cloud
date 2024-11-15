import { Getter, PrimitiveAtom, Setter, atom } from "jotai";
import { Doc } from "yjs";
import * as Y from "yjs";
// FIXME can I import from api/ folder?
import { WebsocketProvider } from "@/../../api/src/runtime/y-websocket";
import { PodResult, RuntimeInfo } from "@/../../api/src/yjs/types";
import { Edge, Node, NodeChange, applyNodeChanges } from "@xyflow/react";
import { getHelperLines } from "@/components/nodes/utils";
import { AppNode } from "./types";
import { produce } from "immer";
import { useCallback } from "react";
import { updateView } from "./canvasSlice";
import { ATOM_repoData } from "./atom";
import { myassert, myNanoId } from "../utils/utils";
import { addNode } from "./canvasSlice_addNode";
import { addAwarenessStyle } from "./yjsSlice_utils";
import { debouncedTryParsePod } from "./runtimeSlice";

// The atoms

export const ATOM_ydoc = atom(new Doc());
export const ATOM_provider = atom<WebsocketProvider | null>(null);

export const ATOM_yjsConnecting = atom(false);
export const ATOM_yjsStatus = atom<string | undefined>(undefined);
export const ATOM_yjsSyncStatus = atom<string | undefined>(undefined);
export const ATOM_providerSynced = atom(false);
export const ATOM_setProviderSynced = atom(
  null,
  (get, set, synced: boolean) => {
    set(ATOM_providerSynced, synced);
  }
);

export const ATOM_runtimeChanged = atom(0);

const id2_ATOM_resultChanged = new Map<string, PrimitiveAtom<number>>();
export function getOrCreate_ATOM_resultChanged(id: string) {
  if (id2_ATOM_resultChanged.has(id)) {
    return id2_ATOM_resultChanged.get(id)!;
  }
  const res = atom(0);
  id2_ATOM_resultChanged.set(id, res);
  return res;
}
function triggerResultChanged(get: Getter, set: Setter, id: string) {
  set(getOrCreate_ATOM_resultChanged(id), (counter: number) => {
    if (counter >= Number.MAX_SAFE_INTEGER) {
      // Handle overflow, reset the counter
      counter = 0;
    }
    return counter + 1;
  });
}

/**
 * Yjs Map getters
 */
// subpages
type Subpage = {
  id: string;
  title: string;
};
function getSubpageMap(get: Getter) {
  const ydoc = get(ATOM_ydoc);
  return ydoc.getMap("rootMap").get("subpageMap") as Y.Map<Subpage>;
}
const ATOM_subpageMap = atom(getSubpageMap);

export const ATOM_subpages = atom<Subpage[]>([]);
function addSubpage(get: Getter, set: Setter, title: string) {
  const id = myNanoId();
  const subpageMap = get(ATOM_subpageMap);
  subpageMap.set(id, { id, title });
  set(ATOM_subpages, Array.from(subpageMap.values()));
  // create a pod in this subpage
  addNode(get, set, {
    type: "RICH",
    position: { x: 0, y: 0 },
    subpageId: id,
  });
}
export const ATOM_addSubpage = atom(null, addSubpage);

function renameSubpage(get: Getter, set: Setter, id: string, title: string) {
  const subpageMap = get(ATOM_subpageMap);
  const subpage = subpageMap.get(id);
  myassert(subpage);
  subpage.title = title;
  subpageMap.set(id, subpage);
  set(ATOM_subpages, Array.from(subpageMap.values()));
}

export const ATOM_renameSubpage = atom(null, renameSubpage);

function deleteSubpage(get: Getter, set: Setter, id: string) {
  const subpageMap = get(ATOM_subpageMap);
  subpageMap.delete(id);
  set(ATOM_subpages, Array.from(subpageMap.values()));
}

export const ATOM_deleteSubpage = atom(null, deleteSubpage);

function getNodesMap(get: Getter) {
  const ydoc = get(ATOM_ydoc);
  const rootMap = ydoc.getMap<Y.Map<AppNode>>("rootMap");
  if (!rootMap) {
    throw new Error("rootMap not found");
  }
  const nodesMap = rootMap.get("nodesMap");
  if (!nodesMap) {
    throw new Error("nodesMap not found");
  }
  return nodesMap;
}
const ATOM_nodesMap = atom(getNodesMap);
function getEdgesMap(get: Getter) {
  const ydoc = get(ATOM_ydoc);
  return ydoc.getMap("rootMap").get("edgesMap") as Y.Map<Edge>;
}
const ATOM_edgesMap = atom(getEdgesMap);
function getCodeMap(get: Getter) {
  const ydoc = get(ATOM_ydoc);
  return ydoc.getMap("rootMap").get("codeMap") as Y.Map<Y.Text>;
}
const ATOM_codeMap = atom(getCodeMap);
function getRichMap(get: Getter) {
  const ydoc = get(ATOM_ydoc);
  return ydoc.getMap("rootMap").get("richMap") as Y.Map<Y.XmlFragment>;
}
const ATOM_richMap = atom(getRichMap);
function getRuntimeMap(get: Getter) {
  const ydoc = get(ATOM_ydoc);
  return ydoc.getMap("rootMap").get("runtimeMap") as Y.Map<RuntimeInfo>;
}
const ATOM_runtimeMap = atom(getRuntimeMap);
function getResultMap(get: Getter) {
  const ydoc = get(ATOM_ydoc);
  return ydoc.getMap("rootMap").get("resultMap") as Y.Map<PodResult>;
}
const ATOM_resultMap = atom(getResultMap);

export {
  ATOM_subpageMap,
  ATOM_nodesMap,
  ATOM_edgesMap,
  ATOM_codeMap,
  ATOM_richMap,
  ATOM_runtimeMap,
  ATOM_resultMap,
};

const lang2_ATOM_runtimeReady = new Map<string, PrimitiveAtom<boolean>>();
export function getOrCreate_ATOM_runtimeReady(lang: string) {
  if (lang2_ATOM_runtimeReady.has(lang)) {
    return lang2_ATOM_runtimeReady.get(lang)!;
  }
  const res = atom(false);
  lang2_ATOM_runtimeReady.set(lang, res);
  return res;
}

function setRuntimeReady(
  get: Getter,
  set: Setter,
  runtimeMap: Y.Map<RuntimeInfo>
) {
  lang2_ATOM_runtimeReady.forEach((atom, kernelName) => {
    // If the runtimeMap doesn't have the kernelName, set it to false.
    if (!runtimeMap.has(kernelName)) set(atom, false);
  });
  runtimeMap.forEach((value, kernelName) => {
    if (["idle", "busy"].includes(value.status || "")) {
      set(getOrCreate_ATOM_runtimeReady(kernelName), true);
    } else {
      set(getOrCreate_ATOM_runtimeReady(kernelName), false);
    }
  });
}

/**
 * Get a random background color suitable for displaying black text on it.
 * Return the color in hex format.
 */
function getRandomLightColor() {
  // Generate random values for RGB with a minimum of 128 for each component to avoid dark colors.
  const r = Math.floor(Math.random() * 64) + 128 + 64;
  const g = Math.floor(Math.random() * 64) + 128 + 64;
  const b = Math.floor(Math.random() * 64) + 128 + 64;

  // Convert RGB to hex format
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

// generate a light color string
const mycolor = getRandomLightColor();

// BlockNote didn't use provider.awareness.
export const ATOM_simpleAwareness = atom({ name: "", color: "" });

/**
 * Connect to Yjs websocket server.
 */
export const ATOM_connectYjs = atom(null, (get, set, name: string) => {
  if (get(ATOM_yjsConnecting)) return;
  if (get(ATOM_provider)) return;
  const repoData = get(ATOM_repoData);
  myassert(repoData);
  const repoId = repoData.id;
  set(ATOM_yjsConnecting, true);
  const yjsWsUrl = `${window.location.protocol === "https:" ? "wss" : "ws"}://${
    window.location.host
  }/yjs`;
  console.log(`connecting yjs socket ${yjsWsUrl} ..`);
  const ydoc = new Doc();
  const provider: WebsocketProvider = new WebsocketProvider(
    yjsWsUrl,
    repoId,
    ydoc,
    {
      // resyncInterval: 2000,
      //
      // BC is more complex to track our custom Uploading status and SyncDone events.
      disableBc: true,
      params: {
        token: localStorage.getItem("token") || "",
      },
    }
  );
  set(ATOM_simpleAwareness, { name, color: mycolor });
  provider.awareness.setLocalStateField("user", {
    name,
    color: mycolor,
    // FIXME blocknote seems to modify provider.awareness to have only name and
    // color. This colorLight is removed. Therefore, if rich text editor is
    // present, the colorLight is not set and will be y-codemirror.next's
    // default +33, which is too light.
    //
    // For the same reason, if above simpleAwareness must be set, otherwise, if
    // rich text editor is present, the color will be default empty.
    //
    // In a word, this setting will be override by simpleAwareness in BlockNote.
    colorLight: mycolor + "55",
  });

  provider.awareness.on("update", (change) => {
    const states = provider.awareness.getStates();
    const nodes = change.added.concat(change.updated);
    nodes.forEach((clientID) => {
      const user = states.get(clientID)?.user;
      if (user) {
        // add client
        addAwarenessStyle(clientID, user.color, user.name);
      }
    });
  });
  provider.on("status", ({ status }) => {
    set(ATOM_yjsStatus, status);
  });
  provider.on("mySync", (status: "uploading" | "synced") => {
    set(ATOM_yjsSyncStatus, status);
  });
  // max retry time: 10s
  provider.maxBackoffTime = 10000;
  provider.once("synced", () => {
    console.log("Provider synced, setting initial content ...");
    // load initial nodes
    const nodesMap = getNodesMap(get);
    const edgesMap = getEdgesMap(get);

    updateView(get, set);
    // Trigger initial results rendering.
    const resultMap = getResultMap(get);
    Array.from(resultMap.keys()).forEach((key) => {
      triggerResultChanged(get, set, key);
    });
    // Set observers to trigger future results rendering.
    resultMap.observe(
      (YMapEvent: Y.YEvent<any>, transaction: Y.Transaction) => {
        // clearResults and setRunning is local change.
        // if (transaction.local) return;
        YMapEvent.changes.keys.forEach((change, key) => {
          // refresh result for pod key
          // FIXME performance on re-rendering: would it trigger re-rendering for all pods?
          triggerResultChanged(get, set, key);
        });
      }
    );
    // FIXME do I need to unobserve it when disconnecting?
    nodesMap.observe((YMapEvent: Y.YEvent<any>, transaction: Y.Transaction) => {
      if (transaction.local) return;
      // whether the meta data of a node is changed.
      YMapEvent.changes.keys.forEach((change, key) => {
        // switch
        switch (change.action) {
          case "add":
          case "delete":
            updateView(get, set);
            break;
          case "update":
            updateView(get, set);
            break;
          default:
            console.warn(
              "unhandled nodesMap peer change action",
              change.action
            );
            break;
        }
      });
    });
    edgesMap.observe((YMapEvent: Y.YEvent<any>, transaction: Y.Transaction) => {
      if (transaction.local) return;
      updateView(get, set);
    });
    const codeMap = getCodeMap(get);

    // Observe all code changes, and re-parse the code when it changes.
    codeMap.observeDeep(
      (events: Y.YEvent<any>[], transaction: Y.Transaction) => {
        // if (transaction.local) return;
        events.forEach((event) => {
          if (event instanceof Y.YTextEvent && event.path.length > 0) {
            const id = event.path[0];
            if (typeof id === "string") {
              debouncedTryParsePod(get, set, id);
            }
          }
        });
      }
    );
    // subpages
    const subpageMap = get(ATOM_subpageMap);
    set(ATOM_subpages, Array.from(subpageMap.values()));
    subpageMap.observe(
      (YMapEvent: Y.YEvent<any>, transaction: Y.Transaction) => {
        if (transaction.local) return;
        set(ATOM_subpages, Array.from(subpageMap.values()));
      }
    );
    // Set active runtime to the first one.
    const runtimeMap = getRuntimeMap(get);

    // initial setup for runtimeReady
    setRuntimeReady(get, set, runtimeMap);
    // Set up observers to trigger future runtime status changes.
    runtimeMap.observe(
      (YMapEvent: Y.YEvent<any>, transaction: Y.Transaction) => {
        if (transaction.local) return;
        set(ATOM_runtimeChanged, get(ATOM_runtimeChanged) + 1);
        // set runtimeReady
        setRuntimeReady(get, set, runtimeMap);
      }
    );
    // Set synced flag to be used to ensure canvas rendering after yjs synced.
    set(ATOM_providerSynced, true);
  });
  provider.connect();
  set(ATOM_ydoc, ydoc);
  set(ATOM_provider, provider);
  set(ATOM_yjsConnecting, false);
});

export const ATOM_disconnectYjs = atom(null, (get, set) => {
  const provider = get(ATOM_provider);
  if (provider) {
    provider.destroy();
    set(ATOM_provider, null);
  }
  const ydoc = get(ATOM_ydoc);
  ydoc.destroy();
  set(ATOM_providerSynced, false);
});
