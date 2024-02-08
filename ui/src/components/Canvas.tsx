import {
  useCallback,
  useState,
  useRef,
  useContext,
  useEffect,
  memo,
  ChangeEvent,
} from "react";
import * as React from "react";
import ReactFlow, {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  BackgroundVariant,
  MiniMap,
  Controls,
  Handle,
  useReactFlow,
  Position,
  ConnectionMode,
  MarkerType,
  Node,
  ReactFlowProvider,
  Edge,
  useViewport,
  XYPosition,
  useStore as useRfStore,
  useKeyPress,
  SelectionMode,
} from "reactflow";
import "reactflow/dist/style.css";

import Box from "@mui/material/Box";

import { useStore } from "zustand";
import * as Y from "yjs";

import { timer } from "d3-timer";

import { RepoContext } from "@/lib/store";

import { ShareProjDialog } from "./ShareProjDialog";
import { RichNode } from "./nodes/Rich";
import { CodeNode } from "./nodes/Code";
import { ScopeNode } from "./nodes/Scope";
import FloatingEdge from "./nodes/FloatingEdge";
import CustomConnectionLine from "./nodes/CustomConnectionLine";
import HelperLines from "./HelperLines";
import { getAbsPos, newNodeShapeConfig } from "@/lib/store/canvasSlice";
import { runtimeTrpc, trpc } from "@/lib/trpc";
import { ListItemIcon, ListItemText, MenuItem, MenuList } from "@mui/material";
import FileUploadTwoToneIcon from "@mui/icons-material/FileUploadTwoTone";
import { debounce } from "lodash";
import { Button, DropdownMenu } from "@radix-ui/themes";

const TempNode = () => {
  return (
    <div
      style={{
        width: "100px",
        height: "100px",
        borderRadius: "50%",
        transform: "translate(-50%, -50%)",
        backgroundColor: "orange",
        opacity: 0.5,
      }}
    ></div>
  );
};

const nodeTypes = {
  SCOPE: ScopeNode,
  CODE: CodeNode,
  RICH: RichNode,
  TEMP: TempNode,
};

const edgeTypes = {
  floating: FloatingEdge,
};

