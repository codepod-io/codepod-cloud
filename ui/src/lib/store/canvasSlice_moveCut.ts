import { Getter, Setter, atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import * as Y from "yjs";
import { produce } from "immer";
import { ATOM_codeMap, ATOM_nodesMap, ATOM_richMap } from "./yjsSlice";
import { match } from "ts-pattern";
import { myassert, myNanoId } from "../utils/utils";
import { AppNode, CodeNodeType, RichNodeType, ScopeNodeType } from "./types";

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
    return [
      ...node.data.treeChildrenIds,
      ...(node.type === "SCOPE" ? node.data.scopeChildrenIds : []),
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

  // The cut node
  const node = nodesMap.get(cutId);
  myassert(node);
  // the new parent is the anchor's parent
  const new_parent = anchor.data.parent;
  const old_parent = node.data.parent;
  myassert(new_parent && old_parent);

  // remove the node from the old parent
  if (old_parent.relation === "SCOPE") {
    const old_scopeParent = nodesMap.get(old_parent.id);
    myassert(old_scopeParent);
    myassert(old_scopeParent.type === "SCOPE");
    nodesMap.set(
      old_parent.id,
      produce(old_scopeParent, (draft) => {
        const children = draft.data.scopeChildrenIds;
        const index = children.indexOf(cutId);
        children.splice(index, 1);
      })
    );
  } else {
    const old_treeParent = nodesMap.get(old_parent.id);
    myassert(old_treeParent);
    nodesMap.set(
      old_parent.id,
      produce(old_treeParent, (draft) => {
        const children = draft.data.treeChildrenIds;
        const index = children.indexOf(cutId);
        children.splice(index, 1);
      })
    );
  }
  // add the node to the new parent
  if (new_parent.relation === "SCOPE") {
    const new_scopeParent = nodesMap.get(new_parent.id);
    myassert(new_scopeParent);
    myassert(new_scopeParent.type === "SCOPE");
    const scopeChildrenIds = new_scopeParent.data.scopeChildrenIds;
    const index = scopeChildrenIds.indexOf(anchorId);
    nodesMap.set(
      new_parent.id,
      produce(new_scopeParent, (draft) => {
        draft.data.scopeChildrenIds.splice(
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
        draft.data.parent = { id: new_parent.id, relation: "SCOPE" };
      })
    );
  } else {
    const new_treeParent = nodesMap.get(new_parent.id);
    myassert(new_treeParent);
    const treeChildrenIds = new_treeParent.data.treeChildrenIds;
    const index = treeChildrenIds.indexOf(anchorId);
    nodesMap.set(
      new_parent.id,
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
        draft.data.parent = { id: new_parent.id, relation: "TREE" };
      })
    );
  }

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

  const oldParent = node.data.parent;
  myassert(oldParent);

  // remove the node from the old parent
  if (oldParent.relation === "SCOPE") {
    const old_scopeParentId = oldParent.id;
    const old_scopeParent = nodesMap.get(old_scopeParentId);
    myassert(old_scopeParent);
    myassert(old_scopeParent.type === "SCOPE");
    nodesMap.set(
      old_scopeParentId,
      produce(old_scopeParent, (draft) => {
        const children = draft.data.scopeChildrenIds;
        const index = children.indexOf(cutId);
        children.splice(index, 1);
      })
    );
  } else {
    const old_treeParent = nodesMap.get(oldParent.id);
    myassert(old_treeParent);
    nodesMap.set(
      oldParent.id,
      produce(old_treeParent, (draft) => {
        const children = draft.data.treeChildrenIds;
        const index = children.indexOf(cutId);
        children.splice(index, 1);
      })
    );
  }
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
      draft.data.parent = { id: new_treeParentId, relation: "TREE" };
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
