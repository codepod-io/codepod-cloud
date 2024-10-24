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
  getOrCreate_ATOM_runtimeReady,
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
import { topoSort } from "./topoSort";
import { ATOM_currentPage } from "./atom";

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
  // if (get(ATOM_disableCodeRewrite)) {
  //   return code;
  // }
  // return code;
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

/**
 * - The immediate field is the immediate pod where this symbol is from. It is
 *   used for computing defuse edges.
 * - The final field is the actual pod where this symbol is defined. It is used
 *   for rewriting code.
 */
type SymbolTable = Map<string, { immediate: string; final: string }>;

// ---- private symbol table
const id2_ATOM_privateST = new Map<string, PrimitiveAtom<SymbolTable>>();
export function getOrCreate_ATOM_privateST(id: string) {
  if (id2_ATOM_privateST.has(id)) {
    return id2_ATOM_privateST.get(id)!;
  }
  const res = atom<SymbolTable>(new Map());
  id2_ATOM_privateST.set(id, res);
  return res;
}

// ---- self symbol table
const id2_ATOM_selfST = new Map<string, PrimitiveAtom<SymbolTable>>();
export function getOrCreate_ATOM_selfST(id: string) {
  if (id2_ATOM_selfST.has(id)) {
    return id2_ATOM_selfST.get(id)!;
  }
  const res = atom<SymbolTable>(new Map());
  id2_ATOM_selfST.set(id, res);
  return res;
}

// ---- public symbol table
const id2_ATOM_publicST = new Map<string, PrimitiveAtom<SymbolTable>>();
export function getOrCreate_ATOM_publicST(id: string) {
  if (id2_ATOM_publicST.has(id)) {
    return id2_ATOM_publicST.get(id)!;
  }
  const res = atom<SymbolTable>(new Map());
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
 *
 */
function propagateUp(
  get: Getter,
  set: Setter,
  parseResult: ParseResult,
  originId: string,
  node: AppNode
) {
  const nodesMap = get(ATOM_nodesMap);
  if (node.parentId) {
    // Parent scope's private ST
    const parentSt = get(getOrCreate_ATOM_privateST(node.parentId));
    parseResult.annotations
      .filter(({ type }) => ["function", "vardef", "bridge"].includes(type))
      .forEach((annotation) => {
        parentSt.set(annotation.name, { immediate: node.id, final: originId });
      });
    if (node.data.isPublic) {
      // parent scope's public ST and propagate up
      const parent = nodesMap.get(node.parentId);
      myassert(parent);
      const parentScopePublicSt = get(getOrCreate_ATOM_publicST(node.parentId));
      parseResult.annotations
        .filter(({ type }) => ["function", "vardef", "bridge"].includes(type))
        .forEach((annotation) => {
          // This public ST is only for visualization purpose. Symbol resolving does not use this.
          parentScopePublicSt.set(annotation.name, {
            immediate: node.id,
            final: originId,
          });
        });
      propagateUp(get, set, parseResult, originId, parent);
    }
  } else {
    // subpage private ST
    const subpageSt = get(
      getOrCreate_ATOM_privateST(node.data.subpageId ?? "main")
    );
    parseResult.annotations
      .filter(({ type }) => ["function", "vardef", "bridge"].includes(type))
      .forEach((annotation) => {
        subpageSt.set(annotation.name, { immediate: node.id, final: originId });
      });
    if (node.data.isPublic) {
      // subpage public ST and propagate to the subpage refs
      const subpageId = node.data.subpageId;
      const subpagePublicSt = get(
        getOrCreate_ATOM_publicST(subpageId ?? "main")
      );
      parseResult.annotations
        .filter(({ type }) => ["function", "vardef", "bridge"].includes(type))
        .forEach((annotation) => {
          subpagePublicSt.set(annotation.name, {
            immediate: node.id,
            final: originId,
          });
        });
      // get the subpage refs, and add to private ST there, i.e., the grandparent
      const subpageRefs = Array.from(nodesMap.values()).filter(
        (node) => node.type === "SubpageRef" && node.data.refId === subpageId
      );
      subpageRefs.forEach((ref) => {
        const grandParentSt = get(
          getOrCreate_ATOM_privateST(
            ref.parentId ?? ref.data.subpageId ?? "main"
          )
        );
        parseResult.annotations
          .filter(({ type }) => ["function", "vardef", "bridge"].includes(type))
          .forEach((annotation) => {
            grandParentSt.set(annotation.name, {
              immediate: ref.id,
              final: originId,
            });
          });
      });
    }
  }
}

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
      selfSt.set(annotation.name, { immediate: id, final: id });
    });
  // set(getOrCreate_ATOM_selfST(id), selfSt);
  propagateUp(get, set, parseResult, id, node);
}

