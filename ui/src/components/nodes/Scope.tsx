import { useAtomValue, useSetAtom } from "jotai";
import { ATOM_nodesMap } from "@/lib/store/yjsSlice";
import { AppNode } from "@/lib/store/types";

import * as Y from "yjs";
import { Handle, Position, XYPosition } from "@xyflow/react";
import { Box } from "@radix-ui/themes";
import { myassert } from "@/lib/utils/utils";
import { ATOM_collisionIds, ATOM_escapedIds } from "@/lib/store/canvasSlice";

export function ScopeNode({ id }) {
  const nodesMap = useAtomValue(ATOM_nodesMap);
  const node = nodesMap.get(id);
  myassert(node);

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
    >
      Scope {id}
      <Handle type="source" position={Position.Right} />
    </Box>
  );
}
