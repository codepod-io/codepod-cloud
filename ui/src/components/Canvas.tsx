import React, { useRef, useEffect, useState } from "react";
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
  Edge,
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
  StraightFloatingEdgeGradient_BlueToRed,
  StraightFloatingEdgeGradient_GreenToOrange,
} from "./nodes/FloatingEdge_Straight";

import HelperLines from "./HelperLines";

import {
  useEdgeContextMenu,
  usePaneContextMenu,
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
  getAbsPos,
  ATOM_onConnect,
  ATOM_insertMode,
  ATOM_updateView,
  g_nonSelectableScopes,
  ATOM_reactflowInstance,
  ATOM_onetimeViewport,
  ATOM_onetimeCenterPod,
  ATOM_jumpToPod,
} from "@/lib/store/canvasSlice";
import {
  ATOM_nodesMap,
  ATOM_subpageMap,
  ATOM_subpages,
} from "@/lib/store/yjsSlice";
import {
  ATOM_currentPage,
  ATOM_editMode,
  ATOM_repoData,
  ATOM_shareOpen,
  INIT_ZOOM,
} from "@/lib/store/atom";
import { Box, Button, Flex } from "@radix-ui/themes";
import { trpc } from "@/lib/trpc";
import { debounce } from "lodash";
import { env } from "../lib/vars";
import { myassert } from "@/lib/utils/utils";
import { css } from "@emotion/css";
import { AppNode } from "@/lib/store/types";
import { SubpageRefNode } from "./nodes/SubpageRef";
import {
  getOrCreate_ATOM_privateST,
  getOrCreate_ATOM_publicST,
} from "@/lib/store/runtimeSlice";

