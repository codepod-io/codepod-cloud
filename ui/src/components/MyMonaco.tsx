import { Position } from "monaco-editor";
import {
  useState,
  useContext,
  memo,
  useCallback,
  useEffect,
  useMemo,
} from "react";

import MonacoEditor, { MonacoDiffEditor } from "react-monaco-editor";
import { monaco } from "react-monaco-editor";

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
    "editor.lineHighlightBackground": "#f3f3f340",
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

function racket_format(model) {
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
    if (line.trim().length === 0) {
      // console.log("line empty");
      continue;
    }
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
      let range = model.findPreviousMatch(")", end_pos, false).range;
      let pos = new Position(range.endLineNumber, range.endColumn);
      let match = model.matchBracket(pos);
      // this is actually a unmatched parenthesis
      if (!match) {
        console.log("warning: unmatched parens");
        return [];
      }
      let openPos = match[1];
      let shift = shifts[openPos.startLineNumber] || 0;

      // detect (define (XXX)
      let line2 = model.getLineContent(openPos.startLineNumber);
      let match2 = line2
        .substring(0, openPos.startColumn)
        .match(/\((define|lambda|let\*?|for|for\/list)\s*\($/);
      if (match2) {
        indent = match2.index + 2 + shift;
      } else {
        indent = openPos.startColumn - 1 + shift;
      }
    }
  }
  // console.log("shifts:", shifts);
  // console.log("computing edits ..");
  let res: any[] = [];
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

export function MyMonacoDiff({ from, to }) {
  return (
    <MonacoDiffEditor
      // width="800"
      // height="600"
      language="javascript"
      original={from || ""}
      value={to || ""}
      options={{
        selectOnLineNumbers: true,
        scrollBeyondLastLine: false,
        folding: false,
        lineNumbersMinChars: 3,
        wordWrap: "on",
        wrappingStrategy: "advanced",
        minimap: {
          enabled: false,
        },
        renderOverviewRuler: false,
        scrollbar: {
          alwaysConsumeMouseWheel: false,
        },
        renderSideBySide: false,
        readOnly: true,
      }}
      editorDidMount={(editor, monaco) => {
        // const lineHeight = editor.getOption(monaco.editor.EditorOption.lineHeight)
        // const lineCount = editor.getModel()?.getLineCount() || 1
        // const height = editor.getTopForLineNumber(lineCount + 1) + lineHeight
        const updateHeight = () => {
          const one = editor.getOriginalEditor();
          const two = editor.getModifiedEditor();
          // console.log(
          //   "one, two",
          //   one.getContentHeight(),
          //   two.getContentHeight()
          // );

          // max height: 400
          const contentHeight = Math.min(
            400,
            Math.max(one.getContentHeight(), two.getContentHeight())
          );
          // console.log("target height:", contentHeight);
          const editorElement = editor.getContainerDomNode();
          if (!editorElement) {
            return;
          }
          editorElement.style.height = `${contentHeight}px`;
          // console.log("do the updating ..");
          editor.layout();
        };

        editor.onDidUpdateDiff(() => {
          // console.log("updating diff ..");
          updateHeight();
        });
      }}
    />
  );
}

async function computeDiff(
  original,
  modified
): Promise<monaco.editor.ILineChange[] | null> {
  return new Promise((resolve, reject) => {
    // 1. get a diff editor
    // 2. onDidUpdateDiff
    // 3. get the diff and return
    const originalModel = monaco.editor.createModel(original);
    const modifiedModel = monaco.editor.createModel(modified);
    // a dummy element just for creating the diff editor
    let elem = document.createElement("div");
    var diffEditor = monaco.editor.createDiffEditor(elem, {
      // You can optionally disable the resizing
      enableSplitViewResizing: false,
    });
    diffEditor.setModel({
      original: originalModel,
      modified: modifiedModel,
    });
    diffEditor.onDidUpdateDiff(() => {
      // this is the result
      let res = diffEditor.getLineChanges();
      resolve(res);
    });
  });
}

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
        hoverMessage: {
          value: `${name} -> ${resolveResult?.resolved
            .get(name)
            ?.substring(0, 6)}`,
        },
      },
    });
  }
  // 2. apply decorations
  editor.oldDecorations = editor.deltaDecorations(
    editor.oldDecorations,
    decorations
  );
}

