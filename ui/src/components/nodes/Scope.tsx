import { useAtomValue, useSetAtom } from "jotai";
import { ATOM_nodesMap } from "@/lib/store/yjsSlice";
import { AppNode } from "@/lib/store/types";

import * as Y from "yjs";
import {
  Handle,
  NodeResizeControl,
  NodeResizer,
  Position,
  useConnection,
  XYPosition,
} from "@xyflow/react";
import { Box } from "@radix-ui/themes";
import { myassert } from "@/lib/utils/utils";
import {
  ATOM_collisionIds,
  ATOM_escapedIds,
  ATOM_insertMode,
} from "@/lib/store/canvasSlice";
import { MyHandle } from "./Code";
import { useState } from "react";

export function ScopeNode({ id }) {
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

  return (
    <Box
      style={{
        backgroundColor: "lightblue",
        opacity: 0.2,
        width: node.data.mywidth,
        height: node.data.myheight,
        // styling
        borderWidth: "5px",
        borderStyle: "solid",
        borderColor: escapedIds.includes(id)
          ? "orange"
          : collisionIds.includes(id)
            ? "pink"
            : "transparent",
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
            zIndex: 10,
            // make it full width of the node
            position: "absolute",
            width: "100%",
            height: "100%",
            top: 0,
            left: 0,
            backgroundColor: "#ccd9f6",
            opacity: 0.5,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          Drag to move
        </Box>
      )}
      Scope {id}
      <MyHandle hover={hover} isTarget={isTarget} />
      <Box
        style={{
          pointerEvents: "all",
        }}
      >
        <NodeResizer
          minWidth={100}
          minHeight={30}
          handleStyle={{
            border: "10px solid transparent",
            opacity: 0,
          }}
          lineStyle={{
            border: "10px solid transparent",
            opacity: 0,
          }}
        />
      </Box>
    </Box>
  );
}
