import { Getter, Setter, atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import { Doc } from "yjs";
import * as Y from "yjs";
import { Edge, Node, NodeChange, applyNodeChanges } from "reactflow";
import { getHelperLines, sortNodes } from "@/components/nodes/utils";
import { produce } from "immer";
import { useCallback } from "react";
import { ATOM_nodesMap } from "./yjsSlice";

export const ATOM_repoName = atom<string | null>(null);
export const ATOM_repoId = atom<string | null>(null);
export const ATOM_repoZoom = atom<number>(1);
export const ATOM_repoX = atom<number>(0);
export const ATOM_repoY = atom<number>(0);

export const ATOM_editMode = atom<"view" | "edit">("view");
export const ATOM_shareOpen = atom<boolean>(false);

export const ATOM_collaborators = atom<any[]>([]);

export const ATOM_isPublic = atom(false);

export const ATOM_error = atom<{ type: string; msg: string } | null>(null);

/**
 * This node2children is maintained with the canvas reactflow states and
 * this mapping may be used by other components, e.g. the runtime.
 *
 * TODO we should optimize the performance of this function, maybe only update
 * the mapping when the structure is changed.
 */
export const ATOM_node2children = atom<Map<string, string[]>>(new Map());
export function buildNode2Children(get: Getter, set: Setter) {
  console.debug("Building node2children..");
  // build a map from node to its children
  let nodesMap = get(ATOM_nodesMap);
  let nodes: Node[] = Array.from(nodesMap.values());
  let node2children = new Map<string, string[]>();
  node2children.set("ROOT", []);
  nodes.forEach((node) => {
    if (!node2children.has(node.id)) {
      node2children.set(node.id, []);
    }
    if (node.parentNode) {
      if (!node2children.has(node.parentNode)) {
        node2children.set(node.parentNode, []);
      }
      node2children.get(node.parentNode)?.push(node.id);
    } else {
      node2children.get("ROOT")?.push(node.id);
    }
  });
  for (const value of Array.from(node2children.values())) {
    if (value.length > 1) {
      sortNodes(value, nodesMap);
    }
  }
  set(ATOM_node2children, node2children);
}
