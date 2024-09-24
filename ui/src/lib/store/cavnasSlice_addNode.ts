import { Getter, Setter, atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import * as Y from "yjs";
import { XYPosition } from "@xyflow/react";
import { produce } from "immer";
import { ATOM_codeMap, ATOM_nodesMap, ATOM_richMap } from "./yjsSlice";
import { match } from "ts-pattern";
import { myassert, myNanoId } from "../utils/utils";
import { AppNode, CodeNodeType, RichNodeType } from "./types";

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
    dragHandle: ".custom-drag-handle",
    data: {
      treeChildrenIds: [],
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
    data: {
      treeChildrenIds: [],
    },
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
  myassert(anchor.data.treeParentId);

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
      draft.data.treeParentId = anchor.data.treeParentId;
    })
  );

  const treeParent = nodesMap.get(anchor.data.treeParentId);
  myassert(treeParent);
  let index = treeParent.data.treeChildrenIds.indexOf(anchorId);
  myassert(index !== -1);
  if (position == "bottom") {
    index = index + 1;
  }
  // update the parent node: add the node to the children field at index
  nodesMap.set(
    anchor.data.treeParentId,
    produce(treeParent, (draft) => {
      draft.data.treeChildrenIds.splice(index, 0, newNode.id);
    })
  );

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
      draft.data.treeParentId = anchorId;
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
  myassert(node.data.treeParentId);
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
  newNode.data.treeParentId = node.data.treeParentId;
  nodesMap.set(
    newNode.id,
    produce(newNode, (draft) => {
      draft.data.treeParentId = node.data.treeParentId;
    })
  );
  // update the parent node
  const treeParentId = node.data.treeParentId;
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

  // update the node
  nodesMap.set(
    id,
    produce(node, (draft) => {
      draft.data.treeParentId = newNode.id;
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
      position: "top" | "bottom" | "right" | "left";
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
      .exhaustive();
  }
);
