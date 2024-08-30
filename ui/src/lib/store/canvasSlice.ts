import { Getter, Setter, atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import { Doc } from "yjs";
import * as Y from "yjs";
import {
  Edge,
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
import { level2color, myNanoId } from "../utils/utils";
import { AppNode, CodeNodeType, RichNodeType, ScopeNodeType } from "./types";

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
 * Create a new node. The node will start from the given position. Typically
 * auto-layout will be triggered after this to move the new node to place in an
 * animation.
 */
function createNewNode(
  type: "CODE" | "RICH" | "SCOPE",
  position: XYPosition = { x: 0, y: 0 }
): AppNode {
  let id = myNanoId();
  const commonData = {
    children: [],
    folded: false,
    isScope: false,
  };
  const commonAttrs = {
    id,
    type,
    position,
    dragHandle: ".custom-drag-handle",
  };
  switch (type) {
    case "CODE":
      {
        return {
          ...commonAttrs,
          data: {
            ...commonData,
            lang: "python",
          },
        } as CodeNodeType;
      }
      break;
    case "RICH":
      {
        return {
          ...commonAttrs,
          data: {
            ...commonData,
          },
        } as RichNodeType;
      }
      break;
    case "SCOPE":
      {
        return {
          ...commonAttrs,
          data: {
            ...commonData,
            scopeChildren: [],
          },
        } as ScopeNodeType;
      }
      break;
    default:
      throw new Error("Unknown type");
  }
}

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

/**
 * This function handles the real updates to the reactflow nodes to render.
 */
export function updateView(get: Getter, set: Setter) {
  const nodesMap = get(ATOM_nodesMap);
  let selectedPods = get(ATOM_selectedPods);
  // let nodes = Array.from<Node>(nodesMap.values());
  // follow the tree order, skip folded nodes
  function dfs(id: string): AppNode[] {
    const node = nodesMap.get(id);
    if (!node) throw new Error(`Node not found: ${id}`);
    if (node.data.folded) return [node];
    let res = [node];
    res = [...res, ...node.data.children.flatMap(dfs)];
    if (node.type === "SCOPE") {
      res = [...res, ...node.data.scopeChildren.flatMap(dfs)];
    }
    return res;
  }
  let nodes = dfs("ROOT");
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

  // edges view
  // const edgesMap = get().getEdgesMap();
  // set({ edges: Array.from<Edge>(edgesMap.values()).filter((e) => e) });
  function generateEdge(nodes: AppNode[]) {
    const edges: Edge[] = [];
    nodes.forEach((node) => {
      node.data?.children?.map((id: string) => {
        edges.push({
          id: `${node.id}-${id}`,
          source: node.id,
          target: id,
          sourceHandle: "right",
          targetHandle: "left",
        });
      });
      node.type === "SCOPE" &&
        node.data?.scopeChildren?.map((id: string) => {
          edges.push({
            id: `${node.id}-${id}`,
            source: node.id,
            target: id,
            sourceHandle: "left",
            targetHandle: "left",
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
  nodesMap: Y.Map<AppNode>;
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

export const ATOM_toggleScope = atom(null, (get, set, id: string) => {
  const nodesMap = get(ATOM_nodesMap);
  const node = nodesMap.get(id);
  if (!node) throw new Error("Node not found");
  nodesMap.set(id, {
    ...node,
    data: {
      ...node.data,
      isScope: !node.data.isScope,
    },
  } as typeof node);
  autoLayoutTree(get, set);
  updateView(get, set);
});

const addNode_top_bottom = (
  get: Getter,
  set: Setter,
  {
    anchorId,
    position,
    type,
    lang,
  }: {
    anchorId: string;
    position: "top" | "bottom";
    type: "CODE" | "RICH";
    lang?: "python" | "julia" | "javascript" | "racket";
  }
) => {
  const nodesMap = get(ATOM_nodesMap);
  const anchor = nodesMap.get(anchorId);
  if (!anchor) {
    throw new Error("Anchor node not found");
  }
  const parentId = anchor.data.parent;
  if (!parentId) {
    throw new Error("Anchor node has no parent");
  }
  const parent = nodesMap.get(parentId);
  if (!parent) throw new Error(`Parent node not found: ${parentId}`);

  const newNode = createNewNode(type, anchor.position);
  switch (newNode.type) {
    case "CODE":
      get(ATOM_codeMap).set(newNode.id, new Y.Text());
      if (lang) newNode.data.lang = lang;
      break;
    case "RICH":
      get(ATOM_richMap).set(newNode.id, new Y.XmlFragment());
      break;
  }

  // add node
  nodesMap.set(newNode.id, {
    ...newNode,
    data: {
      ...newNode.data,
      parent: parentId,
    },
  } as typeof newNode);

  if (parent.type === "SCOPE") {
    // check in scopeChildren
    let index = parent.data.scopeChildren.indexOf(anchorId);
    if (index !== -1) {
      if (position === "bottom") {
        index = index + 1;
      }
      // add the node to the children field at index
      const scopeChildren = [...parent.data.scopeChildren];
      if (index === -1) {
        scopeChildren.push(newNode.id);
      } else {
        scopeChildren.splice(index, 0, newNode.id);
      }
      // update the parent node
      nodesMap.set(parentId, {
        ...parent,
        data: {
          ...parent.data,
          scopeChildren,
        },
      } as typeof parent);
      return;
    }
  }
  let index = parent.data.children.indexOf(anchorId);
  if (position == "bottom") {
    index = index + 1;
  }
  if (index === -1) return;
  // add the node to the children field at index
  const children = [...parent.data.children];
  children.splice(index, 0, newNode.id);
  // update the parent node
  nodesMap.set(parentId, {
    ...parent,
    data: {
      ...parent.data,
      children,
    },
  } as typeof parent);

  autoLayoutTree(get, set);
  updateView(get, set);
};

export const addNode_top = (
  get: Getter,
  set: Setter,
  {
    anchorId,
    type,
    lang,
  }: {
    anchorId: string;
    type: "CODE" | "RICH";
    lang?: "python" | "julia" | "javascript" | "racket";
  }
) => {
  addNode_top_bottom(get, set, {
    anchorId,
    position: "top",
    type,
    lang,
  });
};

export const addNode_bottom = (
  get: Getter,
  set,
  {
    anchorId,
    type,
    lang,
  }: {
    anchorId: string;
    type: "CODE" | "RICH";
    lang?: "python" | "julia" | "javascript" | "racket";
  }
) => {
  addNode_top_bottom(get, set, {
    anchorId,
    position: "bottom",
    type,
    lang,
  });
};

const addNode_in = (
  get: Getter,
  set: Setter,
  {
    anchorId,
    type,
    lang,
  }: {
    anchorId: string;
    type: "CODE" | "RICH";
    lang?: "python" | "julia" | "javascript" | "racket";
  }
) => {
  // add node inside the scope (which must be a scope with no children or scopeChildren)
  const nodesMap = get(ATOM_nodesMap);
  const anchor = nodesMap.get(anchorId);
  if (!anchor) {
    throw new Error("Anchor node not found");
  }
  if (anchor.type !== "SCOPE") {
    throw new Error("Anchor node is not a scope");
  }
  if (anchor.data.scopeChildren.length > 0) {
    throw new Error("Scope node is not empty");
  }
  const newNode = createNewNode(type, anchor.position);
  switch (newNode.type) {
    case "CODE":
      if (lang) newNode.data.lang = lang;
      get(ATOM_codeMap).set(newNode.id, new Y.Text());
      break;
    case "RICH":
      get(ATOM_richMap).set(newNode.id, new Y.XmlFragment());
      break;
  }
  // add node
  nodesMap.set(newNode.id, {
    ...newNode,
    data: {
      ...newNode.data,
      parent: anchorId,
    },
  } as typeof newNode);
  // update the parent node
  nodesMap.set(anchorId, {
    ...anchor,
    data: {
      ...anchor.data,
      scopeChildren: [newNode.id],
    },
  } as typeof anchor);
  autoLayoutTree(get, set);
  updateView(get, set);
};

const addNode_right = (
  get: Getter,
  set: Setter,
  {
    anchorId,
    type,
    lang,
  }: {
    anchorId: string;
    type: "CODE" | "RICH";
    lang?: "python" | "julia" | "javascript" | "racket";
  }
) => {
  const nodesMap = get(ATOM_nodesMap);
  const anchor = nodesMap.get(anchorId);
  if (!anchor) {
    throw new Error("Anchor node not found");
  }
  const parentId = anchorId;
  const index = anchor.data.children.length;
  const parent = nodesMap.get(parentId);
  if (!parent) throw new Error(`Parent node not found: ${parentId}`);

  const newNode = createNewNode(type, anchor.position);
  switch (newNode.type) {
    case "CODE":
      if (lang) newNode.data.lang = lang;
      get(ATOM_codeMap).set(newNode.id, new Y.Text());
      break;
    case "RICH":
      get(ATOM_richMap).set(newNode.id, new Y.XmlFragment());
      break;
  }
  // add node
  nodesMap.set(newNode.id, {
    ...newNode,
    data: {
      ...newNode.data,
      parent: parentId,
    },
  } as typeof newNode);

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
  } as typeof parent);
  autoLayoutTree(get, set);
  updateView(get, set);
};

export const addNode_left = (
  get,
  set,
  {
    anchorId,
    type,
    lang,
  }: {
    anchorId: string;
    type: "CODE" | "RICH";
    lang?: "python" | "julia" | "javascript" | "racket";
  }
) => {
  wrap({ get, set, id: anchorId, type, lang });
};

export const ATOM_addNode = atom(
  null,
  (
    get,
    set,
    {
      anchorId,
      position,
      type,
      lang,
    }: {
      anchorId: string;
      position: "top" | "bottom" | "right" | "left" | "in";
      type: "CODE" | "RICH";
      lang?: "python" | "julia" | "javascript" | "racket";
    }
  ) => {
    match(position)
      .with("top", () => {
        addNode_top(get, set, { anchorId, type, lang });
      })
      .with("bottom", () => {
        addNode_bottom(get, set, { anchorId, type, lang });
      })
      .with("right", () => {
        addNode_right(get, set, { anchorId, type, lang });
      })
      .with("left", () => {
        addNode_left(get, set, { anchorId, type, lang });
      })
      .with("in", () => {
        addNode_in(get, set, { anchorId, type, lang });
      })
      .exhaustive();
  }
);

function checkCutValid({
  nodesMap,
  anchorId,
  cutId,
}: {
  nodesMap: Y.Map<AppNode>;
  anchorId: string;
  cutId: string;
}) {
  // the anchor should not be in the subtree of the cut node.
  // loop through the subtree of cutId, if we find anchorId, return false.
  const dfs = (id: string): boolean => {
    const node = nodesMap.get(id);
    if (!node) throw new Error("Node not found");
    if (id === anchorId) return false;
    return [
      ...node.data.children,
      ...(node.type === "SCOPE" ? node.data.scopeChildren : []),
    ].every((childId) => dfs(childId));
  };
  return dfs(cutId);
}

function moveCut_top_bottom(
  get: Getter,
  set: Setter,
  anchorId: string,
  position: "top" | "bottom"
) {
  const cutId = get(ATOM_cutId);
  if (!cutId) throw new Error("No node to move");
  if (anchorId === cutId) throw new Error("Cannot move a node to itself");
  // move the node id to the new position
  // get the parent node of the anchor node
  const nodesMap = get(ATOM_nodesMap);
  const anchor = nodesMap.get(anchorId);
  if (!anchor) throw new Error("Anchor node not found");
  // the new parent is the anchor's parent
  const newParentId = anchor.data.parent;
  if (!newParentId) throw new Error("Anchor node has no parent");
  const newParent = nodesMap.get(newParentId);
  if (!newParent) throw new Error("Parent not found");

  // The cut node
  const node = nodesMap.get(cutId);
  if (!node) throw new Error("Node not found");
  const oldParentId = node.data.parent;
  if (!oldParentId) throw new Error("Node has no parent");
  const oldParent = nodesMap.get(oldParentId);
  if (!oldParent) throw new Error("Old parent not found");

  // remove the node from the old parent
  if (
    oldParent.type === "SCOPE" &&
    oldParent.data.scopeChildren.includes(cutId)
  ) {
    const oldScopeChildren = oldParent.data.scopeChildren;
    const oldIndex = oldScopeChildren.indexOf(cutId);
    oldScopeChildren.splice(oldIndex, 1);
    nodesMap.set(oldParentId, {
      ...oldParent,
      data: {
        ...oldParent.data,
        scopeChildren: oldScopeChildren,
      },
    });
  } else {
    const oldChildren = oldParent.data.children;
    const oldIndex = oldChildren.indexOf(cutId);
    oldChildren.splice(oldIndex, 1);
    nodesMap.set(oldParentId, {
      ...oldParent,
      data: {
        ...oldParent.data,
        children: oldChildren,
      },
    } as typeof oldParent);
  }
  // add the node to the new parent
  if (
    newParent.type === "SCOPE" &&
    newParent.data.scopeChildren.includes(anchorId)
  ) {
    const newScopeChildren = newParent.data.scopeChildren;
    const index = newScopeChildren.indexOf(anchorId);
    if (position === "top") {
      newScopeChildren.splice(index, 0, cutId);
    } else {
      newScopeChildren.splice(index + 1, 0, cutId);
    }
    nodesMap.set(newParentId, {
      ...newParent,
      data: {
        ...newParent.data,
        scopeChildren: newScopeChildren,
      },
    });
  } else {
    const newChildren = newParent.data.children;
    const index = newChildren.indexOf(anchorId);
    if (position === "top") {
      newChildren.splice(index, 0, cutId);
    } else {
      newChildren.splice(index + 1, 0, cutId);
    }
    nodesMap.set(newParentId, {
      ...newParent,
      data: {
        ...newParent.data,
        children: newChildren,
      },
    } as typeof newParent);
  }

  // update the node's parent
  nodesMap.set(cutId, {
    ...node,
    data: {
      ...node.data,
      parent: newParentId,
    },
  } as typeof node);

  // Do not clear the cutId, so that it can be explicit to the user which pod
  // is being moved.

  // set(ATOM_cutId, null);
  autoLayoutTree(get, set);
  updateView(get, set);
}

function moveCut_right(get: Getter, set: Setter, anchorId: string) {
  const cutId = get(ATOM_cutId);
  if (!cutId) throw new Error("No node to move");
  if (anchorId === cutId) throw new Error("Cannot move a node to itself");
  // move the node id to the new position
  // get the parent node of the anchor node
  const nodesMap = get(ATOM_nodesMap);
  const anchor = nodesMap.get(anchorId);
  if (!anchor) throw new Error("Anchor node not found");
  // the new parent is the anchor's parent
  const newParentId = anchorId;
  const newParent = nodesMap.get(newParentId);
  if (!newParent) throw new Error("Parent not found");

  // The cut node
  const node = nodesMap.get(cutId);
  if (!node) throw new Error("Node not found");
  const oldParentId = node.data.parent;
  if (!oldParentId) throw new Error("Node has no parent");
  const oldParent = nodesMap.get(oldParentId);
  if (!oldParent) throw new Error("Old parent not found");

  // remove the node from the old parent
  if (
    oldParent.type === "SCOPE" &&
    oldParent.data.scopeChildren.includes(cutId)
  ) {
    const oldScopeChildren = oldParent.data.scopeChildren;
    const oldIndex = oldScopeChildren.indexOf(cutId);
    oldScopeChildren.splice(oldIndex, 1);
    nodesMap.set(oldParentId, {
      ...oldParent,
      data: {
        ...oldParent.data,
        scopeChildren: oldScopeChildren,
      },
    });
  } else {
    const oldChildren = oldParent.data.children;
    const oldIndex = oldChildren.indexOf(cutId);
    oldChildren.splice(oldIndex, 1);
    nodesMap.set(oldParentId, {
      ...oldParent,
      data: {
        ...oldParent.data,
        children: oldChildren,
      },
    } as typeof oldParent);
  }
  // add the node to the new parent
  const newChildren = newParent.data.children;
  newChildren.push(cutId);
  nodesMap.set(newParentId, {
    ...newParent,
    data: {
      ...newParent.data,
      children: newChildren,
    },
  } as typeof newParent);

  // update the node's parent
  nodesMap.set(cutId, {
    ...node,
    data: {
      ...node.data,
      parent: newParentId,
    },
  } as typeof node);

  // Do not clear the cutId, so that it can be explicit to the user which pod
  // is being moved.

  // set(ATOM_cutId, null);
  autoLayoutTree(get, set);
  updateView(get, set);
}

export const ATOM_moveCut = atom(
  null,
  (get, set, anchorId: string, position: "top" | "bottom" | "right") => {
    const nodesMap = get(ATOM_nodesMap);
    const cutId = get(ATOM_cutId);
    if (!cutId) throw new Error("No node to move");
    if (!checkCutValid({ nodesMap, anchorId, cutId })) {
      toast.error("Cannot move a node to its own subtree");
      return;
    }
    match(position)
      .with("top", () => {
        moveCut_top_bottom(get, set, anchorId, "top");
      })
      .with("bottom", () => {
        moveCut_top_bottom(get, set, anchorId, "bottom");
      })
      .with("right", () => {
        moveCut_right(get, set, anchorId);
      })
      .exhaustive();
  }
);

export const ATOM_addScope = atom(null, (get, set, id: string) => {
  // add a scope surrounding the node

  const nodesMap = get(ATOM_nodesMap);
  const node = nodesMap.get(id);
  if (!node) throw new Error("Node not found");
  const parentId = node.data.parent;
  if (!parentId) throw new Error("Node has no parent");
  const parent = nodesMap.get(parentId);
  if (!parent) throw new Error("Parent not found");
  // create a new scope node
  const newScopeNode = createNewNode("SCOPE", node.position);
  // put the new node in the parent's children field
  if (parent.type === "SCOPE" && parent.data.scopeChildren.includes(id)) {
    const parentScopeChildren = parent.data.scopeChildren;
    const index = parentScopeChildren.indexOf(id);
    parentScopeChildren.splice(index, 1, newScopeNode.id);
    nodesMap.set(parentId, {
      ...parent,
      data: {
        ...parent.data,
        scopeChildren: parentScopeChildren,
      },
    } as typeof parent);
  } else {
    const parentChildren = parent.data.children;
    const index = parentChildren.indexOf(id);
    if (index === -1) throw new Error("Node not found in parent");
    parentChildren.splice(index, 1, newScopeNode.id);
    nodesMap.set(parentId, {
      ...parent,
      data: {
        ...parent.data,
        children: parentChildren,
      },
    } as typeof parent);
  }

  // update the scope node
  // 1. the node will be the scopeChildren of the scope node
  // 2. the children of the node will be the children of the scope node
  nodesMap.set(newScopeNode.id, {
    ...newScopeNode,
    data: {
      ...newScopeNode.data,
      parent: parentId,
      scopeChildren: [id],
      children: node.data.children,
    },
  } as typeof newScopeNode);
  // update the node children's parent to be this new scope node
  node.data.children.forEach((childId) => {
    const child = nodesMap.get(childId);
    if (!child) throw new Error("Child not found");
    nodesMap.set(childId, {
      ...child,
      data: {
        ...child.data,
        parent: newScopeNode.id,
      },
    } as typeof child);
  });
  // update the node
  // 1. the scope node will be the parent of the node
  nodesMap.set(id, {
    ...node,
    data: {
      ...node.data,
      parent: newScopeNode.id,
      children: [],
    },
  } as typeof node);
  autoLayoutTree(get, set);
  updateView(get, set);
});

function wrap({
  get,
  set,
  id,
  type,
  lang,
}: {
  get: Getter;
  set: Setter;
  id: string;
  type: "CODE" | "RICH";
  lang?: "python" | "julia" | "javascript" | "racket";
}) {
  // wrap the node with a new parent node, i.e., add a node between the node and its parent.
  const nodesMap = get(ATOM_nodesMap);
  const node = nodesMap.get(id);
  if (!node) throw new Error("Node not found");
  const parentId = node.data.parent;
  if (!parentId) return;
  const parent = nodesMap.get(parentId);
  if (!parent) throw new Error("Parent not found");
  // create a new node
  const newNode = createNewNode(type, node.position);
  switch (newNode.type) {
    case "CODE":
      if (lang) newNode.data.lang = lang;
      get(ATOM_codeMap).set(newNode.id, new Y.Text());
      break;
    case "RICH":
      get(ATOM_richMap).set(newNode.id, new Y.XmlFragment());
      break;
  }
  get(ATOM_richMap).set(newNode.id, new Y.XmlFragment());
  nodesMap.set(newNode.id, {
    ...newNode,
    data: {
      ...newNode.data,
      parent: parentId,
      lang,
      children: [id],
    },
  } as typeof newNode);
  // update the parent node
  if (parent.type === "SCOPE" && parent.data.scopeChildren.includes(id)) {
    const index = parent.data.scopeChildren.indexOf(id);
    parent.data.scopeChildren.splice(index, 1, newNode.id);
    nodesMap.set(parentId, {
      ...parent,
      data: {
        ...parent.data,
        scopeChildren: parent.data.scopeChildren,
      },
    } as typeof parent);
  } else {
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
    } as typeof parent);
  }

  // update the node
  nodesMap.set(id, {
    ...node,
    data: {
      ...node.data,
      parent: newNode.id,
    },
  } as typeof node);
  autoLayoutTree(get, set);
  updateView(get, set);
}

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
  } as typeof parent);
  // add the sibling to the node
  const children = node.data.children;
  children.push(siblingId);
  nodesMap.set(id, {
    ...node,
    data: {
      ...node.data,
      children,
    },
  } as typeof node);
  // update the sibling
  nodesMap.set(siblingId, {
    ...sibling,
    data: {
      ...sibling.data,
      parent: id,
    },
  } as typeof sibling);
  autoLayoutTree(get, set);
  updateView(get, set);
});

export const ATOM_unslurp = atom(null, (get, set, id: string) => {
  // move its last child to its sibling
  const nodesMap = get(ATOM_nodesMap);
  const node = nodesMap.get(id);
  if (!node) throw new Error("Node not found");
  const parentId = node.data.parent;
  if (!parentId) throw new Error("Should not unslurp ROOT node");
  const parent = nodesMap.get(parentId);
  if (!parent) throw new Error("Parent not found");
  const index = parent.data.children.indexOf(id);
  if (index === -1) throw new Error("Node not found in parent");
  const lastChildId = node.data.children.pop();
  if (!lastChildId) {
    toast.error("No child to unslurp");
    return;
  }
  const lastChild = nodesMap.get(lastChildId);
  if (!lastChild) throw new Error("Child not found");
  // remove the last child
  nodesMap.set(id, {
    ...node,
    data: {
      ...node.data,
      children: node.data.children,
    },
  } as typeof node);
  // add the last child to the parent
  const parentChildren = parent.data.children;
  parentChildren.splice(index + 1, 0, lastChildId);
  nodesMap.set(parentId, {
    ...parent,
    data: {
      ...parent.data,
      children: parentChildren,
    },
  } as typeof parent);
  // update the last child
  nodesMap.set(lastChildId, {
    ...lastChild,
    data: {
      ...lastChild.data,
      parent: parentId,
    },
  } as typeof lastChild);

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
  } as typeof node);
  if (!node.data.folded) {
    // This is a fold operation. This doesn't trigger auto-layout because
    // nodesMap sees no change.
    debouncedAutoLayoutTree(get, set);
  }
  updateView(get, set);
}

export const ATOM_toggleFold = atom(null, toggleFold);

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
      node.data.children.forEach((childId) => {
        removeDescendants(childId);
        nodesMap.delete(childId);
        // remove from codeMap or richMap
        if (codeMap.has(childId)) codeMap.delete(childId);
        if (richMap.has(childId)) richMap.delete(childId);
      });
      if (node.type === "SCOPE") {
        node.data.scopeChildren.forEach((childId) => {
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
    const parentId = node.data.parent;
    if (!parentId) return;
    const parent = nodesMap.get(parentId);
    if (!parent) return;

    nodesMap.set(parentId, {
      ...parent,
      data: {
        ...parent.data,
        children: parent.data.children.filter(
          (childId) => childId !== todelete
        ),
        ...(parent.type === "SCOPE"
          ? {
              scopeChildren: parent.data.scopeChildren.filter(
                (childId) => childId !== todelete
              ),
            }
          : {}),
      },
    } as typeof parent);
    autoLayoutTree(get, set);
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

          // Since CodeNode doesn't have a height, this dimension change will
          // be filed for CodeNode at the beginning or anytime the node height
          // is changed due to content height changes.
          const node = nextNodes.find((n) => n.id === change.id);
          if (!node) throw new Error(`Node not found: ${change.id}`);
          nodesMap.set(change.id, node as AppNode);
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
        break;
      default:
        // should not reach here.
        throw new Error(`Unknown change type: ${change.type}`);
    }
  });
  const effectiveChanges = changes
    .map((c) => c.type)
    .filter((t) => t !== "select");
  if (effectiveChanges.length > 0) {
    // console.log("effectiveChanges", effectiveChanges);
    debouncedAutoLayoutTree(get, set);
  }
  updateView(get, set);
}

