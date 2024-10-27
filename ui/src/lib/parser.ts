import Parser from "web-tree-sitter";
import { match, P } from "ts-pattern";
import keywords from "./utils/python-keywords";
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
    const lang = await Parser.Language.load("/tree-sitter-python.wasm");
    parser.setLanguage(lang);
    set(ATOM_parserReady, true);
  } finally {
    mutex.release();
  }
});

export type Annotation = {
  name: string;
  type: "function" | "callsite" | "vardef" | "varuse";
  startIndex: number;
  endIndex: number;
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
};

export type ParseResult = {
  annotations: Annotation[];
  errors?: string[];
  error_messages?: string[];
  hash?: string;
};

/**
 * Use tree-sitter query to analyze the code. This only work for functions.
 * @param code
 */
export function parsePython(code: string): ParseResult {
  if (!code) return { annotations: [] };

  let annotations: Annotation[] = [];

  // magic commands
  if (code.startsWith("!")) return { annotations };
  if (!parser) {
    throw Error("warning: parser not ready");
  }
  let tree = parser.parse(code);

  // top-level function definition
  const function_def = "(module (function_definition (identifier) @function))";
  const callsite = `(call (identifier) @callsite)`;
  // top-level variable definition
  const vardef = code.includes("CODEPOD_DEF")
    ? `(module (expression_statement (assignment (identifier) @vardef)))`
    : "";
  // FIXME This will match the function def identifier, including function def,
  // vardef. This is filtered out by the visited variable below.
  const varuse = `((identifier) @varuse)`;

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
    // FIXME This actually prevents the already parsed text from being recorded again.
    // 1. it might contain bugs
    // 2. the order of the annotations must be that varuse is at the end.
    if (visited.has(JSON.stringify([node.startIndex, node.endIndex]))) return;
    visited.add(JSON.stringify([node.startIndex, node.endIndex]));
    annotations.push({
      name: node.text, // the name of the function or variable
      // FIXME the name may not be "callsite".
      type: match.captures[0].name as
        | "function"
        | "callsite"
        | "vardef"
        | "varuse",
      startIndex: node.startIndex,
      endIndex: node.endIndex,
      startPosition: node.startPosition,
      endPosition: node.endPosition,
    });
  });

  annotations = annotations.filter(({ name }) => !keywords.has(name));
  // Sort the annotations so that rewrite can be done in order.
  annotations.sort((a, b) => a.startIndex - b.startIndex);

  return { annotations };
}
