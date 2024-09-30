import { Getter, Setter, atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import { Doc } from "yjs";
import * as Y from "yjs";
import {
  Edge,
  MarkerType,
  Node,
  NodeChange,
  XYPosition,
  applyNodeChanges,
} from "@xyflow/react";
import { getHelperLines } from "@/components/nodes/utils";
import { produce } from "immer";
import { useCallback } from "react";
import { ATOM_codeMap, ATOM_nodesMap, ATOM_richMap } from "./yjsSlice";
import { match } from "ts-pattern";
import { flextree } from "d3-flextree";
import { myassert, myNanoId } from "../utils/utils";
import { AppNode } from "./types";

import debounce from "lodash/debounce";
import { ATOM_cutId } from "./atom";
import { toast } from "react-toastify";
import { getOrCreate_ATOM_resolveResult, propagateAllST } from "./runtimeSlice";

/**
 * Get the absoluate position of the node.
 */
export function getAbsPos(node: Node, nodesMap: Y.Map<AppNode>): XYPosition {
  let x = node.position.x;
  let y = node.position.y;
  while (node.parentId) {
    node = nodesMap.get(node.parentId)!;
    x += node.position.x;
    y += node.position.y;
  }
  return { x, y };
}

export const ATOM_nodes = atom<Node[]>([]);
export const ATOM_edges = atom<Edge[]>([]);

export const ATOM_helperLineHorizontal = atom<number | undefined>(undefined);
export const ATOM_helperLineVertical = atom<number | undefined>(undefined);

export const ATOM_focusedEditor = atom<string | null>(null);

export const ATOM_selectedPods = atom<Set<string>>(new Set<string>());
export const ATOM_centerSelection = atom<boolean>(false);

function selectPod(
  get: Getter,
  set: Setter,
  { id, selected }: { id: string; selected: boolean }
) {
  const selectedPods = get(ATOM_selectedPods);
  if (selected) {
    selectedPods.add(id);
  } else {
    selectedPods.delete(id);
  }
  set(ATOM_selectedPods, selectedPods);
}

export const ATOM_selectPod = atom(null, selectPod);

type T_id2parent = Map<string, string | undefined>;
let oldStructure: T_id2parent = new Map<string, string | undefined>();

function compareMaps(map1: T_id2parent, map2: T_id2parent) {
  if (map1.size !== map2.size) {
    return false;
  }
  for (let [key, val] of map1) {
    if (val !== map2.get(key)) {
      return false;
    }
  }
  return true;
}

function generateEdge(nodes: AppNode[]) {
  const edges: Edge[] = [];
  nodes.forEach((node) => {
    node.data?.treeChildrenIds?.map((id: string) => {
      edges.push({
        id: `${node.id}-${id}`,
        source: node.id,
        target: id,
        sourceHandle: "right",
        targetHandle: "left",
      });
    });
  });
  return edges;
}

function generateCallEdges(get: Getter, set: Setter) {
  const nodesMap = get(ATOM_nodesMap);
  const res: Edge[] = [];
  nodesMap.forEach((node) => {
    const resolveResult = get(getOrCreate_ATOM_resolveResult(node.id));
    myassert(resolveResult);
    for (let [key, value] of resolveResult.resolved) {
      // do not show self-connections
      if (node.id === value) continue;
      res.push({
        id: `${node.id}-${key}`,
        source: node.id,
        target: value,
        sourceHandle: "right",
        targetHandle: "left",
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "red",
          strokeWidth: 4,
        },
        type: "gradient",
        // Caution: animated edges have a huge performance hit.
        // animated: true,
      });
    }
  });
  // console.log("call edges", res);
  return res;
}

/**
 * This function handles the real updates to the reactflow nodes to render.
 */