const debouncedAutoLayoutTree = debounce(
  (get, set) => {
    // console.log("debounced autoLayoutTree");
    autoLayoutTree(get, set);
    // console.log("DEBUG skip autoLayoutTree");
  },
  10,
  { maxWait: 50 }
);

export const ATOM_onNodesChange = atom(null, onNodesChange);

/**
 * Starting from the node id, do postorder dfs traversal and do auto-layout on scope node.
 */
function dfsForScope(
  get: Getter,
  set: Setter,
  nodesMap: Y.Map<AppNode>,
  id: string
) {
  const node = nodesMap.get(id);
  if (!node) throw new Error("Node not found");
  node.data.children.forEach((childId) => {
    dfsForScope(get, set, nodesMap, childId);
  });
  if (node.type === "SCOPE") {
    node.data.scopeChildren.forEach((childId) => {
      dfsForScope(get, set, nodesMap, childId);
    });
  }
  if (node.type === "SCOPE" || id === "ROOT") {
    // if (node.type === "SCOPE") {
    layoutSubTree(nodesMap, id);
  }
}

const scopeSizeMap = new Map<string, { width: number; height: number }>();

/**
 * Auto layout.
 */
function layoutSubTree(nodesMap: Y.Map<AppNode>, id: string) {
  // console.log("Layout subtree for", id);
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
      width: node.measured?.width || 0,
      height: node.measured?.height || 0,
      ...(scopeSizeMap.has(id) ? scopeSizeMap.get(id) : {}),
      children: node.data.folded ? [] : children.map(subtree),
    };
  }
  function subtree_for_scope(node: ScopeNodeType) {
    const scopeChildren = [...node.data.scopeChildren];
    return {
      id: node.id,
      width: 0,
      height: 0,
      children: node.data.folded ? [] : scopeChildren.map(subtree),
    };
  }
  let data;
  if (rootNode.type === "SCOPE") {
    data = subtree_for_scope(rootNode);
  } else {
    if (id !== "ROOT") throw new Error(`Unexpected node id ${id}`);
    data = subtree(id);
  }
  // const data = subtree(id);
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
  // console.log("layout data", data);
  // console.log("layout result", tree);
  // console.log("layout result dump", layout.dump(tree));
  let x1 = Infinity;
  let x2 = -Infinity;
  let y1 = Infinity;
  let y2 = -Infinity;
  tree.each((node) => {
    x1 = Math.min(x1, node.x);
    x2 = Math.max(x2, node.x + node.data.height);
    y1 = Math.min(y1, node.y);
    y2 = Math.max(y2, node.y + node.data.width);
  });
  // tree.each((node) => console.log(`(${node.x}, ${node.y})`));
  // update the nodesMap
  tree.each((node) => {
    // console.log("update pos", node.data.id, node.x, node.y);
    const n = nodesMap.get(node.data.id)!;
    // horizontal
    nodesMap.set(node.data.id, {
      ...n,
      position: {
        x: rootNode.position.x + node.y,
        // center the node
        y:
          rootNode.position.y +
          // (rootNode.measured?.height || 0) / 2 +
          (scopeSizeMap.get(id)?.height || rootNode.measured?.height || 0) / 2 +
          node.x -
          node.data.height / 2,
      },
    });

    if (n.type === "SCOPE" && n.id !== rootNode.id) {
      const dx = rootNode.position.x + node.y - n.position.x;
      const dy =
        rootNode.position.y +
        (scopeSizeMap.get(id)?.height || rootNode.measured?.height || 0) / 2 +
        node.x -
        node.data.height / 2 -
        n.position.y;
      // shift dx,dy for all children
      shiftChildren(nodesMap, n.id, dx, dy);
    }
  });
  if (rootNode.type === "SCOPE") {
    let width = y2 - y1 + 50;
    let height = x2 - x1 + 50;
    if (rootNode.data.scopeChildren.length === 0) {
      // If the scope is empty, give it some minimum size.
      width = 200;
      height = 100;
    }
    scopeSizeMap.set(id, { width, height });
    nodesMap.set(id, {
      ...rootNode,
      width,
      height,
    });
  }
}

