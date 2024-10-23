import { Getter, Setter, atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import * as Y from "yjs";
import { getNodesBounds, Node, XYPosition } from "@xyflow/react";
import {
  ATOM_codeMap,
  ATOM_edgesMap,
  ATOM_nodesMap,
  ATOM_richMap,
} from "./yjsSlice";
import { match } from "ts-pattern";
import { myassert, myNanoId } from "../utils/utils";
import {
  AppNode,
  CodeNodeType,
  RichNodeType,
  SubpageRefNodeType,
} from "./types";

import { getAbsPos, getRelativePos, updateView } from "./canvasSlice";
import { SupportedLanguage } from "./types";
import { toast } from "react-toastify";
import { ATOM_currentPage } from "./atom";

import {
  Block,
  BlockNoteEditor,
  blockToNode,
  PartialBlock,
} from "@blocknote/core";

import {
  prosemirrorToYDoc,
  prosemirrorToYXmlFragment,
  yXmlFragmentToProseMirrorRootNode,
} from "y-prosemirror";

const editor = BlockNoteEditor.create();

function _blocksToProsemirrorNode(blocks: PartialBlock[]) {
  const pmNodes = blocks.map((b) =>
    blockToNode(b, editor.pmSchema, editor.schema.styleSchema)
  );

  const doc = editor.pmSchema.topNodeType.create(
    null,
    editor.pmSchema.nodes["blockGroup"].create(null, pmNodes)
  );
  return doc;
}

function blocksToYXmlFragment(blocks: Block[], xmlFragment?: Y.XmlFragment) {
  return prosemirrorToYXmlFragment(
    _blocksToProsemirrorNode(blocks),
    xmlFragment
  );
}

async function markdownToYXml(markdown: string) {
  const blocks = await editor.tryParseMarkdownToBlocks(markdown);
  return blocksToYXmlFragment(blocks);
}

type InputSpecCommon = {
  position: XYPosition;
  scopeId?: string;
  subpageId?: string;
};

type InputSpecDiff =
  | {
      type: "CODE";
      lang: SupportedLanguage;
    }
  | {
      type: "RICH";
    }
  | {
      type: "SubpageRef";
      refId: string;
    };

type InputSpec = InputSpecCommon & InputSpecDiff;

export async function addNode(get: Getter, set: Setter, spec: InputSpec) {
  const { type, scopeId, subpageId } = spec;
  let position = spec.position;
  let id = myNanoId();
  const nodesMap = get(ATOM_nodesMap);
  const currentPage = get(ATOM_currentPage);
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
        const node: CodeNodeType = {
          id,
          type: "CODE",
          position,
          dragHandle: ".custom-drag-handle",
          parentId: scopeId,
          data: {
            lang: spec.lang,
            mywidth: 600,
            subpageId: subpageId ?? currentPage,
          },
        };
        get(ATOM_codeMap).set(id, new Y.Text());
        nodesMap.set(id, node);
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
          data: {
            mywidth: 600,
            subpageId: subpageId ?? currentPage,
          },
        };
        get(ATOM_richMap).set(id, new Y.XmlFragment());
        // const yxml = await markdownToYXml("Hello, **world**!");
        // get(ATOM_richMap).set(id, yxml);
        nodesMap.set(id, node);
      }
      break;
    case "SubpageRef": {
      const node: SubpageRefNodeType = {
        id,
        type: "SubpageRef",
        position,
        dragHandle: ".custom-drag-handle",
        parentId: scopeId,
        data: {
          mywidth: 400,
          subpageId: subpageId ?? currentPage,
          refId: spec.refId,
        },
      };
      nodesMap.set(id, node);
    }
  }
  if (scopeId) {
    computeHierarchy(get, set);
  }
  updateView(get, set);
}

export const ATOM_addNode = atom(null, addNode);

/**
 * Add a scope node that contains the selected nodes.
 */
