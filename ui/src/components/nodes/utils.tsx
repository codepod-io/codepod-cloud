import {
  Position,
  internalsSymbol,
  Node,
  NodePositionChange,
  XYPosition,
  Handle,
  useReactFlow,
} from "reactflow";

import { useContext, useRef, useState } from "react";

import {
  ChevronLeft,
  ScissorsLineDashed,
  Trash,
  Trash2,
  CalendarArrowUp,
  Wrench,
} from "lucide-react";
import { match, P } from "ts-pattern";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  ATOM_moveCut,
  ATOM_raise,
  ATOM_slurp,
  ATOM_splice,
  ATOM_toggleFold,
  ATOM_toggleScope,
  getAbsPos,
} from "@/lib/store/canvasSlice";
import { ATOM_nodesMap } from "@/lib/store/yjsSlice";

import juliaLogo from "@/assets/julia.svg";
import pythonLogo from "@/assets/python.svg";
import javascriptLogo from "@/assets/javascript.svg";
import racketLogo from "@/assets/racket.svg";

import { NotebookPen, Clipboard } from "lucide-react";

import { ATOM_addNode } from "@/lib/store/canvasSlice";
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
  getOrCreate_ATOM_utilityST,
} from "@/lib/store/runtimeSlice";

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

// returns the position (top,right,bottom or right) passed node compared to
function getParams(nodeA, nodeB) {
  const centerA = getNodeCenter(nodeA);
  const centerB = getNodeCenter(nodeB);

  const horizontalDiff = Math.abs(centerA.x - centerB.x);
  const verticalDiff = Math.abs(centerA.y - centerB.y);

  let position;

  // when the horizontal difference between the nodes is bigger, we use Position.Left or Position.Right for the handle
  // if (horizontalDiff > verticalDiff) {
  //   position = centerA.x > centerB.x ? Position.Left : Position.Right;
  // } else {
  //   // here the vertical difference between the nodes is bigger, so we use Position.Top or Position.Bottom for the handle
  //   position = centerA.y > centerB.y ? Position.Top : Position.Bottom;
  // }

  // UPDATE: In switching to mindmap/tidy-tree layout, we always use left/right.
  // Do not use top-bottom.

  position = centerA.x > centerB.x ? Position.Left : Position.Right;

  const [x, y] = getHandleCoordsByPosition(nodeA, position);
  return [x, y, position];
}

export function sortNodes(nodeIds, nodesMap) {
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

function getHandleCoordsByPosition(node, handlePosition) {
  // all handles are from type source, that's why we use handleBounds.source here
  const handle = node[internalsSymbol].handleBounds.source.find(
    (h) => h.position === handlePosition
  );

  let offsetX = handle.width / 2;
  let offsetY = handle.height / 2;

  // this is a tiny detail to make the markerEnd of an edge visible.
  // The handle position that gets calculated has the origin top-left, so depending which side we are using, we add a little offset
  // when the handlePosition is Position.Right for example, we need to add an offset as big as the handle itself in order to get the correct position
  switch (handlePosition) {
    case Position.Left:
      offsetX = 0;
      break;
    case Position.Right:
      offsetX = handle.width;
      break;
    case Position.Top:
      offsetY = 0;
      break;
    case Position.Bottom:
      offsetY = handle.height;
      break;
  }

  const x = node.positionAbsolute.x + handle.x + offsetX;
  const y = node.positionAbsolute.y + handle.y + offsetY;

  return [x, y];
}

function getNodeCenter(node) {
  return {
    x: node.positionAbsolute.x + node.width / 2,
    y: node.positionAbsolute.y + node.height / 2,
  };
}

// returns the parameters (sx, sy, tx, ty, sourcePos, targetPos) you need to create an edge
export function getEdgeParams(source, target) {
  const [sx, sy, sourcePos] = getParams(source, target);
  const [tx, ty, targetPos] = getParams(target, source);

  return {
    sx,
    sy,
    tx,
    ty,
    sourcePos,
    targetPos,
  };
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

export const Handles = ({ id, hover }) => {
  const toggleFold = useSetAtom(ATOM_toggleFold);
  const [nodesMap] = useAtom(ATOM_nodesMap);

  const node = nodesMap.get(id);
  if (!node) return null;

  let status: "DEFAULT" | "FOLDED" | "EMPTY" = "DEFAULT";

  if (node.data.children.length > 0 && node.data.folded) status = "FOLDED";
  if (node.data.children.length === 0) status = "EMPTY";
  const variants = match({ status, hover })
    // case 1: the subtree is non-empty and folded. Show the count of children.
    .with({ status: "FOLDED" }, () => ({
      content: node.data.children.length,
      style: {
        borderColor: "red",
        backgroundColor: "white",
      },
    }))
    // case 2: the subtree is empty. No visual effect no matter the mouse is hovering or not.
    .with({ status: "EMPTY" }, () => ({
      content: "",
      style: {
        borderColor: "lightgray",
        backgroundColor: "white",
      },
    }))
    // case 3: the subtree is unfolded, and the mouse is hovering over the pod. Add some visual highlight.
    .with({ status: "DEFAULT", hover: true }, () => ({
      content: <ChevronLeft />,
      style: {
        borderColor: "red",
        backgroundColor: "white",
      },
    }))
    // case 4: the mouse is not hovering, no special visual effect.
    .otherwise(() => ({
      content: "",
      style: {
        borderColor: "lightgray",
        backgroundColor: "white",
      },
    }));
  return (
    <>
      <Handle id="left" type="source" position={Position.Left} />
      <Handle
        id="right"
        type="source"
        position={Position.Right}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",

          textAlign: "center",
          width: "20px",
          height: "20px",
          right: "-10px",
          color: "red",
          ...variants.style,
        }}
        onClick={() => {
          if (node.data.children.length > 0) {
            toggleFold(id);
          }
        }}
      >
        {variants.content}
      </Handle>
    </>
  );
};

