// ------------------------------
// codemirror deps
// ------------------------------

import { EditorView, basicSetup } from "codemirror";
import {
  EditorState,
  StateEffect,
  Extension,
  StateField,
} from "@codemirror/state";
import { Decoration, DecorationSet } from "@codemirror/view";
import { javascript } from "@codemirror/lang-javascript";

import { yCollab } from "y-codemirror.next";

// ------------------------------
// language modes
// ------------------------------
import { StreamLanguage } from "@codemirror/language";
import { python } from "@codemirror/lang-python";
// import { racket } from "@codemirror/lang-racket";
// import { julia } from "@codemirror/lang-julia";
import { scheme } from "@codemirror/legacy-modes/mode/scheme";
// import { commonLisp } from "@codemirror/legacy-modes/mode/commonlisp";
import { julia } from "@codemirror/legacy-modes/mode/julia";
import { clojure } from "@codemirror/legacy-modes/mode/clojure";

import { githubLight, githubDark } from "@uiw/codemirror-theme-github";
import { vscodeLight } from "@uiw/codemirror-theme-vscode";

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
  getOrCreate_ATOM_parseResult,
  getOrCreate_ATOM_resolveResult,
} from "@/lib/store/runtimeSlice";

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
        if (e.is(highlightEffect)) {
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

// ------------------------------
// MyCodeMirror component
// ------------------------------

function MyCodeMirrorImpl({ node }: { node: CodeNodeType }) {
  const codeMap = useAtomValue(ATOM_codeMap);

  const editorRef = useRef<HTMLDivElement | null>(null);

  const provider = useAtomValue(ATOM_provider);
  myassert(provider);

  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (editorRef.current) {
      const ytext = codeMap.get(node.id);
      myassert(ytext);

      const undoManager = new Y.UndoManager(ytext);

      const state = EditorState.create({
        doc: ytext.toString(),
        extensions: [
          basicSetup,
          EditorView.lineWrapping,
          // githubLight,
          vscodeLight,
          highlightExtension(),
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
  }, []);

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
        effects: highlightEffect.of({ from: fromPos, to: toPos, color }),
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
        effects: highlightEffect.of({ from: fromPos, to: toPos, color }),
      });
    }
  };

  const parseResult = useAtomValue(getOrCreate_ATOM_parseResult(node.id));
  const resolveResult = useAtomValue(getOrCreate_ATOM_resolveResult(node.id));

  useEffect(() => {
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
            "yellow"
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
              "lightyellow"
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

  // return <pre>{"hello"}</pre>;

  return (
    <div
      style={{ border: "1px solid #ccc", cursor: "auto" }}
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
