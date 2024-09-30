import { Getter, Setter, atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import * as Y from "yjs";
import { ATOM_codeMap, ATOM_nodesMap, ATOM_richMap } from "./yjsSlice";
import { flextree } from "d3-flextree";
import { AppNode } from "./types";

import { getAbsPos, updateView } from "./canvasSlice";

type TreeNode = {
  id: string;
  width: number;
  height: number;
  children: TreeNode[];
};

function autoLayoutTree(get: Getter, set: Setter) {
  // console.log("autoLayoutTree");
  // measure the time of the operation
  const start = performance.now();
  const nodesMap = get(ATOM_nodesMap);
  // layoutSubTree(nodesMap);
  updateView(get, set);
  const end = performance.now();
  // round to 2 decimal places
  console.debug("[perf] autoLayoutTree took", (end - start).toFixed(2), "ms");
}

// DEPRECATED
const ATOM_autoLayoutTree = atom(null, autoLayoutTree);
