import { Getter, Setter, atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import * as Y from "yjs";
import { getNodesBounds, Node, XYPosition } from "@xyflow/react";
import { produce } from "immer";
import { ATOM_codeMap, ATOM_nodesMap, ATOM_richMap } from "./yjsSlice";
import { match } from "ts-pattern";
import { myassert, myNanoId } from "../utils/utils";
import { AppNode, CodeNodeType, RichNodeType } from "./types";

import { updateView } from "./canvasSlice";
import { SupportedLanguage } from "./types";
import { toast } from "react-toastify";

/**
 * Create a new node. The node will start from the given position. Typically
 * auto-layout will be triggered after this to move the new node to place in an
 * animation.
 */
function createCodeNode(
  lang: SupportedLanguage,
  position: XYPosition
): CodeNodeType {
  let id = myNanoId();
  // FIXME get(ATOM_codeMap).set(newNode.id, new Y.Text());
  return {
    id,
    type: "CODE",
    position,
    dragHandle: ".custom-drag-handle",
    data: {
      lang,
    },
  };
}

function createRichNode(position: XYPosition): RichNodeType {
  let id = myNanoId();
  // FIXME get(ATOM_richMap).set(newNode.id, new Y.XmlFragment());
  return {
    id,
    type: "RICH",
    position,
    dragHandle: ".custom-drag-handle",
    data: {},
  };
}

function createNewNode(
  type: "CODE" | "RICH",
  position: XYPosition = { x: 0, y: 0 }
): AppNode {
  switch (type) {
    case "CODE":
      // FIXME pass in language
      return createCodeNode("python", position);
    case "RICH":
      return createRichNode(position);
  }
}

export const ATOM_addNode = atom(
  null,
  (
    get,
    set,
    {
      position,
      type,
      lang,
    }: {
      position: XYPosition;
      type: "CODE" | "RICH";
      lang?: SupportedLanguage;
    }
  ) => {
    const newNode = createNewNode(type, position);
    switch (newNode.type) {
      case "CODE":
        if (lang) newNode.data.lang = lang;
        get(ATOM_codeMap).set(newNode.id, new Y.Text());
        break;
      case "RICH":
        get(ATOM_richMap).set(newNode.id, new Y.XmlFragment());
        break;
    }
    const nodesMap = get(ATOM_nodesMap);
    nodesMap.set(newNode.id, newNode);
    updateView(get, set);
  }
);

/**
 * Add a scope node that contains the selected nodes.
 */
function addScope(get: Getter, set: Setter, nodes0: Node[]) {
  myassert(nodes0.length > 0);
  const id = myNanoId();
  // purify the nodes
  const nodesMap = get(ATOM_nodesMap);
  const nodes1 = nodes0.map((n) => {
    const node = nodesMap.get(n.id);
    myassert(node);
    return node;
  });

  // 1. if a scope node is selected, remove all its children
  const ids = new Set(nodes1.map((n) => n.id));
  nodes1.forEach((node) => {
    if (node.type === "SCOPE") {
      node.data.childrenIds.forEach((id) => ids.delete(id));
    }
  });
  const nodes2 = nodes1.filter((n) => ids.has(n.id));
  // 2. verify that the remaining nodes have the same parentId
  const isValid = nodes2
    .map((n) => n.parentId)
    .every((id) => id === nodes2[0].parentId);
  if (!isValid) {
    toast.error("All nodes must have the same parent");
    return;
  }
  // get the bounding box of the nodes
  const bounds = getNodesBounds(nodes2);
  const scope: AppNode = {
    id,
    type: "SCOPE",
    position: {
      x: bounds.x - 50,
      y: bounds.y - 50,
    },

    dragHandle: ".custom-drag-handle",
    data: {
      mywidth: bounds.width + 100,
      myheight: bounds.height + 100,
      childrenIds: nodes2.map((n) => n.id),
    },
    // the parent id should be the old parent Id
    parentId: nodes2[0].parentId,
  };
  // add the scope to the nodesMap
  nodesMap.set(scope.id, scope);
  // Modify children
  nodes2.forEach((node) => {
    const n = nodesMap.get(node.id);
    myassert(n);
    n.parentId = id;
    // adjust the position of the node to be relative to the scope
    n.position.x -= bounds.x - 50;
    n.position.y -= bounds.y - 50;
    // FIXME Do we need this? Is it mutated in place?
    nodesMap.set(node.id, n);
  });
  // compute childrenIds
  computeChildrenIds(get, set);
  // update the view
  updateView(get, set);
}

/**
 * We reset and recompute the childrenIds of all the scope nodes. This
 * simplifies the logic, and is efficient enough for now at O(n).
 */
function computeChildrenIds(get: Getter, set: Setter) {
  const nodesMap = get(ATOM_nodesMap);
  const nodes = Array.from(nodesMap.values());
  // clear childrenIds
  nodes.forEach((node) => {
    if (node.type === "SCOPE") {
      node.data.childrenIds = [];
    }
  });
  // recompute childrenIds
  nodes.forEach((node) => {
    if (node.parentId) {
      const parent = nodesMap.get(node.parentId);
      myassert(parent);
      myassert(parent.type === "SCOPE");
      parent.data.childrenIds.push(node.id);
    }
  });
  // update the nodesMap
  nodes.forEach((node) => {
    nodesMap.set(node.id, node);
  });
}

export const ATOM_addScope = atom(null, addScope);