async function parseAllPods(get: Getter, set: Setter) {
  const t1 = performance.now();
  const nodesMap = get(ATOM_nodesMap);
  const nodes = Array.from(nodesMap.values());
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
    set(atom, new Map());
  });
  id2_ATOM_publicST.forEach((atom) => {
    set(atom, new Map());
  });
  id2_ATOM_selfST.forEach((atom) => {
    set(atom, new Map());
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

/**
 * This is a map for recording the defuse edges during resolving symbols. It is
 * reset in resolveAllPods.
 */
export const resolveDefUseEdges = new Map<string, Set<string>>();

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
        resolveResult.resolved.set(symbol, target.final);
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
  resolveUp(get, set, { node, resolveResult });
  set(getOrCreate_ATOM_resolveResult(id), resolveResult);
}

function resolveUp(
  get: Getter,
  set: Setter,
  { node, resolveResult }: { node: AppNode; resolveResult: ResolveResult }
) {
  if (resolveResult.unresolved.size == 0) return;
  // This is a scope termination node. Resolve in private ST.
  const st = get(
    getOrCreate_ATOM_privateST(node.parentId ?? node.data.subpageId ?? "main")
  );
  resolveResult.unresolved.forEach((symbol) => {
    const target = st.get(symbol);
    if (target) {
      {
        // Recording defuse edges during resolving symbols.
        //
        // source: the pod where this symbol comes from
        const sourceId = target.immediate;
        // target: the current node
        const targetId = node.id;
        if (!resolveDefUseEdges.has(sourceId)) {
          resolveDefUseEdges.set(sourceId, new Set());
        }
        resolveDefUseEdges.get(sourceId)!.add(targetId);
      }
      resolveResult.resolved.set(symbol, target.final);
    }
  });
  resolveResult.resolved.forEach((_, key) =>
    resolveResult.unresolved.delete(key)
  );

  // Return conditions.
  if (resolveResult.unresolved.size == 0) return;
  if (!node.parentId) return;
  // pass up
  const nodesMap = get(ATOM_nodesMap);
  const parent = nodesMap.get(node.parentId);
  myassert(parent);
  resolveUp(get, set, { node: parent, resolveResult });
}

function resolveAllPods(get: Getter, set: Setter) {
  const nodesMap = get(ATOM_nodesMap);
  resolveDefUseEdges.clear();
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
  // Handle the case where hitting Shift-Enter in the code editor. The runtimeReady flag is not used there.
  const nodesMap = get(ATOM_nodesMap);
  if (ids.length === 1) {
    const node = nodesMap.get(ids[0]);
    if (node && node.type === "CODE") {
      const runtimeReady = get(getOrCreate_ATOM_runtimeReady(node?.data.lang));
      if (!runtimeReady) {
        // if runtime is not ready, return
        toast.error("Runtime not ready");
        return [];
      }
    }
  }

  // 1. parse
  await Promise.all(ids.map((id) => parsePod(get, set, id)));
  // 2. propagate
  // FIXME performance. I'm propagating all STs for all pods when parsing a single pod, so that I can avoid:
  // - remove old symbols from ST
  // - there was a delay in the symbol to be appear in the ST UI of parent node.
  propagateAllST(get, set);
  // 3. resolve & rewrite
  let specs = ids.map((id) => {
    const nodesMap = get(ATOM_nodesMap);
    const node = nodesMap.get(id);
    if (!node) throw new Error(`Node not found for id: ${id}`);
    if (node.type !== "CODE") throw new Error(`Node is not a code pod: ${id}`);
    // update anontations according to st
    resolvePod(get, set, id);
    const newcode = rewriteCode(id, get);
    // console.log("newcode", newcode);
    const lang = node?.data.lang;
    return { podId: id, code: newcode || "", kernelName: lang || "python" };
  });
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
 * Get the list of nodes in the subtree rooted at id, including the root.
 * @param id subtree root
 */
function getSubtreeNodes({
  id,
  nodesMap,
  adjacencySet,
  reverseAdjacencySet,
}: {
  id: string;
  nodesMap: Y.Map<AppNode>;
  adjacencySet: Map<string, Set<string>>;
  reverseAdjacencySet: Map<string, Set<string>>;
}): AppNode[] {
  const node = nodesMap.get(id);
  myassert(node);
  if (node.type === "CODE" && !node.data.isTest) {
    return [node];
  } else if (node.type === "SCOPE" && !node.data.isTest) {
    // get init nodes
    const initIds = node.data.childrenIds.filter((childId) => {
      const child = nodesMap.get(childId);
      myassert(child);
      if (!child.data.isInit) return false;
      if (!reverseAdjacencySet.has(childId)) return true;
      return reverseAdjacencySet.get(childId)!.size === 0;
    });
    const childrenIds = topoSort(node.data.childrenIds, adjacencySet);
    // put init ids in the front, remove them from sorted ids
    const initInFront = [
      ...initIds,
      ...childrenIds.filter((id) => !initIds.includes(id)),
    ];

    const children = initInFront.map((childId) => {
      return getSubtreeNodes({
        id: childId,
        nodesMap,
        adjacencySet,
        reverseAdjacencySet,
      });
    });
    return [...children.flatMap((child) => child)];
  } else {
    return [];
  }
}

function buildAdjacencySet(edges: Edge[]): {
  adjacencySet: Map<string, Set<string>>;
  reverseAdjacencySet: Map<string, Set<string>>;
} {
  const adjacencySet: Map<string, Set<string>> = new Map();
  const reverseAdjacencySet: Map<string, Set<string>> = new Map();
  edges.forEach((edge) => {
    const { source, target } = edge;
    if (!adjacencySet.has(source)) {
      adjacencySet.set(source, new Set());
    }
    adjacencySet.get(source)!.add(target);
    if (!reverseAdjacencySet.has(target)) {
      reverseAdjacencySet.set(target, new Set());
    }
    reverseAdjacencySet.get(target)!.add(source);
  });
  return { adjacencySet, reverseAdjacencySet };
}

function getSubpageChain(
  get: Getter,
  set: Setter,
  subpageId?: string
): string[] {
  const nodesMap = get(ATOM_nodesMap);
  let nodes0 = Array.from(nodesMap.values());
  const edges = get(ATOM_edges);
  // only run the current subpage
  const rootNodes = nodes0.filter(
    (node) => !node.parentId && node.data.subpageId === subpageId
  );
  const rootIds = rootNodes.map((node) => node.id);
  // Build the adjacency set
  const { adjacencySet, reverseAdjacencySet } = buildAdjacencySet(edges);
  const sortedRootIds = topoSort(rootIds, adjacencySet);
  // 2. recursively get subtree nodes
  const nodes1 = sortedRootIds
    .map((id) => {
      return getSubtreeNodes({
        id,
        nodesMap,
        adjacencySet,
        reverseAdjacencySet,
      });
    })
    .flatMap((child) => child);
  return nodes1.map((node) => node.id);
}

export const ATOM_getSubpageChain = atom(null, getSubpageChain);

function getScopeChain(get: Getter, set: Setter, id: string): string[] {
  const nodesMap = get(ATOM_nodesMap);
  const node = nodesMap.get(id);
  myassert(node && node.type === "SCOPE");
  const edges = get(ATOM_edges);
  const { adjacencySet, reverseAdjacencySet } = buildAdjacencySet(edges);
  const nodes = getSubtreeNodes({
    id,
    nodesMap,
    adjacencySet,
    reverseAdjacencySet,
  });
  return nodes.map((node) => node.id);
}

export const ATOM_getScopeChain = atom(null, getScopeChain);

/**
 * Add the pod and all its downstream pods (defined by edges) to the chain and run the chain.
 * @param id the id of the pod to start the chain
 * @returns
 */
function getEdgeChain(get: Getter, set: Setter, id: string): string[] {
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

  // Build the adjacency set
  const { adjacencySet } = buildAdjacencySet(edges);
  // topo sort
  const sortedChain = topoSort(chain, adjacencySet);
  // If there're scopes, get all the nodes in the scopes.
  const nodesMap = get(ATOM_nodesMap);
  const res: string[] = [];
  sortedChain.forEach((id) => {
    const node = nodesMap.get(id);
    if (node && node.type === "SCOPE") {
      const scopeChain = getScopeChain(get, set, id);
      res.push(...scopeChain);
    } else {
      res.push(id);
    }
  });
  return res;
}

export const ATOM_getEdgeChain = atom(null, getEdgeChain);