function shiftChildren(
  nodesMap: Y.Map<AppNode>,
  id: string,
  dx: number,
  dy: number
) {
  const node = nodesMap.get(id);
  if (!node) throw new Error("Node not found");
  node.data.children.forEach((childId) => {
    const child = nodesMap.get(childId);
    if (!child) throw new Error("Child not found");
    nodesMap.set(childId, {
      ...child,
      position: {
        x: child.position.x + dx,
        y: child.position.y + dy,
      },
    });
    shiftChildren(nodesMap, childId, dx, dy);
  });
  if (node.type === "SCOPE") {
    node.data.scopeChildren.forEach((childId) => {
      const child = nodesMap.get(childId);
      if (!child) throw new Error("Child not found");
      nodesMap.set(childId, {
        ...child,
        position: {
          x: child.position.x + dx,
          y: child.position.y + dy,
        },
      });
      shiftChildren(nodesMap, childId, dx, dy);
    });
  }
}

function autoLayoutTree(get: Getter, set: Setter) {
  // console.log("autoLayoutTree");
  const nodesMap = get(ATOM_nodesMap);
  scopeSizeMap.clear();
  // layoutSubTree(nodesMap, "ROOT");
  dfsForScope(get, set, nodesMap, "ROOT");
  updateView(get, set);
}

// DEPRECATED
export const ATOM_autoLayoutTree = atom(null, autoLayoutTree);

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