export function downloadLink(dataUrl, fileName) {
  let element = document.createElement("a");
  element.setAttribute("href", dataUrl);
  element.setAttribute("download", fileName);

  element.style.display = "none";
  document.body.appendChild(element);
  element.click();
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
      children = nodes.filter((n) => !n.parentNode).map((node) => node.id);
    } else {
      children = nodes
        .filter((n) => n.parentNode === curPod?.id)
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

export function ToolbarAddPod({
  id,
  position,
  cb = () => {},
}: {
  id: string;
  position: "left" | "top" | "bottom" | "right";
  cb: () => void;
}) {
  const addNode = useSetAtom(ATOM_addNode);
  const cutId = useAtomValue(ATOM_cutId);
  const moveCut = useSetAtom(ATOM_moveCut);
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        <Button
          variant="ghost"
          radius="small"
          style={{
            margin: 3,
            padding: 0,
          }}
        >
          {match(position)
            .with("top", () => <img src={rowInsertTop} />)
            .with("bottom", () => (
              <img
                src={rowInsertTop}
                style={{
                  // rotate 180deg
                  transform: "rotate(180deg)",
                }}
              />
            ))
            .with("right", () => (
              <img
                src={rowInsertTop}
                // rotate 90deg
                style={{ transform: "rotate(90deg)" }}
              />
            ))
            .with("left", () => (
              <img
                src={rowInsertTop}
                // rotate -90deg
                style={{ transform: "rotate(-90deg)" }}
              />
            ))
            .exhaustive()}
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content variant="soft">
        <DropdownMenu.Item
          shortcut="⌘ D"
          onClick={() => {
            addNode(id, position, "RICH");
            cb();
          }}
        >
          <NotebookPen /> Doc
        </DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Item
          shortcut="⌘ E"
          onClick={() => {
            addNode(id, position, "CODE", "python");
            cb();
          }}
        >
          <img
            src={pythonLogo}
            style={{
              height: "1.5em",
            }}
          />{" "}
          Python
        </DropdownMenu.Item>
        <DropdownMenu.Item
          shortcut="⌘ E"
          onClick={() => {
            addNode(id, position, "CODE", "julia");
            cb();
          }}
        >
          <img
            src={juliaLogo}
            style={{
              height: "1.5em",
            }}
          />{" "}
          Julia
        </DropdownMenu.Item>

        <DropdownMenu.Item
          shortcut="⌘ E"
          onClick={() => {
            addNode(id, position, "CODE", "javascript");
            cb();
          }}
        >
          <img
            src={javascriptLogo}
            style={{
              height: "1.5em",
            }}
          />{" "}
          JavaScript
        </DropdownMenu.Item>

        <DropdownMenu.Item
          shortcut="⌘ E"
          onClick={() => {
            addNode(id, position, "CODE", "racket");
            cb();
          }}
        >
          <img
            src={racketLogo}
            style={{
              height: "1.5em",
            }}
          />{" "}
          Racket
        </DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Item
          onClick={() => {
            // addNode(id, position, "CODE", "racket");
            if (position === "left") throw new Error("Cannot paste to left.");
            moveCut(id, position);
          }}
          disabled={!cutId || cutId === id || position === "left"}
          color="orange"
        >
          <Clipboard />
          Paste
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}

export function PodToolbar({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const [hover, setHover] = useState(false);
  const [cutId, setCutId] = useAtom(ATOM_cutId);

  const nodesMap = useAtomValue(ATOM_nodesMap);
  const node = nodesMap.get(id);
  if (!node) throw new Error(`Node ${id} not found.`);

  const toggleScope = useSetAtom(ATOM_toggleScope);

  return (
    <motion.div
      animate={{
        opacity: hover ? 1 : 0,
      }}
      onMouseEnter={() => {
        setHover(true);
      }}
      onMouseLeave={() => {
        setHover(false);
      }}
    >
      <Flex
        align="center"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          // border: "solid 1px var(--gray-8)",
          transform: "translateY(-120%)",
          backgroundColor: "white",
          borderRadius: "5px",
          boxShadow: "0 0 10px rgba(0,0,0,0.2)",
          cursor: "auto",
        }}
      >
        {/* scope switch */}
        <Tooltip content="Scope">
          <Switch
            checked={node.data.isScope}
            onClick={() => {
              console.log("toggle scope", id);
              toggleScope(id);
            }}
          />
        </Tooltip>
        {/* Toolbar for adding new pod top/bottom/right */}
        {id !== "ROOT" && (
          <ToolbarAddPod
            id={id}
            position="left"
            cb={() => {
              setHover(false);
            }}
          />
        )}
        {id !== "ROOT" && (
          <ToolbarAddPod
            id={id}
            position="top"
            cb={() => {
              setHover(false);
            }}
          />
        )}
        {id !== "ROOT" && (
          <ToolbarAddPod
            id={id}
            position="bottom"
            cb={() => {
              setHover(false);
            }}
          />
        )}
        <ToolbarAddPod
          id={id}
          position="right"
          cb={() => {
            setHover(false);
          }}
        />
        {id !== "ROOT" && (
          <IconButton
            variant="ghost"
            radius="small"
            style={{
              margin: 3,
              padding: 0,
            }}
            onClick={() => {
              if (cutId === id) {
                setCutId(null);
              } else {
                setCutId(id);
              }
            }}
          >
            <ScissorsLineDashed />
          </IconButton>
        )}
        {children}
      </Flex>
    </motion.div>
  );
}