function getBestNode(
  nodes: Node[],
  from,
  direction: "up" | "down" | "left" | "right"
) {
  // find the best node to jump to from (x,y) in the given direction
  let bestNode: Node | null = null;
  let bestDistance = Infinity;
  nodes = nodes.filter((node) => {
    switch (direction) {
      case "up":
        return (
          node.position.y + node.height! / 2 <
          from.position.y + from.height! / 2
        );
      case "down":
        return (
          node.position.y + node.height! / 2 >
          from.position.y + from.height! / 2
        );
      case "left":
        return (
          node.position.x + node.width! / 2 < from.position.x + from.width! / 2
        );
      case "right":
        return (
          node.position.x + node.width! / 2 > from.position.x + from.width! / 2
        );
    }
  });
  for (let node of nodes) {
    // I should start from the edge, instead of the center
    const startPoint: XYPosition = (() => {
      // the center
      // return {
      //   x: from.position.x + from.width! / 2,
      //   y: from.position.y + from.height! / 2,
      // };
      // the edge depending on direction.
      switch (direction) {
        case "up":
          return {
            x: from.position.x + from.width! / 2,
            y: from.position.y,
          };
        case "down":
          return {
            x: from.position.x + from.width! / 2,
            y: from.position.y + from.height!,
          };
        case "left":
          return {
            x: from.position.x,
            y: from.position.y + from.height! / 2,
          };
        case "right":
          return {
            x: from.position.x + from.width!,
            y: from.position.y + from.height! / 2,
          };
      }
    })();
    let distance =
      Math.pow(node.position.x + node.width! / 2 - startPoint.x, 2) *
        (["left", "right"].includes(direction) ? 1 : 2) +
      Math.pow(node.position.y + node.height! / 2 - startPoint.y, 2) *
        (["up", "down"].includes(direction) ? 1 : 2);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestNode = node;
    }
  }
  return bestNode;
}
function isInputDOMNode(event: KeyboardEvent): boolean {
  const target = (event.composedPath?.()?.[0] || event.target) as HTMLElement;
  const isInput =
    ["INPUT", "SELECT", "TEXTAREA"].includes(target?.nodeName) ||
    target?.hasAttribute("contenteditable");
  return isInput;
}
function useJump() {
  const store = useContext(RepoContext)!;

  const setFocusedEditor = useStore(store, (state) => state.setFocusedEditor);

  const nodesMap = useStore(store, (state) => state.getNodesMap());

  const selectedPods = useStore(store, (state) => state.selectedPods);
  const resetSelection = useStore(store, (state) => state.resetSelection);
  const selectPod = useStore(store, (state) => state.selectPod);

  const preprocessChain = useStore(store, (state) => state.preprocessChain);
  const getScopeChain = useStore(store, (state) => state.getScopeChain);

  const runChain = runtimeTrpc.kernel.runChain.useMutation();
  const activeRuntime = useStore(store, (state) => state.activeRuntime);

  const setCenterSelection = useStore(
    store,
    (state) => state.setCenterSelection
  );

  const handleKeyDown = (event) => {
    // This is a hack to address the extra propagation of "Esc" pressed in Rich node, https://github.com/codepod-io/codepod/pull/398#issuecomment-1655153696
    if (isInputDOMNode(event)) return false;
    // Only handle the arrow keys.
    switch (event.key) {
      case "ArrowUp":
      case "ArrowDown":
      case "ArrowLeft":
      case "ArrowRight":
      case "Enter":
        break;
      default:
        return;
    }
    // Get the current cursor node.
    const id = selectedPods.values().next().value; // Assuming only one node can be selected at a time
    if (!id) {
      console.log("No node selected");
      return; // Ignore arrow key presses if there's no selected node or if the user is typing in an input field
    }
    const pod = nodesMap.get(id);
    if (!pod) {
      console.log("pod is undefined");
      return;
    }

    // get the sibling nodes
    const siblings = Array.from<Node>(nodesMap.values()).filter(
      (node) => node.parentNode === pod.parentNode
    );
    const children = Array.from<Node>(nodesMap.values()).filter(
      (node) => node.parentNode === id
    );

    let to: null | Node = null;

    switch (event.key) {
      case "ArrowUp":
        if (event.shiftKey) {
          if (pod.parentNode) {
            to = nodesMap.get(pod.parentNode)!;
          } else {
            to = pod;
          }
        } else {
          to = getBestNode(siblings, pod, "up");
        }
        break;
      case "ArrowDown":
        if (event.shiftKey) {
          if (pod.type === "SCOPE") {
            to = pod;
            let minDist = Math.sqrt(
              (pod.height || 1) ** 2 + (pod.width || 1) ** 2
            );
            let childDist = 0;
            for (const child of children) {
              childDist = Math.sqrt(
                nodesMap.get(child.id)!.position.x ** 2 +
                  nodesMap.get(child.id)!.position.y ** 2
              );
              if (minDist > childDist) {
                minDist = childDist;
                to = nodesMap.get(child.id)!;
              }
            }
          } else {
            to = pod;
          }
        } else {
          to = getBestNode(siblings, pod, "down");
        }
        break;
      case "ArrowLeft":
        to = getBestNode(siblings, pod, "left");
        break;
      case "ArrowRight":
        to = getBestNode(siblings, pod, "right");
        break;
      case "Enter":
        if (pod.type == "CODE") {
          if (event.shiftKey) {
            // Hitting "SHIFT"+"Enter" will run the code pod
            if (activeRuntime) {
              const specs = preprocessChain([id]);
              if (specs) runChain.mutate({ runtimeId: activeRuntime, specs });
            }
          } else {
            // Hitting "Enter" on a Code pod will go to "Edit" mode.
            setFocusedEditor(id);
          }
        } else if (pod.type === "SCOPE") {
          if (event.shiftKey) {
            // Hitting "SHIFT"+"Enter" on a Scope will run the scope.
            if (activeRuntime) {
              const chain = getScopeChain(id);
              const specs = preprocessChain(chain);
              if (specs) runChain.mutate({ runtimeId: activeRuntime, specs });
            }
          }
        } else if (pod.type === "RICH") {
          // Hitting "Enter" on a Rich pod will go to "Edit" mode.
          setFocusedEditor(id);
        }
        break;
      default:
        return;
    }

    if (to) {
      resetSelection();
      selectPod(to.id, true);
      setCenterSelection(true);
    }

    event.preventDefault(); // Prevent default browser behavior for arrow keys
  };

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedPods]);
}

