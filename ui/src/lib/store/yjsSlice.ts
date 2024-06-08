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

export const ATOM_runtimeChanged = atom(0);

export const ATOM_resultChanged = atom<Record<string, number>>({});
function triggerResultChanged(get: Getter, set: Setter, id: string) {
  set(
    ATOM_resultChanged,
    produce((resultChanged: Record<string, number>) => {
      resultChanged[id] = (resultChanged[id] || 0) + 1;
    })
  );
}

/**
 * This ATOM is used to trigger re-rendering of the pod.
 */
export const ATOM_podUpdated = atom<Record<string, number>>({});

function triggerPodUpdate(get: Getter, set: Setter, id: string) {
  set(
    ATOM_podUpdated,
    produce((podChanged: Record<string, number>) => {
      podChanged[id] = (podChanged[id] || 0) + 1;
    })
  );
}

/**
 * Change the pod's language will trigger (1) the change of yjs data and (2) the
 * re-rendering of the pod.
 */
export const ATOM_changeLang = atom(
  null,
  (get, set, id: string, lang: string) => {
    const nodesMap = getNodesMap(get);
    const node = nodesMap.get(id);
    if (node) {
      // set the yjs data
      nodesMap.set(id, { ...node, data: { ...node.data, lang } });
      // trigger re-rendering
      triggerPodUpdate(get, set, id);
    }
  }
);

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

export const ATOM_runtimeReady = atom<Record<string, boolean>>({});
function setRuntimeReady(
  get: Getter,
  set: Setter,
  runtimeMap: Y.Map<RuntimeInfo>
) {
  runtimeMap.forEach((value, kernelName) => {
    if (["idle", "busy"].includes(value.status || "")) {
      set(
        ATOM_runtimeReady,
        produce((runtimeReady: Record<string, boolean>) => {
          runtimeReady[kernelName] = true;
        })
      );
    } else {
      set(
        ATOM_runtimeReady,
        produce((runtimeReady: Record<string, boolean>) => {
          runtimeReady[kernelName] = false;
        })
      );
    }
  });
}

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
            triggerPodUpdate(get, set, key);
            break;
          default:
            console.warn("unhandled change action", change.action);
            break;
        }
      });
    });
    edgesMap.observe((YMapEvent: Y.YEvent<any>, transaction: Y.Transaction) => {
      if (transaction.local) return;
      updateView(get, set);
    });
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
