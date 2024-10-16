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
  getOrCreate_ATOM_parseResult,
  getOrCreate_ATOM_resolveResult,
} from "@/lib/store/runtimeSlice";
import { Flex } from "@radix-ui/themes";

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
  console.log("formatCode");
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

function MyCodeMirrorImpl({ node }: { node: CodeNodeType }) {
  const codeMap = useAtomValue(ATOM_codeMap);

  const editorRef = useRef<HTMLDivElement | null>(null);

  const provider = useAtomValue(ATOM_provider);
  myassert(provider);

  const viewRef = useRef<EditorView | null>(null);

  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(""); // For the input box filter
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0); // Track selected command
  const inputRef = useRef(null); // Ref for the input box
  const paletteRef = useRef(null); // Ref for the command palette to handle outside click

  const commands = [
    { label: "Bold", command: () => console.log("Bold") },
    { label: "Italic", command: () => console.log("Italic") },
    { label: "Underline", command: () => console.log("Underline") },
    { label: "Strikethrough", command: () => console.log("Strikethrough") },
  ];

  const showCommandPalette = () => {
    setIsCommandPaletteOpen(true);
    setSearchQuery("");
    setSelectedCommandIndex(0); // Reset to the first command
  };

  const runCommand = (command) => {
    command();
    setIsCommandPaletteOpen(false); // Close palette after running command
    editorRef.current?.focus(); // Focus back on the editor
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const filteredCommands = commands.filter((cmd) =>
      cmd.label.toLowerCase().includes(searchQuery.toLowerCase())
    );

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        // Navigate down in the command list
        setSelectedCommandIndex((prevIndex) =>
          prevIndex < filteredCommands.length - 1 ? prevIndex + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        // Navigate up in the command list
        setSelectedCommandIndex((prevIndex) =>
          prevIndex > 0 ? prevIndex - 1 : filteredCommands.length - 1
        );
        break;
      case "n":
        // Navigate down in the command list
        if (e.ctrlKey) {
          e.preventDefault(); // Prevent default scrolling behavior
          setSelectedCommandIndex((prevIndex) =>
            prevIndex < filteredCommands.length - 1 ? prevIndex + 1 : 0
          );
        }
        break;
      case "p":
        // Navigate up in the command list
        if (e.ctrlKey) {
          e.preventDefault(); // Prevent default scrolling behavior
          setSelectedCommandIndex((prevIndex) =>
            prevIndex > 0 ? prevIndex - 1 : filteredCommands.length - 1
          );
        }
        break;
      case "Enter":
        // Run the selected command
        if (filteredCommands[selectedCommandIndex]) {
          runCommand(filteredCommands[selectedCommandIndex].command);
        }
        break;
      case "Escape":
        // Close the command palette
        e.preventDefault();
        setIsCommandPaletteOpen(false);
        editorRef.current?.focus(); // Focus back on the editor
        // viewRef.current?.dom.focus();
        break;
      default:
        break;
    }
  };

  // Focus on the input box when the command palette is opened
  useEffect(() => {
    if (isCommandPaletteOpen) {
      // @ts-ignore
      inputRef.current.focus();
    }
  }, [isCommandPaletteOpen]);

  // Close the palette when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      // @ts-ignore
      if (paletteRef.current && !paletteRef.current.contains(event.target)) {
        setIsCommandPaletteOpen(false);
        // editorRef.current?.focus(); // Focus back on the editor when clicking outside
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [paletteRef]);

  // Filter commands based on search query
  const filteredCommands = commands.filter((cmd) =>
    cmd.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    if (editorRef.current) {
      const ytext = codeMap.get(node.id);
      myassert(ytext);

      const undoManager = new Y.UndoManager(ytext);

      // Define the commands inside the useEffect where showCommandPalette is available
      const customCommands = keymap.of([
        {
          key: "Cmd-Shift-p", // Or "Cmd-p" for macOS
          run: () => {
            showCommandPalette(); // Function to display command palette
            return true; // Returning true stops further key processing
          },
        },
        // {
        //   key: "Ctrl-b",
        //   run: (view) => {
        //     console.log("Bold command triggered");
        //     return true;
        //   },
        // },
      ]);

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
          customCommands,
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

  // return <pre>{"hello"}</pre>;

  return (
    <div>
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
      {isCommandPaletteOpen && (
        <div
          ref={paletteRef}
          style={{
            position: "absolute",
            top: "10%",
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "white",
            border: "1px solid black",
            padding: "10px",
            width: "300px",
            zIndex: 10,
            pointerEvents: "auto",
          }}
          onKeyDown={handleKeyDown}
        >
          {/* Input box to filter commands */}
          <Flex
            style={{
              // vertical align the items within the flex
              alignItems: "center",
            }}
          >
            <div>Run {">"}</div>
            <input
              ref={inputRef}
              type="text"
              placeholder="Type a command"
              value={searchQuery}
              // onChange={(e) => setSearchQuery(e.target.value)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSelectedCommandIndex(0); // Reset to the first match when typing
              }}
              style={{
                padding: "8px",
                // marginBottom: "8px",
                fontSize: "14px",
                boxSizing: "border-box",
              }}
            />
          </Flex>

          {/* Display filtered commands */}
          {filteredCommands.length > 0 ? (
            filteredCommands.map((cmd, idx) => (
              <div
                key={idx}
                onClick={() => runCommand(cmd.command)}
                className={css`
                  padding: 5px 10px;
                  cursor: pointer;
                  background-color: ${idx === selectedCommandIndex
                    ? "#d3d3d3"
                    : "white"};
                  &:hover {
                    background: #f0f0f0;
                  }
                `}
              >
                {cmd.label}
              </div>
            ))
          ) : (
            <div>No matching commands</div>
          )}
        </div>
      )}
    </div>
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
