import {
  useCallback,
  useState,
  useRef,
  useContext,
  useEffect,
  memo,
  useMemo,
} from "react";
import * as React from "react";

import { ResizableBox } from "react-resizable";

import { useStore } from "zustand";
import { shallow } from "zustand/shallow";

import * as Y from "yjs";

import ReactFlow, {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  MiniMap,
  Controls,
  Handle,
  useReactFlow,
  Position,
  ConnectionMode,
  MarkerType,
  Node,
  useStore as useReactFlowStore,
  NodeResizer,
  NodeResizeControl,
} from "reactflow";
import Ansi from "ansi-to-react";

import Box from "@mui/material/Box";
import InputBase from "@mui/material/InputBase";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import FormatColorResetIcon from "@mui/icons-material/FormatColorReset";
import HeightIcon from "@mui/icons-material/Height";

import {
  BoldExtension,
  CalloutExtension,
  DropCursorExtension,
  ImageExtension,
  ItalicExtension,
  PlaceholderExtension,
  ShortcutHandlerProps,
  SubExtension,
  SupExtension,
  TextHighlightExtension,
  createMarkPositioner,
  wysiwygPreset,
  MarkdownExtension,
  TOP_50_TLDS,
  BidiExtension,
  GapCursorExtension,
  ShortcutsExtension,
  TrailingNodeExtension,
  HardBreakExtension,
  HorizontalRuleExtension,
  BlockquoteExtension,
  CodeBlockExtension,
  HeadingExtension,
  IframeExtension,
  CodeExtension,
  StrikeExtension,
  UnderlineExtension,
  EmojiExtension,
} from "remirror/extensions";
import emojiData from "svgmoji/emoji.json";

import {
  Remirror,
  EditorComponent,
  useRemirror,
  useCommands,
  useActive,
  WysiwygToolbar,
  TableComponents,
  ThemeProvider,
  ReactComponentExtension,
  HeadingLevelButtonGroup,
  VerticalDivider,
  FormattingButtonGroup,
  CommandButtonGroup,
  ListButtonGroup,
  CreateTableButton,
  DecreaseIndentButton,
  IncreaseIndentButton,
  TextAlignmentButtonGroup,
  IndentationButtonGroup,
  BaselineButtonGroup,
  CommandButton,
  CommandButtonProps,
  useChainedCommands,
  useCurrentSelection,
  useAttrs,
  useUpdateReason,
  FloatingWrapper,
  useMention,
  useKeymap,
  ToggleBoldButton,
  ToggleItalicButton,
  ToggleUnderlineButton,
  ToggleCodeButton,
  ToggleStrikeButton,
} from "@remirror/react";
import { FloatingToolbar, useExtensionEvent } from "@remirror/react";

import { InputRule } from "@remirror/pm";
import { markInputRule } from "@remirror/core-utils";

import { TableExtension } from "@remirror/extension-react-tables";
import "remirror/styles/all.css";
import { styled } from "@mui/material";

// Local Imports

import { MyYjsExtension } from "./extensions/YjsRemirror";
import {
  MathInlineExtension,
  MathBlockExtension,
} from "./extensions/mathExtension";
import {
  BulletListExtension,
  OrderedListExtension,
  TaskListExtension,
} from "./extensions/list";

import { CodePodSyncExtension } from "./extensions/codepodSync";

import { LinkExtension, LinkToolbar } from "./extensions/link";
import { SlashExtension } from "./extensions/slash";
import { SlashSuggestor } from "./extensions/useSlash";
import { BlockHandleExtension } from "./extensions/blockHandle";

import { ConfirmDeleteButton, Handles } from "./utils";
import { RepoContext } from "@/lib/store";

import { MyLexical } from "./rich/MyLexical";

import "./remirror-size.css";

/**
 * This is the toolbar when user select some text. It allows user to change the
 * markups of the text, e.g. bold, italic, underline, highlight, etc.
 */
