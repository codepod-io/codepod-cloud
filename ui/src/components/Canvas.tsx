import { useRef, useEffect, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  Controls,
  useReactFlow,
  ConnectionMode,
  MarkerType,
  ReactFlowProvider,
  useViewport,
  SelectionMode,
  getBezierPath,
  EdgeProps,
  Node,
} from "@xyflow/react";

// you also need to adjust the style import
import "@xyflow/react/dist/style.css";

import { useAtom, useAtomValue, useSetAtom } from "jotai";

import { RichNode } from "./nodes/Rich";
import { CodeNode } from "./nodes/Code";
import { ScopeNode } from "./nodes/Scope";
import { FloatingEdge } from "./nodes/FloatingEdge";
import {
  ConnectionLineStraight,
  StraightFloatingEdge,
} from "./nodes/FloatingEdge_Straight";

import HelperLines from "./HelperLines";

import {
  ContextMenu,
  useContextMenu,
  useEdgeContextMenu,
  useSelectionContextMenu,
  useUpload,
} from "./canvas/ContextMenu";
import { useAnimatedNodes, useCopyPaste } from "./canvas/helpers";
import {
  ATOM_edges,
  ATOM_helperLineHorizontal,
  ATOM_helperLineVertical,
  ATOM_nodes,
  ATOM_selectedPods,
  ATOM_onNodesChange,
  ATOM_centerSelection,
  getAbsPos,
  ATOM_onConnect,
  ATOM_insertMode,
  ATOM_computeCollisions,
} from "@/lib/store/canvasSlice";
import { ATOM_nodesMap } from "@/lib/store/yjsSlice";
import {
  ATOM_editMode,
  ATOM_repoData,
  ATOM_shareOpen,
  INIT_ZOOM,
} from "@/lib/store/atom";
import { Box, Flex } from "@radix-ui/themes";
import { trpc } from "@/lib/trpc";
import { debounce } from "lodash";
import { env } from "../lib/vars";
import { myassert } from "@/lib/utils/utils";

const nodeTypes = {
  CODE: CodeNode,
  RICH: RichNode,
  SCOPE: ScopeNode,
};

function GradientEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  markerEnd,
  sourcePosition,
  targetPosition,
  style,
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <>
      <defs>
        <linearGradient
          // id={"blue-to-red"}
          id={id}
          x1={sourceX > targetX ? "100%" : "0%"}
          // x1="100%"
          y1="0%"
          x2={sourceX > targetX ? "0%" : "100%"}
          // x2="0%"
          y2="0%"
          // gradientUnits="objectBoundingBox"
          // gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" style={{ stopColor: "blue", stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: "red", stopOpacity: 1 }} />
        </linearGradient>
      </defs>
      <path
        id={id}
        className="react-flow__edge-path"
        d={edgePath}
        strokeWidth={5}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: `url(#${id})`,
        }}
      />
    </>
  );
}

const edgeTypes = {
  // floating: FloatingEdge,
  floating: StraightFloatingEdge,
  gradient: GradientEdge,
};

/**
 * The ReactFlow instance keeps re-rendering when nodes change. Thus, we're
 * using this wrapper component to load the useXXX functions only once.
 */
function CanvasImplWrap() {
  useCopyPaste();
  return (
    <Flex flexGrow={"1"} position="relative">
      <CanvasImpl />
      <ViewportInfo />
    </Flex>
  );
}

function ViewportInfo() {
  const { x, y, zoom } = useViewport();
  return (
    <div
      style={{
        position: "absolute",
        bottom: "10px",
        right: "10px",
        backgroundColor: "rgba(0,0,0,0.5)",
        color: "white",
        padding: 1,
        fontSize: 12,
        borderRadius: 1,
        zIndex: 100,
      }}
    >
      {`x: ${x.toFixed(2)}, y: ${y.toFixed(2)}, zoom: ${zoom.toFixed(2)}`}
    </div>
  );
}

/**
 * The canvas.
 * @returns
 */