export function RaiseButton({ id }) {
  const raise = useSetAtom(ATOM_raise);
  return (
    <DropdownMenu.Item
      onClick={() => {
        // replace the parent with the current pod.
        raise(id);
      }}
    >
      <img src={ArrowLeftToLine} />
      Raise
    </DropdownMenu.Item>
  );
}

export function SlurpButton({ id }) {
  const slurp = useSetAtom(ATOM_slurp);
  return (
    <DropdownMenu.Item
      onClick={() => {
        // move its next sibling to its children
        slurp(id);
      }}
    >
      <CalendarArrowUp />
      Slurp
    </DropdownMenu.Item>
  );
}

// Ref: https://github.com/radix-ui/primitives/discussions/1830#discussioncomment-10300947
function ConfirmedDelete({
  color,
  onClick,
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
        onClick={(e) => {
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
            <DropdownMenu.Item color={color} onClick={onClick}>
              {confirm}
            </DropdownMenu.Item>
          </Dialog.Close>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}

export function SpliceButton({ id }) {
  const ref = useRef<HTMLButtonElement>(null);
  const splice = useSetAtom(ATOM_splice);
  return (
    <ConfirmedDelete
      color="orange"
      onClick={() => {
        // remove this pod, place its parent in place of it.
        splice(id);
      }}
      trigger={
        <>
          <Trash /> Delete Pod
        </>
      }
      title="This will delete this pod."
      description="The children will be spliced into the place of this pod. Continue?"
      confirm="Delete Pod"
    />
  );
}

export function DeleteButton({ id }) {
  const ref = useRef<HTMLButtonElement>(null);
  const reactFlowInstance = useReactFlow();
  return (
    <ConfirmedDelete
      color="red"
      onClick={() => {
        // Delete all edges connected to the node.
        reactFlowInstance.deleteElements({ nodes: [{ id }] });
      }}
      trigger={
        <>
          <Trash2 color="red" /> Delete Tree
        </>
      }
      title="This will delete the entire subtree."
      description="Continue?"
      confirm="Delete"
    />
  );
}

export function SymbolTable({ id }) {
  const privateSt = useAtomValue(getOrCreate_ATOM_privateST(id));
  const publicSt = useAtomValue(getOrCreate_ATOM_publicST(id));
  const utilitySt = useAtomValue(getOrCreate_ATOM_utilityST(id));
  const nodesMap = useAtomValue(ATOM_nodesMap);
  const node = nodesMap.get(id);
  if (!node) throw new Error(`Node ${id} not found.`);
  const reactFlowInstance = useReactFlow();
  return (
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
                pos.x + targetNode.width! / 2,
                pos.y + targetNode.height! / 2,
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
                color: publicSt.has(key) ? "green" : "black",
              }}
            >
              {key}
            </code>
          </Button>
          {utilitySt.has(key) ? <Wrench /> : ""}
        </Flex>
      ))}
    </Box>
  );
}