function useAddNode(reactFlowWrapper) {
  const store = useContext(RepoContext)!;
  const isAddingNode = useStore(store, (state) => state.isAddingNode);
  const setIsAddingNode = useStore(store, (state) => state.setIsAddingNode);
  const updateView = useStore(store, (state) => state.updateView);
  const updateView_addNode = useStore(
    store,
    (state) => state.updateView_addNode
  );
  const setMousePosition = useStore(store, (state) => state.setMousePosition);
  const getInsertPosition = useStore(store, (state) => state.getInsertPosition);

  const reactFlowInstance = useReactFlow();
  const addNodeAtAnchor = useStore(store, (state) => state.addNodeAtAnchor);

  // cancel when ESC is pressed
  const escapePressed = useKeyPress("Escape");
  useEffect(() => {
    if (escapePressed) {
      console.log("escape pressed");
      setIsAddingNode(false);
      updateView();
    }
  }, [escapePressed]);

  // when add node mode activated
  // 1. there is a node moving with the mouse.
  // 2. We calculate the desired position to insert the node in the tree
  //    hierarchy, and show it on the canvas.
  // 3. when the user clicks, we insert the node in the tree hierarchy.

  useEffect(() => {
    if (!reactFlowWrapper) return;
    if (!isAddingNode) return;
    const mouseMove = (event) => {
      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = reactFlowInstance.project({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });
      // show the node on the canvas
      setMousePosition(position);
      getInsertPosition();
      updateView_addNode();
    };
    const debouncedMouseMove = debounce(mouseMove, 1);
    const mouseClick = (event) => {
      // insert the node in the tree hierarchy
      addNodeAtAnchor("CODE");
      setIsAddingNode(false);
      updateView();
    };

    reactFlowWrapper.current.addEventListener("mousemove", debouncedMouseMove);
    reactFlowWrapper.current.addEventListener("click", mouseClick);
    return () => {
      reactFlowWrapper.current.removeEventListener(
        "mousemove",
        debouncedMouseMove
      );
      reactFlowWrapper.current.removeEventListener("click", mouseClick);
    };
  }, [isAddingNode, reactFlowWrapper]);
}

export function useCopyPaste() {
  const store = useContext(RepoContext)!;
  const rfDomNode = useRfStore((state) => state.domNode);
  const reactFlowInstance = useReactFlow();
  const handleCopy = useStore(store, (state) => state.handleCopy);
  const handlePaste = useStore(store, (state) => state.handlePaste);

  const posRef = useRef<XYPosition>({ x: 0, y: 0 });
  useEffect(() => {
    if (rfDomNode) {
      const onMouseMove = (event: MouseEvent) => {
        const bounds = rfDomNode.getBoundingClientRect();
        const position = reactFlowInstance.project({
          x: event.clientX - (bounds?.left ?? 0),
          y: event.clientY - (bounds?.top ?? 0),
        });
        posRef.current = position;
      };

      rfDomNode.addEventListener("mousemove", onMouseMove);

      return () => {
        rfDomNode.removeEventListener("mousemove", onMouseMove);
      };
    }
  }, [rfDomNode]);

  const paste = useCallback(
    (event) => {
      handlePaste(event, posRef.current);
    },
    [handlePaste, posRef]
  );

  // bind copy/paste events
  useEffect(() => {
    if (!rfDomNode) return;
    document.addEventListener("copy", handleCopy);
    document.addEventListener("paste", paste);

    return () => {
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("paste", paste);
    };
  }, [handleCopy, handlePaste, rfDomNode]);
}

/**
 * The ReactFlow instance keeps re-rendering when nodes change. Thus, we're
 * using this wrapper component to load the useXXX functions only once.
 */
function CanvasImplWrap() {
  useCopyPaste();
  useJump();
  return (
    <Box sx={{ height: "100%" }}>
      <CanvasImpl />
      <ViewportInfo />
    </Box>
  );
}

function ViewportInfo() {
  const store = useContext(RepoContext)!;
  const { x, y, zoom } = useViewport();
  return (
    <Box
      sx={{
        position: "absolute",
        bottom: 0,
        right: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        color: "white",
        padding: 1,
        fontSize: 12,
        borderRadius: 1,
        zIndex: 100,
      }}
    >
      {`x: ${x.toFixed(2)}, y: ${y.toFixed(2)}, zoom: ${zoom.toFixed(2)}`}
    </Box>
  );
}

