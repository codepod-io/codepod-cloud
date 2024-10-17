import { Getter, PrimitiveAtom, Setter, atom } from "jotai";
import * as Y from "yjs";

import { parsePython } from "../parser";
import { parseRacket } from "../parserRacket";
import {
  ATOM_codeMap,
  ATOM_edgesMap,
  ATOM_nodesMap,
  ATOM_resultMap,
  ATOM_runtimeMap,
} from "./yjsSlice";
import { produce } from "immer";
import { ATOM_edges, ATOM_nodes } from "./canvasSlice";
import { Edge, Node } from "@xyflow/react";
import { toast } from "react-toastify";
import { match } from "ts-pattern";
import { ParseResult } from "../parser";
import { parseJavascript } from "../parserJavascript";
import { parseJulia } from "../parserJulia";
import { myassert } from "../utils/utils";
import { ATOM_disableCodeRewrite } from "./settingSlice";
import { AppNode } from "./types";

/**
 * 1. parse the code, get: (defs, refs) to functions & variables
 * 2. consult symbol table to resolve them
 * 3. if all resolved, rewrite the code; otherwise, return null.
 * @param code
 * @param symbolTable
 * @returns
 */
function rewriteCode(id: string, get: Getter): string | null {
  const nodesMap = get(ATOM_nodesMap);
  const node = nodesMap.get(id);
  const codeMap = get(ATOM_codeMap);
  const parseResult = get(getOrCreate_ATOM_parseResult(id));
  const resolveResult = get(getOrCreate_ATOM_resolveResult(id));
  if (resolveResult.unresolved.size > 0) {
    console.log(
      "rewriteCode: Unresolved symbols in pod " +
        id +
        ": " +
        [...resolveResult.unresolved].join(",")
    );
  }
  if (!node) return null;
  if (!codeMap.has(id)) return null;
  let code = codeMap.get(id)!.toString();
  if (code.startsWith("!")) return code;
  // replace with symbol table
  let newcode = "";
  let index = 0;
  parseResult.annotations?.forEach((annotation) => {
    newcode += code.slice(index, annotation.startIndex);
    index = annotation.endIndex;
    if (annotation.name.startsWith("CODEPOD_RAW_")) {
      // do not replace
      newcode += annotation.name;
      return;
    }
    switch (annotation.type) {
      case "vardef":
      case "function":
        {
          // add this pod's id to the name
          newcode += `${annotation.name}_${id}`;
        }
        break;
      case "varuse":
      case "callsite":
        {
          if (resolveResult.resolved.has(annotation.name)) {
            newcode += `${annotation.name}_${resolveResult.resolved.get(
              annotation.name
            )}`;
          } else {
            newcode += annotation.name;
          }
        }
        break;
      default:
        throw new Error("unknown annotation type: " + annotation.type);
    }
  });
  newcode += code.slice(index);
  // console.debug("newcode", newcode);
  return newcode;
}

// ---- parse result
const id2_ATOM_parseResult = new Map<string, PrimitiveAtom<ParseResult>>();
export function getOrCreate_ATOM_parseResult(id: string) {
  if (id2_ATOM_parseResult.has(id)) {
    const res = id2_ATOM_parseResult.get(id);
    return id2_ATOM_parseResult.get(id)!;
  }
  const res = atom<ParseResult>({
    annotations: [],
  });
  id2_ATOM_parseResult.set(id, res);
  return id2_ATOM_parseResult.get(id)!;
}

// ---- private symbol table
const id2_ATOM_privateST = new Map<
  string,
  PrimitiveAtom<Map<string, string>>
>();
export function getOrCreate_ATOM_privateST(id: string) {
  if (id2_ATOM_privateST.has(id)) {
    return id2_ATOM_privateST.get(id)!;
  }
  const res = atom(new Map<string, string>());
  id2_ATOM_privateST.set(id, res);
  return res;
}

// ---- self symbol table
const id2_ATOM_selfST = new Map<string, PrimitiveAtom<Map<string, string>>>();
export function getOrCreate_ATOM_selfST(id: string) {
  if (id2_ATOM_selfST.has(id)) {
    return id2_ATOM_selfST.get(id)!;
  }
  const res = atom(new Map<string, string>());
  id2_ATOM_selfST.set(id, res);
  return res;
}