export function updateView(get: Getter, set: Setter) {
  const t1 = performance.now();
  const nodesMap = get(ATOM_nodesMap);
  let selectedPods = get(ATOM_selectedPods);
  const newStructure: T_id2parent = new Map();
  // TODO compare new/old structure
  // TODO render scope first
  const _nodes = Array.from<AppNode>(nodesMap.values());
  const nodes = structuredClone(_nodes);
  nodes.forEach((node) => {
    node.selected = selectedPods.has(node.id);
  });
  // Remove width and height to let reactflow measure them.
  nodes.forEach((node) => {
    node.width = undefined;
    node.height = undefined;
  });
  // compare old  and new structure, if changed, propagate symbol table
  // FIXME performance
  if (!compareMaps(oldStructure, newStructure)) {
    propagateAllST(get, set);
    oldStructure = newStructure;
  }

  // generate the scope overlay SVG here
  // for each node, start a SVG drawing covering it and all its children.
  // node: {x,y,width,height}
  const svgNodes = nodes
    .filter((node) => node.data.isScope)
    .map((node) => {
      return {
        id: node.id + "_SVG",
        type: "SVG",
        // position: { x: node.position.x, y: node.position.y },
        position: { x: 0, y: 0 },
        data: {
          id: node.id,
        },
      };
    });
  set(ATOM_nodes, [...svgNodes, ...nodes]);

  // Generate edges for tree structure.
  const edges1 = generateEdge(nodes);
  // Generate edges for caller-callee relationship.
  const edges2 = generateCallEdges(get, set);
  set(ATOM_edges, [...edges1, ...edges2]);
  const t2 = performance.now();
  console.debug("[perf] updateView took:", (t2 - t1).toFixed(2), "ms");
}

export const ATOM_updateView = atom(null, updateView);

export const ATOM_deleteSubtree = atom(
  null,
  (get: Getter, set: Setter, todelete: string) => {
    const nodesMap = get(ATOM_nodesMap);
    const codeMap = get(ATOM_codeMap);
    const richMap = get(ATOM_richMap);
    const node = nodesMap.get(todelete);
    if (!node) throw new Error("Node not found");
    // remove all descendants
    const removeDescendants = (id: string) => {
      const node = nodesMap.get(id);
      if (!node) throw new Error("Node not found");
      node.data.treeChildrenIds.forEach((childId) => {
        removeDescendants(childId);
        nodesMap.delete(childId);
        // remove from codeMap or richMap
        if (codeMap.has(childId)) codeMap.delete(childId);
        if (richMap.has(childId)) richMap.delete(childId);
      });
    };
    removeDescendants(todelete);
    // remove the node itself
    nodesMap.delete(todelete);
    if (codeMap.has(todelete)) codeMap.delete(todelete);
    if (richMap.has(todelete)) richMap.delete(todelete);
    // update parent node's children field.
    if (node.data.treeParentId) {
      const treeParent = nodesMap.get(node.data.treeParentId);
      myassert(treeParent);
      nodesMap.set(
        node.data.treeParentId,
        produce(treeParent, (draft) => {
          draft.data.treeChildrenIds = draft.data.treeChildrenIds.filter(
            (childId) => childId !== todelete
          );
        })
      );
    }

    // autoLayoutTree(get, set);
    updateView(get, set);
  }
);