/**
 * Animate nodes and edges when their positions change.
 */
function useAnimatedNodes(nodes: Node[]) {
  const [tmpNodes, setTmpNodes] = useState(nodes);

  const store = useContext(RepoContext)!;
  // When adding node, set the animation duration to 0 so that the temp node follows mouse.
  const isAddingNode = useStore(store, (state) => state.isAddingNode);
  const animationDuration = isAddingNode ? 0 : 100;

  const { getNode } = useReactFlow();

  useEffect(() => {
    const transitions = nodes.map((node) => ({
      id: node.id,
      from: getNode(node.id)?.position ?? node.position,
      to: node.position,
      node,
    }));

    const t = timer((elapsed) => {
      const s = elapsed / animationDuration;

      const currNodes = transitions.map(({ node, from, to }) => {
        return {
          ...node,
          position: {
            x: from.x + (to.x - from.x) * s,
            y: from.y + (to.y - from.y) * s,
          },
        };
      });

      setTmpNodes(currNodes);

      if (elapsed > animationDuration) {
        // it's important to set the final nodes here to avoid glitches
        setTmpNodes(nodes);
        t.stop();
      }
    });

    return () => t.stop();
  }, [nodes, getNode, animationDuration]);

  return { nodes: tmpNodes };
}

/**
 * The canvas.
 * @returns
 */
