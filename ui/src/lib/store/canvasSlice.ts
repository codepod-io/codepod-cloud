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
import { ATOM_cutId } from "./atom";
import { toast } from "react-toastify";

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
function createNewNode(type: "CODE" | "RICH"): Node<NodeData> {
  let id = myNanoId();
  const newNode: Node<NodeData> = {
    id,
    type,
    position: { x: 0, y: 0 },

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
  const anchor = nodesMap.get(anchorId);
  if (!anchor) {
    throw new Error("Anchor node not found");
  }
  if (position === "right") {
    // add to the end of children
    return { parentId: anchorId, index: anchor.data.children.length };
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
    position: "top" | "bottom" | "right" | "left",
    type: "CODE" | "RICH",
    lang?: "python" | "julia" | "javascript" | "racket"
  ) => {
    if (position === "left") {
      wrap(get, set, anchorId);
      return;
    }
    const nodesMap = get(ATOM_nodesMap);
    const { parentId, index } = getParentIndex({
      nodesMap,
      anchorId,
      position,
    });
    // create new node
    const newNode = createNewNode(type);
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

export const ATOM_moveCut = atom(
  null,
  (get, set, anchorId: string, position: "top" | "bottom" | "right") => {
    const cutId = get(ATOM_cutId);
    if (!cutId) throw new Error("No node to move");
    if (anchorId === cutId) throw new Error("Cannot move a node to itself");
    // move the node id to the new position
    // get the parent node of the anchor node
    const nodesMap = get(ATOM_nodesMap);
    const { parentId, index } = getParentIndex({
      nodesMap,
      anchorId,
      position,
    });
    const node = nodesMap.get(cutId);
    if (!node) throw new Error("Node not found");
    const oldParentId = node.data.parent;
    if (!oldParentId) throw new Error("Node has no parent");
    const oldParent = nodesMap.get(oldParentId);
    if (!oldParent) throw new Error("Old parent not found");
    const newParent = nodesMap.get(parentId);
    if (!newParent) throw new Error("New parent not found");
    // remove the node from the old parent
    const oldChildren = oldParent.data.children;
    const oldIndex = oldChildren.indexOf(cutId);
    if (oldIndex === -1) throw new Error("Node not found in old parent");
    oldChildren.splice(oldIndex, 1);
    nodesMap.set(oldParentId, {
      ...oldParent,
      data: {
        ...oldParent.data,
        children: oldChildren,
      },
    });
    // add the node to the new parent
    const newChildren = newParent.data.children;
    if (index === -1) {
      newChildren.push(cutId);
    } else {
      newChildren.splice(index, 0, cutId);
    }
    nodesMap.set(parentId, {
      ...newParent,
      data: {
        ...newParent.data,
        children: newChildren,
      },
    });

    // update the node's parent
    nodesMap.set(cutId, {
      ...node,
      data: {
        ...node.data,
        parent: parentId,
      },
    });

    // Do not clear the cutId, so that it can be explicit to the user which pod
    // is being moved.

    // set(ATOM_cutId, null);

    autoLayoutTree(get, set);
    updateView(get, set);
  }
);

function wrap(get: Getter, set: Setter, id: string) {
  // wrap the node with a new parent node, i.e., add a node between the node and its parent.
  const nodesMap = get(ATOM_nodesMap);
  const node = nodesMap.get(id);
  if (!node) throw new Error("Node not found");
  const parentId = node.data.parent;
  if (!parentId) return;
  const parent = nodesMap.get(parentId);
  if (!parent) throw new Error("Parent not found");
  // create a new node
  const newNode = createNewNode("RICH");
  get(ATOM_richMap).set(newNode.id, new Y.XmlFragment());
  nodesMap.set(newNode.id, {
    ...newNode,
    data: {
      ...newNode.data,
      parent: parentId,
      children: [id],
    },
  });
  // update the parent node
  const parentChildren = parent.data.children;
  const index = parentChildren.indexOf(id);
  if (index === -1) throw new Error("Node not found in parent");
  parentChildren.splice(index, 1, newNode.id);
  nodesMap.set(parentId, {
    ...parent,
    data: {
      ...parent.data,
      children: parentChildren,
    },
  });
  // update the node
  nodesMap.set(id, {
    ...node,
    data: {
      ...node.data,
      parent: newNode.id,
    },
  });
  autoLayoutTree(get, set);
  updateView(get, set);
}

export const ATOM_raise = atom(null, (get, set, id: string) => {
  // raise the node to replace its parent. The parent and its other descendants are removed.
  const nodesMap = get(ATOM_nodesMap);
  const node = nodesMap.get(id);
  if (!node) throw new Error("Node not found");
  const parentId = node.data.parent;
  if (!parentId) {
    toast.error("Cannot raise pod: no parent found.");
    return;
  }
  const parent = nodesMap.get(parentId);
  if (!parent) throw new Error("Parent not found");
  const grandParentId = parent.data.parent;
  if (!grandParentId) {
    toast.error("Cannot raise pod to ROOT");
    return;
  }
  const grandParent = nodesMap.get(grandParentId);
  if (!grandParent) throw new Error("Grand parent not found");
  // remove the parent node
  const grandParentChildren = grandParent.data.children;
  const parentIndex = grandParentChildren.indexOf(parentId);
  if (parentIndex === -1) throw new Error("Parent not found in grand parent");
  grandParentChildren.splice(parentIndex, 1);
  nodesMap.set(grandParentId, {
    ...grandParent,
    data: {
      ...grandParent.data,
      children: grandParentChildren,
    },
  });
  // remove the parent node and its descendants
  const removeDescendants = (toremove: string) => {
    const node = nodesMap.get(toremove);
    if (!node) throw new Error("Node not found");
    node.data.children.forEach((childId) => {
      // do not remove the node itself
      if (childId === id) return;
      removeDescendants(childId);
    });
    nodesMap.delete(toremove);
  };
  removeDescendants(parentId);
  // update the node
  nodesMap.set(id, {
    ...node,
    data: {
      ...node.data,
      parent: grandParentId,
    },
  });
  // update the grand parent node
  const grandParentChildren2 = grandParent.data.children;
  grandParentChildren2.splice(parentIndex, 0, id);
  nodesMap.set(grandParentId, {
    ...grandParent,
    data: {
      ...grandParent.data,
      children: grandParentChildren2,
    },
  });
  autoLayoutTree(get, set);
  updateView(get, set);
});

// This is remove node itself.
export const ATOM_splice = atom(null, (get, set, id: string) => {
  // remove this node; place its children in its place.
  const nodesMap = get(ATOM_nodesMap);
  const node = nodesMap.get(id);
  if (!node) throw new Error("Node not found");
  const parentId = node.data.parent;
  if (!parentId) {
    toast.error("Cannot splice ROOT node");
    return;
  }
  const parent = nodesMap.get(parentId);
  if (!parent) throw new Error("Parent not found");
  const index = parent.data.children.indexOf(id);
  if (index === -1) throw new Error("Node not found in parent");
  // remove the node
  const parentChildren = parent.data.children;
  // replace the node with its children
  parentChildren.splice(index, 1, ...node.data.children);
  nodesMap.set(parentId, {
    ...parent,
    data: {
      ...parent.data,
      children: parentChildren,
    },
  });
  // update the children
  node.data.children.forEach((childId) => {
    const child = nodesMap.get(childId);
    if (!child) throw new Error("Child not found");
    nodesMap.set(childId, {
      ...child,
      data: {
        ...child.data,
        parent: parentId,
      },
    });
  });
  // remove the node
  nodesMap.delete(id);
  autoLayoutTree(get, set);
  updateView(get, set);
});

export const ATOM_slurp = atom(null, (get, set, id: string) => {
  // move its next sibling to the end of its children.
  const nodesMap = get(ATOM_nodesMap);
  const node = nodesMap.get(id);
  if (!node) throw new Error("Node not found");
  const parentId = node.data.parent;
  if (!parentId) throw new Error("Should not slurp ROOT node");
  const parent = nodesMap.get(parentId);
  if (!parent) throw new Error("Parent not found");
  const index = parent.data.children.indexOf(id);
  if (index === -1) throw new Error("Node not found in parent");
  if (index === parent.data.children.length - 1) {
    toast.error("No next sibling to slurp");
    return;
  }
  const siblingId = parent.data.children[index + 1];
  const sibling = nodesMap.get(siblingId);
  if (!sibling) throw new Error("Sibling not found");
  // remove the sibling
  const parentChildren = parent.data.children;
  parentChildren.splice(index + 1, 1);
  nodesMap.set(parentId, {
    ...parent,
    data: {
      ...parent.data,
      children: parentChildren,
    },
  });
  // add the sibling to the node
  const children = node.data.children;
  children.push(siblingId);
  nodesMap.set(id, {
    ...node,
    data: {
      ...node.data,
      children,
    },
  });
  // update the sibling
  nodesMap.set(siblingId, {
    ...sibling,
    data: {
      ...sibling.data,
      parent: id,
    },
  });
  autoLayoutTree(get, set);
  updateView(get, set);
});

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
    if (!node) throw new Error(`Node not found: ${id}`);
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

// DEPRECATED
const ATOM_autoLayoutTree = atom(null, autoLayoutTree);

// DEPRECATED
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

// DEPRECATED
const ATOM_messUp = atom(null, messUp);
