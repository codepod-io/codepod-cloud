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
    index = annotation.endIndex;
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

// ---- utility symbol table
const id2_ATOM_utilityST = new Map<
  string,
  PrimitiveAtom<Map<string, string>>
>();
export function getOrCreate_ATOM_utilityST(id: string) {
  if (id2_ATOM_utilityST.has(id)) {
    return id2_ATOM_utilityST.get(id)!;
  }
  const res = atom(new Map<string, string>());
  id2_ATOM_utilityST.set(id, res);
  return res;
}

// generate symbol table for a pod.
function generateSymbolTable(get: Getter, set: Setter, id: string) {
  // private table: all symbols defined in its children
  const nodesMap = get(ATOM_nodesMap);
  const node = nodesMap.get(id);
  if (!node) throw new Error(`Node not found for id: ${id}`);

  // compute the symbol table with its children
  const privateSt = new Map<string, string>();
  const publicSt = new Map<string, string>();
  const utilitySt = new Map<string, string>();
  const selfSt = new Map<string, string>();

  {
    const parseResult = get(getOrCreate_ATOM_parseResult(id));
    parseResult.annotations
      .filter(({ type }) => ["function", "vardef", "bridge"].includes(type))
      .forEach((annotation) => {
        selfSt.set(annotation.name, id);
      });
  }

  const children = nodesMap.get(id)?.data.children || [];
  children.forEach((childId) => {
    const child = nodesMap.get(childId);
    if (!child) throw new Error(`Child not found for id: ${childId}`);
    const parseResult = get(getOrCreate_ATOM_parseResult(childId));

    parseResult.annotations
      .filter(({ type }) => ["function", "vardef", "bridge"].includes(type))
      .forEach((annotation) => {
        privateSt.set(annotation.name, childId);
      });

    if (parseResult.ispublic) {
      parseResult.annotations
        .filter(({ type }) => ["function", "vardef", "bridge"].includes(type))
        .forEach((annotation) => {
          publicSt.set(annotation.name, childId);
        });
    }
    if (parseResult.isutility) {
      parseResult.annotations
        .filter(({ type }) => ["function", "vardef", "bridge"].includes(type))
        .forEach((annotation) => {
          utilitySt.set(annotation.name, childId);
        });
    }
    // If a child has public ST, merge it to the parent's private ST
    const childPubSt = get(getOrCreate_ATOM_publicST(childId));
    childPubSt.forEach((value, key) => {
      privateSt.set(key, value);
    });
    // If a child has symbol in BOTH utility and public ST (i.e., public
    // utility), merge it to the parent's utility ST.
    const childUtilSt = get(getOrCreate_ATOM_utilityST(childId));
    childUtilSt.forEach((value, key) => {
      if (childPubSt.has(key)) {
        utilitySt.set(key, value);
      }
    });
  });

  set(getOrCreate_ATOM_selfST(id), selfSt);
  set(getOrCreate_ATOM_privateST(id), privateSt);
  set(getOrCreate_ATOM_publicST(id), publicSt);
  set(getOrCreate_ATOM_utilityST(id), utilitySt);
}

/**
 * Parse the code for defined variables and functions.
 * @param id paod
 */
function parsePod(get: Getter, set: Setter, id: string) {
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
  // this only for updating selfSt
  generateSymbolTable(get, set, id);
  const parentId = node.data.parent;
  if (!parentId) return;
  generateSymbolTable(get, set, parentId);
  const parent = nodesMap.get(parentId);
  if (!parent) return;
  const grandParentId = parent.data.parent;
  if (!grandParentId) return;
  generateSymbolTable(get, set, grandParentId);
}

export const ATOM_parsePod = atom(null, parsePod);

function parseAllPods(get: Getter, set: Setter) {
  const nodesMap = get(ATOM_nodesMap);
  nodesMap.forEach((node) => {
    if (node.type === "CODE") {
      parsePod(get, set, node.id);
    }
  });
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

function resolveUtility(get: Getter, id: string, resolveResult: ResolveResult) {
  const st = get(getOrCreate_ATOM_utilityST(id));
  if (!st) throw new Error(`Symbol table not found for id: ${id}`);
  resolveResult.unresolved.forEach((symbol) => {
    if (st.has(symbol)) {
      resolveResult.resolved.set(symbol, st.get(symbol)!);
    }
  });
  resolveResult.resolved.forEach((_, key) =>
    resolveResult.unresolved.delete(key)
  );
  if (resolveResult.unresolved.size === 0) return;
  const node = get(ATOM_nodesMap).get(id);
  if (!node) throw new Error(`Node not found for id: ${id}`);
  if (!node.data.parent) return;
  resolveUtility(get, node.data.parent, resolveResult);
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
  // 2.3 try the parent's private ST, i.e., from its siblings
  if (resolveResult.unresolved.size > 0) {
    const node = get(ATOM_nodesMap).get(id);
    if (!node) throw new Error(`Node not found for id: ${id}`);
    if (!node.data.parent) throw new Error(`Parent not found for id: ${id}`);
    const st = get(getOrCreate_ATOM_privateST(node.data.parent));
    if (!st)
      throw new Error(`Symbol table not found for id: ${node.data.parent}`);
    resolveResult.unresolved.forEach((symbol) => {
      if (st.has(symbol)) {
        resolveResult.resolved.set(symbol, st.get(symbol)!);
      }
    });
    resolveResult.resolved.forEach((_, key) =>
      resolveResult.unresolved.delete(key)
    );
  }
  // 2.4 ancestors' the utility scopes. The parent's utility is already included
  //    in parent's private ST. Therefore we should start with grandparent's
  //    utility.
  if (resolveResult.unresolved.size > 0) {
    const node = get(ATOM_nodesMap).get(id);
    if (!node) throw new Error(`Node not found for id: ${id}`);
    if (!node.data.parent) throw new Error(`Parent not found for id: ${id}`);
    const parent = get(ATOM_nodesMap).get(node.data.parent);
    if (!parent) throw new Error(`Parent not found for id: ${id}`);
    const grandParentId = parent.data.parent;
    if (grandParentId) {
      resolveUtility(get, grandParentId, resolveResult);
    }
  }
  if (resolveResult.unresolved.size > 0) {
    console.log(
      "resolvePod: Unresolved symbols in pod " +
        id +
        ": " +
        [...resolveResult.unresolved].join(",")
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
