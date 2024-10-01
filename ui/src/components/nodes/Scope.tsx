import { useAtomValue, useSetAtom } from "jotai";
import { ATOM_nodesMap } from "@/lib/store/yjsSlice";
import { AppNode } from "@/lib/store/types";

import * as Y from "yjs";
import { Handle, Position, XYPosition } from "@xyflow/react";
import { Box } from "@radix-ui/themes";
import { myassert } from "@/lib/utils/utils";

export function ScopeNode({ id }) {
  const nodesMap = useAtomValue(ATOM_nodesMap);
  const node = nodesMap.get(id);
  myassert(node);

  return (
    <Box
      style={{
        backgroundColor: "lightblue",
        opacity: 0.2,
        width: node.data.mywidth,
        height: node.data.myheight,
      }}
    >
      Scope {id}
      <Handle type="source" position={Position.Right} />
    </Box>
  );
}
