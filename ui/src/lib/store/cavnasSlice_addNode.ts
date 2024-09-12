import { Getter, Setter, atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import * as Y from "yjs";
import { XYPosition } from "@xyflow/react";
import { produce } from "immer";
import { ATOM_codeMap, ATOM_nodesMap, ATOM_richMap } from "./yjsSlice";
import { match } from "ts-pattern";
import { myassert, myNanoId } from "../utils/utils";
import { AppNode, CodeNodeType, RichNodeType, ScopeNodeType } from "./types";

import { updateView } from "./canvasSlice";
import { autoLayoutTree } from "./canvasSlice_autoLayout";
import { SupportedLanguage } from "./types";

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
    width: 300,
    dragHandle: ".custom-drag-handle",
    data: {
      treeChildrenIds: [],
      folded: false,
      isScope: false,
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
    width: 300,
    dragHandle: ".custom-drag-handle",
    data: {
      treeChildrenIds: [],
      folded: false,
      isScope: false,
    },
  };
}

function createScopeNode(position: XYPosition): ScopeNodeType {
  let id = myNanoId();
  return {
    id,
    type: "SCOPE",
    position,
    // width: 300,
    dragHandle: ".custom-drag-handle",
    data: {
      treeChildrenIds: [],
      folded: false,
      isScope: false,
      scopeChildrenIds: [],
    },
  };
}

function createNewNode(
  type: "CODE" | "RICH" | "SCOPE",
  position: XYPosition = { x: 0, y: 0 }
): AppNode {
  switch (type) {
    case "CODE":
      // FIXME pass in language
      return createCodeNode("python", position);
    case "RICH":
      return createRichNode(position);
    case "SCOPE":
      return createScopeNode(position);
  }
}

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
    lang?: SupportedLanguage;
  }
) => {
  const nodesMap = get(ATOM_nodesMap);
  const anchor = nodesMap.get(anchorId);
  myassert(anchor);
  myassert(anchor.data.parent);

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
  nodesMap.set(
    newNode.id,
    produce(newNode, (draft) => {
      draft.data.parent = anchor.data.parent;
    })
  );

  if (anchor.data.parent.relation === "SCOPE") {
    // check in scopeChildren
    const scopeParent = nodesMap.get(anchor.data.parent.id);
    myassert(scopeParent);
    myassert(scopeParent.type === "SCOPE");
    let index = scopeParent.data.scopeChildrenIds.indexOf(anchorId);
    myassert(index !== -1);
    if (position === "bottom") {
      index = index + 1;
    }
    // update the parent node: add the node to the children field at index
    nodesMap.set(
      anchor.data.parent.id,
      produce(scopeParent, (draft) => {
        draft.data.scopeChildrenIds.splice(index, 0, newNode.id);
      })
    );
  } else {
    const treeParent = nodesMap.get(anchor.data.parent.id);
    myassert(treeParent);
    let index = treeParent.data.treeChildrenIds.indexOf(anchorId);
    myassert(index !== -1);
    if (position == "bottom") {
      index = index + 1;
    }
    // update the parent node: add the node to the children field at index
    nodesMap.set(
      anchor.data.parent.id,
      produce(treeParent, (draft) => {
        draft.data.treeChildrenIds.splice(index, 0, newNode.id);
      })
    );
  }

  updateView(get, set);
};

const addNode_top = (
  get: Getter,
  set: Setter,
  {
    anchorId,
    type,
    lang,
  }: {
    anchorId: string;
    type: "CODE" | "RICH";
    lang?: SupportedLanguage;
  }
) => {
  addNode_top_bottom(get, set, {
    anchorId,
    position: "top",
    type,
    lang,
  });
};

const addNode_bottom = (
  get: Getter,
  set,
  {
    anchorId,
    type,
    lang,
  }: {
    anchorId: string;
    type: "CODE" | "RICH";
    lang?: SupportedLanguage;
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
    lang?: SupportedLanguage;
  }
) => {
  // add node inside the scope (which must be a scope with no children or scopeChildren)
  const nodesMap = get(ATOM_nodesMap);
  const anchor = nodesMap.get(anchorId);
  myassert(anchor);
  myassert(anchor.type === "SCOPE");
  myassert(anchor.data.scopeChildrenIds.length === 0);
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
  newNode.data.parent = { id: anchorId, relation: "SCOPE" };
  nodesMap.set(newNode.id, newNode);
  // update the parent node
  nodesMap.set(
    anchorId,
    produce(anchor, (draft) => {
      draft.data.scopeChildrenIds = [newNode.id];
    })
  );
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
    lang?: SupportedLanguage;
  }
) => {
  const nodesMap = get(ATOM_nodesMap);
  const anchor = nodesMap.get(anchorId);
  myassert(anchor);
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
  nodesMap.set(
    newNode.id,
    produce(newNode, (draft) => {
      draft.data.parent = { id: anchorId, relation: "TREE" };
    })
  );

  // update the parent node
  nodesMap.set(
    anchorId,
    produce(anchor, (draft) => {
      draft.data.treeChildrenIds.push(newNode.id);
    })
  );
  autoLayoutTree(get, set);
  updateView(get, set);
};

