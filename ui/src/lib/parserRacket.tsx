// racket parser

import Parser from "web-tree-sitter";
import { Annotation, ParseResult } from "./parser";
import { atom } from "jotai";
import { Mutex } from "async-mutex";

let parser: Parser | null = null;

const mutex = new Mutex();

export const ATOM_parserReady = atom(false);
export const ATOM_loadParser = atom(null, async (get, set) => {
  await mutex.acquire();
  try {
    if (parser) {
      set(ATOM_parserReady, true);
      return;
    }
    await Parser.init({
      locateFile(scriptName: string, scriptDirectory: string) {
        return "/" + scriptName;
      },
    });
    parser = new Parser();
    const lang = await Parser.Language.load("/tree-sitter-scheme.wasm");
    parser.setLanguage(lang);
    set(ATOM_parserReady, true);
  } finally {
    mutex.release();
  }
});

/**
 * Use tree-sitter query to analyze the code. This only work for functions.
 * @param code
 */
export function parseRacket(code: string): ParseResult {
  let annotations: Annotation[] = [];
  let ispublic = false;
  let isutility = false;
  // FIXME better error handling
  if (!code) return { ispublic, isutility, annotations };
  if (code.trim().startsWith("@public")) {
    ispublic = true;
    code = code.replace("@public", " ".repeat("@public".length));
  }
  if (code.trim().startsWith("@utility")) {
    isutility = true;
    code = code.replace("@utility", " ".repeat("@utility".length));
  }
  if (code.trim().startsWith("@public")) {
    ispublic = true;
    code = code.replace("@public", " ".repeat("@public".length));
  }
  // magic commands
  if (code.startsWith("!")) return { ispublic, isutility, annotations };
  if (!parser) {
    throw Error("warning: parser not ready");
  }
  let tree = parser.parse(code);

  // top-level function definition
  const function_def = "(program (binding_procedure (identifier) @function))";
  const callsite = `(procedure_call (identifier) @callsite)`;
  // top-level variable definition
  const vardef = "(program (binding_variable (identifier) @vardef))";
  const varuse = "((identifier) @varuse)";

  let query_func = parser.getLanguage().query(`
  [
    ${function_def}
    ${callsite}
    ${vardef}
    ${varuse}
  ]
  `);
  const visited = new Set();
  query_func.matches(tree.rootNode).forEach((match) => {
    let node = match.captures[0].node;
    if (visited.has(JSON.stringify([node.startIndex, node.endIndex]))) return;
    visited.add(JSON.stringify([node.startIndex, node.endIndex]));
    annotations.push({
      name: node.text, // the name of the function or variable
      // FIXME the name may not be "callsite".
      type: match.captures[0].name as "function" | "callsite",
      startIndex: node.startIndex,
      endIndex: node.endIndex,
      startPosition: node.startPosition,
      endPosition: node.endPosition,
    });
  });

  // Sort the annotations so that rewrite can be done in order.
  annotations.sort((a, b) => a.startIndex - b.startIndex);

  return { ispublic, isutility, annotations };
}
