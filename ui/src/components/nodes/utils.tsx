import {
  Position,
  Node,
  NodePositionChange,
  XYPosition,
  Handle,
  useReactFlow,
  InternalNode,
} from "@xyflow/react";

import { memo, useContext, useRef, useState } from "react";

import {
  ChevronLeft,
  ScissorsLineDashed,
  Trash,
  Trash2,
  Wrench,
  CornerRightUp,
  CornerDownLeft,
  Minimize,
  Maximize,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { match, P } from "ts-pattern";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { getAbsPos } from "@/lib/store/canvasSlice";

import { ATOM_nodesMap } from "@/lib/store/yjsSlice";

import juliaLogo from "@/assets/julia.svg";
import pythonLogo from "@/assets/python.svg";
import javascriptLogo from "@/assets/javascript.svg";
import racketLogo from "@/assets/racket.svg";

export const JuliaLogo = memo(() => (
  <img src={juliaLogo} style={{ height: "1.5em" }} />
));
export const PythonLogo = memo(() => (
  <img src={pythonLogo} style={{ height: "1.5em" }} />
));
export const JavaScriptLogo = memo(() => (
  <img src={javascriptLogo} style={{ height: "1.5em" }} />
));
export const RacketLogo = memo(() => (
  <img src={racketLogo} style={{ height: "1.5em" }} />
));

import { NotebookPen, Clipboard } from "lucide-react";

import {
  Box,
  Button,
  Dialog,
  DropdownMenu,
  Flex,
  IconButton,
  Switch,
  Tooltip,
} from "@radix-ui/themes";
import { motion } from "framer-motion";

import rowInsertTop from "@/assets/row-insert-top.svg";
import { ATOM_cutId } from "@/lib/store/atom";

import ArrowLeftToLine from "@/assets/ArrowLeftToLine.svg";
import {
  getOrCreate_ATOM_privateST,
  getOrCreate_ATOM_publicST,
  getOrCreate_ATOM_selfST,
} from "@/lib/store/runtimeSlice";
import { myassert } from "@/lib/utils/utils";

export function ResizeIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      strokeWidth="2"
      stroke="#ff0071"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ position: "absolute", right: 5, bottom: 5 }}
    >
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <polyline points="16 20 20 20 20 16" />
      <line x1="14" y1="14" x2="20" y2="20" />
      <polyline points="8 4 4 4 4 8" />
      <line x1="4" y1="4" x2="10" y2="10" />
    </svg>
  );
}

function sortNodes(nodeIds, nodesMap) {
  nodeIds.sort((id1, id2) => {
    const node1 = nodesMap.get(id1);
    const node2 = nodesMap.get(id2);
    if (node1 && node2) {
      if (node1.position.y === node2.position.y) {
        return node1.position.x - node2.position.x;
      } else {
        return node1.position.y - node2.position.y;
      }
    } else {
      return 0;
    }
  });
}

type GetHelperLinesResult = {
  horizontal?: number;
  vertical?: number;
  snapPosition: Partial<XYPosition>;
};

