import { Getter, PrimitiveAtom, Setter, atom } from "jotai";
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
  if (code.trim().startsWith("@export")) {
    code = code.replace("@export", " ".repeat("@export".length));
  }
  if (code.trim().startsWith("@utility")) {
    code = code.replace("@utility", " ".repeat("@utility".length));
  }
  if (code.trim().startsWith("@export")) {
    code = code.replace("@export", " ".repeat("@export".length));
  }
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
    ispublic: false,
    isutility: false,
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

/**
 * Parse the code for defined variables and functions.
 * @param id paod
 */
function parsePod(get: Getter, set: Setter, id: string) {
  console.log("parsePod", id);
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
  const parseResult = analyzeCode(codeMap.get(id)?.toString() || "");
  set(getOrCreate_ATOM_parseResult(id), parseResult);
}

function propagateST(get: Getter, set: Setter, id: string) {
  const nodesMap = get(ATOM_nodesMap);
  const node = nodesMap.get(id);
  if (!node) throw new Error(`Node not found for id: ${id}`);
  if (node.type !== "CODE") return;
  const parseResult = get(getOrCreate_ATOM_parseResult(id));
  // this only for updating selfSt
  const selfSt = new Map<string, string>();
  parseResult.annotations
    .filter(({ type }) => ["function", "vardef", "bridge"].includes(type))
    .forEach((annotation) => {
      selfSt.set(annotation.name, id);
    });
  set(getOrCreate_ATOM_selfST(id), selfSt);

  function passUp(tmpId: string) {
    const tmpNode = nodesMap.get(tmpId);
    if (!tmpNode) return;
    if (!tmpNode.data.parent) return;
    const parent = nodesMap.get(tmpNode.data.parent.id);
    if (!parent) return;
    if (tmpNode.data.parent.relation === "TREE" && parent.type !== "RICH") {
      // terminate
      const treeParent = nodesMap.get(tmpNode.data.parent.id);
      myassert(treeParent);
      const st = get(getOrCreate_ATOM_privateST(treeParent.id));
      parseResult.annotations
        .filter(({ type }) => ["function", "vardef", "bridge"].includes(type))
        .forEach((annotation) => {
          // TODO support multiple definitions with map to array (multi-map).
          st.set(annotation.name, id);
        });
      set(getOrCreate_ATOM_privateST(treeParent.id), st);
      return;
    }
    const scopeParent = nodesMap.get(tmpNode.data.parent.id);
    myassert(scopeParent);
    const parent_privateSt = get(getOrCreate_ATOM_publicST(scopeParent.id));
    parseResult.annotations
      .filter(({ type }) => ["function", "vardef", "bridge"].includes(type))
      .forEach((annotation) => {
        // TODO support multiple definitions with map to array (multi-map).
        parent_privateSt.set(annotation.name, id);
      });
    set(getOrCreate_ATOM_publicST(scopeParent.id), parent_privateSt);
    passUp(tmpNode.data.parent.id);
  }

  myassert(node.data.parent);
  const parent = nodesMap.get(node.data.parent.id);
  myassert(parent);
  passUp(id);
}

export const ATOM_parsePod = atom(null, (get, set, id: string) => {
  parsePod(get, set, id);
  propagateST(get, set, id);
});

function parseAllPods(get: Getter, set: Setter) {
  const t1 = performance.now();
  const nodesMap = get(ATOM_nodesMap);
  nodesMap.forEach((node) => {
    if (node.type === "CODE") {
      parsePod(get, set, node.id);
    }
  });
  const t2 = performance.now();
  console.log("[perf] parseAllPods took " + (t2 - t1) + " milliseconds.");

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
  console.log("[perf] propagateST took " + (t3 - t2) + " milliseconds.");
}

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
  {
    const st = get(getOrCreate_ATOM_selfST(id));
    if (!st) throw new Error(`Symbol table not found for id: ${id}`);
    resolveResult.unresolved.forEach((symbol) => {
      if (st.has(symbol)) {
        resolveResult.resolved.set(symbol, st.get(symbol)!);
      }
    });
    resolveResult.resolved.forEach((_, key) =>
      resolveResult.unresolved.delete(key)
    );
  }
  // 2.2 try this pod's private ST, i.e. from its children
  {
    const st = get(getOrCreate_ATOM_privateST(id));
    if (!st) throw new Error(`Symbol table not found for id: ${id}`);
    resolveResult.unresolved.forEach((symbol) => {
      if (st.has(symbol)) {
        resolveResult.resolved.set(symbol, st.get(symbol)!);
      }
    });
    resolveResult.resolved.forEach((_, key) =>
      resolveResult.unresolved.delete(key)
    );
  }
  // 2.3 try the parent's private and public ST, i.e., from its siblings
  if (resolveResult.unresolved.size > 0) {
    const node = get(ATOM_nodesMap).get(id);
    if (!node) throw new Error(`Node not found for id: ${id}`);
    if (!node.data.parent) throw new Error(`Parent not found for id: ${id}`);
    const privateSt = get(getOrCreate_ATOM_privateST(node.data.parent.id));
    const publicSt = get(getOrCreate_ATOM_publicST(node.data.parent.id));
    myassert(privateSt);
    myassert(publicSt);
    resolveResult.unresolved.forEach((symbol) => {
      const target = privateSt.get(symbol) || publicSt.get(symbol);
      if (target) {
        resolveResult.resolved.set(symbol, target);
      }
    });
    resolveResult.resolved.forEach((_, key) =>
      resolveResult.unresolved.delete(key)
    );
  }
  set(getOrCreate_ATOM_resolveResult(id), resolveResult);
}

export const ATOM_resolveAllPods = atom(null, (get, set) => {
  const nodesMap = get(ATOM_nodesMap);
  nodesMap.forEach((node) => {
    if (node.type === "CODE") {
      resolvePod(get, set, node.id);
    }
  });
});

function clearResults(get: Getter, set: Setter, podId: string) {
  const resultMap = get(ATOM_resultMap);
  resultMap.delete(podId);
}

export const ATOM_clearResults = atom(null, clearResults);

function setRunning(get: Getter, set: Setter, podId: string) {
  const resultMap = get(ATOM_resultMap);
  resultMap.set(podId, { running: true, data: [] });
}

function preprocessChain(get: Getter, set: Setter, ids: string[]) {
  let specs = ids.map((id) => {
    const nodesMap = get(ATOM_nodesMap);
    const node = nodesMap.get(id);
    if (!node) throw new Error(`Node not found for id: ${id}`);
    if (node.type !== "CODE") throw new Error(`Node is not a code pod: ${id}`);
    // Actually send the run request.
    // Analyze code and set symbol table
    parsePod(get, set, id);
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
  const edgesMap = get(ATOM_edgesMap);
  let edges = Array.from<Edge>(edgesMap.values());
  // build a node2target map
  let node2target = {};
  edges.forEach(({ source, target }) => {
    // TODO support multiple targets
    node2target[source] = target;
  });
  // Get the chain
  let chain: string[] = [];
  let nodeid = id;
  while (nodeid) {
    // if the nodeid is already in the chain, then there is a loop
    if (chain.includes(nodeid)) break;
    chain.push(nodeid);
    nodeid = node2target[nodeid];
  }
  return chain;
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
