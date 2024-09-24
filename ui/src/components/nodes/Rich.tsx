import { memo, useCallback, useState } from "react";

import {
  useReactFlow,
  NodeResizeControl,
  ResizeControlVariant,
  Handle,
  Position,
  NodeProps,
} from "@xyflow/react";

import * as Y from "yjs";

// Local Imports

import { DeleteButton, PodToolbar, SymbolTable, ToolbarAddPod } from "./utils";

import {
  Box,
  Button,
  Text,
  DropdownMenu,
  Flex,
  IconButton,
  Switch,
  Heading,
} from "@radix-ui/themes";
import {
  CornerDownLeft,
  CornerRightUp,
  Ellipsis,
  RemoveFormatting,
  ScissorsLineDashed,
} from "lucide-react";
import { ATOM_cutId, ATOM_editMode } from "@/lib/store/atom";
import {
  ATOM_nodesMap,
  ATOM_provider,
  ATOM_richMap,
} from "@/lib/store/yjsSlice";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { env } from "@/lib/vars";
import {
  ATOM_slurp,
  ATOM_toggleScope,
  ATOM_unslurp,
} from "@/lib/store/canvasSlice";
import { motion } from "framer-motion";
import { RichEditor } from "./Rich_Editor";
import { myassert } from "@/lib/utils/utils";

function MyPodToolbar({ id }) {
  const toggleScope = useSetAtom(ATOM_toggleScope);
  const nodesMap = useAtomValue(ATOM_nodesMap);
  const node = nodesMap.get(id);
  const slurp = useSetAtom(ATOM_slurp);
  const unslurp = useSetAtom(ATOM_unslurp);
  myassert(node);
  return (
    <PodToolbar id={id}>
      {/* The "more" button */}
      {id === "ROOT" && <ToolbarAddPod id={id} position="right" />}
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
          <DropdownMenu.Content color="yellow">
            {id !== "ROOT" && (
              <DropdownMenu.Item
                onSelect={(e) => {
                  e.preventDefault();
                }}
                asChild
              >
                <Flex
                  onClick={() => {
                    toggleScope(id);
                  }}
                >
                  Scope
                  <Switch checked={node.data.isScope} color="blue" />
                </Flex>
              </DropdownMenu.Item>
            )}

            {/* Structural edit */}
            <DropdownMenu.Separator />
            <Flex direction="column">
              <ToolbarAddPod id={id} position="top" />
              <Flex align="center" justify="center">
                <ToolbarAddPod id={id} position="left" />
                <ToolbarAddPod id={id} position="right" />
              </Flex>
              <ToolbarAddPod id={id} position="bottom" />
            </Flex>
            <DropdownMenu.Separator />
            <DropdownMenu.Item
              onSelect={(e) => {
                e.preventDefault();
                // move its next sibling to its children
                slurp(id);
              }}
            >
              <CornerRightUp />
              Slurp
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={(e) => {
                e.preventDefault();
                // move its children to its next sibling
                unslurp(id);
              }}
            >
              <CornerDownLeft />
              Unslurp
            </DropdownMenu.Item>
            <DeleteButton id={id} />
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      )}
    </PodToolbar>
  );
}

function getTitleFromYXml(yXmlFragment: Y.XmlFragment) {
  const blockGroup = yXmlFragment.get(0);
  if (
    blockGroup instanceof Y.XmlElement &&
    blockGroup.nodeName === "blockGroup"
  ) {
    const blockContainer = blockGroup.get(0);
    if (
      blockContainer instanceof Y.XmlElement &&
      blockContainer.nodeName === "blockContainer"
    ) {
      let heading = blockContainer.get(0);
      if (heading instanceof Y.XmlElement) {
        if (heading.nodeName === "heading") {
          const text = heading.get(0);
          if (text) {
            return <Heading>{text.toString()}</Heading>;
          }
        } else {
          // This is plain text.
          // recursively get children until plain text
          while (heading && !(heading instanceof Y.Text)) {
            heading = heading.get(0);
          }
          if (heading) {
            return <Text>{heading.toString().substring(0, 10)} ..</Text>;
          }
        }
      }
    }
  }
  return <Text>Folded Note</Text>;
}

const RichEditorWrapper = ({ id }: { id: string }) => {
  // the Yjs extension for Remirror
  const [provider] = useAtom(ATOM_provider);

  const [richMap] = useAtom(ATOM_richMap);
  if (!richMap.has(id)) {
    throw new Error("richMap does not have id " + id);
  }
  const yXml = richMap.get(id);
  if (!yXml) return null;
  if (!provider) return null;
  return <RichEditor yXml={yXml} provider={provider} id={id} />;
};

function FoldedRichPod({ id }: { id: string }) {
  const [provider] = useAtom(ATOM_provider);

  const [richMap] = useAtom(ATOM_richMap);
  if (!richMap.has(id)) {
    throw new Error("richMap does not have id " + id);
  }
  const yXml = richMap.get(id);
  if (!yXml) return null;
  if (!provider) return null;
  const title = getTitleFromYXml(yXml);
  return title;
}

/**
 * The React Flow node.
 */

export const RichNode = function ({
  id,
  selected,
}: NodeProps & { id: string }) {
  const nodesMap = useAtomValue(ATOM_nodesMap);

  const [hover, setHover] = useState(false);

  const node = nodesMap.get(id);
  const cutId = useAtomValue(ATOM_cutId);
  if (!node) return null;

  if (node.data.podFolded) {
    return (
      <div
        className={`nodrag`}
        style={{
          minWidth: "200px",
        }}
      >
        <div
          style={{
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
            paddingLeft: "10px",
          }}
        >
          <div
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
              display: "flex",
              flexDirection: "column",
              // backgroundColor: "white",
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

            <FoldedRichPod id={id} />

            <SymbolTable id={id} />

            <Handle id="left" type="source" position={Position.Left} />
            <Handle id="right" type="source" position={Position.Right} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`nodrag`}
      style={{
        width: node.data.podFolded ? undefined : node.data.mywidth,
        minWidth: "300px",
      }}
    >
      <div
        style={{
          // This is the key to let the node auto-resize w.r.t. the content.
          height: "auto",

          backdropFilter: "blur(10px)",
          backgroundColor: "rgba(228, 228, 228, 0.5)",
          // padding: "8px",
          borderRadius: "8px",
          // border: "3px solid",
          // borderColor: focused ? "black" : "transparent",
          border:
            cutId === id
              ? "3px dashed red"
              : selected
                ? "3px solid black"
                : "3px solid transparent",
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
          <RichEditorWrapper id={id} />

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
