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
/**
 * Auto layout.
 */
function layoutSubTree(nodesMap: Y.Map<AppNode>) {
  function subtree(id: string): TreeNode {
    const node = nodesMap.get(id);
    if (!node) throw new Error(`Node not found: ${id}`);
    const children = node.data.treeChildrenIds;
    return {
      id: node.id,
      width: node.measured?.width || 0,
      height: node.measured?.height || 0,
      children: node.data.treeFolded ? [] : children.map(subtree),
    };
  }
  const data = subtree("ROOT");
  // const data = subtree(id);
  // console.log("Data", data);
  const paddingX = 100;
  const paddingY = 50;

  const layout = flextree({
    children: (data) => data.children,
    // horizontal
    nodeSize: (node) => [
      node.data.height + paddingY,
      node.data.width + paddingX,
    ],
    // spacing: 100,
  });
  const tree = layout.hierarchy(data);
  layout(tree);
  // console.log("layout data", data);
  // console.log("layout result", tree);
  // console.log("layout result dump", layout.dump(tree));
  let x1 = Infinity;
  let x2 = -Infinity;
  let y1 = Infinity;
  let y2 = -Infinity;
  tree.each((node) => {
    x1 = Math.min(x1, node.x);
    x2 = Math.max(x2, node.x + node.data.height);
    y1 = Math.min(y1, node.y);
    y2 = Math.max(y2, node.y + node.data.width);
  });
  // tree.each((node) => console.log(`(${node.x}, ${node.y})`));
  // update the nodesMap
  tree.each((node) => {
    // console.log("update pos", node.data.id, node.x, node.y);
    const n = nodesMap.get(node.data.id)!;
    // horizontal
    nodesMap.set(node.data.id, {
      ...n,
      position: {
        x: node.y,
        // center the node
        y: node.x - node.data.height / 2,
      },
    });
  });
}

export function autoLayoutTree(get: Getter, set: Setter) {
  // console.log("autoLayoutTree");
  // measure the time of the operation
  const start = performance.now();
  const nodesMap = get(ATOM_nodesMap);
  layoutSubTree(nodesMap);
  updateView(get, set);
  const end = performance.now();
  // round to 2 decimal places
  console.debug("[perf] autoLayoutTree took", (end - start).toFixed(2), "ms");
}

// DEPRECATED
export const ATOM_autoLayoutTree = atom(null, autoLayoutTree);