function addScope(get: Getter, set: Setter, nodes1: AppNode[]) {
  myassert(nodes1.length > 0);
  const nodesMap = get(ATOM_nodesMap);

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
  const id = myNanoId();
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
  myassert(
    node.type === "CODE" || node.type === "RICH" || node.type === "SubpageRef"
  );
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

function deleteSelection(get: Getter, set: Setter, nodes: AppNode[]) {
  // delete nodes in a selection
  // 1. order the nodes by scope level
  // 2. delete in order. If the node is already deleted, skip it.
  const nodesMap = get(ATOM_nodesMap);
  nodes.sort((a, b) => {
    return (a.data.level ?? 0) - (b.data.level ?? 0);
  });
  nodes.forEach((node) => {
    if (nodesMap.has(node.id)) {
      if (node.type === "SCOPE") {
        deleleSubTree(get, set, node.id);
      } else {
        deletePod(get, set, node.id);
      }
    }
  });
}

export const ATOM_deleteSelection = atom(null, deleteSelection);

export const ATOM_deleteEdge = atom(
  null,
  (get: Getter, set: Setter, edgeId: string) => {
    const edgesMap = get(ATOM_edgesMap);
    edgesMap.delete(edgeId);
    updateView(get, set);
  }
);

function duplicateScope(get: Getter, set: Setter, id: string) {
  const nodesMap = get(ATOM_nodesMap);
  const node = nodesMap.get(id);
  myassert(node);
  myassert(node.type === "SCOPE");
  const newId = duplicateSubtree(get, set, id, node.parentId);
  // adjust the position
  const newNode = nodesMap.get(newId);
  myassert(newNode);
  newNode.position.x += (node.measured?.width ?? 50) + 50;
  // newNode.position.y += node.measured?.height ?? 50;
  nodesMap.set(newId, newNode);
  computeHierarchy(get, set);
  updateView(get, set);
}

export const ATOM_duplicateScope = atom(null, duplicateScope);

/**
 * For the subtree rooted at id, create a clone with all new ids. Return the new id of the root.
 */
function duplicateSubtree(
  get: Getter,
  set: Setter,
  id: string,
  parentId?: string
) {
  const nodesMap = get(ATOM_nodesMap);
  const richMap = get(ATOM_richMap);
  const codeMap = get(ATOM_codeMap);
  const node = nodesMap.get(id);
  myassert(node);
  const newId = myNanoId();
  if (node.type === "SCOPE") {
    node.data.childrenIds.forEach((id) => {
      duplicateSubtree(get, set, id, newId);
    });
  }
  const newNode = structuredClone(node);
  newNode.id = newId;
  newNode.parentId = parentId;
  nodesMap.set(newId, newNode);
  if (node.type === "CODE") {
    // copy the code
    const code = codeMap.get(id);
    myassert(code);
    codeMap.set(newId, code.clone());
  }
  if (node.type === "RICH") {
    // copy the rich content
    const rich = richMap.get(id);
    myassert(rich);
    richMap.set(newId, cloneYxmlFragment(rich));
  }
  return newId;
}

function cloneYxmlFragment(yxml: Y.XmlFragment) {
  const el = new Y.XmlFragment();
  el.insert(
    0,
    // @ts-ignore
    yxml.toArray().map((item) => {
      if (item instanceof Y.AbstractType) {
        return cloneRecur(item);
      } else {
        return item;
      }
    })
  );
  return el;
}

// BlockNote stores the level attr of heading in number. Yjs only clones string
// attrs. This is a temporary fix for it. Ref:
// https://github.com/TypeCellOS/BlockNote/issues/1123
function cloneRecur(yxml: Y.XmlElement | Y.XmlText | Y.XmlHook) {
  if (yxml instanceof Y.XmlElement) {
    const el = new Y.XmlElement(yxml.nodeName);
    const attrs = yxml.getAttributes();
    Object.entries(attrs).forEach(([key, value]) => {
      // if (typeof value === 'string') {
      if (value) {
        el.setAttribute(key, value);
      }
    });

    el.insert(
      0,
      // @ts-ignore
      yxml
        .toArray()
        .map((item) =>
          item instanceof Y.AbstractType ? cloneRecur(item) : item
        )
    );
    return el;
  } else if (yxml instanceof Y.XmlText) {
    return yxml.clone();
  } else if (yxml instanceof Y.XmlHook) {
    return yxml.clone();
  }
}

function duplicateSelection(get: Getter, set: Setter, nodes1: AppNode[]) {
  myassert(nodes1.length > 0);
  // duplicate nodes in a selection
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
  const nodesMap = get(ATOM_nodesMap);
  // for each node, duplicate it and adjust the position
  nodes2.forEach((node) => {
    const newId = duplicateSubtree(get, set, node.id, node.parentId);
    // adjust the position
    const newNode = nodesMap.get(newId);
    myassert(newNode);
    newNode.position.x += (bounds.width ?? 50) + 50;
    nodesMap.set(newId, newNode);
  });

  computeHierarchy(get, set);
  updateView(get, set);
}

export const ATOM_duplicateSelection = atom(null, duplicateSelection);
