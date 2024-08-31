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

import {
  useReactFlow,
  NodeResizeControl,
  ResizeControlVariant,
  Handle,
  Position,
} from "@xyflow/react";
import Ansi from "ansi-to-react";

import jsx from "refractor/lang/jsx.js";
import typescript from "refractor/lang/typescript.js";
import python from "refractor/lang/python.js";

import { css } from "@emotion/css";

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
  ThemeProvider,
  ReactComponentExtension,
  CommandButton,
  CommandButtonProps,
  ToggleBoldButton,
  ToggleItalicButton,
  ToggleUnderlineButton,
  ToggleCodeButton,
  ToggleStrikeButton,
} from "@remirror/react";
import { FloatingToolbar } from "@remirror/react";

import "remirror/styles/all.css";

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

import { HighlightCurrentLineExtension } from "./extensions/lineHighlight";

import { CodePodSyncExtension, DebugExtension } from "./extensions/codepodSync";

import { LinkExtension, LinkToolbar } from "./extensions/link";
import { SlashExtension } from "./extensions/slash";
import { SlashSuggestor } from "./extensions/useSlash";
import { BlockHandleExtension } from "./extensions/blockHandle";

import {
  DeleteButton,
  PodToolbar,
  SlurpButton,
  SymbolTable,
  ToolbarAddPod,
  UnslurpButton,
} from "./utils";

import { MyLexical } from "./rich/MyLexical";

import { Box, Button, DropdownMenu, Flex, IconButton } from "@radix-ui/themes";
import { Ellipsis, RemoveFormatting, ScissorsLineDashed } from "lucide-react";
import { ATOM_cutId, ATOM_editMode } from "@/lib/store/atom";
import {
  ATOM_nodesMap,
  ATOM_provider,
  ATOM_richMap,
} from "@/lib/store/yjsSlice";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { env } from "@/lib/vars";
import { ATOM_addScope } from "@/lib/store/canvasSlice";
import { motion } from "framer-motion";

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
            style={{
              backgroundColor: color,
              paddingLeft: "4px",
              paddingRight: "4px",
              borderRadius: "4px",
              lineHeight: 1.2,
            }}
          >
            A
          </Box>
        ) : (
          <RemoveFormatting size={16} />
        )
      }
    />
  );
};

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
    throw new Error("richMap does not have id " + id);
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
      new ImageExtension({ enableResizing: true }),

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
      // new DebugExtension(),
      new HighlightCurrentLineExtension(),
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
      className={
        "remirror-theme " +
        // Display different markers for different levels in nested ordered lists.
        css`
          ol {
            list-style-type: decimal;
          }
          ol li ol {
            list-style-type: lower-alpha;
          }
          ol li ol li ol {
            list-style-type: lower-roman;
          }
          .remirror-editor-wrapper {
            padding: 0;
          }

          /* leave some space for the block handle */
          .remirror-editor-wrapper .ProseMirror {
            padding-left: 24px;
          }
        `
      }
      style={{
        userSelect: "text",
        cursor: "auto",
      }}
      overflow="auto"
    >
      <ThemeProvider>
        <Remirror
          editable={!env.READ_ONLY && editMode === "edit"}
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

          {!env.READ_ONLY && editMode === "edit" && <EditorToolbar />}
          <LinkToolbar />

          {/* <Menu /> */}
        </Remirror>
      </ThemeProvider>
    </Box>
  );
};

function MyPodToolbar({ id }) {
  const addScope = useSetAtom(ATOM_addScope);
  return (
    <PodToolbar id={id}>
      {/* The "more" button */}
      {id !== "ROOT" && (
        <DropdownMenu.Root>
          <DropdownMenu.Trigger>
            <IconButton
              variant="ghost"
              radius="small"
              style={{
                margin: 3,
                padding: 0,
              }}
            >
              <Ellipsis />
            </IconButton>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content>
            {/* Structural edit */}
            <DropdownMenu.Item
              onSelect={() => {
                addScope(id);
              }}
            >
              Add Scope
            </DropdownMenu.Item>
            <SlurpButton id={id} />
            <UnslurpButton id={id} />
            <DropdownMenu.Separator />
            <DeleteButton id={id} />
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      )}
    </PodToolbar>
  );
}

/**
 * The React Flow node.
 */

export const RichNode = function ({ id }: { id: string }) {
  const nodesMap = useAtomValue(ATOM_nodesMap);

  const [hover, setHover] = useState(false);
  const [focused, setFocused] = useState(false);

  const node = nodesMap.get(id);
  const cutId = useAtomValue(ATOM_cutId);
  if (!node) return null;

  return (
    <div
      // focused classname is used to show line highlight only for the focused Remirror node.
      className={`nodrag ${focused ? "focused" : ""}`}
      style={{
        width: "100%",
        minWidth: "300px",
        // This is the key to let the node auto-resize w.r.t. the content.
        height: "auto",

        backdropFilter: "blur(10px)",
        backgroundColor: "rgba(228, 228, 228, 0.5)",
        // padding: "8px",
        borderRadius: "8px",
        // border: "3px solid",
        // borderColor: focused ? "black" : "transparent",
        border: cutId === id ? "3px dashed red" : "3px solid transparent",
        // add shadow
        boxShadow: "0 4px 6px rgba(0, 0, 0, 0.3)",
      }}
    >
      <div
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          display: "flex",
          flexDirection: "column",
          backgroundColor: "white",
          cursor: "auto",
          // This is required to remove the weird corner of the border.
          borderRadius: "5px",
        }}
      >
        {!env.READ_ONLY && (
          <motion.div
            animate={{
              opacity: hover ? 1 : 0,
            }}
          >
            <MyPodToolbar id={id} />
          </motion.div>
        )}
        {/* Two alternative editors */}

        {/* <MyLexical id={id} /> */}
        <Box
          onFocus={() => {
            setFocused(true);
          }}
          onBlur={() => {
            setFocused(false);
          }}
        >
          <MyRemirror id={id} />
        </Box>

        <SymbolTable id={id} />

        <Handle id="left" type="source" position={Position.Left} />
        <Handle id="right" type="source" position={Position.Right} />

        <NodeResizeControl
          minWidth={300}
          minHeight={50}
          // this allows the resize happens in X-axis only.
          position="right"
          // FIXME
          variant={"line" as any}
          // variant={ResizeControlVariant.Line}
          color="transparent"
          style={{
            border: "10px solid transparent",
            transform: "translateX(-30%)",
          }}
        />
      </div>
    </div>
  );
};

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