// this utility function can be called with a position change (inside onNodesChange)
// it checks all other nodes and calculated the helper line positions and the position where the current node should snap to
export function getHelperLines(
  change: NodePositionChange,
  nodes: Node[],
  distance = 5
): GetHelperLinesResult {
  const defaultResult = {
    horizontal: undefined,
    vertical: undefined,
    snapPosition: { x: undefined, y: undefined },
  };
  const nodeA = nodes.find((node) => node.id === change.id);

  if (!nodeA || !change.position) {
    return defaultResult;
  }

  const nodeABounds = {
    left: change.position.x,
    right: change.position.x + (nodeA.width ?? 0),
    top: change.position.y,
    bottom: change.position.y + (nodeA.height ?? 0),
    width: nodeA.width ?? 0,
    height: nodeA.height ?? 0,
  };

  let horizontalDistance = distance;
  let verticalDistance = distance;

  return nodes
    .filter((node) => node.id !== nodeA.id)
    .reduce<GetHelperLinesResult>((result, nodeB) => {
      const nodeBBounds = {
        left: nodeB.position.x,
        right: nodeB.position.x + (nodeB.width ?? 0),
        top: nodeB.position.y,
        bottom: nodeB.position.y + (nodeB.height ?? 0),
        width: nodeB.width ?? 0,
        height: nodeB.height ?? 0,
      };

      //  |‾‾‾‾‾‾‾‾‾‾‾|
      //  |     A     |
      //  |___________|
      //  |
      //  |
      //  |‾‾‾‾‾‾‾‾‾‾‾|
      //  |     B     |
      //  |___________|
      const distanceLeftLeft = Math.abs(nodeABounds.left - nodeBBounds.left);

      if (distanceLeftLeft < verticalDistance) {
        result.snapPosition.x = nodeBBounds.left;
        result.vertical = nodeBBounds.left;
        verticalDistance = distanceLeftLeft;
      }

      //  |‾‾‾‾‾‾‾‾‾‾‾|
      //  |     A     |
      //  |___________|
      //              |
      //              |
      //  |‾‾‾‾‾‾‾‾‾‾‾|
      //  |     B     |
      //  |___________|
      const distanceRightRight = Math.abs(
        nodeABounds.right - nodeBBounds.right
      );

      if (distanceRightRight < verticalDistance) {
        result.snapPosition.x = nodeBBounds.right - nodeABounds.width;
        result.vertical = nodeBBounds.right;
        verticalDistance = distanceRightRight;
      }

      //              |‾‾‾‾‾‾‾‾‾‾‾|
      //              |     A     |
      //              |___________|
      //              |
      //              |
      //  |‾‾‾‾‾‾‾‾‾‾‾|
      //  |     B     |
      //  |___________|
      const distanceLeftRight = Math.abs(nodeABounds.left - nodeBBounds.right);

      if (distanceLeftRight < verticalDistance) {
        result.snapPosition.x = nodeBBounds.right;
        result.vertical = nodeBBounds.right;
        verticalDistance = distanceLeftRight;
      }

      //  |‾‾‾‾‾‾‾‾‾‾‾|
      //  |     A     |
      //  |___________|
      //              |
      //              |
      //              |‾‾‾‾‾‾‾‾‾‾‾|
      //              |     B     |
      //              |___________|
      const distanceRightLeft = Math.abs(nodeABounds.right - nodeBBounds.left);

      if (distanceRightLeft < verticalDistance) {
        result.snapPosition.x = nodeBBounds.left - nodeABounds.width;
        result.vertical = nodeBBounds.left;
        verticalDistance = distanceRightLeft;
      }

      //  |‾‾‾‾‾‾‾‾‾‾‾|‾‾‾‾‾|‾‾‾‾‾‾‾‾‾‾‾|
      //  |     A     |     |     B     |
      //  |___________|     |___________|
      const distanceTopTop = Math.abs(nodeABounds.top - nodeBBounds.top);

      if (distanceTopTop < horizontalDistance) {
        result.snapPosition.y = nodeBBounds.top;
        result.horizontal = nodeBBounds.top;
        horizontalDistance = distanceTopTop;
      }

      //  |‾‾‾‾‾‾‾‾‾‾‾|
      //  |     A     |
      //  |___________|_________________
      //                    |           |
      //                    |     B     |
      //                    |___________|
      const distanceBottomTop = Math.abs(nodeABounds.bottom - nodeBBounds.top);

      if (distanceBottomTop < horizontalDistance) {
        result.snapPosition.y = nodeBBounds.top - nodeABounds.height;
        result.horizontal = nodeBBounds.top;
        horizontalDistance = distanceBottomTop;
      }

      //  |‾‾‾‾‾‾‾‾‾‾‾|     |‾‾‾‾‾‾‾‾‾‾‾|
      //  |     A     |     |     B     |
      //  |___________|_____|___________|
      const distanceBottomBottom = Math.abs(
        nodeABounds.bottom - nodeBBounds.bottom
      );

      if (distanceBottomBottom < horizontalDistance) {
        result.snapPosition.y = nodeBBounds.bottom - nodeABounds.height;
        result.horizontal = nodeBBounds.bottom;
        horizontalDistance = distanceBottomBottom;
      }

      //                    |‾‾‾‾‾‾‾‾‾‾‾|
      //                    |     B     |
      //                    |           |
      //  |‾‾‾‾‾‾‾‾‾‾‾|‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾
      //  |     A     |
      //  |___________|
      const distanceTopBottom = Math.abs(nodeABounds.top - nodeBBounds.bottom);

      if (distanceTopBottom < horizontalDistance) {
        result.snapPosition.y = nodeBBounds.bottom;
        result.horizontal = nodeBBounds.bottom;
        horizontalDistance = distanceTopBottom;
      }

      return result;
    }, defaultResult);
}