function CanvasImpl() {
  const reactFlowWrapper = useRef<any>(null);

  const store = useContext(RepoContext)!;
  useAddNode(reactFlowWrapper);

  const nodes = useStore(store, (state) => state.nodes);

  const { nodes: animatedNodes } = useAnimatedNodes(nodes);
  const edges = useStore(store, (state) => state.edges);
  const nodesMap = useStore(store, (state) => state.getNodesMap());
  const onNodesChange = useStore(store, (state) => state.onNodesChange);
  const setDragHighlight = useStore(store, (state) => state.setDragHighlight);
  const removeDragHighlight = useStore(
    store,
    (state) => state.removeDragHighlight
  );
  const updateView = useStore(store, (state) => state.updateView);
  const autoLayoutROOT = useStore(store, (state) => state.autoLayoutROOT);

  const importLocalCode = useStore(store, (state) => state.importLocalCode);

  const selectedPods = useStore(store, (state) => state.selectedPods);

  const reactFlowInstance = useReactFlow();

  const project = useCallback(
    ({ x, y }) => {
      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      return reactFlowInstance.project({
        x: x - reactFlowBounds.left,
        y: y - reactFlowBounds.top,
      });
    },
    [reactFlowInstance]
  );

  const repoId = useStore(store, (state) => state.repoId);

  const editMode = useStore(store, (state) => state.editMode);

  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  const shareOpen = useStore(store, (state) => state.shareOpen);
  const setShareOpen = useStore(store, (state) => state.setShareOpen);

  const [showContextMenu, setShowContextMenu] = useState(false);
  const [points, setPoints] = useState({ x: 0, y: 0 });
  const [client, setClient] = useState({ x: 0, y: 0 });
  const [parentNode, setParentNode] = useState(undefined);

  const moved = useStore(store, (state) => state.moved);
  const paneClicked = useStore(store, (state) => state.paneClicked);
  const nodeClicked = useStore(store, (state) => state.nodeClicked);

  useEffect(() => {
    setShowContextMenu(false);
  }, [moved, paneClicked, nodeClicked]);
  const escapePressed = useKeyPress("Escape");
  useEffect(() => {
    if (escapePressed) {
      setShowContextMenu(false);
    }
  }, [escapePressed]);

  const centerSelection = useStore(store, (state) => state.centerSelection);
  const setCenterSelection = useStore(
    store,
    (state) => state.setCenterSelection
  );

  useEffect(() => {
    // move the viewport to the to node
    // get the absolute position of the to node
    if (centerSelection && selectedPods.size > 0) {
      const node = selectedPods.values().next().value;
      const pos = getAbsPos(nodesMap.get(node)!, nodesMap);

      reactFlowInstance.setCenter(
        pos.x + nodesMap.get(node)!.width! / 2,
        pos.y + nodesMap.get(node)!.height! / 2,
        {
          zoom: reactFlowInstance.getZoom(),
          duration: 800,
        }
      );
      setCenterSelection(false);
    }
  }, [centerSelection, setCenterSelection]);

  const onPaneContextMenu = (event) => {
    event.preventDefault();
    setShowContextMenu(true);
    setParentNode(undefined);
    setPoints({ x: event.pageX, y: event.pageY });
    setClient({ x: event.clientX, y: event.clientY });
  };

  const onNodeContextMenu = (event, node) => {
    if (node?.type !== "SCOPE") return;

    event.preventDefault();
    setShowContextMenu(true);
    setParentNode(node.id);
    setPoints({ x: event.pageX, y: event.pageY });
    setClient({ x: event.clientX, y: event.clientY });
  };

  const autoRunLayout = useStore(store, (state) => state.autoRunLayout);
  const setAutoLayoutOnce = useStore(store, (state) => state.setAutoLayoutOnce);
  const autoLayoutOnce = useStore(store, (state) => state.autoLayoutOnce);

  const helperLineHorizontal = useStore(
    store,
    (state) => state.helperLineHorizontal
  );
  const helperLineVertical = useStore(
    store,
    (state) => state.helperLineVertical
  );
  const toggleMoved = useStore(store, (state) => state.toggleMoved);
  const togglePaneClicked = useStore(store, (state) => state.togglePaneClicked);
  const toggleNodeClicked = useStore(store, (state) => state.toggleNodeClicked);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleItemClick = () => {
    fileInputRef!.current!.click();
    fileInputRef!.current!.value = "";
  };

  const handleFileInputChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const fileName = e.target.files[0].name;
    console.log("Import Jupyter Notebook or Python scripts: ", fileName);
    const fileReader = new FileReader();
    fileReader.onload = (e) => {
      const fileContent =
        typeof e.target!.result === "string"
          ? e.target!.result
          : Buffer.from(e.target!.result!).toString();
      let cellList: any[] = [];
      let importScopeName = "";
      switch (fileName.split(".").pop()) {
        case "ipynb":
          cellList = JSON.parse(String(fileContent)).cells.map((cell) => ({
            cellType: cell.cell_type,
            cellSource: cell.source.join(""),
            cellOutputs: cell.outputs || [],
            execution_count: cell.execution_count || 0,
          }));
          importScopeName = fileName.substring(0, fileName.length - 6);
          break;
        case "py":
          cellList = [{ cellType: "code", cellSource: String(fileContent) }];
          break;
        default:
          return;
      }

      importLocalCode(
        project({ x: client.x, y: client.y }),
        importScopeName,
        cellList
      );
      setAutoLayoutOnce(true);
    };
    fileReader.readAsText(e.target.files[0], "UTF-8");
  };

  useEffect(() => {
    // A BIG HACK: we run autolayout once at SOME point after ImportLocalCode to
    // let reactflow calculate the height of pods, then layout them properly.
    if (
      autoLayoutOnce &&
      nodes.filter((node) => node.height === newNodeShapeConfig.height)
        .length == 0
    ) {
      autoLayoutROOT();
      setAutoLayoutOnce(false);
    }
  }, [autoLayoutOnce, nodes]);

  return (
    <Box
      style={{
        display: "flex",
        height: "100%",
        flexDirection: "column",
      }}
    >
      <Box sx={{ height: "100%" }} ref={reactFlowWrapper}>
        <ReactFlow
          nodes={animatedNodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onMove={() => {
            toggleMoved();
            // Hide the Rich node drag handle when moving.
            const elems = document.getElementsByClassName("global-drag-handle");
            Array.from(elems).forEach((elem) => {
              (elem as HTMLElement).style.display = "none";
            });
          }}
          onPaneClick={() => {
            togglePaneClicked();
          }}
          onNodeClick={() => {
            toggleNodeClicked();
          }}
          attributionPosition="top-right"
          maxZoom={2}
          minZoom={0.1}
          fitView={true}
          fitViewOptions={{
            maxZoom: 1,
          }}
          onPaneContextMenu={onPaneContextMenu}
          onNodeContextMenu={onNodeContextMenu}
          nodeTypes={nodeTypes}
          // custom edge for easy connect
          edgeTypes={edgeTypes}
          defaultEdgeOptions={{
            style: { strokeWidth: 3, stroke: "black" },
            type: "floating",
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: "black",
            },
          }}
          connectionLineComponent={CustomConnectionLine}
          connectionLineStyle={{
            strokeWidth: 3,
            stroke: "black",
          }}
          // end custom edge

          zoomOnScroll={false}
          panOnScroll={true}
          connectionMode={ConnectionMode.Loose}
          nodesDraggable={editMode === "edit"}
          // disable node delete on backspace when the user is a guest.
          deleteKeyCode={editMode === "view" ? null : "Backspace"}
          multiSelectionKeyCode={isMac ? "Meta" : "Control"}
          selectionMode={SelectionMode.Partial}
          // TODO restore previous viewport
          defaultViewport={{ zoom: 1, x: 0, y: 0 }}
          proOptions={{ hideAttribution: true }}
          disableKeyboardA11y={true}
        >
          <Box>
            <MiniMap
              nodeStrokeColor={(n) => {
                if (n.style?.borderColor) return n.style.borderColor;
                if (n.type === "CODE") return "#d6dee6";
                if (n.type === "SCOPE") return "#f4f6f8";

                return "#d6dee6";
              }}
              nodeColor={(n) => {
                if (n.style?.backgroundColor) return n.style.backgroundColor;

                return "#f4f6f8";
              }}
              nodeBorderRadius={2}
            />
            <Controls
              showInteractive={editMode === "edit"}
              style={{
                display: "flex",
                backdropFilter: "blur(5px)",
              }}
              position="bottom-center"
            />

            <HelperLines
              horizontal={helperLineHorizontal}
              vertical={helperLineVertical}
            />

            <Background />
            <Background
              id="1"
              gap={10}
              color="#f1f1f1"
              variant={BackgroundVariant.Lines}
            />
            <Background
              id="2"
              gap={100}
              offset={1}
              color="#ccc"
              variant={BackgroundVariant.Lines}
            />
          </Box>
        </ReactFlow>
        <input
          type="file"
          accept=".ipynb, .py"
          ref={fileInputRef}
          style={{ display: "none" }}
          onChange={(e) => handleFileInputChange(e)}
        />
        {showContextMenu && (
          <Box
            sx={{
              left: `${points.x}px`,
              top: `${points.y}px`,
              zIndex: 100,
              position: "absolute",
              boxShadow: "0px 1px 8px 0px rgba(0, 0, 0, 0.1)",
              // width: '200px',
              backgroundColor: "#fff",
              borderRadius: "5px",
              boxSizing: "border-box",
            }}
          >
            <ContextMenu
              setShowContextMenu={setShowContextMenu}
              handleItemClick={handleItemClick}
            />
          </Box>
        )}

        {shareOpen && <ShareProjDialog open={shareOpen} id={repoId || ""} />}
      </Box>
    </Box>
  );
}

