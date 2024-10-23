// ------------------------------
// codemirror deps
// ------------------------------

import { EditorView, basicSetup } from "codemirror";
import {
  EditorState,
  StateEffect,
  Extension,
  StateField,
  Prec,
} from "@codemirror/state";
import {
  crosshairCursor,
  Decoration,
  DecorationSet,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  rectangularSelection,
} from "@codemirror/view";

import {
  defaultKeymap,
  indentSelection,
  indentWithTab,
} from "@codemirror/commands";

import { foldKeymap } from "@codemirror/language";
import { history, historyKeymap } from "@codemirror/commands";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import {
  autocompletion,
  completionKeymap,
  closeBrackets,
  closeBracketsKeymap,
} from "@codemirror/autocomplete";
import { lintKeymap } from "@codemirror/lint";

import { yCollab } from "y-codemirror.next";

// Themes
import { githubLight, githubDark } from "@uiw/codemirror-theme-github";
import { vscodeLight } from "@uiw/codemirror-theme-vscode";

// ------------------------------
// language modes
// ------------------------------
import { javascript } from "@codemirror/lang-javascript";

import {
  bracketMatching,
  defaultHighlightStyle,
  foldGutter,
  indentOnInput,
  indentUnit,
  StreamLanguage,
  syntaxHighlighting,
} from "@codemirror/language";
import { python } from "@codemirror/lang-python";
// import { racket } from "@codemirror/lang-racket";
// import { julia } from "@codemirror/lang-julia";
import { scheme } from "@codemirror/legacy-modes/mode/scheme";
// import { commonLisp } from "@codemirror/legacy-modes/mode/commonlisp";
import { julia } from "@codemirror/legacy-modes/mode/julia";
import { clojure } from "@codemirror/legacy-modes/mode/clojure";

// ------------------------------
// other deps
// ------------------------------

import { useState, useEffect, useRef, memo, useMemo, useCallback } from "react";

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import * as Y from "yjs";

import {
  ATOM_codeMap,
  ATOM_nodesMap,
  ATOM_provider,
  getOrCreate_ATOM_runtimeReady,
} from "@/lib/store/yjsSlice";

import { CodeNodeType } from "@/lib/store/types";
import { css } from "@emotion/css";
import { myassert } from "@/lib/utils/utils";

import { match } from "ts-pattern";
import {
  ATOM_preprocessChain,
  getOrCreate_ATOM_parseResult,
  getOrCreate_ATOM_resolveResult,
} from "@/lib/store/runtimeSlice";
import { ATOM_previousVersion } from "@/pages/repo";
import { gitGutterExtension } from "./MyCodeMirror_GitGutter";
import { runtimeTrpc } from "@/lib/trpc";
import { ATOM_repoData } from "@/lib/store/atom";

const myScheme = {
  name: "scheme",
  startState: scheme.startState,
  token: function (stream, state) {
    const res = scheme.token(stream, state);
    if (res === "builtin") return "keyword";
    return res;
  },
  indent: scheme.indent,
};

// ------------------------------
// Highlight Extension
// ------------------------------

interface HighlightRange {
  from: number;
  to: number;
  color: string;
}

const highlightTheme = EditorView.baseTheme({
  ".cm-highlight": { backgroundColor: "var(--highlight-color)" },
});

const highlightEffect = StateEffect.define<HighlightRange>();
const clearHighlightsEffect = StateEffect.define<null>();

const highlightMark = (color: string) =>
  Decoration.mark({
    class: "cm-highlight",
    attributes: { style: `--highlight-color: ${color};` },
  });

const highlightExtension = (): Extension => {
  const highlightField = StateField.define<DecorationSet>({
    create() {
      return Decoration.none;
    },
    update(highlights, tr) {
      highlights = highlights.map(tr.changes);

      for (const e of tr.effects) {
        if (e.is(clearHighlightsEffect)) {
          // Clear all existing highlights
          highlights = Decoration.none;
        } else if (e.is(highlightEffect)) {
          highlights = highlights.update({
            add: [highlightMark(e.value.color).range(e.value.from, e.value.to)],
          });
        }
      }
      return highlights;
    },
    provide: (f) => EditorView.decorations.from(f),
  });

  return [highlightField, highlightTheme];
};

