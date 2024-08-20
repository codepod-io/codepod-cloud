// racket parser

import Parser from "web-tree-sitter";
import { Annotation, ParseResult } from "./parser";

let parser: Parser | null = null;
let parser_loading = false;

export async function initParser(prefix = "/", callback = () => {}) {
  if (parser_loading) return false;
  if (parser) {
    callback();
    return true;
  }
  return new Promise((resolve, reject) => {
    parser_loading = true;
    Parser.init({
      locateFile(scriptName: string, scriptDirectory: string) {
        return "/" + scriptName;
      },
    }).then(async () => {
      /* the library is ready */
      console.log("tree-sitter is ready");
      parser = new Parser();
      const Racket = await Parser.Language.load(
        `${prefix}tree-sitter-scheme.wasm`
      );
      parser.setLanguage(Racket);
      parser_loading = false;

      callback();
      resolve(true);
    });
  });
}

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
  if (code.trim().startsWith("@export")) {
    ispublic = true;
    code = code.replace("@export", " ".repeat("@export".length));
  }
  if (code.trim().startsWith("@utility")) {
    isutility = true;
    code = code.replace("@utility", " ".repeat("@utility".length));
  }
  if (code.trim().startsWith("@export")) {
    ispublic = true;
    code = code.replace("@export", " ".repeat("@export".length));
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