/**
 * Add a node to the left.
 * The new node will be the parent of the anchor node.
 * The anchor node will be the only child of the new node.
 * The anchorNode can be a children or a scopeChildren of its parent node. We need to update the parent node accordingly.
 */
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
  lang?: SupportedLanguage;
}) {
  // wrap the node with a new parent node, i.e., add a node between the node and its parent.
  const nodesMap = get(ATOM_nodesMap);
  const node = nodesMap.get(id);
  myassert(node);
  myassert(node.data.parent);
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
  newNode.data.treeChildrenIds = [id];
  newNode.data.parent = node.data.parent;
  nodesMap.set(
    newNode.id,
    produce(newNode, (draft) => {
      draft.data.parent = node.data.parent;
    })
  );
  // update the parent node
  if (node.data.parent.relation === "SCOPE") {
    const scopeParent = nodesMap.get(node.data.parent.id);
    myassert(scopeParent);
    myassert(scopeParent.type === "SCOPE");
    nodesMap.set(
      node.data.parent.id,
      produce(scopeParent, (draft) => {
        const children = draft.data.scopeChildrenIds;
        const index = children.indexOf(id);
        myassert(index !== -1);
        children.splice(index, 1, newNode.id);
      })
    );
  } else {
    const treeParentId = node.data.parent.id;
    const treeParent = nodesMap.get(treeParentId);
    myassert(treeParent);
    nodesMap.set(
      treeParentId,
      produce(treeParent, (draft) => {
        const children = draft.data.treeChildrenIds;
        const index = children.indexOf(id);
        myassert(index !== -1);
        children.splice(index, 1, newNode.id);
      })
    );
  }

  // update the node
  nodesMap.set(
    id,
    produce(node, (draft) => {
      draft.data.parent = { id: newNode.id, relation: "TREE" };
    })
  );
  autoLayoutTree(get, set);
  updateView(get, set);
}

const addNode_left = (
  get,
  set,
  {
    anchorId,
    type,
    lang,
  }: {
    anchorId: string;
    type: "CODE" | "RICH";
    lang?: SupportedLanguage;
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
      lang?: SupportedLanguage;
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

export const ATOM_addScope = atom(null, (get, set, id: string) => {
  // add a scope surrounding the node

  const nodesMap = get(ATOM_nodesMap);
  const node = nodesMap.get(id);
  myassert(node);
  const newScopeNode = createNewNode("SCOPE", node.position);
  myassert(newScopeNode.type === "SCOPE");
  // Connect the new scope node to this node.
  nodesMap.set(
    id,
    produce(node, (draft) => {
      draft.data.parent = { id: newScopeNode.id, relation: "SCOPE" };
      draft.data.treeChildrenIds = [];
    })
  );

  myassert(node.data.parent);
  // put the new node in the parent's children field
  if (node.data.parent.relation === "SCOPE") {
    // The parent is a scope.
    const scopeParent = nodesMap.get(node.data.parent.id);
    myassert(scopeParent);
    myassert(scopeParent.type === "SCOPE");
    nodesMap.set(
      node.data.parent.id,
      produce(scopeParent, (draft) => {
        const children = draft.data.scopeChildrenIds;
        const index = children.indexOf(id);
        myassert(index !== -1);
        children.splice(index, 1, newScopeNode.id);
      })
    );
    // update the scope node
    // 1. the node will be the scopeChildren of the scope node
    // 2. the children of the node will be the children of the scope node
    nodesMap.set(
      newScopeNode.id,
      produce(newScopeNode, (draft) => {
        myassert(node.data.parent);
        draft.data.parent = { id: node.data.parent.id, relation: "SCOPE" };
        draft.data.scopeChildrenIds = [id];
        draft.data.treeChildrenIds = node.data.treeChildrenIds;
      })
    );
  } else {
    // The parent is a tree node.
    const treeParent = nodesMap.get(node.data.parent.id);
    myassert(treeParent);
    nodesMap.set(
      node.data.parent.id,
      produce(treeParent, (draft) => {
        const children = draft.data.treeChildrenIds;
        const index = children.indexOf(id);
        myassert(index !== -1);
        children.splice(index, 1, newScopeNode.id);
      })
    );
    // update the scope node
    // 1. the node will be the scopeChildren of the scope node
    // 2. the children of the node will be the children of the scope node
    nodesMap.set(
      newScopeNode.id,
      produce(newScopeNode, (draft) => {
        myassert(node.data.parent);
        draft.data.parent = { id: node.data.parent.id, relation: "TREE" };
        draft.data.scopeChildrenIds = [id];
        draft.data.treeChildrenIds = node.data.treeChildrenIds;
      })
    );
  }
  // the tree children of the node will be the children of the scope node
  node.data.treeChildrenIds.forEach((childId) => {
    const n = nodesMap.get(childId);
    myassert(n);
    nodesMap.set(
      childId,
      produce(n, (draft) => {
        draft.data.parent = { id: newScopeNode.id, relation: "TREE" };
      })
    );
  });

  autoLayoutTree(get, set);
  updateView(get, set);
});
