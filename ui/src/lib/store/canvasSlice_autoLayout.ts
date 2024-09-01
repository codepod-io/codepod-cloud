import { Getter, Setter, atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import * as Y from "yjs";
import { ATOM_codeMap, ATOM_nodesMap, ATOM_richMap } from "./yjsSlice";
import { flextree } from "d3-flextree";
import { AppNode, CodeNodeType, RichNodeType, ScopeNodeType } from "./types";

import { getAbsPos, updateView } from "./canvasSlice";

/**
 * Starting from the node id, do postorder dfs traversal and do auto-layout on scope node.
 */
function dfsForScope(
  get: Getter,
  set: Setter,
  nodesMap: Y.Map<AppNode>,
  id: string
) {
  const node = nodesMap.get(id);
  if (!node) throw new Error("Node not found");
  node.data.treeChildrenIds.forEach((childId) => {
    dfsForScope(get, set, nodesMap, childId);
  });
  if (node.type === "SCOPE") {
    node.data.scopeChildrenIds.forEach((childId) => {
      dfsForScope(get, set, nodesMap, childId);
    });
  }
  if (node.type === "SCOPE" || id === "ROOT") {
    // if (node.type === "SCOPE") {
    layoutSubTree(nodesMap, id);
  }
}

const scopeSizeMap = new Map<string, { width: number; height: number }>();

/**
 * Auto layout.
 */
function layoutSubTree(nodesMap: Y.Map<AppNode>, id: string) {
  // console.log("Layout subtree for", id);
  // const data = subtree("1");
  const rootNode = nodesMap.get(id);
  // console.log("RootNode", rootNode);
  if (!rootNode) throw new Error("Root node not found");
  function subtree(id: string) {
    const node = nodesMap.get(id);
    if (!node) throw new Error(`Node not found: ${id}`);
    const children = node.data.treeChildrenIds;
    return {
      id: node.id,
      width: node.measured?.width || 0,
      height: node.measured?.height || 0,
      ...(scopeSizeMap.has(id) ? scopeSizeMap.get(id) : {}),
      children: node.data.folded ? [] : children.map(subtree),
    };
  }
  function subtree_for_scope(node: ScopeNodeType) {
    const scopeChildren = [...node.data.scopeChildrenIds];
    return {
      id: node.id,
      width: 0,
      height: 0,
      children: node.data.folded ? [] : scopeChildren.map(subtree),
    };
  }
  let data;
  if (rootNode.type === "SCOPE") {
    data = subtree_for_scope(rootNode);
  } else {
    if (id !== "ROOT") throw new Error(`Unexpected node id ${id}`);
    data = subtree(id);
  }
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
        x: rootNode.position.x + node.y,
        // center the node
        y:
          rootNode.position.y +
          // (rootNode.measured?.height || 0) / 2 +
          (scopeSizeMap.get(id)?.height || rootNode.measured?.height || 0) / 2 +
          node.x -
          node.data.height / 2,
      },
    });

    if (n.type === "SCOPE" && n.id !== rootNode.id) {
      const dx = rootNode.position.x + node.y - n.position.x;
      const dy =
        rootNode.position.y +
        (scopeSizeMap.get(id)?.height || rootNode.measured?.height || 0) / 2 +
        node.x -
        node.data.height / 2 -
        n.position.y;
      // shift dx,dy for all children
      shiftChildren(nodesMap, n.id, dx, dy);
    }
  });
  if (rootNode.type === "SCOPE") {
    let width = y2 - y1 + 50;
    let height = x2 - x1 + 50;
    if (rootNode.data.scopeChildrenIds.length === 0) {
      // If the scope is empty, give it some minimum size.
      width = 200;
      height = 100;
    }
    scopeSizeMap.set(id, { width, height });
    nodesMap.set(id, {
      ...rootNode,
      width,
      height,
    });
  }
}

function shiftChildren(
  nodesMap: Y.Map<AppNode>,
  id: string,
  dx: number,
  dy: number
) {
  const node = nodesMap.get(id);
  if (!node) throw new Error("Node not found");
  node.data.treeChildrenIds.forEach((childId) => {
    const child = nodesMap.get(childId);
    if (!child) throw new Error("Child not found");
    nodesMap.set(childId, {
      ...child,
      position: {
        x: child.position.x + dx,
        y: child.position.y + dy,
      },
    });
    shiftChildren(nodesMap, childId, dx, dy);
  });
  if (node.type === "SCOPE") {
    node.data.scopeChildrenIds.forEach((childId) => {
      const child = nodesMap.get(childId);
      if (!child) throw new Error("Child not found");
      nodesMap.set(childId, {
        ...child,
        position: {
          x: child.position.x + dx,
          y: child.position.y + dy,
        },
      });
      shiftChildren(nodesMap, childId, dx, dy);
    });
  }
}

export function autoLayoutTree(get: Getter, set: Setter) {
  // console.log("autoLayoutTree");
  // measure the time of the operation
  const start = performance.now();
  const nodesMap = get(ATOM_nodesMap);
  scopeSizeMap.clear();
  // layoutSubTree(nodesMap, "ROOT");
  dfsForScope(get, set, nodesMap, "ROOT");
  updateView(get, set);
  const end = performance.now();
  // round to 2 decimal places
  console.log("[perf] autoLayoutTree took", (end - start).toFixed(2), "ms");
}

// DEPRECATED
export const ATOM_autoLayoutTree = atom(null, autoLayoutTree);

// DEPRECATED
function messUp(get: Getter, set: Setter) {
  const nodesMap = get(ATOM_nodesMap);
  const nodes = Array.from(nodesMap.values());
  nodes.forEach((node) => {
    if (node.type === "SCOPE") return;
    if (node.id === "ROOT") return;
    const pos = getAbsPos(node, nodesMap);
    node.position = { x: pos.x - 100, y: pos.y - 100 };
    nodesMap.set(node.id, node);
  });
  updateView(get, set);
}

// DEPRECATED
const ATOM_messUp = atom(null, messUp);
