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

import jsx from "refractor/lang/jsx.js";
import typescript from "refractor/lang/typescript.js";
import python from "refractor/lang/python.js";

import Box from "@mui/material/Box";
import InputBase from "@mui/material/InputBase";
import Tooltip from "@mui/material/Tooltip";
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

import { Handles } from "./utils";

import { MyLexical } from "./rich/MyLexical";

import { Button, DropdownMenu, IconButton } from "@radix-ui/themes";
import { CircleEllipsis } from "lucide-react";
import { match } from "ts-pattern";
import { useAnchorStyle } from "./utils";
import { ATOM_editMode } from "@/lib/store/atom";
import {
  ATOM_nodesMap,
  ATOM_provider,
  ATOM_richMap,
} from "@/lib/store/yjsSlice";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { ATOM_addNode, ATOM_autoLayoutTree } from "@/lib/store/canvasSlice";

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
const MyRemirror = ({
  placeholder = "Start typing...",
  id,
}: {
  placeholder?: string;
  id: string;
}) => {
  // FIXME this is re-rendered all the time.
  const [editMode] = useAtom(ATOM_editMode);
  // the Yjs extension for Remirror
  const [provider] = useAtom(ATOM_provider);

  const [richMap] = useAtom(ATOM_richMap);
  if (!richMap.has(id)) {
    throw new Error("richMap does not have id" + id);
  }
  const yXml = richMap.get(id);

  const { manager, state, setState } = useRemirror({
    extensions: () => [
      // node extensions
      new MathInlineExtension(),
      new MathBlockExtension(),
      new HorizontalRuleExtension({}),
      new BlockquoteExtension(),
      new CodeBlockExtension({ supportedLanguages: [jsx, typescript, python] }),
      new HeadingExtension({}),
      new BulletListExtension({}),
      new OrderedListExtension(),
      new TaskListExtension(),
      new EmojiExtension({ data: emojiData as any, plainText: true }),

      // mark extensions
      new TextHighlightExtension({}),
      new BoldExtension({}),
      new CodeExtension(),
      new StrikeExtension(),
      new ItalicExtension(),
      new LinkExtension({
        autoLink: true,
        autoLinkAllowedTLDs: ["dev", ...TOP_50_TLDS],
      }),
      new UnderlineExtension(),

      // plain extensions
      new PlaceholderExtension({ placeholder }),
      new ReactComponentExtension({}),
      new MarkdownExtension({}),

      new DropCursorExtension({}),
      new GapCursorExtension(),
      new ShortcutsExtension(),
      new TrailingNodeExtension({}),
      new SlashExtension({
        extraAttributes: { type: "user" },
        matchers: [
          { name: "slash", char: "/", appendText: " ", matchOffset: 0 },
        ],
      }),
      // new BlockHandleExtension(),

      // // Special extensions (plain)
      new MyYjsExtension({ yXml, awareness: provider.awareness }),
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

  const [hover, setHover] = useState(false);

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
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      overflow="auto"
    >
      <ThemeProvider>
        <MyStyledWrapper>
          {hover && (
            <Box position={"fixed"} top="0" right="0" zIndex={1000}>
              <TopRightMenu id={id} />
            </Box>
          )}
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

function TopRightMenu({ id }) {
  const reactFlowInstance = useReactFlow();
  const addNode = useSetAtom(ATOM_addNode);
  const [nodesMap] = useAtom(ATOM_nodesMap);
  const node = nodesMap.get(id)!;
  const parentId = node.data.parent;
  let index = 0;
  if (parentId) {
    const parentNode = nodesMap.get(parentId);
    index = parentNode?.data.children?.indexOf(id)!;
  }
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        <IconButton
          variant="ghost"
          radius="full"
          style={{
            margin: 0,
          }}
        >
          <CircleEllipsis />
        </IconButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.Item
          shortcut="⌘ ⌫"
          color="red"
          disabled={node.id === "ROOT"}
          onClick={() => {
            // Delete all edges connected to the node.
            reactFlowInstance.deleteElements({ nodes: [{ id }] });
          }}
        >
          Delete
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
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
  // A helper state to allow single-click a selected pod and enter edit mode.
  const [singleClickEdit, setSingleClickEdit] = useState(false);
  useEffect(() => {
    if (!selected) setSingleClickEdit(false);
  }, [selected, setSingleClickEdit]);

  const inputRef = useRef<HTMLInputElement>(null);
  const nodesMap = useAtomValue(ATOM_nodesMap);
  const reactFlowInstance = useReactFlow();

  const [showToolbar, setShowToolbar] = useState(false);
  const autoLayoutTree = useSetAtom(ATOM_autoLayoutTree);

  const anchorStyle = useAnchorStyle(id);

  const [hover, setHover] = useState(false);

  const node = nodesMap.get(id);
  if (!node) return null;

  return (
    <div
      className="nodrag"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...anchorStyle,
        width: "100%",
        minWidth: "300px",
        // This is the key to let the node auto-resize w.r.t. the content.
        height: "auto",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          backgroundColor: "white",
          cursor: "auto",
          border: "solid 1px var(--gray-12)",
          borderRadius: "4px",
        }}
      >
        {/* Two alternative editors */}

        {/* <MyLexical id={id} /> */}
        <MyRemirror id={id} />

        <Handles id={id} hover={hover} />

        {hover && (
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
                autoLayoutTree();
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
        )}
      </div>
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
