import { Getter, Setter, atom } from "jotai";
import { Annotation, analyzeCode } from "../parser";
import {
  ATOM_codeMap,
  ATOM_edgesMap,
  ATOM_nodesMap,
  ATOM_resultMap,
  ATOM_runtimeMap,
} from "./yjsSlice";
import { produce } from "immer";
import { ATOM_edges, ATOM_nodes } from "./canvasSlice";
import { Edge, Node } from "reactflow";

function collectSymbolTables(get: Getter, id: string): Record<string, string> {
  const nodesMap = get(ATOM_nodesMap);
  const nodes = Array.from<Node>(nodesMap.values());
  const parseResult = get(ATOM_parseResult);
  const node = nodesMap.get(id);
  if (!node) return {};
  const isbridge = parseResult[id].isbridge;
  // Collect from parent scope.
  let parentId = node.parentNode;
  let allSymbolTables: Record<string, string>[] = [];
  // do this for all ancestor scopes.
  while (parentId) {
    const siblings = nodes
      .filter((node) => node.parentNode === parentId)
      .map((n) => n.id);
    const tables = siblings.map((sibId) => {
      // FIXME make this consistent, CODE, POD, DECK, SCOPE; use enums
      if (nodesMap.get(sibId)?.type === "CODE") {
        if (isbridge && sibId === id) {
          // The key to support recursive export bridge are:
          // 1. not to add the name to symbol table when resolving this bridge
          //    pod, so that we can correctly set name_thisScope =
          //    name_originScope.
          // 2. do add the name to symbol table when resolving other pods, so
          //    that other pods can see its definition.
          return {};
        } else {
          return parseResult[sibId].symbolTable || {};
        }
      } else {
        // FIXME dfs, or re-export?
        const children = nodes.filter((n) => n.parentNode === sibId);
        let tables = (children || [])
          .filter(({ id }) => parseResult[id].ispublic)
          .map(({ id }) => parseResult[id].symbolTable);
        return Object.assign({}, ...tables);
      }
    });
    allSymbolTables.push(Object.assign({}, ...tables));
    if (!parentId) break;
    // next iteration
    parentId = nodesMap.get(parentId)?.parentNode;
  }
  // collect from all ancestor scopes.
  // Collect from scopes by Arrows.
  const edges = get(ATOM_edges);
  edges.forEach(({ source, target }) => {
    if (target === node.parentNode) {
      if (nodesMap.get(source)?.type === "CODE") {
        allSymbolTables.push(parseResult[target]?.symbolTable || {});
      } else {
        const children = nodes.filter((n) => n.parentNode === source);
        let tables = (children || [])
          .filter(({ id }) => parseResult[id].ispublic)
          .map(({ id }) => parseResult[id]?.symbolTable);
        allSymbolTables.push(Object.assign({}, ...tables));
      }
    }
  });
  // Combine the tables and return.
  let res: Record<string, string> = Object.assign(
    {},
    parseResult[id].symbolTable,
    ...allSymbolTables
  );
  return res;
}

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
  const parseResult = get(ATOM_parseResult);
  if (!node) return null;
  if (!codeMap.has(id)) return null;
  let code = codeMap.get(id)!.toString();
  if (code.trim().startsWith("@export")) {
    code = code.replace("@export", " ".repeat("@export".length));
  }
  if (code.startsWith("!")) return code;
  // replace with symbol table
  let newcode = "";
  let index = 0;
  parseResult[id].annotations?.forEach((annotation) => {
    newcode += code.slice(index, annotation.startIndex);
    switch (annotation.type) {
      case "vardef":
      case "varuse":
        // directly replace with _SCOPE if we can resolve it
        if (annotation.origin) {
          newcode += `${annotation.name}_${
            nodesMap.get(annotation.origin)!.parentNode
          }`;
        } else {
          newcode += annotation.name;
        }
        break;
      case "function":
      case "callsite":
        // directly replace with _SCOPE too
        if (annotation.origin) {
          newcode += `${annotation.name}_${
            nodesMap.get(annotation.origin)!.parentNode
          }`;
        } else {
          console.log("function not found", annotation.name);
          newcode += annotation.name;
        }
        break;
      case "bridge":
        // replace "@export x" with "x_thisScope = x_originScope"
        if (annotation.origin) {
          newcode += `${annotation.name}_${nodesMap.get(id)!.parentNode} = ${
            annotation.name
          }_${nodesMap.get(annotation.origin)!.parentNode}`;
        } else {
          console.log("bridge not found", annotation.name);
          newcode += annotation.name;
        }
        break;
      default:
        throw new Error("unknown annotation type: " + annotation.type);
    }
    index = annotation.endIndex;
  });
  newcode += code.slice(index);
  console.debug("newcode", newcode);
  return newcode;
}