function useHighlight(
  viewRef: React.MutableRefObject<EditorView | null>,
  node: CodeNodeType
) {
  const highlight = (
    from: { row: number; col: number },
    to: { row: number; col: number },
    color: string
  ) => {
    if (viewRef.current) {
      const fromPos =
        viewRef.current.state.doc.line(from.row).from + from.col - 1;
      const toPos = viewRef.current.state.doc.line(to.row).from + to.col - 1;

      viewRef.current.dispatch({
        effects: [
          clearHighlightsEffect.of(null),
          highlightEffect.of({ from: fromPos, to: toPos, color }),
        ],
      });
    }
  };

  const highlightByIndex = (
    startIndex: number,
    endIndex: number,
    color = "yellow"
  ) => {
    if (viewRef.current) {
      const fromPos = startIndex;
      const toPos = endIndex;
      viewRef.current.dispatch({
        effects: [
          clearHighlightsEffect.of(null),
          highlightEffect.of({ from: fromPos, to: toPos, color }),
        ],
      });
    }
  };

  const parseResult = useAtomValue(getOrCreate_ATOM_parseResult(node.id));
  const resolveResult = useAtomValue(getOrCreate_ATOM_resolveResult(node.id));

  useEffect(() => {
    // Clear all highlights first
    if (viewRef.current) {
      viewRef.current.dispatch({
        effects: clearHighlightsEffect.of(null),
      });
    }

    // Then add new highlights
    parseResult.annotations.forEach((annotation) => {
      // annotation.startIndex
      // annotation.startPosition
      const name = annotation.name;
      const type = annotation.type;
      switch (type) {
        case "function":
          highlightByIndex(
            annotation.startIndex,
            annotation.endIndex,
            "#fcff3466"
          );
          break;
        // return "myDecoration-function";
        case "vardef":
          highlightByIndex(
            annotation.startIndex,
            annotation.endIndex,
            // "lightpink"
            // # 255,173,185
            // # add opacity 66 to def, 33 to use
            "#FFA9B966"
          );
          // return "myDecoration-vardef";
          break;
        case "callsite":
          // NOTE using the same style for both callsite and varuse.
          if (resolveResult?.resolved.has(name)) {
            highlightByIndex(
              annotation.startIndex,
              annotation.endIndex,
              "#ffed8633"
            );
            // return "myDecoration-callsite";
          } else {
            // return "myDecoration-unresolved";
          }
          break;
        // return "myDecoration-varuse";
        case "varuse":
          if (resolveResult?.resolved.has(name)) {
            highlightByIndex(
              annotation.startIndex,
              annotation.endIndex,
              "#FFA9B933"
            );
            // return "myDecoration-varuse";
          } else {
            // return "myDecoration-unresolved";
          }
          break;
        default:
          throw new Error("unknown type: " + type);
      }
    });
  }, [parseResult, resolveResult]);
}

// ------------------------------
// MyCodeMirror component
// ------------------------------

const myBasicSetup: Extension = (() => [
  // lineNumbers(),
  highlightActiveLineGutter(),
  highlightSpecialChars(),
  history(),
  // foldGutter(),
  drawSelection(),
  dropCursor(),
  EditorState.allowMultipleSelections.of(true),
  indentOnInput(),
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  bracketMatching(),
  closeBrackets(),
  autocompletion(),
  rectangularSelection(),
  crosshairCursor(),
  highlightActiveLine(),
  highlightSelectionMatches(),
  keymap.of([
    ...closeBracketsKeymap,
    ...defaultKeymap,
    ...searchKeymap,
    ...historyKeymap,
    ...foldKeymap,
    ...completionKeymap,
    ...lintKeymap,
  ]),
])();

// Define the format code command
function formatCode(view) {
  indentSelection(view);
  return true; // Indicate the command was successful
}

// Create a keymap for the format command
const formatKeymap = keymap.of([
  {
    key: "Cmd-Shift-f", // Keybinding for "Ctrl + Shift + F"
    run: formatCode,
  },
]);