// ---- public symbol table
const id2_ATOM_publicST = new Map<string, PrimitiveAtom<Map<string, string>>>();
export function getOrCreate_ATOM_publicST(id: string) {
  if (id2_ATOM_publicST.has(id)) {
    return id2_ATOM_publicST.get(id)!;
  }
  const res = atom(new Map<string, string>());
  id2_ATOM_publicST.set(id, res);
  return res;
}

async function computeHash(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Parse the code for defined variables and functions.
 * @param id paod
 */
async function parsePod(get: Getter, set: Setter, id: string) {
  // console.log("parsePod", id);
  const nodesMap = get(ATOM_nodesMap);
  const node = nodesMap.get(id);
  if (!node) throw new Error(`Node not found for id: ${id}`);
  if (node.type !== "CODE") return;
  const codeMap = get(ATOM_codeMap);
  const analyzeCode = match(node.data.lang)
    .with("python", () => parsePython)
    .with("racket", () => parseRacket)
    .with("javascript", () => parseJavascript)
    .with("julia", () => parseJulia)
    .otherwise(() => null);
  if (!analyzeCode) {
    console.log("Unsupported language: " + node.data.lang);
    // set(getOrCreate_ATOM_parseResult(id), null);
    return;
  }
  const code = codeMap.get(id)?.toString() || "";
  // compute hash. If the hash is the same, return the previous result.
  const hash = await computeHash(code);
  const prevResult = get(getOrCreate_ATOM_parseResult(id));
  if (prevResult.hash === hash) {
    return;
  }
  const parseResult = analyzeCode(code);
  parseResult.hash = hash;
  set(getOrCreate_ATOM_parseResult(id), parseResult);
}

export const ATOM_parsePod = atom(null, parsePod);

/**
 * TODO this is nlogn, can be improved to n. But this is not a bottleneck, i.e.,
 * runs in sub millisecond.
 *
 * FIXME does this modify in place? Seems yes.
 * FIXME detect multiple definitions
 */
function propagateST(get: Getter, set: Setter, id: string) {
  const nodesMap = get(ATOM_nodesMap);
  const node = nodesMap.get(id);
  if (!node) throw new Error(`Node not found for id: ${id}`);
  if (node.type !== "CODE") return;
  const parseResult = get(getOrCreate_ATOM_parseResult(id));
  // this only for updating selfSt
  // const selfSt = new Map<string, string>();
  const selfSt = get(getOrCreate_ATOM_selfST(id));
  parseResult.annotations
    .filter(({ type }) => ["function", "vardef", "bridge"].includes(type))
    .forEach((annotation) => {
      selfSt.set(annotation.name, id);
    });
  // set(getOrCreate_ATOM_selfST(id), selfSt);

  // Find the nearest scope parent, and insert the symbols to its private ST
  const parentSt = get(getOrCreate_ATOM_privateST(node.parentId ?? "ROOT"));
  parseResult.annotations
    .filter(({ type }) => ["function", "vardef", "bridge"].includes(type))
    .forEach((annotation) => {
      parentSt.set(annotation.name, id);
    });
  // set(getOrCreate_ATOM_privateST(parentScopeId), parentScopeSt);
  // If it is public, insert to one layer up
  if (node.parentId && node.data.isPublic) {
    const parent = nodesMap.get(node.parentId);
    myassert(parent);
    const grandParentSt = get(
      getOrCreate_ATOM_privateST(parent.parentId ?? "ROOT")
    );
    parseResult.annotations
      .filter(({ type }) => ["function", "vardef", "bridge"].includes(type))
      .forEach((annotation) => {
        grandParentSt.set(annotation.name, id);
      });
    const parentScopePublicSt = get(getOrCreate_ATOM_publicST(node.parentId));
    parseResult.annotations
      .filter(({ type }) => ["function", "vardef", "bridge"].includes(type))
      .forEach((annotation) => {
        // This public ST is only for visualization purpose. Symbol resolving does not use this.
        parentScopePublicSt.set(annotation.name, id);
      });
    // set(getOrCreate_ATOM_privateST(grandParentScopeId), grandParentScopeSt);
    // set(getOrCreate_ATOM_publicST(parentScopeId), parentScopePublicSt);
  }
}

async function parseAllPods(get: Getter, set: Setter) {
  const t1 = performance.now();
  const nodesMap = get(ATOM_nodesMap);
  const nodes = Array.from<AppNode>(nodesMap.values());
  // parse all code pods in parallel
  await Promise.all(
    nodes.map(async (node) => {
      if (node.type === "CODE") {
        await parsePod(get, set, node.id);
      }
    })
  );
  const t2 = performance.now();
  console.debug("[perf] parseAllPods took " + (t2 - t1).toFixed(2) + " ms.");
}

export function propagateAllST(get: Getter, set: Setter) {
  const t2 = performance.now();
  const nodesMap = get(ATOM_nodesMap);
  // clear all symbol tables
  id2_ATOM_privateST.forEach((atom) => {
    set(atom, new Map<string, string>());
  });
  id2_ATOM_publicST.forEach((atom) => {
    set(atom, new Map<string, string>());
  });
  id2_ATOM_selfST.forEach((atom) => {
    set(atom, new Map<string, string>());
  });
  // propagate symbol tables
  nodesMap.forEach((node) => {
    if (node.type === "CODE") {
      propagateST(get, set, node.id);
    }
  });
  const t3 = performance.now();
  console.debug("[perf] propagateST took " + (t3 - t2).toFixed(2) + " ms.");
}

export const ATOM_propagateAllST = atom(null, propagateAllST);

export const ATOM_parseAllPods = atom(null, parseAllPods);

export type ResolveResult = {
  resolved: Map<string, string>;
  unresolved: Set<string>;
};
const resolveResult: ResolveResult = {
  resolved: new Map(),
  unresolved: new Set(),
};
const id2_ATOM_resolveResult = new Map<string, PrimitiveAtom<ResolveResult>>();
export function getOrCreate_ATOM_resolveResult(id: string) {
  if (id2_ATOM_resolveResult.has(id)) {
    return id2_ATOM_resolveResult.get(id)!;
  }
  const res = atom(resolveResult);
  id2_ATOM_resolveResult.set(id, res);
  return res;
}

export const ATOM_resolvePod = atom(null, resolvePod);

function resolvePod(get: Getter, set: Setter, id: string) {
  // 1. gather all symbols to be resolved
  const resolveResult = {
    resolved: new Map<string, string>(),
    unresolved: new Set<string>(),
  };
  const parseResult = get(getOrCreate_ATOM_parseResult(id));
  parseResult.annotations
    .filter(({ type }) => ["varuse", "callsite"].includes(type))
    .forEach((annotation) => {
      resolveResult.unresolved.add(annotation.name);
    });
  // 2.1 self ST
  if (resolveResult.unresolved.size > 0) {
    const st = get(getOrCreate_ATOM_selfST(id));
    if (!st) throw new Error(`Symbol table not found for id: ${id}`);
    resolveResult.unresolved.forEach((symbol) => {
      const target = st.get(symbol);
      if (target) {
        resolveResult.resolved.set(symbol, target);
      }
    });
    resolveResult.resolved.forEach((_, key) =>
      resolveResult.unresolved.delete(key)
    );
  }
  // 2.2 go up, find scopes, and try their private ST
  const nodesMap = get(ATOM_nodesMap);
  const node = nodesMap.get(id);
  myassert(node);
  resolveUp(get, set, { id: node.parentId, resolveResult });
  set(getOrCreate_ATOM_resolveResult(id), resolveResult);
}

function resolveUp(
  get: Getter,
  set: Setter,
  { id, resolveResult }: { id?: string; resolveResult: ResolveResult }
) {
  if (resolveResult.unresolved.size == 0) return;
  // This is a scope termination node. Resolve in private ST.
  const st = get(getOrCreate_ATOM_privateST(id ?? "ROOT"));
  resolveResult.unresolved.forEach((symbol) => {
    const target = st.get(symbol);
    if (target) {
      resolveResult.resolved.set(symbol, target);
    }
  });
  resolveResult.resolved.forEach((_, key) =>
    resolveResult.unresolved.delete(key)
  );

  // Return conditions.
  if (resolveResult.unresolved.size == 0) return;
  if (!id) return;
  // pass up
  const nodesMap = get(ATOM_nodesMap);
  const node = nodesMap.get(id);
  myassert(node);
  resolveUp(get, set, { id: node.parentId, resolveResult });
}

function resolveAllPods(get: Getter, set: Setter) {
  const nodesMap = get(ATOM_nodesMap);
  nodesMap.forEach((node) => {
    if (node.type === "CODE") {
      resolvePod(get, set, node.id);
    }
  });
}

export const ATOM_resolveAllPods = atom(null, resolveAllPods);

function clearResults(get: Getter, set: Setter, podId: string) {
  const resultMap = get(ATOM_resultMap);
  resultMap.delete(podId);
}

export const ATOM_clearResults = atom(null, clearResults);

function setRunning(get: Getter, set: Setter, podId: string) {
  const resultMap = get(ATOM_resultMap);
  resultMap.set(podId, { running: true, data: [] });
}

async function preprocessChain(get: Getter, set: Setter, ids: string[]) {
  let specs = await Promise.all(
    ids.map(async (id) => {
      const nodesMap = get(ATOM_nodesMap);
      const node = nodesMap.get(id);
      if (!node) throw new Error(`Node not found for id: ${id}`);
      if (node.type !== "CODE")
        throw new Error(`Node is not a code pod: ${id}`);
      // Actually send the run request.
      // Analyze code and set symbol table
      await parsePod(get, set, id);
      // FIXME performance. I'm propagating all STs for all pods when parsing a single pod, so that I can avoid:
      // 1. remove old symbols from ST
      // 2. there was a delay in the symbol to be appear in the ST UI of parent node.
      //
      // propagateST(get, set, id);
      propagateAllST(get, set);
      // update anontations according to st
      resolvePod(get, set, id);
      const newcode = rewriteCode(id, get);
      // console.log("newcode", newcode);
      const lang = node?.data.lang;
      return { podId: id, code: newcode || "", kernelName: lang || "python" };
    })
  );
  return specs.filter(({ podId, code }) => {
    if (code.length > 0) {
      clearResults(get, set, podId);
      setRunning(get, set, podId);
      return true;
    }
    return false;
  });
}

export const ATOM_preprocessChain = atom(null, preprocessChain);

/**
 * Topological sort the ids.
 * If a cycle is detected, remove the edge causing the cycle and continue.
 */
function topoSort(
  ids: string[],
  nodesMap: Y.Map<AppNode>,
  edges: Edge[]
): string[] {
  const sorted: string[] = [];
  const visited: Set<string> = new Set();
  const visiting: Set<string> = new Set(); // To detect cycles
  const adjacencyList: Map<string, string[]> = new Map();

  // Build the adjacency list
  edges.forEach((edge) => {
    const { source, target } = edge;
    if (!adjacencyList.has(source)) {
      adjacencyList.set(source, []);
    }
    adjacencyList.get(source)!.push(target);
  });

  // Remove an edge from the adjacency list
  function removeEdge(source: string, target: string) {
    const neighbors = adjacencyList.get(source);
    if (neighbors) {
      adjacencyList.set(
        source,
        neighbors.filter((n) => n !== target)
      );
    }
  }

  // Helper function to perform DFS
  function dfs(nodeId: string): boolean {
    if (visited.has(nodeId)) return true; // Already processed
    if (visiting.has(nodeId)) return false; // Cycle detected

    visiting.add(nodeId);

    const neighbors = adjacencyList.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (!dfs(neighbor)) {
        // A cycle is detected, remove the edge causing the cycle and warn
        console.warn(
          `Cycle detected between ${nodeId} and ${neighbor}. Removing edge.`
        );
        removeEdge(nodeId, neighbor); // Remove the edge causing the cycle
      }
    }

    visiting.delete(nodeId);
    visited.add(nodeId);
    sorted.push(nodeId);

    return true;
  }

  // Perform DFS on all nodes
  for (const id of ids) {
    if (!visited.has(id)) {
      dfs(id);
    }
  }

  return sorted.reverse(); // Reverse because we want to return in topological order
}

