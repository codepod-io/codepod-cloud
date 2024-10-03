import { Getter, Setter, atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import { Doc } from "yjs";
import * as Y from "yjs";
import {
  Connection,
  Edge,
  EdgeChange,
  MarkerType,
  Node,
  NodeChange,
  XYPosition,
  applyNodeChanges,
} from "@xyflow/react";
import { getHelperLines } from "@/components/nodes/utils";
import { produce } from "immer";
import { useCallback } from "react";
import {
  ATOM_codeMap,
  ATOM_edgesMap,
  ATOM_nodesMap,
  ATOM_richMap,
} from "./yjsSlice";
import { match } from "ts-pattern";
import { flextree } from "d3-flextree";
import { myassert, myNanoId } from "../utils/utils";
import { AppNode } from "./types";

import debounce from "lodash/debounce";
import { ATOM_cutId } from "./atom";
import { toast } from "react-toastify";
import { getOrCreate_ATOM_resolveResult, propagateAllST } from "./runtimeSlice";

export const ATOM_insertMode = atom<"Insert" | "Move" | "Connect">("Insert");

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

/**
 * Get the relative position of pos inside parent node.
 */
export function getRelativePos(
  pos: XYPosition,
  node: Node,
  nodesMap: Y.Map<AppNode>
): XYPosition {
  let x = pos.x;
  let y = pos.y;
  const absPos = getAbsPos(node, nodesMap);
  x -= absPos.x;
  y -= absPos.y;
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
  // NOTE: must use structuredClone, otherwise the ATOM is not marked as changed.
  const selectedPods = structuredClone(get(ATOM_selectedPods));
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
 * Get the list of nodes in the subtree rooted at id, including the root.
 * @param id subtree root
 */
function getSubtreeNodes(id: string, nodesMap: Y.Map<AppNode>): AppNode[] {
  const node = nodesMap.get(id);
  myassert(node);
  if (node.type === "SCOPE") {
    const children = node.data.childrenIds.map((childId) => {
      return getSubtreeNodes(childId, nodesMap);
    });
    return [node, ...children.flatMap((child) => child)];
  } else {
    return [node];
  }
}

export const g_nonSelectableScopes = new Set<string>();

/**
 * This function handles the real updates to the reactflow nodes to render.
 */
export function updateView(get: Getter, set: Setter) {
  const t1 = performance.now();
  const nodesMap = get(ATOM_nodesMap);
  let selectedPods = get(ATOM_selectedPods);
  const newStructure: T_id2parent = new Map();
  // TODO compare new/old structure

  // The nodes from the nodesMap.
  const nodes0 = Array.from<AppNode>(nodesMap.values());

  // render scope first
  const rootNodes = nodes0.filter((node) => !node.parentId);
  const nodes1 = rootNodes
    .map(({ id }) => {
      return getSubtreeNodes(id, nodesMap);
    })
    .flatMap((child) => child);
  // The structuredClone is necessary to not mutate in place, otherwise immer
  // will complain.
  const nodes = structuredClone(nodes1);
  nodes.forEach((node) => {
    node.selected = selectedPods.has(node.id);
  });
  // Remove width and height to let reactflow measure them.
  nodes.forEach((node) => {
    node.width = undefined;
    node.height = undefined;
    if (node.type === "SCOPE" && g_nonSelectableScopes.has(node.id)) {
      node.selectable = false;
    }
  });
  // compare old  and new structure, if changed, propagate symbol table
  // FIXME performance
  if (!compareMaps(oldStructure, newStructure)) {
    propagateAllST(get, set);
    oldStructure = newStructure;
  }

  set(ATOM_nodes, [...nodes]);

  // from edgesMap
  const edgesMap = get(ATOM_edgesMap);
  const edges0 = Array.from(edgesMap.values());
  // Generate edges for caller-callee relationship.
  const edges1 = generateCallEdges(get, set);
  set(ATOM_edges, [...edges0, ...edges1]);
  computeCollisions(get, set);
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
      if (node.type === "SCOPE") {
        node.data.childrenIds.forEach((childId) => {
          removeDescendants(childId);
          nodesMap.delete(childId);
          // remove from codeMap or richMap
          if (codeMap.has(childId)) codeMap.delete(childId);
          if (richMap.has(childId)) richMap.delete(childId);
        });
      }
    };
    removeDescendants(todelete);
    // remove the node itself
    nodesMap.delete(todelete);
    if (codeMap.has(todelete)) codeMap.delete(todelete);
    if (richMap.has(todelete)) richMap.delete(todelete);
    // update parent node's children field.
    if (node.parentId) {
      const parent = nodesMap.get(node.parentId);
      myassert(parent);
      myassert(parent.type === "SCOPE");
      nodesMap.set(
        node.parentId,
        produce(parent, (draft) => {
          draft.data.childrenIds = draft.data.childrenIds.filter(
            (childId) => childId !== todelete
          );
        })
      );
    }

    // autoLayoutTree(get, set);
    updateView(get, set);
  }
);

