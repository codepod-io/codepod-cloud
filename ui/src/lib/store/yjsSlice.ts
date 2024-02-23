import { Getter, Setter, atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import { Doc } from "yjs";
import * as Y from "yjs";
import { WebsocketProvider } from "@codepod/yjs/src/y-websocket";
import { Edge, Node, NodeChange, applyNodeChanges } from "reactflow";
import { getHelperLines } from "@/components/nodes/utils";
import { NodeData } from "./canvasSlice";
import { produce } from "immer";
import { useCallback } from "react";
import { updateView } from "./canvasSlice";
import { ATOM_repoId, buildNode2Children } from "./atom";
import { ATOM_activeRuntime } from "./runtimeSlice";

export type RuntimeInfo = {
  status?: string;
  wsStatus?: string;
};

type PodResult = {
  exec_count?: number;
  data: {
    type: string;
    html?: string;
    text?: string;
    image?: string;
  }[];
  running?: boolean;
  lastExecutedAt?: number;
  error?: { ename: string; evalue: string; stacktrace: string[] } | null;
};

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

export const ATOM_runtimeChanged = atom(false);

export const ATOM_resultChanged = atom<Record<string, boolean>>({});
function toggleResultChanged(get: Getter, set: Setter, id: string) {
  console.log("toggleResultChanged", id);
  set(
    ATOM_resultChanged,
    produce((resultChanged: Record<string, boolean>) => {
      resultChanged[id] = !resultChanged[id];
    })
  );
}

/**
 * Yjs Map getters
 */
function getNodesMap(get: Getter) {
  const ydoc = get(ATOM_ydoc);
  const rootMap = ydoc.getMap<Y.Map<Node<NodeData>>>("rootMap");
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
  ATOM_nodesMap,
  ATOM_edgesMap,
  ATOM_codeMap,
  ATOM_richMap,
  ATOM_runtimeMap,
  ATOM_resultMap,
};

const ATOM_clients = atom(new Map<string, any>());

/**
 * Connect to Yjs websocket server.
 */
export const ATOM_connectYjs = atom(null, (get, set, name: string) => {
  if (get(ATOM_yjsConnecting)) return;
  if (get(ATOM_provider)) return;
  set(ATOM_yjsConnecting, true);
  const yjsWsUrl = `${window.location.protocol === "https:" ? "wss" : "ws"}://${
    window.location.host
  }/yjs`;
  console.log(`connecting yjs socket ${yjsWsUrl} ..`);
  const ydoc = new Doc();
  const provider: WebsocketProvider = new WebsocketProvider(
    yjsWsUrl,
    get(ATOM_repoId),
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
  const color = "#" + Math.floor(Math.random() * 16777215).toString(16);
  provider.awareness.setLocalStateField("user", {
    name,
    color,
  });
  provider.awareness.on("update", (change) => {
    const states = provider.awareness.getStates();
    const nodes = change.added.concat(change.updated);
    nodes.forEach((clientID) => {
      const user = states.get(clientID)?.user;
      if (user) {
        // add client
        set(
          ATOM_clients,
          produce((clients: Map<string, any>) => {
            clients.set(clientID, { name, color });
          })
        );
      }
    });
    change.removed.forEach((clientID) => {
      // delete client
      set(
        ATOM_clients,
        produce((clients: Map<string, any>) => {
          clients.delete(clientID);
        })
      );
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
    const codeMap = getCodeMap(get);
    const richMap = getRichMap(get);
    // init nodesMap
    if (nodesMap.size == 0) {
      nodesMap.set("ROOT", {
        id: "ROOT",
        type: "RICH",
        position: { x: 0, y: 0 },
        data: {
          level: 0,
          children: [],
          folded: false,
        },
        style: {
          width: 300,
          // height: 100,
        },
      });
      richMap.set("ROOT", new Y.XmlFragment());
    }

    updateView(get, set);
    // Trigger initial results rendering.
    const resultMap = getResultMap(get);
    // Initialize node2children
    buildNode2Children(get, set);
    Array.from(resultMap.keys()).forEach((key) => {
      toggleResultChanged(get, set, key);
    });
    // Set observers to trigger future results rendering.
    resultMap.observe(
      (YMapEvent: Y.YEvent<any>, transaction: Y.Transaction) => {
        // clearResults and setRunning is local change.
        // if (transaction.local) return;
        YMapEvent.changes.keys.forEach((change, key) => {
          // refresh result for pod key
          // FIXME performance on re-rendering: would it trigger re-rendering for all pods?
          toggleResultChanged(get, set, key);
        });
      }
    );
    // FIXME do I need to unobserve it when disconnecting?
    nodesMap.observe((YMapEvent: Y.YEvent<any>, transaction: Y.Transaction) => {
      if (transaction.local) return;
      updateView(get, set);
    });
    edgesMap.observe((YMapEvent: Y.YEvent<any>, transaction: Y.Transaction) => {
      if (transaction.local) return;
      updateView(get, set);
    });
    // Set active runtime to the first one.
    const runtimeMap = getRuntimeMap(get);
    if (runtimeMap.size > 0) {
      set(ATOM_activeRuntime, Array.from(runtimeMap.keys())[0]);
    }
    // Set up observers to trigger future runtime status changes.
    runtimeMap.observe(
      (YMapEvent: Y.YEvent<any>, transaction: Y.Transaction) => {
        if (transaction.local) return;
        YMapEvent.changes.keys.forEach((change, key) => {
          if (change.action === "add") {
          } else if (change.action === "update") {
          } else if (change.action === "delete") {
            // If it was the active runtime, reset it.
            if (get(ATOM_activeRuntime) === key) {
              set(ATOM_activeRuntime, undefined);
            }
          }
        });
        // Set active runtime if it is not set
        if (runtimeMap.size > 0 && !get(ATOM_activeRuntime)) {
          set(ATOM_activeRuntime, Array.from(runtimeMap.keys())[0]);
        }
        set(ATOM_runtimeChanged, !get(ATOM_runtimeChanged));
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
