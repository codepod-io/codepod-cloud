import { Getter, Setter, atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import { produce } from "immer";
import { ATOM_codeMap, ATOM_nodesMap, ATOM_richMap } from "./yjsSlice";
import { myassert, myNanoId } from "../utils/utils";

import { toast } from "react-toastify";
import { autoLayoutTree } from "./canvasSlice_autoLayout";
import { updateView } from "./canvasSlice";

export const ATOM_slurp = atom(null, (get, set, id: string) => {
  // move its next sibling to the end of its children.
  const nodesMap = get(ATOM_nodesMap);
  const node = nodesMap.get(id);
  myassert(node);
  myassert(node.data.parent);
  const parent = nodesMap.get(node.data.parent.id);
  myassert(parent);
  if (node.data.parent.relation === "TREE") {
    const index = parent.data.treeChildrenIds.indexOf(id);
    if (index === -1) throw new Error("Node not found in parent");
    if (index === parent.data.treeChildrenIds.length - 1) {
      toast.error("No next sibling to slurp");
      return;
    }
    const siblingId = parent.data.treeChildrenIds[index + 1];
    const sibling = nodesMap.get(siblingId);
    myassert(sibling);
    // remove the sibling
    nodesMap.set(
      node.data.parent.id,
      produce(parent, (draft) => {
        draft.data.treeChildrenIds.splice(index + 1, 1);
      })
    );
    // add the sibling to the node
    nodesMap.set(
      id,
      produce(node, (draft) => {
        draft.data.treeChildrenIds.push(siblingId);
      })
    );
    // update the sibling
    nodesMap.set(
      siblingId,
      produce(sibling, (draft) => {
        draft.data.parent = { id, relation: "TREE" };
      })
    );
  } else {
    myassert(parent.type === "SCOPE");
    const index = parent.data.scopeChildrenIds.indexOf(id);
    if (index === -1) throw new Error("Node not found in parent");
    if (index === parent.data.scopeChildrenIds.length - 1) {
      toast.error("No next sibling to slurp");
      return;
    }
    const siblingId = parent.data.scopeChildrenIds[index + 1];
    const sibling = nodesMap.get(siblingId);
    myassert(sibling);
    // remove the sibling
    nodesMap.set(
      node.data.parent.id,
      produce(parent, (draft) => {
        draft.data.scopeChildrenIds.splice(index + 1, 1);
      })
    );
    // add the sibling to the node
    nodesMap.set(
      id,
      produce(node, (draft) => {
        draft.data.treeChildrenIds.push(siblingId);
      })
    );
    // update the sibling
    nodesMap.set(
      siblingId,
      produce(sibling, (draft) => {
        draft.data.parent = { id, relation: "TREE" };
      })
    );
  }
  autoLayoutTree(get, set);
  updateView(get, set);
});

export const ATOM_unslurp = atom(null, (get, set, id: string) => {
  // move its last child to its sibling
  const nodesMap = get(ATOM_nodesMap);
  const node = nodesMap.get(id);
  myassert(node);
  myassert(node.data.parent);
  const parent = nodesMap.get(node.data.parent.id);
  myassert(parent);
  if (node.data.parent.relation === "TREE") {
    const index = parent.data.treeChildrenIds.indexOf(id);
    if (index === -1) throw new Error("Node not found in parent");
    // remove the last child
    if (node.data.treeChildrenIds.length === 0) {
      toast.error("No child to unslurp");
      return;
    }
    const lastChildId = node.data.treeChildrenIds.at(-1);
    myassert(lastChildId);
    const lastChild = nodesMap.get(lastChildId);
    myassert(lastChild);
    // remove the last child
    nodesMap.set(
      id,
      produce(node, (draft) => {
        draft.data.treeChildrenIds.pop();
      })
    );
    // add the last child to the parent
    nodesMap.set(
      node.data.parent.id,
      produce(parent, (draft) => {
        draft.data.treeChildrenIds.splice(index + 1, 0, lastChildId);
      })
    );
    // update the last child's parent
    nodesMap.set(
      lastChildId,
      produce(lastChild, (draft) => {
        draft.data.parent = node.data.parent;
      })
    );
  } else {
    myassert(parent.type === "SCOPE");
    // slurp a scope child
    const index = parent.data.scopeChildrenIds.indexOf(id);
    myassert(index !== -1);
    // remove the last child
    if (node.data.treeChildrenIds.length === 0) {
      toast.error("No child to unslurp");
      return;
    }
    const lastChildId = node.data.treeChildrenIds.at(-1);
    myassert(lastChildId);
    const lastChild = nodesMap.get(lastChildId);
    myassert(lastChild);
    // remove the last child
    nodesMap.set(
      id,
      produce(node, (draft) => {
        draft.data.treeChildrenIds.pop();
      })
    );
    // add the last child to the parent
    nodesMap.set(
      node.data.parent.id,
      produce(parent, (draft) => {
        draft.data.scopeChildrenIds.splice(index + 1, 0, lastChildId);
      })
    );
    // update the last child's parent
    nodesMap.set(
      lastChildId,
      produce(lastChild, (draft) => {
        draft.data.parent = node.data.parent;
      })
    );
  }

  autoLayoutTree(get, set);
  updateView(get, set);
});