export const ATOM_deleteEdge = atom(
  null,
  (get: Getter, set: Setter, edgeId: string) => {
    const edgesMap = get(ATOM_edgesMap);
    edgesMap.delete(edgeId);
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

export const ATOM_onNodesChange = atom(null, onNodesChange);

function onConnect(get: Getter, set: Setter, connection: Connection) {
  const edgesMap = get(ATOM_edgesMap);
  if (!connection.source || !connection.target) return null;
  const edge = {
    // TODO This ID might not support multiple types of edges between the same nodes.
    id: `${connection.source}_${connection.target}_manual`,
    source: connection.source,
    // sourceHandle: "top",
    target: connection.target,
    type: "floating",
    // targetHandle: "top",

    // NOTE: I should not add styles here. Instead, it should be default so that
    // I don't need to migrate this piece of data.
    //
    // markerEnd: {
    //   type: MarkerType.Arrow,
    //   color: "red",
    // },
    // style: { strokeWidth: 8, stroke: "black", strokeOpacity: 0.1 },
  };
  edgesMap.set(edge.id, edge);
  updateView(get, set);
}

export const ATOM_onConnect = atom(null, onConnect);

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

/***********************
 * Collision Detection *
 **********************/

export const ATOM_collisionIds = atom<string[]>([]);
export const ATOM_escapedIds = atom<string[]>([]);

/**
 * Compute the collisions between nodes.
 * 1. when two nodes of the same scope collide
 * 2. when a node is out of its parent
 */
function computeCollisions(get: Getter, set: Setter) {
  const nodesMap = get(ATOM_nodesMap);
  const nodes = Array.from(nodesMap.values());
  const rootNodes = nodes.filter((node) => !node.parentId);
  // get collisions
  const collisionIds = getCollisionIds(rootNodes);
  const escapedIds = getEscapedIds(rootNodes);
  // get all the nodes
  rootNodes.forEach((node) => {
    computeCollisionsSubtree(get, set, node, collisionIds, escapedIds);
  });
  set(ATOM_collisionIds, collisionIds);
  set(ATOM_escapedIds, escapedIds);
}

function computeCollisionsSubtree(
  get: Getter,
  set: Setter,
  root: AppNode,
  collisionIds: string[],
  escapedIds: string[]
) {
  if (root.type !== "SCOPE") return;
  const nodesMap = get(ATOM_nodesMap);
  const children = root.data.childrenIds.map((id) => nodesMap.get(id));
  myassert(children.every((n) => !!n));
  const tmp1 = getCollisionIds(children);
  const tmp2 = getEscapedIds(children, root);
  collisionIds.push(...tmp1);
  escapedIds.push(...tmp2);
  children.forEach((child) => {
    if (child.type === "SCOPE") {
      computeCollisionsSubtree(get, set, child, collisionIds, escapedIds);
    }
  });
}

/**
 * Compute the collision ids and escaped ids.
 * @returns {collisionIds, escapedIds}
 * @returns {collisionIds} The ids of the nodes that collide with each other.
 * @returns {escapedIds} The ids of the nodes that are out of the parent.
 */
function getCollisionIds(nodes: AppNode[]): string[] {
  const collisionIds: string[] = [];

  // Check for collisions between nodes
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (isColliding(nodes[i], nodes[j])) {
        collisionIds.push(nodes[i].id, nodes[j].id);
      }
    }
  }

  return [...new Set(collisionIds)];
}

function getEscapedIds(nodes: AppNode[], parent?: AppNode): string[] {
  const escapedIds: string[] = [];

  // Check if nodes have escaped the parent
  if (parent) {
    for (const node of nodes) {
      if (hasEscaped(node, parent)) {
        // console.log("escaped", node, parent);
        escapedIds.push(node.id, parent.id);
      }
    }
  }

  return escapedIds;
}

/**
 * Check if two rectangles are colliding.
 */
function isColliding(rect1: AppNode, rect2: AppNode): boolean {
  return (
    rect1.position.x < rect2.position.x + (rect2.measured?.width ?? 0) &&
    rect1.position.x + (rect1.measured?.width ?? 0) > rect2.position.x &&
    rect1.position.y < rect2.position.y + (rect2.measured?.height ?? 0) &&
    rect1.position.y + (rect1.measured?.height ?? 0) > rect2.position.y
  );
}

/**
 * Check if a rectangle has escaped its parent.
 */
function hasEscaped(rect: AppNode, parent: AppNode): boolean {
  return (
    rect.position.x < 0 ||
    rect.position.y < 0 ||
    rect.position.x + (rect.measured?.width ?? 0) >
      (parent.measured?.width ?? 0) ||
    rect.position.y + (rect.measured?.height ?? 0) >
      (parent.measured?.height ?? 0)
  );
}