const EditorToolbar = () => {
  return (
    <>
      <FloatingToolbar
        // By default, MUI's Popper creates a Portal, which is a ROOT html
        // elements that prevents paning on reactflow canvas. Therefore, we
        // disable the portal behavior.
        disablePortal
        sx={{
          button: {
            padding: 0,
            border: "none",
            borderRadius: "5px",
            marginLeft: "5px",
          },
          paddingX: "4px",
          border: "2px solid grey",
          borderRadius: "5px",
          alignItems: "center",
          backgroundColor: "white",
        }}
      >
        <ToggleBoldButton />
        <ToggleItalicButton />
        <ToggleUnderlineButton />
        <ToggleStrikeButton />
        <ToggleCodeButton />
        <SetHighlightButton color="lightpink" />
        <SetHighlightButton color="yellow" />
        <SetHighlightButton color="lightgreen" />
        <SetHighlightButton color="lightcyan" />
        <SetHighlightButton />

        {/* <TextAlignmentButtonGroup /> */}
        {/* <IndentationButtonGroup /> */}
        {/* <BaselineButtonGroup /> */}
      </FloatingToolbar>
    </>
  );
};

export interface SetHighlightButtonProps
  extends Omit<
    CommandButtonProps,
    "commandName" | "active" | "enabled" | "attrs" | "onSelect" | "icon"
  > {}

export const SetHighlightButton: React.FC<
  SetHighlightButtonProps | { color: string }
> = ({ color = null, ...props }) => {
  const { setTextHighlight, removeTextHighlight } = useCommands();

  const handleSelect = useCallback(() => {
    if (color === null) {
      removeTextHighlight();
    } else {
      setTextHighlight(color);
    }
    // TODO toggle the bar
  }, [color, removeTextHighlight, setTextHighlight]);

  const enabled = true;

  return (
    <CommandButton
      {...props}
      commandName="setHighlight"
      label={color ? "Highlight" : "Clear Highlight"}
      enabled={enabled}
      onSelect={handleSelect}
      icon={
        color ? (
          <Box
            sx={{
              backgroundColor: color,
              paddingX: "4px",
              borderRadius: "4px",
              lineHeight: 1.2,
            }}
          >
            A
          </Box>
        ) : (
          <FormatColorResetIcon />
        )
      }
    />
  );
};

const MyStyledWrapper = styled("div")(
  () => `
  .remirror-editor-wrapper {
    padding: 0;
  }

  /* leave some space for the block handle */
  .remirror-editor-wrapper .ProseMirror {
    padding-left: 24px;
  }
`
);