export function repo2ipynb(nodesMap, codeMap, resultMap, repoId, repoName) {
  const nodes = Array.from<Node>(nodesMap.values());

  // Hard-code Jupyter cell format. Reference, https://nbformat.readthedocs.io/en/latest/format_description.html
  let jupyterCellList: {
    cell_type: string;
    execution_count?: number;
    metadata: object;
    source: string[];
    outputs?: object[];
  }[] = [];

  // 1. iteratively retrieve and sort all pods level by level
  // Queue to sort the pods geographically
  let q = new Array<[Node | undefined, string]>();
  // adjacency list for podId -> parentId mapping
  let adj = {};
  q.push([undefined, "0.0"]);
  while (q.length > 0) {
    let [curPod, curScore] = q.shift()!;
    let children: string[] = [];
    if (curScore === "0.0") {
      // fetch top-level nodes
      children = nodes.filter((n) => !n.parentId).map((node) => node.id);
    } else {
      children = nodes
        .filter((n) => n.parentId === curPod?.id)
        .map((n) => n.id);
    }

    // sort the pods geographically(top-down, left-right)
    sortNodes(children, nodesMap);

    children.forEach((id, index) => {
      const pod = nodesMap.get(id)!;
      let geoScore = `${curScore}${index + 1}`;
      adj[pod.id] = {
        name: pod.data.name,
        parentId: pod.parentNode || "ROOT",
      };
      switch (pod.type) {
        case "SCOPE":
          q.push([
            pod,
            geoScore.substring(0, geoScore.length - 1) +
              "0" +
              geoScore.substring(geoScore.length - 1),
          ]);
          break;
        case "CODE":
          jupyterCellList.push({
            cell_type: "code",
            // TODO: expand other Codepod related-metadata fields, or run a real-time search in database when importing.
            metadata: { id: pod.id, geoScore: Number(geoScore) },
            source: [],
          });
          break;
        case "RICH":
          jupyterCellList.push({
            cell_type: "markdown",
            // TODO: expand other Codepod related-metadata fields, or run a real-time search in database when importing.
            metadata: { id: pod.id, geoScore: Number(geoScore) },
            source: ["TODO"], // [pod.richContent || ""],
          });
          break;
      }
    });
  }

  // sort the generated cells by their geoScore
  jupyterCellList.sort((cell1, cell2) => {
    if (
      Number(cell1.metadata["geoScore"]) < Number(cell2.metadata["geoScore"])
    ) {
      return -1;
    } else {
      return 1;
    }
  });

  // 2. fill in the sources and outputs for sorted cell lists
  jupyterCellList.forEach((pod) => {
    // generate the scope structure as comment for each cell
    let scopes: string[] = [];
    let parentId = adj[pod.metadata["id"]].parentId;

    // iterative {parentId,name} retrieval
    while (parentId && parentId != "ROOT") {
      scopes.push(adj[parentId].name);
      parentId = adj[parentId].parentId;
    }

    // Add scope structure as a block comment at the head of each cell
    // FIXME, RICH pod should have a different format
    let scopeStructureAsComment =
      scopes.length > 0
        ? [
            "'''\n",
            `CodePod Scope structure: ${scopes.reverse().join("/")}\n`,
            "'''\n",
          ]
        : [""];
    switch (pod.cell_type) {
      case "code":
        const result = resultMap.get(pod.metadata["id"]);
        let podOutput: any[] = [];
        for (const item of result?.data || []) {
          switch (item.type) {
            case "execute_result":
              podOutput.push({
                output_type: item.type,
                data: {
                  "text/plain": (item.text || "")
                    .split(/\r?\n/)
                    .map((line) => line + "\n") || [""],
                  "text/html": (item.html || "")
                    .split(/\r?\n/)
                    .map((line) => line + "\n") || [""],
                },
                execution_count: result!.exec_count,
              });
              break;
            case "display_data":
              podOutput.push({
                output_type: item.type,
                data: {
                  "text/plain": (item.text || "")
                    .split(/\r?\n/)
                    .map((line) => line + "\n") || [""],
                  "text/html": (item.html || "")
                    .split(/\r?\n/)
                    .map((line) => line + "\n") || [""],
                  "image/png": item.image,
                },
              });
              break;
            case "stream_stdout":
              podOutput.push({
                output_type: "stream",
                name: "stdout",
                text: (item.text || "")
                  .split(/\r?\n/)
                  .map((line) => line + "\n"),
              });
              break;
            case "stream_stderr":
              podOutput.push({
                output_type: "stream",
                name: "stderr",
                text: (item.text || "")
                  .split(/\r?\n/)
                  .map((line) => line + "\n"),
              });
              break;
            default:
              break;
          }
        }
        const error = result?.error;
        if (error) {
          podOutput.push({
            output_type: "error",
            ename: error.ename,
            evalue: error.evalue,
            traceback: error.stacktrace,
          });
        }

        const contentArray =
          codeMap
            .get(pod.metadata["id"])
            ?.toString()
            .split(/\r?\n/)
            .map((line) => line + "\n") || [];
        pod.source = [...scopeStructureAsComment, ...contentArray];
        pod.outputs = podOutput;
        pod.execution_count = result?.exec_count;
        break;
      case "markdown":
        pod.source = [...scopeStructureAsComment, "TODO"];
        break;
      default:
        break;
    }
  });

  // 3. produce the final .ipynb file
  const fileContent = JSON.stringify(
    {
      // hard-code Jupyter Notebook top-level metadata
      metadata: {
        name: repoName,
        kernelspec: {
          name: "python3",
          display_name: "Python 3",
        },
        language_info: { name: "python" },
        Codepod_version: "v0.0.1",
        Codepod_repo_id: `${repoId}`,
      },
      nbformat: 4.0,
      nbformat_minor: 0,
      cells: jupyterCellList,
    },
    null,
    4
  );

  return fileContent;
}