function onNodesChange(get: Getter, set: Setter, changes: NodeChange[]) {
  // compute the helper lines
  // get(setHelperLineHorizontal)(undefined);
  set(ATOM_helperLineHorizontal, undefined);
  set(ATOM_helperLineVertical, undefined);

  const nodesMap = get(ATOM_nodesMap);
  const nodes = get(ATOM_nodes);

  const codeMap = get(ATOM_codeMap);
  const richMap = get(ATOM_richMap);

  // this will be true if it's a single node being dragged
  // inside we calculate the helper lines and snap position for the position where the node is being moved to
  if (
    changes.length === 1 &&
    changes[0].type === "position" &&
    changes[0].dragging &&
    changes[0].position
  ) {
    // For hierarchical pods, we only get helper lines within the same scope.
    const change = changes[0];
    const movingNode = nodesMap.get(change.id)!;

    // distance is the sensitivity for snapping to helper lines.
    const distance = 10;
    const helperLines = getHelperLines(
      changes[0],
      nodes.filter((n) => n.parentId === movingNode.parentId),
      distance
    );

    // adjust the position into absolute position
    if (movingNode.parentId) {
      const parent = nodesMap.get(movingNode.parentId)!;
      // const offset = parent?.positionAbsolute;
      // const offset = parent?.position;
      const offset = getAbsPos(parent, nodesMap);
      helperLines.vertical && (helperLines.vertical += offset?.x || 0);
      helperLines.horizontal && (helperLines.horizontal += offset?.y || 0);
    }

    // if we have a helper line, we snap the node to the helper line position
    // this is being done by manipulating the node position inside the change object
    changes[0].position.x = helperLines.snapPosition.x ?? changes[0].position.x;
    changes[0].position.y = helperLines.snapPosition.y ?? changes[0].position.y;

    // if helper lines are returned, we set them so that they can be displayed
    set(ATOM_helperLineHorizontal, helperLines.horizontal);
    set(ATOM_helperLineVertical, helperLines.vertical);
  }

  // I think this place update the node's width/height
  //
  // NOTE: If any part of the node is produced by immer, this line may throw this error:
  // - Uncaught TypeError: Cannot assign to read only property 'width' of object '#<Object>'
  // The solution is to not use immer to produce the node object. Refs:
  // - https://github.com/xyflow/xyflow/issues/4528
  // - https://github.com/xyflow/xyflow/issues/4253
  const nextNodes = applyNodeChanges(changes, nodes);

  // console.log(
  //   "changes",
  //   changes.map((c) => c.type)
  // );

  let shouldAutoLayout = false;

  changes.forEach((change) => {
    switch (change.type) {
      case "add":
        throw new Error("Add node should not be handled here");
      case "select":
        selectPod(get, set, { id: change.id, selected: change.selected });
        break;
      case "dimensions":
        {
          // There's a weird dimencion change event fired at the end of
          // resizing a node.
          if (!change.dimensions) return;
          // if change.id is xxx_SVG, it's a SVG node, we ignore it.
          if (change.id.endsWith("_SVG")) return;

          // Since CodeNode doesn't have a height, this dimension change will
          // be filed for CodeNode at the beginning or anytime the node height
          // is changed due to content height changes.
          const node = nextNodes.find((n) => n.id === change.id);
          if (!node) throw new Error(`Node not found: ${change.id}`);
          // when the pod is not folded, we record the dimension change into
          // mywidth/myheight
          if (!node.data.podFolded) {
            node.data.myheight = change.dimensions.height;
            node.data.mywidth = change.dimensions.width;
          }
          nodesMap.set(change.id, node as AppNode);
          shouldAutoLayout = true;
        }
        break;
      case "position":
        {
          const node = nextNodes.find((n) => n.id === change.id);
          if (!node) throw new Error(`Node not found: ${change.id}`);
          nodesMap.set(change.id, node as AppNode);
        }
        break;
      case "remove":
        // Toast error is displayd below.
        break;
      default:
        // should not reach here.
        throw new Error(`Unknown change type: ${change.type}`);
    }
  });
  // Tell users to use the delete button.
  changes.map((change) => change.type).includes("remove") &&
    toast.error(
      "Cannot use delete key to remove nodes. Use the delete button instead."
    );
  updateView(get, set);
}

const debouncedAutoLayoutTree = debounce(
  (get, set) => {
    // console.log("debounced autoLayoutTree");
    // autoLayoutTree(get, set);
    // console.log("DEBUG skip autoLayoutTree");
  },
  10,
  {
    maxWait: 50,
    leading: true,
    trailing: false,
  }
);

export const ATOM_onNodesChange = atom(null, onNodesChange);