// FIXME re-rendering performance
const MyEditor = ({
  placeholder = "Start typing...",
  id,
}: {
  placeholder?: string;
  id: string;
}) => {
  // FIXME this is re-rendered all the time.
  const store = useContext(RepoContext)!;
  const editMode = useStore(store, (state) => state.editMode);
  // the Yjs extension for Remirror
  const provider = useStore(store, (state) => state.provider)!;

  const richMap = useStore(store, (state) => state.getRichMap());
  if (!richMap.has(id)) {
    throw new Error("richMap does not have id" + id);
  }
  const yXml = richMap.get(id);

  const { manager, state, setState } = useRemirror({
    extensions: () => [
      new PlaceholderExtension({ placeholder }),
      new ReactComponentExtension(),
      new TableExtension(),
      new TextHighlightExtension(),
      new SupExtension(),
      new SubExtension(),
      new MarkdownExtension(),
      new MyYjsExtension({ yXml, awareness: provider.awareness }),
      new MathInlineExtension(),
      new MathBlockExtension(),
      // new CalloutExtension({ defaultType: "warn" }),
      // Plain
      new BidiExtension(),
      new DropCursorExtension(),
      new GapCursorExtension(),
      new ShortcutsExtension(),
      new TrailingNodeExtension(),
      // Nodes
      new HardBreakExtension(),
      new ImageExtension({ enableResizing: true }),
      new HorizontalRuleExtension(),
      new BlockquoteExtension(),
      new CodeBlockExtension(),
      new HeadingExtension(),
      new IframeExtension(),
      new BulletListExtension(),
      new OrderedListExtension(),
      new TaskListExtension(),

      // Marks
      new BoldExtension(),
      new CodeExtension(),
      new StrikeExtension(),
      new ItalicExtension(),
      new LinkExtension({
        autoLink: true,
        autoLinkAllowedTLDs: ["dev", ...TOP_50_TLDS],
      }),
      new UnderlineExtension(),
      new EmojiExtension({ data: emojiData as any, plainText: true }),
      new SlashExtension({
        extraAttributes: { type: "user" },
        matchers: [
          { name: "slash", char: "/", appendText: " ", matchOffset: 0 },
        ],
      }),
      new BlockHandleExtension(),
    ],
    onError: ({ json, invalidContent, transformers }) => {
      // Automatically remove all invalid nodes and marks.
      console.log("removing invalidContent", invalidContent);
      return transformers.remove(json, invalidContent);
    },

    // Set the initial content.
    // content: "<p>I love <b>Remirror</b></p>",
    // content: "hello world",
    // content: initialContent,
    // FIXME initial content should not be set.
    // content: pod.content == "" ? pod.richContent : pod.content,

    // Place the cursor at the start of the document. This can also be set to
    // `end`, `all` or a numbered position.
    // selection: "start",

    // Set the string handler which means the content provided will be
    // automatically handled as html.
    // `markdown` is also available when the `MarkdownExtension`
    // is added to the editor.
    // stringHandler: "html",
    // stringHandler: htmlToProsemirrorNode,
    // FIXME handle markdown import/export when we migrate to Yjs for everything.
    stringHandler: "markdown",
  });

  // Printing the schema for backend JSON2YXML conversion. This is useful for
  // parsing the prosemirror JSON doc format in the backend (search `json2yxml`
  // funciton).
  //
  // const obj = { nodes: {}, marks: {},
  // };
  // manager.schema.spec.nodes.forEach((k, v) => { console.log("k", k, "v", v);
  //   obj["nodes"][k] = v;
  // });
  // manager.schema.spec.marks.forEach((k, v) => { console.log("k", k, "v", v);
  //   obj["marks"][k] = v;
  // });
  // console.log("obj", JSON.stringify(obj));

  return (
    <Box
      className="remirror-theme"
      sx={{
        userSelect: "text",
        cursor: "auto",
        // Display different markers for different levels in nested ordered lists.
        ol: {
          listStylType: "decimal",
        },
        "ol li ol": {
          listStyleType: "lower-alpha",
        },
        "ol li ol li ol": {
          listStyleType: "lower-roman",
        },
      }}
      overflow="auto"
    >
      <ThemeProvider>
        <MyStyledWrapper>
          <Remirror
            editable={editMode === "edit"}
            manager={manager}
            // Must set initialContent, otherwise the Reactflow will fire two
            // dimension change events at the beginning. This should be caused
            // by initialContent being empty, then the actual content. Setting
            // it to the actual content at the beginning will prevent this.
            initialContent={state}
            // Should not set state and onChange (the controlled Remirror editor
            // [1]), otherwise Chinsee (or CJK) input methods will not be
            // supported [2].
            // - [1] https://remirror.io/docs/controlled-editor
            // - [2] demo that Chinese input method is not working:
            //   https://remirror.vercel.app/?path=/story/editors-controlled--editable
          >
            {/* <WysiwygToolbar /> */}
            <EditorComponent />

            <TableComponents />
            <SlashSuggestor />

            {editMode === "edit" && <EditorToolbar />}
            <LinkToolbar />

            {/* <Menu /> */}
          </Remirror>
        </MyStyledWrapper>
      </ThemeProvider>
    </Box>
  );
};

function MyRemirror({ id }) {
  return (
    <div className="flex flex-col">
      <div
        className="custom-drag-handle"
        style={{
          height: "var(--space-6)",
          backgroundColor: "var(--accent-8)",
          border: "solid 1px var(--gray-12)",
          borderRadius: "4px 4px 0 0",
          cursor: "grab",
          display: "flex",
          alignItems: "center",
          padding: "0 10px",
        }}
      ></div>
      <div
        style={{
          width: "100%",
          border: "1px solid black",
          borderRadius: "0 0 4px 4px",
        }}
      >
        <MyEditor id={id} />
      </div>
    </div>
  );
}

function MyLexical1({ id }) {
  return (
    <div
      style={{
        width: "100%",
        border: "1px solid black",
        // borderRadius: "0 0 4px 4px",
        borderRadius: "4px",
      }}
    >
      <MyLexical id={id} />
    </div>
  );
}

