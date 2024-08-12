import { Getter, Setter, atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import { Doc } from "yjs";
import * as Y from "yjs";
import {
  Edge,
  Node,
  NodeChange,
  XYPosition,
  applyNodeChanges,
} from "reactflow";
import { getHelperLines, sortNodes } from "@/components/nodes/utils";
import { produce } from "immer";
import { useCallback } from "react";
import { ATOM_codeMap, ATOM_nodesMap, ATOM_richMap } from "./yjsSlice";
import { match } from "ts-pattern";
import { flextree } from "d3-flextree";
import { level2color, myNanoId } from "../utils/utils";
import { NodeData } from "./types";

import debounce from "lodash/debounce";

const newScopeNodeShapeConfig = {
  width: 600,
  height: 600,
};

export const newNodeShapeConfig = {
  width: 300,
  // NOTE for import ipynb: we need to specify some reasonable height so that
  // the imported pods can be properly laid-out. 130 is a good one.
  // This number is also used in Canvas.tsx (refer to "A BIG HACK" in Canvas.tsx).
  height: 100,
};

/**
 * The new reactflow nodes for context-menu's addXXX items.
 */
function createNewNode(
  type: "SCOPE" | "CODE" | "RICH",
  position
): Node<NodeData> {
  let id = myNanoId();
  const newNode = {
    id,
    type,
    position,
    ...(type === "SCOPE"
      ? {
          width: newScopeNodeShapeConfig.width,
          height: newScopeNodeShapeConfig.height,
          style: {
            backgroundColor: level2color[0],
            width: newScopeNodeShapeConfig.width,
            height: newScopeNodeShapeConfig.height,
          },
        }
      : {
          width: newNodeShapeConfig.width,
          // // Previously, we should not specify height, so that the pod can grow
          // // when content changes. But when we add auto-layout on adding a new
          // // node, unspecified height will cause  the node to be added always at
          // // the top-left corner (the reason is unknown). Thus, we have to
          // // specify the height here. Note that this height is a dummy value;
          // // the content height will still be adjusted based on content height.
          height: newNodeShapeConfig.height,
          style: {
            // Need to set the style.width here. Otherwise, there could be weird
            // dimension changes, and may cause a node to keep expanding its
            // width.
            width: newNodeShapeConfig.width,
            //   // It turns out that this height should not be specified to let the
            //   // height change automatically.
            //   //
            //   // height: 200
          },
        }),
    data: {
      // label: id,
      // name: "",
      // FIXME the key "ROOT" is deprecated.
      // parent: "ROOT",
      level: 0,
      children: [],
      folded: false,
      lang: "python",
    },
    dragHandle: ".custom-drag-handle",
  };
  return newNode;
}

/**
 * Get the absoluate position of the node.
 */
export function getAbsPos(node: Node, nodesMap: Y.Map<Node>): XYPosition {
  let x = node.position.x;
  let y = node.position.y;
  while (node.parentNode) {
    node = nodesMap.get(node.parentNode)!;
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

/**
 * This function handles the real updates to the reactflow nodes to render.
 */
export function updateView(get: Getter, set: Setter) {
  const nodesMap = get(ATOM_nodesMap);
  let selectedPods = get(ATOM_selectedPods);
  // let nodes = Array.from<Node>(nodesMap.values());
  // follow the tree order, skip folded nodes
  function dfs(node: Node<NodeData>) {
    if (node.data.folded) return [node];
    let children = node.data.children.map((id) => nodesMap.get(id)!);
    return [node, ...children.flatMap(dfs)];
  }
  let nodes = dfs(nodesMap.get("ROOT")!);
  set(ATOM_nodes, nodes);
  // edges view
  // const edgesMap = get().getEdgesMap();
  // set({ edges: Array.from<Edge>(edgesMap.values()).filter((e) => e) });
  function generateEdge(nodes: Node[]) {
    const edges: any[] = [];
    nodes.forEach((node) => {
      node.data?.children?.map((id: string) => {
        edges.push({
          id: `${node.id}-${id}`,
          source: node.id,
          target: id,
        });
      });
    });
    return edges;
  }
  set(ATOM_edges, generateEdge(nodes));
}

export const ATOM_updateView = atom(null, updateView);

/**
 * Given the anchor node and the handle position, return the insertion position
 * of the new node.
 * @returns {parentId: string, index: number} the parent node id and the index
 * of the new node in the parent's children field.
 */
function getParentIndex({
  nodesMap,
  anchorId,
  position,
}: {
  nodesMap: Y.Map<Node<NodeData>>;
  anchorId: string;
  position: "top" | "bottom" | "right";
}): { parentId: string; index: number } {
  if (position === "right") return { parentId: anchorId, index: 0 };

  const anchor = nodesMap.get(anchorId);
  if (!anchor) {
    throw new Error("Anchor node not found");
  }
  const anchorParentId = anchor.data.parent;
  if (!anchorParentId) {
    throw new Error("Anchor node has no parent");
  }
  const parent = nodesMap.get(anchorParentId)!;
  const index = parent.data.children.indexOf(anchorId);
  switch (position) {
    case "top":
      return { parentId: anchorParentId, index };
    case "bottom":
      return { parentId: anchorParentId, index: index + 1 };
    default:
      throw new Error("unknown position");
  }
}

export const ATOM_addNode = atom(
  null,
  (
    get,
    set,
    anchorId: string,
    position: "top" | "bottom" | "right",
    type: "CODE" | "RICH",
    // lang?: "python" | "julia" | "javascript" | "racket"
    lang?: string
  ) => {
    const nodesMap = get(ATOM_nodesMap);
    const { parentId, index } = getParentIndex({
      nodesMap,
      anchorId,
      position,
    });
    // create new node
    const newNode = createNewNode(type, { x: 0, y: 0 });
    switch (type) {
      case "CODE":
        get(ATOM_codeMap).set(newNode.id, new Y.Text());
        break;
      case "RICH":
        get(ATOM_richMap).set(newNode.id, new Y.XmlFragment());
        break;
    }
    nodesMap.set(newNode.id, {
      ...newNode,
      data: {
        ...newNode.data,
        parent: parentId,
        lang,
      },
    });
    const parent = nodesMap.get(parentId);
    if (!parent) throw new Error(`Parent node not found: ${parentId}`);
    // add the node to the children field at index
    const children = [...parent.data.children];
    if (index === -1) {
      children.push(newNode.id);
    } else {
      children.splice(index, 0, newNode.id);
    }
    // update the parent node
    nodesMap.set(parentId, {
      ...parent,
      data: {
        ...parent.data,
        children,
      },
    });
    autoLayoutTree(get, set);
    updateView(get, set);
  }
);

function toggleFold(get: Getter, set: Setter, id: string) {
  const nodesMap = get(ATOM_nodesMap);
  const node = nodesMap.get(id);
  if (!node) throw new Error("Node not found");
  nodesMap.set(id, {
    ...node,
    data: {
      ...node.data,
      folded: !node.data.folded,
    },
  });
  if (!node.data.folded) {
    // This is a fold operation. This doesn't trigger auto-layout because
    // nodesMap sees no change.
    debouncedAutoLayoutTree(get, set);
  }
  updateView(get, set);
}

export const ATOM_toggleFold = atom(null, toggleFold);

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
      nodes.filter((n) => n.parentNode === movingNode.parentNode),
      distance
    );

    // adjust the position into absolute position
    if (movingNode.parentNode) {
      const parent = nodesMap.get(movingNode.parentNode)!;
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
  const nextNodes = applyNodeChanges(changes, nodes);

  // console.log(
  //   "changes",
  //   changes.map((c) => c.type)
  // );

  changes.forEach((change) => {
    switch (change.type) {
      case "reset":
        break;
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

          // Since CodeNode doesn't have a height, this dimension change will
          // be filed for CodeNode at the beginning or anytime the node height
          // is changed due to content height changes.
          const node = nextNodes.find((n) => n.id === change.id);
          if (!node) throw new Error(`Node not found: ${change.id}`);
          nodesMap.set(change.id, node);
        }
        break;
      case "position":
        {
          const node = nextNodes.find((n) => n.id === change.id);
          if (!node) throw new Error(`Node not found: ${change.id}`);
          nodesMap.set(change.id, node);
        }

        break;
      case "remove":
        // FIXME Would reactflow fire multiple remove for all nodes? If so,
        // do they have a proper order? Seems yes.
        // remove from yjs
        //
        // TODO remove from codeMap and richMap?
        const node = nodesMap.get(change.id);
        if (!node) throw new Error("Node not found");
        // remove all descendants
        const removeDescendants = (id) => {
          const node = nodesMap.get(id);
          if (!node) throw new Error("Node not found");
          node.data.children.forEach((childId) => {
            removeDescendants(childId);
            nodesMap.delete(childId);
            // remove from codeMap or richMap
            if (codeMap.has(childId)) codeMap.delete(childId);
            if (richMap.has(childId)) richMap.delete(childId);
          });
        };
        removeDescendants(change.id);
        // remove the node itself
        nodesMap.delete(change.id);
        if (codeMap.has(change.id)) codeMap.delete(change.id);
        if (richMap.has(change.id)) richMap.delete(change.id);
        // update parent node's children field.
        const parentId = node.data.parent;
        if (!parentId) break;
        const parent = nodesMap.get(parentId);
        if (!parent) break;
        nodesMap.set(
          parentId,
          produce(parent, (draft) => {
            draft.data.children.splice(
              draft.data.children.indexOf(change.id),
              1
            );
          })
        );

        // remove from selected pods
        selectPod(get, set, { id: change.id, selected: false });
        break;
      default:
        // should not reach here.
        throw new Error("Unknown change type");
    }
  });
  debouncedAutoLayoutTree(get, set);
  updateView(get, set);
}

const debouncedAutoLayoutTree = debounce(
  (get, set) => {
    // console.log("debounced autoLayoutTree");
    autoLayoutTree(get, set);
  },
  10,
  { maxWait: 50 }
);

export const ATOM_onNodesChange = atom(null, onNodesChange);

/**
 * Auto layout.
 */
function layoutSubTree(nodesMap: Y.Map<Node<NodeData>>, id: string) {
  // const data = subtree("1");
  const rootNode = nodesMap.get(id);
  // console.log("RootNode", rootNode);
  if (!rootNode) throw new Error("Root node not found");
  function subtree(id: string) {
    const node = nodesMap.get(id);
    if (!node) throw new Error("Node not found");
    const children = node.data.children;
    return {
      id: node.id,
      width: node.width!,
      height: node.height!,
      children: node.data.folded ? [] : children ? children.map(subtree) : [],
    };
  }
  const data = subtree(id);
  // console.log("Data", data);
  const paddingX = 100;
  const paddingY = 50;

  const layout = flextree({
    children: (data) => data.children,
    // horizontal
    nodeSize: (node) => [
      node.data.height + paddingY,
      node.data.width + paddingX,
    ],
    // spacing: 100,
  });
  const tree = layout.hierarchy(data);
  layout(tree);
  // console.log("Layout Result", layout.dump(tree)); //=> prints the results
  // console.log("Tree", tree);
  // tree.each((node) => console.log(`(${node.x}, ${node.y})`));
  // update the nodesMap
  tree.each((node) => {
    const n = nodesMap.get(node.data.id)!;
    // horizontal
    nodesMap.set(node.data.id, {
      ...n,
      position: {
        x: rootNode.position.x + node.y,
        // center the node
        y:
          rootNode.position.y +
          rootNode.height! / 2 +
          node.x -
          node.data.height / 2,
        // y: node.x,
      },
    });
  });
}

function autoLayoutTree(get: Getter, set: Setter) {
  const nodesMap = get(ATOM_nodesMap);
  layoutSubTree(nodesMap, "ROOT");
  updateView(get, set);
}

export const ATOM_autoLayoutTree = atom(null, autoLayoutTree);

function messUp(get: Getter, set: Setter) {
  const nodesMap = get(ATOM_nodesMap);
  const nodes = Array.from(nodesMap.values());
  nodes.forEach((node) => {
    if (node.type === "SCOPE") return;
    if (node.id === "ROOT") return;
    const pos = getAbsPos(node, nodesMap);
    node.position = { x: pos.x - 100, y: pos.y - 100 };
    nodesMap.set(node.id, node);
  });
  updateView(get, set);
}

export const ATOM_messUp = atom(null, messUp);
