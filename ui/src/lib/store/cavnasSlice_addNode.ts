import { Getter, Setter, atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import * as Y from "yjs";
import { XYPosition } from "@xyflow/react";
import { produce } from "immer";
import { ATOM_codeMap, ATOM_nodesMap, ATOM_richMap } from "./yjsSlice";
import { match } from "ts-pattern";
import { myassert, myNanoId } from "../utils/utils";
import { AppNode, CodeNodeType, RichNodeType } from "./types";

import { updateView } from "./canvasSlice";
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