function usePreviousCode(id: string) {
  const previousVersion = useAtomValue(ATOM_previousVersion);
  let previousCode: string = "";
  if (previousVersion === null) {
    // loading, no need to update
    previousCode = "";
  } else if (previousVersion === "init") {
    previousCode = "";
  } else {
    const ydoc = previousVersion;
    const codeMap = ydoc.getMap("rootMap").get("codeMap") as Y.Map<Y.Text>;
    const str = codeMap.get(id);
    if (str) {
      previousCode = str.toString();
    } else {
      previousCode = "";
    }
  }
  return previousCode;
}

function MyCodeMirrorImpl({ node }: { node: CodeNodeType }) {
  const codeMap = useAtomValue(ATOM_codeMap);

  const editorRef = useRef<HTMLDivElement | null>(null);

  const provider = useAtomValue(ATOM_provider);
  myassert(provider);

  const viewRef = useRef<EditorView | null>(null);

  const previousCode = usePreviousCode(node.id);
  const runChain = runtimeTrpc.k8s.runChain.useMutation();
  const preprocessChain = useSetAtom(ATOM_preprocessChain);
  const repoData = useAtomValue(ATOM_repoData);
  myassert(repoData);
  const repoId = repoData.id;

  const runKeymap = keymap.of([
    {
      key: "Shift-Enter",
      run: (view) => {
        async function run() {
          const specs = await preprocessChain([node.id]);
          if (specs.length > 0) runChain.mutate({ repoId, specs });
        }
        run();
        return true;
      },
    },
  ]);

  useEffect(() => {
    if (editorRef.current) {
      const ytext = codeMap.get(node.id);
      myassert(ytext);

      const undoManager = new Y.UndoManager(ytext);

      const state = EditorState.create({
        doc: ytext.toString(),
        extensions: [
          myBasicSetup,
          EditorView.lineWrapping,
          // githubLight,
          vscodeLight,
          EditorState.tabSize.of(4),
          indentUnit.of("    "),
          keymap.of([indentWithTab]),
          formatKeymap,
          // The shift-enter keymap is occupied by standardkeymap, so we need to use the highest priority.
          Prec.highest(runKeymap),
          highlightExtension(),
          gitGutterExtension(previousCode),
          match(node.data.lang)
            .with("javascript", () => javascript())
            .with("python", () => python())
            // .with("racket", () => StreamLanguage.define(commonLisp))
            .with("racket", () => StreamLanguage.define(myScheme))
            .with("julia", () => StreamLanguage.define(julia))
            .exhaustive(),
          yCollab(ytext, provider.awareness, { undoManager }),
        ],
      });

      viewRef.current = new EditorView({
        state,
        parent: editorRef.current,
      });
    }
    return () => {
      if (viewRef.current) {
        viewRef.current.destroy();
      }
    };
  }, [previousCode]);

  useHighlight(viewRef, node);

  // return <pre>{"hello"}</pre>;

  return (
    <div
      style={{
        border: "1px solid #ccc",
        cursor: "auto",
      }}
      className={css`
        .cm-ySelectionInfo {
          opacity: 1;
          color: black;
          font-weight: 600;
        }
        // .cm-ySelectionCaret:hover > .cm-ySelectionInfo {
        //   opacity: 1;
        //   transitionDelay: '0s'
        // }

        .git-gutter {
          width: 4px;
          background-color: transparent;
          margin-right: 3px;
        }
        .git-gutter-marker {
          width: 4px;
          height: 100%;
          border-radius: 2px;
        }
        .git-add {
          background-color: #28a745;
        }
        .git-delete {
          background-color: #dc3545;
        }
        .git-modify {
          background-color: #ffc107;
        }
      `}
      ref={editorRef}
    />
  );
}

export const MyCodeMirror = memo(({ id }: { id: string }) => {
  const nodesMap = useAtomValue(ATOM_nodesMap);
  const node = nodesMap.get(id);
  myassert(node);
  myassert(node.type === "CODE");
  return MyCodeMirrorImpl({ node });
  // return MyCodeMirrorEmpty({ node });
});
