import { Getter, Setter, atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import * as Y from "yjs";
import { produce } from "immer";
import { ATOM_codeMap, ATOM_nodesMap, ATOM_richMap } from "./yjsSlice";
import { match } from "ts-pattern";
import { myassert, myNanoId } from "../utils/utils";
import { AppNode, CodeNodeType, RichNodeType } from "./types";

import debounce from "lodash/debounce";
import { ATOM_cutId } from "./atom";
import { toast } from "react-toastify";
import { autoLayoutTree } from "./canvasSlice_autoLayout";
import { updateView } from "./canvasSlice";

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
    myassert(node);
    if (id === anchorId) return false;
    return [...node.data.treeChildrenIds].every((childId) => dfs(childId));
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

  // The cut node
  const node = nodesMap.get(cutId);
  myassert(node);
  // the new parent is the anchor's parent
  const new_parentId = anchor.data.treeParentId;
  const old_parentId = node.data.treeParentId;
  myassert(new_parentId && old_parentId);

  // remove the node from the old parent
  const old_treeParent = nodesMap.get(old_parentId);
  myassert(old_treeParent);
  nodesMap.set(
    old_parentId,
    produce(old_treeParent, (draft) => {
      const children = draft.data.treeChildrenIds;
      const index = children.indexOf(cutId);
      children.splice(index, 1);
    })
  );

  // add the node to the new parent

  const new_treeParent = nodesMap.get(new_parentId);
  myassert(new_treeParent);
  const treeChildrenIds = new_treeParent.data.treeChildrenIds;
  const index = treeChildrenIds.indexOf(anchorId);
  nodesMap.set(
    new_parentId,
    produce(new_treeParent, (draft) => {
      draft.data.treeChildrenIds.splice(
        position === "top" ? index : index + 1,
        0,
        cutId
      );
    })
  );
  // update the node's parent
  nodesMap.set(
    cutId,
    produce(node, (draft) => {
      draft.data.treeParentId = new_parentId;
    })
  );

  // Do not clear the cutId, so that it can be explicit to the user which pod
  // is being moved.

  // set(ATOM_cutId, null);
  autoLayoutTree(get, set);
  updateView(get, set);
}

function moveCut_right(get: Getter, set: Setter, anchorId: string) {
  const cutId = get(ATOM_cutId);
  myassert(cutId);
  myassert(anchorId !== cutId);
  // move the node id to the new position
  // get the parent node of the anchor node
  const nodesMap = get(ATOM_nodesMap);
  const anchor = nodesMap.get(anchorId);
  myassert(anchor);
  // the new parent is the anchor's parent
  const new_treeParentId = anchorId;
  const new_treeParent = nodesMap.get(new_treeParentId);
  myassert(new_treeParent);

  // The cut node
  const node = nodesMap.get(cutId);
  myassert(node);

  const oldParentId = node.data.treeParentId;
  myassert(oldParentId);

  // remove the node from the old parent

  const old_treeParent = nodesMap.get(oldParentId);
  myassert(old_treeParent);
  nodesMap.set(
    oldParentId,
    produce(old_treeParent, (draft) => {
      const children = draft.data.treeChildrenIds;
      const index = children.indexOf(cutId);
      children.splice(index, 1);
    })
  );

  // add the node to the new parent
  nodesMap.set(
    new_treeParentId,
    produce(new_treeParent, (draft) => {
      draft.data.treeChildrenIds.push(cutId);
    })
  );

  // update the node's parent
  nodesMap.set(
    cutId,
    produce(node, (draft) => {
      draft.data.treeParentId = new_treeParentId;
    })
  );

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
