import { memo, useCallback, useState } from "react";

import {
  useReactFlow,
  NodeResizeControl,
  ResizeControlVariant,
  Handle,
  Position,
  NodeProps,
  useConnection,
  useStore,
} from "@xyflow/react";

import * as Y from "yjs";

// Local Imports

import { ConfirmedDelete } from "./utils";

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
  BookOpenText,
  CornerDownLeft,
  CornerRightUp,
  Ellipsis,
  GripVertical,
  RemoveFormatting,
  ScissorsLineDashed,
  Trash2,
} from "lucide-react";
import { ATOM_cutId, ATOM_editMode } from "@/lib/store/atom";
import {
  ATOM_nodesMap,
  ATOM_provider,
  ATOM_richMap,
} from "@/lib/store/yjsSlice";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { env } from "@/lib/vars";
import { motion } from "framer-motion";
import { RichEditor } from "./Rich_Editor";
import { myassert } from "@/lib/utils/utils";
import {
  ATOM_collisionIds,
  ATOM_escapedIds,
  ATOM_toggleReadme,
} from "@/lib/store/canvasSlice";
import { ChangeScopeItem, HandleOnToolbar, MyHandle } from "./Code";
import { ATOM_deletePod } from "@/lib/store/canvasSlice_addNode";

const MyPodToolbar = memo(function MyPodToolbar({ id }: { id: string }) {
  const zoom = useStore((s) => Math.max(s.transform[2], 0.3));

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        position: "absolute",
        top: 0,
        right: 0,
        // border: "solid 1px var(--gray-8)",
        transform: `translate(0%, -100%) scale(${1 / zoom})`,
        transformOrigin: "bottom right",
        backgroundColor: "white",
        borderRadius: "5px",
        boxShadow: "0 0 10px rgba(0,0,0,0.2)",
        cursor: "auto",
      }}
    >
      <MyPodToolbarImpl id={id} />
    </div>
  );
});

const MyPodToolbarImpl = memo(function MyPodToolbarImpl({
  id,
}: {
  id: string;
}) {
  const nodesMap = useAtomValue(ATOM_nodesMap);
  const node = nodesMap.get(id);
  myassert(node);

  const deletePod = useSetAtom(ATOM_deletePod);
  const toggleReadme = useSetAtom(ATOM_toggleReadme);
  return (
    <>
      {/* drag handle */}
      <Box
        className="custom-drag-handle"
        style={{
          cursor: "grab",
          padding: "8px",
          display: "inline-flex",
        }}
      >
        <GripVertical />
      </Box>
      <HandleOnToolbar />

      {/* The "more" button */}
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
          <ChangeScopeItem id={id} />
          <DropdownMenu.Item
            onSelect={() => {
              toggleReadme(id);
            }}
          >
            <BookOpenText />
            toggle Readme
          </DropdownMenu.Item>
          <DropdownMenu.Separator />
          <ConfirmedDelete
            color="red"
            onSelect={() => {
              deletePod(id);
            }}
            trigger={
              <>
                <Trash2 /> Delete Pod
              </>
            }
            title="This will delete the pod."
            description="Continue?"
            confirm="Delete"
          />
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </>
  );
});

export function getTitleFromYXml(yXmlFragment: Y.XmlFragment) {
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
  return null;
}

const RichEditorWrapper = memo(({ id }: { id: string }) => {
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
});

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
  if (title) return title;
  return <Text>Folded Note</Text>;
}

const Tags = function Tags({ id }: { id: string }) {
  const nodesMap = useAtomValue(ATOM_nodesMap);
  const node = nodesMap.get(id);
  const reactFlowInstance = useReactFlow();
  if (!node) throw new Error(`Node ${id} not found.`);
  return (
    <>
      {/* TOP: show self symbol table at the top, big font */}
      <Flex
        style={{
          // place it on the right
          position: "absolute",
          top: 0,
          left: 0,
          transform: "translateY(-100%) translateY(-10px)",
          pointerEvents: "none",
        }}
        direction={"column"}
        gap="4"
        wrap="wrap"
      >
        {/* tags */}
        {node.data.isReadme && (
          <div
            style={{
              fontSize: "1.5em",
              whiteSpace: "nowrap",
            }}
          >
            <Text
              style={{
                color: "black",
                backgroundColor: "lightgreen",
                borderRadius: "5px",
                padding: "2px 5px",
              }}
            >
              readme
            </Text>
          </div>
        )}
      </Flex>
    </>
  );
};

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

  const connection = useConnection();

  const isTarget = connection.inProgress && connection.fromNode.id !== id;
  const isSource = connection.inProgress && connection.fromNode.id === id;

  // collisions
  const collisionIds = useAtomValue(ATOM_collisionIds);
  const escapedIds = useAtomValue(ATOM_escapedIds);

  if (!node) return null;

  // For performance debugging.
  if (false as any) {
    return (
      <div
        style={{
          width: node.data.mywidth,
          minWidth: "300px",
          height: "100px",
          backgroundColor: "pink",
        }}
      >
        Test
        <MyHandle isTarget={isTarget} />
      </div>
    );
  }

  return (
    <div
      // className={`nodrag`}
      style={{
        width: node.data.mywidth,
        minWidth: "300px",
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div
        style={{
          // This is the key to let the node auto-resize w.r.t. the content.
          height: "auto",

          // backdropFilter: "blur(10px)",
          // backgroundColor: "rgba(228, 228, 228, 0.5)",
          // padding: "8px",
          borderRadius: "8px",
          // border: "3px solid",
          // borderColor: focused ? "black" : "transparent",
          borderWidth: "5px",
          borderStyle: cutId === id ? "dashed" : "solid",
          borderColor:
            cutId === id
              ? "red"
              : escapedIds.includes(id)
                ? "orange"
                : collisionIds.includes(id)
                  ? "pink"
                  : "var(--gray-2)",
          // add shadow
          boxShadow: "0 4px 6px rgba(0, 0, 0, 0.3)",
        }}
      >
        <div
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
            // <motion.div
            //   animate={{
            //     opacity: hover ? 1 : 0,
            //   }}
            // >
            //   <MyPodToolbar id={id} />
            // </motion.div>
            <div
              style={{
                opacity: hover || isSource ? 1 : 0,
              }}
            >
              <MyPodToolbar id={id} />
            </div>
          )}
          <RichEditorWrapper id={id} />
          <Tags id={id} />

          <MyNodeResizer />
          <MyHandle isTarget={isTarget} />
        </div>
      </div>
    </div>
  );
};

const MyNodeResizer = memo(function MyNodeResizer() {
  return (
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