// Ref: https://github.com/radix-ui/primitives/discussions/1830#discussioncomment-10300947
export function ConfirmedDelete({
  color,
  onSelect,
  trigger,
  title,
  description,
  confirm,
}) {
  const ref = useRef<HTMLButtonElement>(null);

  return (
    <Dialog.Root>
      {/* Try 3 (which works):  use a ref and trigger the click on the inner from the outer. */}
      <DropdownMenu.Item
        color={color}
        onSelect={(e) => {
          e.preventDefault();
          ref?.current?.click();
        }}
      >
        <Dialog.Trigger
          ref={ref}
          style={{
            display: "none",
          }}
        >
          <div></div>
        </Dialog.Trigger>
        {trigger}
      </DropdownMenu.Item>

      <Dialog.Content maxWidth="450px">
        <Dialog.Title size="3">{title}</Dialog.Title>
        <Dialog.Description size="2" mb="4">
          {description}
        </Dialog.Description>

        <Flex gap="3" mt="4" justify="end">
          <Dialog.Close>
            <Button variant="soft" color="gray">
              Cancel
            </Button>
          </Dialog.Close>
          <Dialog.Close>
            <DropdownMenu.Item color={color} onSelect={onSelect}>
              {confirm}
            </DropdownMenu.Item>
          </Dialog.Close>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}

export const SymbolTable = memo(function SymbolTable({ id }: { id: string }) {
  const privateSt = useAtomValue(getOrCreate_ATOM_privateST(id));
  const publicSt = useAtomValue(getOrCreate_ATOM_publicST(id));
  const selfSt = useAtomValue(getOrCreate_ATOM_selfST(id));
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
        }}
        direction={"column"}
        gap="4"
        wrap="wrap"
      >
        {[...selfSt.keys()].map((key) => (
          <Flex align="center" key={key}>
            <code
              style={{
                fontSize: "2.5em",
                color: "black",
                // lineHeight: "var(--line-height-1)",
                // lineHeight: "10px",
                lineHeight: "0.5em",
                // do not wrap
                whiteSpace: "nowrap",
              }}
            >
              {key}
            </code>
          </Flex>
        ))}
      </Flex>
      {/* LEFT: show public ST of this scope. */}
      <Box
        style={{
          // place it on the left
          position: "absolute",
          top: 0,
          left: 0,
          transform: "translateX(-100%) translateX(-10px)",
        }}
      >
        {[...publicSt.keys()].map((key) => (
          <Flex align="center" key={key}>
            <Button
              onClick={() => {
                // jump to the node
                const targetId = publicSt.get(key);
                myassert(targetId);
                const targetNode = nodesMap.get(targetId);
                if (!targetNode) return;
                const pos = getAbsPos(targetNode, nodesMap);
                reactFlowInstance.setCenter(
                  pos.x + (targetNode.measured?.width || 0) / 2,
                  pos.y + (targetNode.measured?.height || 0) / 2,
                  {
                    zoom: reactFlowInstance.getZoom(),
                    duration: 800,
                  }
                );
              }}
              variant="ghost"
            >
              <code
                style={{
                  color: "green",
                }}
              >
                {key}
              </code>
            </Button>
          </Flex>
        ))}
      </Box>

      {/* RIGHT: show private ST of this scope. */}
      <Box
        style={{
          // place it on the right
          position: "absolute",
          top: 0,
          right: 0,
          transform: "translateX(100%) translateX(10px)",
        }}
      >
        {[...privateSt.keys()].map((key) => (
          <Flex align="center" key={key}>
            <Button
              onClick={() => {
                // jump to the node
                const targetId = privateSt.get(key)!;
                const targetNode = nodesMap.get(targetId);
                if (!targetNode) return;
                const pos = getAbsPos(targetNode, nodesMap);
                reactFlowInstance.setCenter(
                  pos.x + (targetNode.measured?.width || 0) / 2,
                  pos.y + (targetNode.measured?.height || 0) / 2,
                  {
                    zoom: reactFlowInstance.getZoom(),
                    duration: 800,
                  }
                );
              }}
              variant="ghost"
            >
              <code>{key}</code>
            </Button>
          </Flex>
        ))}
      </Box>
    </>
  );
});
