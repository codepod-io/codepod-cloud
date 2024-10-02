import { useAtomValue, useSetAtom } from "jotai";
import { ATOM_nodesMap } from "@/lib/store/yjsSlice";
import { AppNode } from "@/lib/store/types";

import * as Y from "yjs";
import {
  Handle,
  NodeProps,
  NodeResizeControl,
  NodeResizer,
  Position,
  useConnection,
  XYPosition,
} from "@xyflow/react";
import { Box, DropdownMenu, Flex, IconButton } from "@radix-ui/themes";
import { myassert } from "@/lib/utils/utils";
import {
  ATOM_collisionIds,
  ATOM_escapedIds,
  ATOM_insertMode,
} from "@/lib/store/canvasSlice";
import { MyHandle } from "./Code";
import { memo, useState } from "react";
import { motion } from "framer-motion";
import { Ellipsis, GripVertical } from "lucide-react";
import { css } from "@emotion/css";

const MyToolbar = memo(function MyToolbar({ id }: { id: string }) {
  return (
    <Flex
      align="center"
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        // border: "solid 1px var(--gray-8)",
        transform: "translateY(-100%) translateX(-10%)",
        backgroundColor: "white",
        borderRadius: "5px",
        boxShadow: "0 0 10px rgba(0,0,0,0.2)",
        cursor: "auto",
      }}
    >
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
          <DropdownMenu.Item
            onSelect={() => {
              // TODO
            }}
          >
            Delete Scope
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={() => {
              // TODO
            }}
          >
            Delete Scope and Children
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </Flex>
  );
});

export function ScopeNode({ id }: NodeProps) {
  const nodesMap = useAtomValue(ATOM_nodesMap);
  const node = nodesMap.get(id);
  myassert(node);

  const [hover, setHover] = useState(false);

  const insertMode = useAtomValue(ATOM_insertMode);

  const connection = useConnection();

  const isTarget = connection.inProgress && connection.fromNode.id !== id;

  // collisions
  const collisionIds = useAtomValue(ATOM_collisionIds);
  const escapedIds = useAtomValue(ATOM_escapedIds);

  const borderWidth = 4;

  return (
    <Box
      style={{
        width: node.data.mywidth,
        height: node.data.myheight,
        // styling
        borderWidth: `${borderWidth}px`,
        borderStyle: "solid",
        borderColor: escapedIds.includes(id)
          ? "orange"
          : collisionIds.includes(id)
            ? "pink"
            : "gray",
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {insertMode === "Move" && (
        <Box
          className="custom-drag-handle"
          style={{
            pointerEvents: "all",
            // put it on top of Monaco
            // zIndex: 10,
            // make it full width of the node
            position: "absolute",
            width: "100%",
            height: "100%",
            top: 0,
            left: 0,
            backgroundColor: "lightblue",
            opacity: 0.1,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          Drag to move
        </Box>
      )}
      <Flex
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: "lightpink",
          opacity: 0.1,
        }}
      >
        Scope {id}
      </Flex>
      <MyHandle hover={hover} isTarget={isTarget} />
      <motion.div
        animate={{
          opacity: hover ? 1 : 0,
        }}
        style={{
          pointerEvents: "all",
        }}
      >
        <MyToolbar id={id} />
      </motion.div>
      <Box
        style={{
          pointerEvents: "all",
        }}
        className={css`
          .line.right {
            width: 20px;
            border-width: 0px;
            background-color: pink;

            // border-right-width: 10px;
            // the 3px here is 1/2 of the scope border 6px
            transform: translateX(-50%) translateX(-${borderWidth / 2}px);
          }
          .line.bottom {
            height: 20px;
            background-color: pink;
            // border-bottom-width: 10px;
            transform: translateY(-50%) translateY(-${borderWidth / 2}px);
          }
          .line.left {
            width: 20px;
            background-color: pink;
            border-left-width: 0px;
            transform: translateX(-50%) translateX(${borderWidth / 2}px);
          }
          .line.top {
            height: 20px;
            background-color: pink;
            border-top-width: 0px;
            transform: translateY(-50%) translateY(${borderWidth / 2}px);
          }
          .handle.top.right {
            transform: translate(-50%, -50%) translate(-${borderWidth / 2}px, ${borderWidth / 2}px);
          }
          .handle.top.left {
            transform: translate(-50%, -50%) translate(${borderWidth / 2}px, ${borderWidth / 2}px);
          }
          .handle.bottom.right {
            transform: translate(-50%, -50%) translate(-${borderWidth / 2}px, -${borderWidth / 2}px);
          }
          .handle.bottom.left {
            transform: translate(-50%, -50%) translate(${borderWidth / 2}px, -${borderWidth / 2}px);
        `}
      >
        <NodeResizer
          minWidth={100}
          minHeight={30}
          handleStyle={{
            // borderWidth: "5px",
            width: "10px",
            height: "10px",
            // border: "10px solid",
            opacity: 0,
          }}
          lineStyle={{
            opacity: 0,
            borderColor: escapedIds.includes(id)
              ? "orange"
              : collisionIds.includes(id)
                ? "pink"
                : "blue",
          }}
        />
      </Box>
    </Box>
  );
}