function ContextMenu({ setShowContextMenu, handleItemClick }) {
  const store = useContext(RepoContext)!;
  const setIsAddingNode = useStore(store, (state) => state.setIsAddingNode);
  return (
    <DropdownMenu.Root
      open={true}
      onOpenChange={(open) => {
        console.log("onOpenChange");
        setShowContextMenu(false);
      }}
    >
      <DropdownMenu.Trigger>
        <Button
          variant="ghost"
          style={{
            width: 0,
            height: 0,
            opacity: 0,
          }}
        >
          Options
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.Item
          shortcut="⌘ E"
          onClick={() => {
            setIsAddingNode(true);
          }}
        >
          + Code
        </DropdownMenu.Item>
        <DropdownMenu.Item shortcut="⌘ D">+ Doc</DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Item
          shortcut="⌘ N"
          onClick={() => {
            // handle CanvasContextMenu "import Jupyter notebook" click
            handleItemClick();
          }}
        >
          <FileUploadTwoToneIcon />
          Import
        </DropdownMenu.Item>

        <DropdownMenu.Sub>
          <DropdownMenu.SubTrigger>More</DropdownMenu.SubTrigger>
          <DropdownMenu.SubContent>
            <DropdownMenu.Item>Move to project…</DropdownMenu.Item>
            <DropdownMenu.Item>Move to folder…</DropdownMenu.Item>

            <DropdownMenu.Separator />
            <DropdownMenu.Item>Advanced options…</DropdownMenu.Item>
          </DropdownMenu.SubContent>
        </DropdownMenu.Sub>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}

export function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasImplWrap />
    </ReactFlowProvider>
  );
}
