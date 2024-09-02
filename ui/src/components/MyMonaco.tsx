import { Position } from "monaco-editor";
import { useState, useEffect, useRef } from "react";

import * as monaco from "monaco-editor";

import { MonacoBinding } from "y-monaco";
import { copilotTrpc } from "@/lib/trpc";

import { llamaInlineCompletionProvider } from "@/lib/llamaCompletionProvider";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  ATOM_copilotManualMode,
  ATOM_scopedVars,
  ATOM_showAnnotations,
  ATOM_showLineNumbers,
} from "@/lib/store/settingSlice";
import {
  getOrCreate_ATOM_parseResult,
  getOrCreate_ATOM_resolveResult,
  ResolveResult,
} from "@/lib/store/runtimeSlice";
import {
  ATOM_codeMap,
  ATOM_nodesMap,
  ATOM_provider,
} from "@/lib/store/yjsSlice";

// From here: https://github.com/suren-atoyan/monaco-react?tab=readme-ov-file#use-monaco-editor-as-an-npm-package
// Fix the error in https://github.com/codepod-io/codepod-cloud/pull/54
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import cssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import htmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import { ATOM_editMode } from "@/lib/store/atom";
import { env } from "@/lib/vars";
import { ParseResult } from "@/lib/parser";
import { CodeNodeType } from "@/lib/store/types";
import { css } from "@emotion/css";

self.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === "json") {
      return new jsonWorker();
    }
    if (label === "css" || label === "scss" || label === "less") {
      return new cssWorker();
    }
    if (label === "html" || label === "handlebars" || label === "razor") {
      return new htmlWorker();
    }
    if (label === "typescript" || label === "javascript") {
      return new tsWorker();
    }
    return new editorWorker();
  },
};