const nodeTypes = {
  CODE: CodeNode,
  RICH: RichNode,
  SCOPE: ScopeNode,
  SubpageRef: SubpageRefNode,
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

/**
 * Naming:
 * - floating is for manual edges
 * - gradient is for defuse edges
 *
 * FIXME: We should replace the "floating" and "gradient" with "manual" and
 * "defuse". But this requires a migration of user data in the database.
 */
export const MANUAL_EDGE = "floating";
export const DEFUSE_EDGE = "gradient";
const edgeTypes = {
  floating: StraightFloatingEdgeGradient_GreenToOrange,
  gradient: StraightFloatingEdgeGradient_BlueToRed,
};

/**
 * The ReactFlow instance keeps re-rendering when nodes change. Thus, we're
 * using this wrapper component to load the useXXX functions only once.
 */
function CanvasImplWrap() {
  // useCopyPaste();
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

function useSetTitle() {
  // monitor the repo name change
  const repoData = useAtomValue(ATOM_repoData);
  myassert(repoData);
  // monitor the subpage (title) change
  const subpages = useAtomValue(ATOM_subpages);
  // monitor the current page change
  const currentPage = useAtomValue(ATOM_currentPage);
  // set the title
  const subpageMap = useAtomValue(ATOM_subpageMap);
  const subpageTitle = currentPage
    ? subpageMap.get(currentPage)?.title
    : "main";
  useEffect(() => {
    document.title = `${subpageTitle} - ${repoData.name ?? "Untitled"}`;
    return () => {
      // reset the title
      document.title = "CodePod IDE";
    };
  }, [currentPage, repoData, subpages]);
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

  const reactFlowInstance = useReactFlow<AppNode, Edge>();
  const setReactflowInstance = useSetAtom(ATOM_reactflowInstance);
  useEffect(() => {
    setReactflowInstance(reactFlowInstance);
  }, [reactFlowInstance]);

  const repoData = useAtomValue(ATOM_repoData);
  myassert(repoData);
  const repoId = repoData.id;

  const [editMode] = useAtom(ATOM_editMode);

  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  const [shareOpen, setShareOpen] = useAtom(ATOM_shareOpen);

  const currentPage = useAtomValue(ATOM_currentPage);
  const { fitView } = useReactFlow();
  useEffect(() => {
    fitView({ maxZoom: 1 });
  }, [currentPage]);

  useSetTitle();

  const [onetimeCenterPod, setOnetimeCenterSelection] = useAtom(
    ATOM_onetimeCenterPod
  );

  useEffect(() => {
    // move the viewport to the to node
    // get the absolute position of the to node
    if (onetimeCenterPod) {
      const node = nodesMap.get(onetimeCenterPod);
      if (!node) return;
      const pos = getAbsPos(node, nodesMap);

      const width = node.measured?.width || 0;
      const height = node.measured?.height || 0;

      reactFlowInstance.setCenter(pos.x + width / 2, pos.y + height / 2, {
        // zoom: reactFlowInstance.getZoom(),
        // On centering, also adjust the zoom level to make the pod visible.
        zoom: 20 / Math.sqrt(width),
        duration: 800,
      });
      setOnetimeCenterSelection(undefined);
    }
  }, [onetimeCenterPod]);

  // Set the viewport onetime.
  const [onetimeViewport, setOnetimeViewport] = useAtom(ATOM_onetimeViewport);
  useEffect(() => {
    if (onetimeViewport) {
      reactFlowInstance.setViewport(onetimeViewport, {
        duration: 800,
      });
      setOnetimeViewport(undefined);
    }
  }, [onetimeViewport]);

  const [helperLineHorizontal] = useAtom(ATOM_helperLineHorizontal);
  const [helperLineVertical] = useAtom(ATOM_helperLineVertical);

  const saveViewPort = trpc.repo.saveViewPort.useMutation();
  const debouncedSaveViewPort = debounce(saveViewPort.mutate, 50, {
    maxWait: 5000,
  });

  const { contextMenu: paneContextMenu, onContextMenu: onPaneContextMenu } =
    usePaneContextMenu();
  const { edgeContextMenu, onEdgeContextMenu } = useEdgeContextMenu();
  const { selectionContextMenu, onSelectionContextMenu } =
    useSelectionContextMenu();
  const insertMode = useAtomValue(ATOM_insertMode);

  // ------------------------------------------------------------
  // Set non-selectable scopes
  // ------------------------------------------------------------

  const { getIntersectingNodes } = useReactFlow();
  const updateView = useSetAtom(ATOM_updateView);
  const { screenToFlowPosition } = useReactFlow();

  const onSelectionStart = (event: React.MouseEvent) => {
    // If the selection drag starts within a scope, set the scope as not selectable
    //
    // 1. get all scopes that are within the selection
    const position = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });
    const nodes = getIntersectingNodes({
      x: position.x,
      y: position.y,
      width: 1,
      height: 1,
    });
    // 2. set the not selectable flags
    nodes.forEach((n) => {
      g_nonSelectableScopes.add(n.id);
    });
    updateView();
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
      className={css`
        // so that we can drag a selection inside the scope.
        .react-flow__node-SCOPE {
          pointer-events: none !important;
        }
        // This is still needed so that edges are shown on top of ReactFlow Handles in Connect mode.
        // This also put the edges on top of the symbol table.
        // - UPDATE 1: no, the symbol table is still on top.
        // - UPDATE 2: still set to 9999 to let edges be on top of nodes.
        .react-flow__edges {
          z-index: 9999;
        }
        // But put the nodes on top of the edges.
        // .react-flow__nodes {
        //   z-index: 2;
        // }
      `}
    >
      <ReactFlow<AppNode>
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgeContextMenu={onEdgeContextMenu}
        onSelectionContextMenu={onSelectionContextMenu}
        onConnect={onConnect}
        onSelectionStart={onSelectionStart}
        onSelectionEnd={() => {
          // reset the not selectable flags
          g_nonSelectableScopes.clear();
        }}
        attributionPosition="top-right"
        maxZoom={3}
        minZoom={0.01}
        onPaneContextMenu={onPaneContextMenu}
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
          // markerEnd: {
          //   type: MarkerType.Arrow,
          //   // color: "red",
          // },
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

        // onMove={(e, { x, y, zoom }) => {
        //   // FIXME this is causing the re-rendering of the canvas. All trpc
        //   // mutations will cause the re-rendering.
        //   if (env.READ_ONLY) return;
        //   debouncedSaveViewPort({ repoId, x, y, zoom });
        // }}
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
        // multiSelectionKeyCode={isMac ? "Meta" : "Control"}
        selectionMode={SelectionMode.Partial}
        // Restore previous viewport.
        // defaultViewport={{ zoom: repoData.zoom, x: repoData.x, y: repoData.y }}
        // Center node on repo creation. INIT_ZOOM is a magic number (1.001) to
        // trigger initial centering.
        // fitView={repoData.zoom === INIT_ZOOM}
        fitView={true}
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

          {/* <Background /> */}
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
      <SubpageSymbolTable />
      {paneContextMenu}
      {edgeContextMenu}
      {selectionContextMenu}
    </Flex>
  );
}

function SubpageSymbolTable() {
  const currentPage = useAtomValue(ATOM_currentPage);
  const privateSt = useAtomValue(
    getOrCreate_ATOM_privateST(currentPage ?? "main")
  );
  const publicSt = useAtomValue(
    getOrCreate_ATOM_publicST(currentPage ?? "main")
  );
  const jumpToPod = useSetAtom(ATOM_jumpToPod);
  return (
    <Box>
      <Box
        style={{
          // place it on the left
          position: "absolute",
          top: 0,
          left: 0,
          // transform: "translateX(-100%) translateX(-10px)",
          pointerEvents: "all",
          // border: "1px solid red",
        }}
      >
        {/* public */}
        {[...publicSt.keys()].map((key) => (
          <Flex align="center" key={key}>
            <Button
              onClick={() => {
                // jump to the node
                const target = publicSt.get(key);
                myassert(target);
                jumpToPod(target.final);
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
          // transform: "translateX(100%) translateX(10px)",
          pointerEvents: "all",
        }}
      >
        {/* private */}
        {[...privateSt.keys()].map((key) => (
          <Flex align="center" key={key}>
            <Button
              onClick={() => {
                // jump to the node
                const target = privateSt.get(key);
                myassert(target);
                jumpToPod(target.final);
              }}
              variant="ghost"
            >
              <code>{key}</code>
            </Button>
          </Flex>
        ))}
      </Box>
    </Box>
  );
}

export function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasImplWrap />
    </ReactFlowProvider>
  );
}