function CanvasImpl() {
  const [nodes] = useAtom(ATOM_nodes);

  const [edges] = useAtom(ATOM_edges);
  const [nodesMap] = useAtom(ATOM_nodesMap);
  const onNodesChange = useSetAtom(ATOM_onNodesChange);
  const onConnect = useSetAtom(ATOM_onConnect);

  const [selectedPods] = useAtom(ATOM_selectedPods);

  const reactFlowInstance = useReactFlow();

  const repoData = useAtomValue(ATOM_repoData);
  myassert(repoData);
  const repoId = repoData.id;

  const [editMode] = useAtom(ATOM_editMode);

  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  const [shareOpen, setShareOpen] = useAtom(ATOM_shareOpen);

  const [centerSelection, setCenterSelection] = useAtom(ATOM_centerSelection);

  useEffect(() => {
    // move the viewport to the to node
    // get the absolute position of the to node
    if (centerSelection && selectedPods.size > 0) {
      const node = selectedPods.values().next().value;
      const pos = getAbsPos(nodesMap.get(node)!, nodesMap);

      reactFlowInstance.setCenter(
        pos.x + (nodesMap.get(node)?.measured?.width || 0) / 2,
        pos.y + (nodesMap.get(node)?.measured?.height || 0) / 2,
        {
          zoom: reactFlowInstance.getZoom(),
          duration: 800,
        }
      );
      setCenterSelection(false);
    }
  }, [centerSelection, setCenterSelection]);

  const [helperLineHorizontal] = useAtom(ATOM_helperLineHorizontal);
  const [helperLineVertical] = useAtom(ATOM_helperLineVertical);
  const {
    pagePosition,
    clientPosition,
    showContextMenu,
    setShowContextMenu,
    onPaneContextMenu,
    onNodeContextMenu,
  } = useContextMenu();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { handleFileInputChange } = useUpload();

  const handleItemClick = () => {
    fileInputRef!.current!.click();
    fileInputRef!.current!.value = "";
  };

  const saveViewPort = trpc.repo.saveViewPort.useMutation();
  const debouncedSaveViewPort = debounce(saveViewPort.mutate, 50, {
    maxWait: 5000,
  });

  const { edgeContextMenu, onEdgeContextMenu } = useEdgeContextMenu();
  const { selectionContextMenu, onSelectionContextMenu } =
    useSelectionContextMenu();
  const insertMode = useAtomValue(ATOM_insertMode);

  const computeCollisions = useSetAtom(ATOM_computeCollisions);
  useEffect(() => {
    // compute collsion on mount.
    computeCollisions();
  }, []);

  const { getIntersectingNodes, isNodeIntersecting } = useReactFlow();

  // this ref stores the current dragged node
  const dragRef = useRef(null);

  const onNodeDragStart = (evt, node) => {
    dragRef.current = node;
  };

  const setCollisionIds = useSetAtom(ATOM_collisionIds);
  const setEscapedIds = useSetAtom(ATOM_escapedIds);

  const onNodeDrag = (evt: React.MouseEvent, _node: Node, nodes: Node[]) => {
    const collisionIds: string[] = [];
    const escapedIds: string[] = [];
    nodes.forEach((node) => {
      // find overlapping nodes
      let intersectingNodes = getIntersectingNodes(node);
      // only include nodes of the same parent
      intersectingNodes = intersectingNodes.filter(
        (n) => n.parentId === node.parentId
      );
      if (intersectingNodes.length > 0) {
        collisionIds.push(node.id);
        collisionIds.push(...intersectingNodes.map((n) => n.id));
      }

      // find if the node is within the parent node
      if (node.parentId) {
        const parent = nodesMap.get(node.parentId);
        myassert(parent);
        const rect = getNodesBounds([parent]);
        const withinParent = isNodeIntersecting(node, rect, false);
        if (!withinParent) {
          escapedIds.push(node.id);
          escapedIds.push(node.parentId);
        }
      }
    });
    setCollisionIds(collisionIds);
    setEscapedIds(escapedIds);
  };

  const onNodeDragStop = (evt, node) => {
    // we detect collisions when the drag stops. If collisions are detected, re-compute teh collision for all pods.
    dragRef.current = null;
    computeCollisions();
  };

  return (
    <Flex
      style={{
        // backgroundImage:
        //   "url('https://cdn.pixabay.com/photo/2019/03/12/17/18/trees-4051288_1280.jpg')",
        // backgroundSize: "cover",
        backgroundColor: "var(--gray-2)",

        // Rainbow border. Ref: https://codepen.io/unnegative/pen/dVwYBq
        // border: "3px solid transparent",
        // borderImage:
        //   "linear-gradient(to bottom right, #b827fc 0%, #2c90fc 25%, #b8fd33 50%, #fec837 75%, #fd1892 100%)",
        // borderImageSlice: 1,

        // background gradient: https://freefrontend.com/css-gradient-examples/
        // backgroundImage: "linear-gradient(200deg, #FDEB82, #F78FAD)",
        // backgroundImage: "linear-gradient(200deg, #C1E3FF, #ABC7FF)",
        // backgroundImage: "linear-gradient(200deg, #FDEB82, #ABC7FF)",
      }}
      flexGrow={"1"}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgeContextMenu={onEdgeContextMenu}
        onSelectionContextMenu={onSelectionContextMenu}
        onConnect={onConnect}
        onNodeDragStart={() => {
          computeCollisions();
        }}
        onNodeDrag={() => {
          computeCollisions();
        }}
        attributionPosition="top-right"
        maxZoom={2}
        minZoom={0.1}
        onPaneContextMenu={onPaneContextMenu}
        onNodeContextMenu={onNodeContextMenu}
        nodeTypes={nodeTypes}
        // custom edge for easy connect
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{
          // style: { strokeWidth: 3, stroke: "black", strokeOpacity: 0.1 },
          // type: "floating",
          // type: "simplebezier",
          selectable: insertMode !== "Insert",
          // markerEnd: {
          //   type: MarkerType.ArrowClosed,
          //   color: "black",
          // },
          markerEnd: {
            type: MarkerType.Arrow,
            // color: "red",
          },
          style: {
            strokeWidth: 5,
            // stroke: "black",
            // strokeOpacity: 0.1,
          },
        }}
        connectionLineComponent={ConnectionLineStraight}
        connectionLineStyle={{
          strokeWidth: 3,
          stroke: "black",
        }}
        // end custom edge

        onMove={(e, { x, y, zoom }) => {
          // FIXME this is causing the re-rendering of the canvas. All trpc
          // mutations will cause the re-rendering.
          if (env.READ_ONLY) return;
          debouncedSaveViewPort({ repoId, x, y, zoom });
        }}
        // drag to select nodes instead of panning the canvas.
        panOnDrag={false}
        selectionOnDrag={true}
        // use the touchpad to pan the canvas.
        zoomOnScroll={false}
        panOnScroll={true}
        connectionMode={ConnectionMode.Loose}
        nodesDraggable={editMode === "edit"}
        // disable node delete on backspace when the user is a guest.
        deleteKeyCode={editMode === "view" ? null : "Backspace"}
        multiSelectionKeyCode={isMac ? "Meta" : "Control"}
        // selectionMode={SelectionMode.Partial}
        // Restore previous viewport.
        defaultViewport={{ zoom: repoData.zoom, x: repoData.x, y: repoData.y }}
        // Center node on repo creation. INIT_ZOOM is a magic number (1.001) to
        // trigger initial centering.
        fitView={repoData.zoom === INIT_ZOOM}
        fitViewOptions={{ maxZoom: 1 }}
        proOptions={{ hideAttribution: true }}
        disableKeyboardA11y={true}
      >
        <Box>
          {/* <MiniMap
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
          /> */}
          <Controls
            showInteractive={editMode === "edit"}
            style={{
              display: "flex",
              backdropFilter: "blur(5px)",
              backgroundColor: "rgba(255,255,255,0.5)",
            }}
            fitViewOptions={{ maxZoom: 1, duration: 100 }}
            // position="bottom-center"
          />

          <HelperLines
            horizontal={helperLineHorizontal}
            vertical={helperLineVertical}
          />

          <Background />
          {/* <Background
            id="1"
            gap={10}
            color="#f1f1f1"
            variant={BackgroundVariant.Lines}
          /> */}
          {/* <Background
            id="2"
            gap={100}
            offset={1}
            color="#ccc"
            variant={BackgroundVariant.Lines}
          /> */}
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
          style={{
            left: `${pagePosition.x}px`,
            top: `${pagePosition.y}px`,
            zIndex: 100,
            // FIXME still a little offset
            position: "fixed",
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
            clientPosition={clientPosition}
          />
        </Box>
      )}
      {edgeContextMenu}
      {selectionContextMenu}
    </Flex>
  );
}

export function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasImplWrap />
    </ReactFlowProvider>
  );
}