export const ATOM_activeRuntime = atom<string | undefined>(undefined);

type ParseResult = Record<
  string,
  {
    ispublic: boolean;
    isbridge: boolean;
    symbolTable: { [key: string]: string };
    annotations: Annotation[];
  }
>;

export const ATOM_parseResult = atom<ParseResult>({});

/**
 * Parse the code for defined variables and functions.
 * @param id paod
 */
function parsePod(get: Getter, set: Setter, id: string) {
  const nodesMap = get(ATOM_nodesMap);
  const codeMap = get(ATOM_codeMap);
  set(
    ATOM_parseResult,
    produce((parseResult: ParseResult) => {
      const analyze = analyzeCode;
      let { ispublic, isbridge, annotations } = analyze(
        codeMap.get(id)?.toString() || ""
      );
      parseResult[id] = {
        ispublic: false,
        isbridge: false,
        symbolTable: {},
        annotations: [],
      };
      parseResult[id].ispublic = ispublic;
      if (isbridge) parseResult[id].isbridge = isbridge;

      parseResult[id].symbolTable = Object.assign(
        {},
        ...annotations
          .filter(({ type }) => ["function", "vardef", "bridge"].includes(type))
          .map(({ name }) => ({
            [name]: id,
          }))
      );

      parseResult[id].annotations = annotations;
    })
  );
}

function parseAllPods(get: Getter, set: Setter) {
  const nodesMap = get(ATOM_nodesMap);
  nodesMap.forEach((node) => {
    if (node.type === "CODE") parsePod(get, set, node.id);
  });
}

export const ATOM_parseAllPods = atom(null, parseAllPods);

function resolvePod(get: Getter, set: Setter, id: string) {
  let st = collectSymbolTables(get, id);
  // 2. resolve symbols
  const parseResult = get(ATOM_parseResult);
  set(
    ATOM_parseResult,
    produce((parseResult) => {
      // update the origin field of the annotations
      parseResult[id].annotations.forEach((annotation) => {
        let { name } = annotation;
        if (st[name]) {
          annotation.origin = st[name];
        } else {
          annotation.origin = undefined;
        }
      });
    })
  );
}

export const ATOM_resolveAllPods = atom(null, (get, set) => {
  const nodesMap = get(ATOM_nodesMap);
  nodesMap.forEach((node) => {
    if (node.type === "CODE") resolvePod(get, set, node.id);
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
    // Actually send the run request.
    // Analyze code and set symbol table
    parsePod(get, set, id);
    // update anontations according to st
    resolvePod(get, set, id);
    const newcode = rewriteCode(id, get);
    return { podId: id, code: newcode || "" };
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

function isRuntimeReady(get: Getter) {
  const runtimeMap = get(ATOM_runtimeMap);
  const activeRuntime = get(ATOM_activeRuntime);
  if (!activeRuntime) {
    console.log({
      type: "error",
      msg: "No active runtime",
    });
    return false;
  }
  const runtime = runtimeMap.get(activeRuntime);
  if (runtime?.wsStatus !== "connected") {
    console.log({
      type: "error",
      msg: "Runtime not connected",
    });
    return false;
  }
  return true;
}

function getScopeChain(get: Getter, set: Setter, id: string) {
  if (!isRuntimeReady(get)) return [];
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
  if (!isRuntimeReady(get)) return [];
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
    let children = nodes.filter((n) => n.parentNode === node.id);
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