/**
 * Get the list of nodes in the subtree rooted at id, including the root.
 * @param id subtree root
 */
function getSubtreeNodes(
  id: string,
  nodesMap: Y.Map<AppNode>,
  edges: Edge[]
): AppNode[] {
  const node = nodesMap.get(id);
  myassert(node);
  if (node.type === "CODE" && !node.data.isTest) {
    return [node];
  } else if (node.type === "SCOPE" && !node.data.isTest) {
    const childrenIds = topoSort(node.data.childrenIds, nodesMap, edges);
    const children = childrenIds.map((childId) => {
      return getSubtreeNodes(childId, nodesMap, edges);
    });
    return [...children.flatMap((child) => child)];
  } else {
    return [];
  }
}

export function getAllCode(get: Getter, set: Setter) {
  // 1. get root nodes
  const nodesMap = get(ATOM_nodesMap);
  let nodes0 = Array.from<AppNode>(nodesMap.values());
  const edges = get(ATOM_edges);
  const rootNodes = nodes0.filter((node) => !node.parentId);
  const rootIds = rootNodes.map((node) => node.id);
  const sortedRootIds = topoSort(rootIds, nodesMap, edges);
  // 2. recursively get subtree nodes
  const nodes1 = sortedRootIds
    .map((id) => {
      return getSubtreeNodes(id, nodesMap, edges);
    })
    .flatMap((child) => child);
  return nodes1;
}