async function updateGitGutter(editor) {
  if (!editor.oldDecorations) {
    editor.oldDecorations = [];
  }
  const gitvalue = editor.staged;
  const value = editor.getValue();
  // console.log("computing diff with", gitvalue, "value:", value);
  // console.log("editor.staged", editor.staged);
  let diffs = await computeDiff(gitvalue, value);
  // console.log("original", gitvalue);
  // console.log("modified", value);
  // console.log("diffs:", diffs);
  let decorations: any[] = [];
  for (const diff of diffs || []) {
    // newly added lines
    if (diff.originalStartLineNumber > diff.originalEndLineNumber) {
      // newly added
      decorations.push({
        range: new monaco.Range(
          diff.modifiedStartLineNumber,
          1,
          diff.modifiedEndLineNumber,
          1
        ),
        options: {
          isWholeLine: true,
          linesDecorationsClassName: "myLineDecoration-add",
        },
      });
    } else {
      if (diff.modifiedStartLineNumber > diff.modifiedEndLineNumber) {
        // deleted
        decorations.push({
          range: new monaco.Range(
            diff.modifiedStartLineNumber,
            1,
            diff.modifiedStartLineNumber,
            1
          ),
          options: {
            isWholeLine: true,
            linesDecorationsClassName: "myLineDecoration-delete",
          },
        });
      } else {
        // modified
        decorations.push({
          range: new monaco.Range(
            diff.modifiedStartLineNumber,
            1,
            diff.modifiedEndLineNumber,
            1
          ),
          options: {
            isWholeLine: true,
            linesDecorationsClassName: "myLineDecoration-modified",
          },
        });
      }
    }
  }
  // FIXME this is delta, so need to get previous decos.
  editor.oldDecorations = editor.deltaDecorations(
    editor.oldDecorations,
    decorations
  );
}

export const MyMonaco = function MyMonaco({ id = "0" }) {
  // there's no racket language support
  const [showLineNumbers] = useAtom(ATOM_showLineNumbers);

  const parseResult = useAtomValue(getOrCreate_ATOM_parseResult(id));
  const resolveResult = useAtomValue(getOrCreate_ATOM_resolveResult(id));

  const [showAnnotations] = useAtom(ATOM_showAnnotations);
  const [scopedVars] = useAtom(ATOM_scopedVars);

  const [copilotManualMode] = useAtom(ATOM_copilotManualMode);

  // TODO support other languages.
  const [nodesMap] = useAtom(ATOM_nodesMap);
  const node = nodesMap.get(id);
  let lang = node?.data.lang || "python";
  let [editor, setEditor] =
    useState<monaco.editor.IStandaloneCodeEditor | null>(null);

  useEffect(() => {
    if (!editor) return;
    if (showAnnotations) {
      highlightAnnotations(editor, parseResult, resolveResult);
    }
  }, [parseResult, resolveResult, editor, showAnnotations, scopedVars]);

  const provider = useAtomValue(ATOM_provider);
  const codeMap = useAtomValue(ATOM_codeMap);

  const { client } = copilotTrpc.useUtils();

  // FIXME useCallback?
  function onEditorDidMount(
    editor: monaco.editor.IStandaloneCodeEditor,
    monaco
  ) {
    setEditor(editor);
    // console.log(Math.min(1000, editor.getContentHeight()));
    const updateHeight = ({ contentHeight }) => {
      const editorElement = editor.getDomNode();
      if (!editorElement) {
        return;
      }
      // Set a minimum height of 50px for the code editor.
      editorElement.style.height = `${Math.max(100, contentHeight)}px`;
      editor.layout();
    };
    editor.onDidContentSizeChange(updateHeight);
    editor.addAction({
      id: "trigger-inline-suggest",
      label: "Trigger Suggest",
      keybindings: [
        monaco.KeyMod.WinCtrl | monaco.KeyMod.Shift | monaco.KeyCode.Space,
      ],
      run: () => {
        editor.trigger(null, "editor.action.inlineSuggest.trigger", null);
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

    // FIXME: make sure the provider.wsconnected is true or it won't display any content.
  }

  const editMode = useAtomValue(ATOM_editMode);

  return (
    <MonacoEditor
      language={lang === "racket" ? "scheme" : lang}
      theme="codepod"
      options={{
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
      }}
      editorDidMount={onEditorDidMount}
    />
  );
};