const theme: monaco.editor.IStandaloneThemeData = {
  base: "vs",
  inherit: true,
  rules: [],
  colors: {
    // "editor.background": "#f3f3f340",
    "editor.lineHighlightBackground": "#00ff3320",
  },
};
monaco.editor.defineTheme("codepod", theme);
monaco.languages.setLanguageConfiguration("julia", {
  indentationRules: {
    increaseIndentPattern:
      /^(\s*|.*=\s*|.*@\w*\s*)[\w\s]*(?:["'`][^"'`]*["'`])*[\w\s]*\b(if|while|for|function|macro|(mutable\s+)?struct|abstract\s+type|primitive\s+type|let|quote|try|begin|.*\)\s*do|else|elseif|catch|finally)\b(?!(?:.*\bend\b[^\]]*)|(?:[^[]*\].*)$).*$/,
    decreaseIndentPattern: /^\s*(end|else|elseif|catch|finally)\b.*$/,
  },
});

function construct_indent(pos, indent) {
  return [
    {
      range: {
        startLineNumber: pos.lineNumber,
        startColumn: 1,
        endLineNumber: pos.lineNumber,
        endColumn: pos.column,
      },
      text: " ".repeat(indent),
    },
  ];
}
function decide_indent_open(line) {
  // Assume line has more (. Decide the indent
  let ct = 0;
  for (let i = line.length - 1; i >= 0; i--) {
    if (line[i] === ")" || line[i] === "]") {
      ct += 1;
    } else if (line[i] === "(" || line[i] === "[") {
      ct -= 1;
    }
    if (ct === -1) {
      // check the pattern
      if (
        line.substring(i).match(/^\((define|lambda|let|for|match|case|when).*/)
      ) {
        return i + 2;
      }
      if (line.substring(i).match(/^[([]{2}/)) {
        return i + 1;
      }
      // trim right, and find " "
      let match = line.substring(i).trimRight().match(/\s/);
      if (match) {
        return i + match.index + 1;
      } else {
        return i + 2;
      }
    }
  }
}

function racket_format(model: monaco.editor.ITextModel) {
  // console.log("executing formatting");
  // 1. scan from pos 1,1
  // record current indent, from 0
  // for each line, see how many () are there in this line
  // - if n_open = n_close: next_indent = currnet_indent
  // - if n_open > n_close: from right, find the first unpaired open (
  // - if n_open < n_close: find the last close, and find the match brackets
  let indent = 0;
  let shifts: { [key: number]: number } = {};

  for (let linum = 1; linum <= model.getLineCount(); linum += 1) {
    let line = model.getLineContent(linum);

    // Trim trailing whitespace
    // let trimmedLine = line.trimRight();
    // trim trailing whitespace
    // if (trimmedLine.length !== line.length) {
    //   res.push({
    //     range: new monaco.Range(linum, 1, linum, line.length + 1),
    //     text: trimmedLine,
    //   });
    // }
    // console.log("indent:", linum, indent);
    let old_indent = line.length - line.trimLeft().length;
    if (indent !== old_indent) {
      shifts[linum] = indent - old_indent;
    }
    let n_open = (line.match(/\(|\[/g) || []).length;
    let n_close = (line.match(/\)|\]/g) || []).length;
    if (n_open === n_close) {
      // console.log("equal open/close parens");
      continue;
    } else if (n_open > n_close) {
      indent = decide_indent_open(line) + (shifts[linum] || 0);
    } else {
      // find the last close
      // CAUTION I have to have the "new" keyword here, otherwise Error
      let end_pos = new Position(linum, model.getLineMaxColumn(linum));
      let range = model.findPreviousMatch(
        ")",
        end_pos,
        false,
        false,
        null,
        false
      )?.range;
      if (!range) {
        console.log("warning: unmatched parens");
        return [];
      }
      let pos = new Position(range.endLineNumber, range.endColumn);
      // bracketPairs is an internal method. Defined here:
      // https://github.com/microsoft/vscode/blob/11ad426fe21df1d2a51b46200fb126cfdc2cb531/src/vs/editor/common/model.ts#L1311
      // https://github.com/microsoft/vscode/blob/11ad426fe21df1d2a51b46200fb126cfdc2cb531/src/vs/editor/common/textModelBracketPairs.ts#L66
      let match = (model as any).bracketPairs.matchBracket(pos);
      // this is actually a unmatched parenthesis
      if (!match) {
        console.log("warning: unmatched parens");
        // return [];

        // Instead of returning, we just skip further passing, and return the
        // edits so far. This is useful when users are editing in the middle of
        // the program, and may need to just delete remaining code.
        break;
      }
      // match[0] is the open position, match[1] is the close position
      let openPos = match[0];
      let shift = shifts[openPos.startLineNumber] || 0;

      // detect (define (XXX)
      let line2 = model.getLineContent(openPos.startLineNumber);
      let match2 = line2
        .substring(0, openPos.startColumn)
        .match(/\((define|lambda|let\*?|for|for\/list)\s*\($/);
      if (match2 && match2.index) {
        indent = match2.index + 2 + shift;
      } else {
        indent = openPos.startColumn - 1 + shift;
      }
    }
  }
  // console.log("shifts:", shifts);
  // console.log("computing edits ..");
  let res: monaco.languages.ProviderResult<monaco.languages.TextEdit[]> = [];
  for (const [linum, shift] of Object.entries(shifts)) {
    let edit = {
      range: {
        startLineNumber: parseInt(linum),
        startColumn: 1,
        endLineNumber: parseInt(linum),
        endColumn: Math.max(1 - shift, 1),
      },
      text: " ".repeat(Math.max(0, shift)),
    };
    res.push(edit);
  }
  // console.log("edits:", res);
  return res;
}

monaco.languages.registerDocumentFormattingEditProvider("scheme", {
  // CAUTION this won't give error feedback
  provideDocumentFormattingEdits: racket_format,
});
monaco.languages.registerOnTypeFormattingEditProvider("scheme", {
  autoFormatTriggerCharacters: ["(", ")", "\n"], // You can add more trigger characters if needed
  provideOnTypeFormattingEdits: (model, position, ch, options, token) => {
    // use the logic from racket_format
    let edits = racket_format(model);
    // find the line number
    let linum = position.lineNumber;
    let edit = edits.find((edit) => {
      return (
        edit.range.startLineNumber <= linum && edit.range.endLineNumber >= linum
      );
    });
    if (edit) {
      return [edit];
    } else {
      return [];
    }
  },
});

/**
 * Highlight the given symbol table annotations in the editor, including
 * function definitions and callsites, and variable definitions and references.
 * @param editor The Monaco editor instance.
 * @param annotations The annotations to highlight.
 */
function highlightAnnotations(
  editor: monaco.editor.IStandaloneCodeEditor & { oldDecorations?: any[] },
  parseResult: ParseResult,
  resolveResult: ResolveResult
) {
  if (!editor.oldDecorations) {
    editor.oldDecorations = [];
  }
  // 1. get the positions
  let decorations: monaco.editor.IModelDeltaDecoration[] = [];
  for (const {
    type,
    name,
    startPosition,
    endPosition,
  } of parseResult.annotations) {
    decorations.push({
      range: new monaco.Range(
        startPosition.row + 1,
        startPosition.column + 1,
        endPosition.row + 1,
        endPosition.column + 1
      ),
      options: {
        isWholeLine: false,
        inlineClassName:
          (() => {
            switch (type) {
              case "function":
                return "myDecoration-function";
              case "vardef":
                return "myDecoration-vardef";
              case "callsite":
                // NOTE using the same style for both callsite and varuse.
                if (resolveResult?.resolved.has(name)) {
                  return "myDecoration-callsite";
                } else {
                  return "myDecoration-unresolved";
                }
              // return "myDecoration-varuse";
              case "varuse":
                if (resolveResult?.resolved.has(name)) {
                  return "myDecoration-varuse";
                } else {
                  return "myDecoration-unresolved";
                }
              case "bridge":
                return "myDecoration-bridge-unused";
              default:
                throw new Error("unknown type: " + type);
            }
          })() +
          (resolveResult?.unresolved.has(name)
            ? " myDecoration-unresolved"
            : ""),
        hoverMessage: ["callsite", "varuse"].includes(type)
          ? {
              value: `${name} -> ${resolveResult?.resolved
                .get(name)
                ?.substring(0, 6)}`,
            }
          : undefined,
      },
    });
  }
  // 2. apply decorations
  editor.oldDecorations = editor.deltaDecorations(
    editor.oldDecorations,
    decorations
  );
}

function useInitEditor({
  node,
  editor,
}: {
  node: CodeNodeType;
  editor: monaco.editor.IStandaloneCodeEditor | null;
}) {
  // there's no racket language support
  const [showLineNumbers] = useAtom(ATOM_showLineNumbers);
  const id = node.id;

  const parseResult = useAtomValue(getOrCreate_ATOM_parseResult(id));
  const resolveResult = useAtomValue(getOrCreate_ATOM_resolveResult(id));

  const [showAnnotations] = useAtom(ATOM_showAnnotations);
  const [scopedVars] = useAtom(ATOM_scopedVars);

  const [copilotManualMode] = useAtom(ATOM_copilotManualMode);

  // TODO support other languages.
  let lang = node.data.lang;

  useEffect(() => {
    if (!editor) return;
    if (showAnnotations) {
      highlightAnnotations(editor, parseResult, resolveResult);
    }
  }, [parseResult, resolveResult, editor, showAnnotations, scopedVars]);

  const provider = useAtomValue(ATOM_provider);
  const codeMap = useAtomValue(ATOM_codeMap);

  const { client } = copilotTrpc.useUtils();

  useEffect(() => {
    if (editor && editor.getModel()) {
      const updateHeight = ({ contentHeight }) => {
        const editorElement = editor?.getDomNode();
        if (!editorElement) {
          return;
        }
        // Set a minimum height of 50px for the code editor.
        editorElement.style.height = `${Math.max(40, contentHeight)}px`;
        editor?.layout();
      };
      editor.onDidContentSizeChange(updateHeight);
      // Set the height for the first time.
      updateHeight({ contentHeight: editor.getContentHeight() });
      editor.addAction({
        id: "trigger-inline-suggest",
        label: "Trigger Suggest",
        keybindings: [
          monaco.KeyMod.WinCtrl | monaco.KeyMod.Shift | monaco.KeyCode.Space,
        ],
        run: () => {
          editor?.trigger(null, "editor.action.inlineSuggest.trigger", null);
        },
      });

      // editor.onDidChangeModelContent(async (e) => {
      //   // content is value?
      //   updateGitGutter(editor);
      // });

      const llamaCompletionProvider = new llamaInlineCompletionProvider(
        id,
        editor,
        client,
        copilotManualMode || false
      );
      monaco.languages.registerInlineCompletionsProvider(
        "python",
        llamaCompletionProvider
      );

      // bind it to the ytext with pod id
      if (!codeMap.has(id)) {
        throw new Error("codeMap doesn't have pod " + id);
      }
      const ytext = codeMap.get(id)!;
      new MonacoBinding(
        ytext,
        editor.getModel()!,
        new Set([editor]),
        provider?.awareness
      );
    }
  }, [editor]);
}

export function MyMonaco({ node }: { node: CodeNodeType }) {
  const editorRef = useRef(null);

  let [editor, setEditor] =
    useState<monaco.editor.IStandaloneCodeEditor | null>(null);

  const [showLineNumbers] = useAtom(ATOM_showLineNumbers);
  const id = node.id;

  // TODO support other languages.
  let lang = node.data.lang;
  const editMode = useAtomValue(ATOM_editMode);

  useInitEditor({ node, editor });

  useEffect(() => {
    if (editorRef.current) {
      const editor = monaco.editor.create(editorRef.current, {
        // value: `function hello() {
        //   alert('Hello world!');
        // }`,
        language: lang === "racket" ? "scheme" : lang,
        theme: "codepod",
        selectOnLineNumbers: true,
        readOnly: env.READ_ONLY || editMode !== "edit",
        fontSize: 14,
        // This scrollBeyondLastLine is super important. Without this, it will
        // try to adjust height infinitely.
        scrollBeyondLastLine: false,
        folding: false,
        lineNumbersMinChars: 3,
        wordWrap: "on",
        wrappingStrategy: "advanced",
        minimap: {
          enabled: false,
        },
        formatOnPaste: true,
        formatOnType: true,
        autoIndent: "full",
        // autoIndent: true,
        overviewRulerLanes: 0,
        automaticLayout: true,
        lineNumbers: showLineNumbers ? "on" : "off",
        scrollbar: {
          alwaysConsumeMouseWheel: false,
          vertical: "hidden",
        },
        renderLineHighlight: "line",
        renderLineHighlightOnlyWhenFocus: true,
      });

      setEditor(editor);

      return () => {
        if (editor) {
          editor.dispose();
        }
        setEditor(null);
      };
    }
  }, []);

  return (
    <div
      className={css`
        .monaco-editor {
          outline: 0;
          border-radius: 4px;
        }
        .overflow-guard {
          border-radius: 4px;
        }
      `}
      ref={editorRef}
    />
  );
}