async function preprocessAllPodsExceptTest(get: Getter, set: Setter) {
  // parse and resolve
  await parseAllPods(get, set);
  propagateAllST(get, set);
  resolveAllPods(get, set);
  // get all non-test pods
  const nodesMap = get(ATOM_nodesMap);
  // run dfs, skip test scopes and pods
  // TODO the order should be topological
  const codeNodes = getAllCode(get, set);

  // rewrite code and construct specs
  let specs = codeNodes.map((node) => {
    myassert(node.type === "CODE");
    // skip parsing and resolving
    const newcode = rewriteCode(node.id, get);
    // console.log("newcode", newcode);
    const lang = node?.data.lang;
    return {
      podId: node.id,
      code: newcode || "",
      kernelName: lang || "python",
    };
  });
  // filter out empty code
  specs = specs.filter(({ podId, code }) => {
    if (code.length > 0) {
      return true;
    }
    return false;
  });
  // clear old results and set running status
  specs.forEach(({ podId }) => {
    clearResults(get, set, podId);
    setRunning(get, set, podId);
  });
  return specs;
}

export const ATOM_preprocessAllPodsExceptTest = atom(
  null,
  preprocessAllPodsExceptTest
);

function getScopeChain(get: Getter, set: Setter, id: string) {
  const nodesMap = get(ATOM_nodesMap);
  const nodes = Array.from<Node>(nodesMap.values());
  const node = nodesMap.get(id);
  if (!node) return [];
  const chain = getDescendants(node, nodes);
  return chain;
}

