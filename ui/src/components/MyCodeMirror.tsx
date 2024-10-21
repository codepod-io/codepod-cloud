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
import { useStore } from "@xyflow/react";
import { getAbsPos } from "@/lib/store/canvasSlice";

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

const MyCodeMirrorImpl = memo(function MyCodeMirrorImpl({
  node,
}: {
  node: CodeNodeType;
}) {
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

  const ytext = codeMap.get(node.id);
  myassert(ytext);

  // return <pre>{"hello"}</pre>;
  // return <pre>{ytext.toString()}</pre>;

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
      `}
      ref={editorRef}
    />
  );
});

/**
 * @return whether the node is in the current viewport.
 */
function useIsInView({ node, linum }: { node: CodeNodeType; linum: number }) {
  const nodesMap = useAtomValue(ATOM_nodesMap);
  const absPos = getAbsPos(node, nodesMap);
  return useStore((s) => {
    const [x, y, zoom] = s.transform;
    // console.log("x,y,zoom", x, y, zoom, s.width, s.height);
    // check in viewport
    // node.position.x, node.position.y
    // The rectangle of the node
    // get abs pos
    const nodeRect = {
      // x: node.position.x,
      // y: node.position.y,
      x: absPos.x,
      y: absPos.y,
      width: node.data.mywidth ?? 200,
      // FIXME fixed height for this computation
      // height: 200,
      // height: linum * 1.5,
      // height: (linum * 2762) / 112,
      height: (linum * 2500) / 112,
    };
    // 2762, 112
    // console.log("nodeRect", node.id, node.measured?.height, linum);
    const viewport = {
      x: -x / zoom,
      y: -y / zoom,
      zoom: zoom,
      width: s.width / zoom,
      height: s.height / zoom,
    };
    const viewport2 = {
      x: viewport.x + 100,
      y: viewport.y + 100,
      width: viewport.width - 200,
      height: viewport.height - 200,
    };
    // console.log("nodeRect", node.id, nodeRect);
    // console.log("viewport", viewport);
    // debug as long as any part the pod is out of scope
    // return (
    //   nodeRect.x + nodeRect.width < viewport.x + viewport.width &&
    //   nodeRect.x > viewport.x &&
    //   nodeRect.y + nodeRect.height < viewport.y + viewport.height &&
    //   nodeRect.y > viewport.y
    // );
    // check if the node is in the viewport, i.e., the nodeRect has overlap with the viewport.
    return (
      nodeRect.x < viewport.x + viewport.width &&
      nodeRect.x + nodeRect.width > viewport.x &&
      nodeRect.y < viewport.y + viewport.height &&
      nodeRect.y + nodeRect.height > viewport.y
    );
    return (
      nodeRect.x < viewport2.x + viewport2.width &&
      nodeRect.x + nodeRect.width > viewport2.x &&
      nodeRect.y < viewport2.y + viewport2.height &&
      nodeRect.y + nodeRect.height > viewport2.y
    );
  });
}

/**
 * Only render codemirror editor when the node is in the viewport, and the zoom level is right.
 */
function ContextualZoom({ node }: { node: CodeNodeType }) {
  // return <pre>{"hello"}</pre>;
  const codeMap = useAtomValue(ATOM_codeMap);
  const ytext = codeMap.get(node.id);
  myassert(ytext);
  const linum = ytext.toString().split("\n").length;

  const zoomLevel = useStore((s) => {
    const zoom = s.transform[2];
    return Math.floor(zoom * 100) / 100;
  });

  // const { x, y, zoom } = useStore((s) => {
  //   const [x, y, zoom] = s.transform;
  //   // const zoom = s.transform[2];
  //   // return lower round of zoom, digit 2
  //   // return rounded numbers for x,y,zoom
  //   return {
  //     x: Math.floor(x / 10000) * 10000,
  //     // y: Math.floor(y / 10) * 10,
  //     y: 0,
  //     zoom: Math.floor(zoom * 100) / 100,
  //   };
  // });

  const isInView = useIsInView({ node, linum });
  // const { x, y, zoom } = useViewport();
  // useViewport();

  const content = [
    `${isInView}`,
    `linum=${linum}`,
    `zoomLevel=${zoomLevel}`,
    // `x=${x}`,
    // `y=${y}`,
    // `zoom=${zoom}`,
    // "hello",
  ].join("\n");

  // return <pre>{"hello"}</pre>;
  // return <pre>{ytext.toString()}</pre>;

  if (isInView && zoomLevel > 0.1) {
    return <MyCodeMirrorImpl node={node} />;
    return (
      <div
        style={{
          // height is the linum * 1.5em
          height: `${linum * 1.5}em`,
          border: "1px solid red",
        }}
      >
        <pre
          style={{
            whiteSpace: "pre-wrap",
            fontSize: "10em",
          }}
        >
          {content}
        </pre>
      </div>
    );
  }
  // if (isInView && zoomLevel > 0.1) {
  //   return <pre>{ytext.toString()}</pre>;
  // }
  // console.log("linum", linum);
  return (
    <div
      style={{
        height: `${linum * 1.5}em`,
        border: "1px solid blue",
      }}
    >
      {/* working */}
      {/* {[1, 2, 3].map((_, i) => (
        <div key={i}>Hello</div>
      ))} */}
      {/* Array.from(3) doesn't work because the empty array is not mappable. Must use Array.from({length: 3}) or .fill(null) */}
      {/* {Array.from({ length: Math.max(linum - 1, 0) }).map((_, i) => (
        <div key={i}>Hello</div>
      ))} */}

      {new Array(Math.max(linum - 1, 0)).fill(null).map((_, i) => (
        <div
          key={i}
          style={{
            backgroundColor: "#eee",
            width: "100%",
            // height: "10px",
            height: "1.3em",
            marginBottom: "4px",
          }}
        />
      ))}
      {/* <div
        style={{
          backgroundColor: "#eee",
          width: "100%",
          height: "10px",
          marginBottom: "4px",
        }}
      />
      <div
        style={{
          backgroundColor: "#eee",
          width: "100%",
          height: "10px",
          marginBottom: "4px",
        }}
      /> */}
      <div
        style={{
          backgroundColor: "#eee",
          width: "100%",
          height: "10px",
        }}
      />
    </div>
  );
  return (
    <div
      style={{
        // height is the linum * 1.5em
        height: `${linum * 1.5}em`,
        border: "1px solid blue",
      }}
    >
      <pre
        style={{
          whiteSpace: "pre-wrap",
          fontSize: "10em",
        }}
      >
        {content}
      </pre>
    </div>
  );
}

export const MyCodeMirror = memo(({ id }: { id: string }) => {
  const nodesMap = useAtomValue(ATOM_nodesMap);
  const node = nodesMap.get(id);
  myassert(node);
  myassert(node.type === "CODE");
  // return MyCodeMirrorImpl({ node });
  // return MyCodeMirrorEmpty({ node });
  return ContextualZoom({ node });
});
