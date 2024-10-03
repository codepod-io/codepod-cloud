import { Getter, Setter, atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import * as Y from "yjs";
import { getNodesBounds, Node, XYPosition } from "@xyflow/react";
import { produce } from "immer";
import {
  ATOM_codeMap,
  ATOM_edgesMap,
  ATOM_nodesMap,
  ATOM_richMap,
} from "./yjsSlice";
import { match } from "ts-pattern";
import { myassert, myNanoId } from "../utils/utils";
import { AppNode, CodeNodeType, RichNodeType } from "./types";

import { getAbsPos, getRelativePos, updateView } from "./canvasSlice";
import { SupportedLanguage } from "./types";
import { toast } from "react-toastify";

export const ATOM_addNode = atom(
  null,
  (
    get,
    set,
    {
      position,
      type,
      lang,
      scopeId,
    }: {
      position: XYPosition;
      type: "CODE" | "RICH";
      lang?: SupportedLanguage;
      scopeId?: string;
    }
  ) => {
    let id = myNanoId();
    const nodesMap = get(ATOM_nodesMap);
    let parentId = scopeId;
    while (parentId) {
      const parent = nodesMap.get(parentId);
      myassert(parent);
      position = {
        x: position.x - parent.position.x,
        y: position.y - parent.position.y,
      };
      parentId = parent.parentId;
    }
    switch (type) {
      case "CODE":
        {
          myassert(lang);
          const node: CodeNodeType = {
            id,
            type: "CODE",
            position,
            dragHandle: ".custom-drag-handle",
            parentId: scopeId,
            data: {
              lang,
            },
          };
          nodesMap.set(id, node);
          get(ATOM_codeMap).set(id, new Y.Text());
        }
        break;
      case "RICH":
        {
          const node: RichNodeType = {
            id,
            type: "RICH",
            position,
            dragHandle: ".custom-drag-handle",
            parentId: scopeId,
            data: {},
          };
          nodesMap.set(id, node);
          get(ATOM_richMap).set(id, new Y.XmlFragment());
        }
        break;
    }
    if (scopeId) {
      computeHierarchy(get, set);
    }
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
  computeHierarchy(get, set);
  // update the view
  updateView(get, set);
}

/**
 * We reset and recompute the childrenIds of all the scope nodes. This
 * simplifies the logic, and is efficient enough for now at O(n).
 * - Reset and compute childrenIds
 * - Compute levels
 */
function computeHierarchy(get: Getter, set: Setter) {
  const nodesMap = get(ATOM_nodesMap);
  const nodes = Array.from(nodesMap.values());
  // clear childrenIds
  nodes.forEach((node) => {
    if (node.type === "SCOPE") {
      node.data.childrenIds = [];
    }
    node.data.level = undefined;
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
  // compute level
  const rootNodes = nodes.filter((n) => !n.parentId);
  const computeLevel = (node: AppNode, level: number) => {
    node.data.level = level;
    if (node.type === "SCOPE") {
      node.data.childrenIds
        .map((id) => nodesMap.get(id))
        .forEach((child) => {
          if (child) {
            computeLevel(child, level + 1);
          }
        });
    }
  };
  rootNodes.forEach((node) => computeLevel(node, 0));
  // update the nodesMap
  nodes.forEach((node) => {
    nodesMap.set(node.id, node);
  });
}

export const ATOM_addScope = atom(null, addScope);

/**
 * Change the scope of the node <id> to the scope <scopeId>.
 */
function changeScope(
  get: Getter,
  set: Setter,
  { id, scopeId }: { id: string; scopeId?: string }
) {
  const nodesMap = get(ATOM_nodesMap);
  const node = nodesMap.get(id);
  myassert(node);
  const oldScopeId = node.parentId;
  if (oldScopeId === scopeId) {
    return;
  }
  // adjust position
  // 1. get abs position
  const absPos = getAbsPos(node, nodesMap);
  if (!scopeId) {
    // if scopeId is undefined, absPos is the position to use.
    node.parentId = scopeId;
    node.position = absPos;
  } else {
    const scope = nodesMap.get(scopeId);
    myassert(scope);
    const relativePos = getRelativePos(absPos, scope, nodesMap);
    // 2. adjust according to the new scope

    node.parentId = scopeId;
    node.position = relativePos;
    // node.position = absPos;
  }

  // Set the new node.
  nodesMap.set(id, node);

  // We actually don't need to do anything to the old scope. Just re-compute the hierarchy.
  computeHierarchy(get, set);
  updateView(get, set);
}

export const ATOM_changeScope = atom(null, changeScope);

/**
 * Delete a code pod or a rich pod.
 */
function deletePod(get: Getter, set: Setter, id: string) {
  const nodesMap = get(ATOM_nodesMap);
  const codeMap = get(ATOM_codeMap);
  const richMap = get(ATOM_richMap);
  const node = nodesMap.get(id);
  myassert(node);
  myassert(node.type === "CODE" || node.type === "RICH");
  nodesMap.delete(id);
  // remove from codeMap or richMap
  if (codeMap.has(id)) codeMap.delete(id);
  if (richMap.has(id)) richMap.delete(id);

  computeHierarchy(get, set);
  updateView(get, set);
}

export const ATOM_deletePod = atom(null, deletePod);

/**
 * Delete a scope but keep its children.
 */
function deleteScope(get: Getter, set: Setter, id: string) {
  const nodesMap = get(ATOM_nodesMap);
  const node = nodesMap.get(id);
  myassert(node);
  myassert(node.type === "SCOPE");
  // change the parentId of the children
  node.data.childrenIds.forEach((childId) => {
    const child = nodesMap.get(childId);
    myassert(child);
    child.parentId = node.parentId;
    // adjust the positions
    child.position.x += node.position.x;
    child.position.y += node.position.y;
    nodesMap.set(childId, child);
  });
  // delete the scope
  nodesMap.delete(id);
  computeHierarchy(get, set);
  updateView(get, set);
}
export const ATOM_deleteScope = atom(null, deleteScope);

/**
 * Delete a scope and all its children.
 */
function deleleSubTree(get: Getter, set: Setter, id: string) {
  const nodesMap = get(ATOM_nodesMap);
  const codeMap = get(ATOM_codeMap);
  const richMap = get(ATOM_richMap);
  const node = nodesMap.get(id);
  myassert(node);
  myassert(node.type === "SCOPE");
  // remove all descendants
  // get all descendants
  function getSubtreeIds(id: string): string[] {
    const node = nodesMap.get(id);
    myassert(node);
    let res = [id];
    if (node.type === "SCOPE") {
      node.data.childrenIds.forEach((childId) => {
        res = res.concat(getSubtreeIds(childId));
      });
    }
    return res;
  }
  const ids = getSubtreeIds(id);
  ids.forEach((id) => {
    nodesMap.delete(id);
    if (codeMap.has(id)) codeMap.delete(id);
    if (richMap.has(id)) richMap.delete(id);
  });
  computeHierarchy(get, set);
  updateView(get, set);
}
export const ATOM_deleteSubTree = atom(null, deleleSubTree);

export const ATOM_deleteEdge = atom(
  null,
  (get: Getter, set: Setter, edgeId: string) => {
    const edgesMap = get(ATOM_edgesMap);
    edgesMap.delete(edgeId);
    updateView(get, set);
  }
);