export const ATOM_getScopeChain = atom(null, getScopeChain);

/**
 * Add the pod and all its downstream pods (defined by edges) to the chain and run the chain.
 * @param id the id of the pod to start the chain
 * @returns
 */
function getEdgeChain(get: Getter, set: Setter, id: string) {
  // Get the chain: get the edges, and then get the pods
  // These edges include both defuse edges and manual edges.
  const edges = get(ATOM_edges);
  // build a node2target map
  let node2targets = new Map<string, Set<string>>();
  edges.forEach(({ source, target }) => {
    // TODO support multiple targets
    if (!node2targets.has(source)) {
      node2targets.set(source, new Set());
    }
    node2targets.get(source)!.add(target);
  });
  // Get the chain
  let chain: string[] = [];
  const heads = new Set<string>();
  const visited = new Set<string>();
  heads.add(id);
  while (heads.size > 0) {
    const nodeid = heads.values().next().value;
    myassert(nodeid);
    heads.delete(nodeid);
    chain.push(nodeid);
    visited.add(nodeid);

    const targets = node2targets.get(nodeid);
    targets?.forEach((node) => {
      // If the nodeid is already in the chain, then there is a loop. In this
      // case, we want to skip it and continue processing. Effectively, this break
      // up the loops if any.
      //
      // UPDATE: this is not enough. We should do topoSort.
      if (!visited.has(node)) {
        heads.add(node);
      }
    });
  }
  // topo sort
  const sortedChain = topoSort(chain, get(ATOM_nodesMap), edges);
  return sortedChain;
}

export const ATOM_getEdgeChain = atom(null, getEdgeChain);

/**
 * Get all code pods inside a scope by geographical order.
 */
function getDescendants(node: Node, nodes: Node[]): string[] {
  if (node.type === "CODE") return [node.id];
  if (node.type === "SCOPE") {
    let children = nodes.filter((n) => n.parentId === node.id);
    children.sort((a, b) => {
      if (a.position.y === b.position.y) {
        return a.position.x - b.position.x;
      } else {
        return a.position.y - b.position.y;
      }
    });
    return ([] as string[]).concat(
      ...children.map((n) => getDescendants(n, nodes))
    );
  }
  return [];
}