/**
 * The React Flow node.
 */

interface Props {
  data: any;
  id: string;
  isConnectable: boolean;
  selected: boolean;
  // note that xPos and yPos are the absolute position of the node
  xPos: number;
  yPos: number;
}

export const RichNode = memo<Props>(function ({
  data,
  id,
  isConnectable,
  selected,
  xPos,
  yPos,
}) {
  const store = useContext(RepoContext)!;
  // const pod = useStore(store, (state) => state.pods[id]);
  const setPodName = useStore(store, (state) => state.setPodName);

  // A helper state to allow single-click a selected pod and enter edit mode.
  const [singleClickEdit, setSingleClickEdit] = useState(false);
  useEffect(() => {
    if (!selected) setSingleClickEdit(false);
  }, [selected, setSingleClickEdit]);

  const devMode = useStore(store, (state) => state.devMode);
  const inputRef = useRef<HTMLInputElement>(null);
  const nodesMap = useStore(store, (state) => state.getNodesMap());
  const updateView = useStore(store, (state) => state.updateView);
  const reactFlowInstance = useReactFlow();

  const [showToolbar, setShowToolbar] = useState(false);
  const autoLayoutROOT = useStore(store, (state) => state.autoLayoutROOT);
  const autoRunLayout = useStore(store, (state) => state.autoRunLayout);

  useEffect(() => {
    if (!data.name) return;
    setPodName({ id, name: data.name });
    if (inputRef?.current) {
      inputRef.current.value = data.name || "";
    }
  }, [data.name, setPodName, id]);

  const node = nodesMap.get(id);
  if (!node) return null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        minWidth: "300px",
        // This is the key to let the node auto-resize w.r.t. the content.
        height: "auto",
        backgroundColor: "white",
        cursor: "auto",
      }}
    >
      {/* Using Remirror Editor */}
      <MyRemirror id={id} />

      {/* Using Lexical Editor */}
      {/* <MyLexical1 id={id} /> */}

      <Handles
        width={node.width}
        height={node.height}
        parent={node.parentNode}
        xPos={xPos}
        yPos={yPos}
      />
      <NodeResizeControl
        style={{
          background: "transparent",
          border: "none",
          zIndex: 100,
          // put it to the right-bottom corner, instead of right-middle.
          top: "100%",
          color: "red",
        }}
        minWidth={300}
        minHeight={50}
        // this allows the resize happens in X-axis only.
        position="right"
        onResizeEnd={() => {
          // remove style.height so that the node auto-resizes.
          const node = nodesMap.get(id);
          if (node) {
            nodesMap.set(id, {
              ...node,
              style: { ...node.style, height: undefined },
            });
          }
          if (autoRunLayout) {
            autoLayoutROOT();
          }
        }}
      >
        <HeightIcon
          sx={{
            transform: "rotate(90deg)",
            position: "absolute",
            right: 5,
            bottom: 5,
          }}
        />
      </NodeResizeControl>
    </div>
  );
});

function prosemirrorToPlainText(prosemirrorJson) {
  let plainText = "";

  // Iterate through each node in the prosemirror JSON object
  prosemirrorJson.content.forEach((node) => {
    // Handle each node type
    switch (node.type) {
      // Handle paragraph nodes
      case "paragraph": {
        // Iterate through each child of the paragraph
        if (node.content) {
          node.content.forEach((child) => {
            // If the child is text, add its value to the plainText string
            if (child.type === "text") {
              plainText += child.text;
            }
          });
          // Add a newline character after the paragraph
          plainText += "\n";
        }
        break;
      }
      // Handle heading nodes
      case "heading": {
        // Add the heading text to the plainText string
        node.content.forEach((child) => {
          // If the child is text, add its value to the plainText string
          if (child.type === "text") {
            plainText += child.text;
          }
        });
        // Add two newline characters after the heading
        plainText += "\n\n";
        break;
      }
      // Handle other node types
      default: {
        // If the node has content, recursively call the function on its content
        if (node.content) {
          plainText += prosemirrorToPlainText(node);
        }
        break;
      }
    }
  });

  return plainText;
}
