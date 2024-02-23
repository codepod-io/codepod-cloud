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

import { useAtom, useSetAtom } from "jotai";

import { ShareProjDialog } from "./ShareProjDialog";
import { RichNode } from "./nodes/Rich";
import { CodeNode } from "./nodes/Code";
import { ScopeNode } from "./nodes/Scope";
import FloatingEdge from "./nodes/FloatingEdge";
import CustomConnectionLine from "./nodes/CustomConnectionLine";
import HelperLines from "./HelperLines";

import {
  ContextMenu,
  useAddNode,
  useContextMenu,
  useUpload,
} from "./canvas/ContextMenu";
import { useAnimatedNodes, useCopyPaste } from "./canvas/helpers";
import { useJump } from "./canvas/jump";
import {
  ATOM_edges,
  ATOM_helperLineHorizontal,
  ATOM_helperLineVertical,
  ATOM_nodes,
  ATOM_selectedPods,
  ATOM_onNodesChange,
  ATOM_centerSelection,
  getAbsPos,
} from "@/lib/store/canvasSlice";
import { ATOM_nodesMap } from "@/lib/store/yjsSlice";
import { ATOM_editMode, ATOM_repoId, ATOM_shareOpen } from "@/lib/store/atom";

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
 * The canvas.
 * @returns
 */
function CanvasImpl() {
  const reactFlowWrapper = useRef<any>(null);

  useAddNode(reactFlowWrapper);

  const [nodes] = useAtom(ATOM_nodes);

  const { nodes: animatedNodes } = useAnimatedNodes(nodes);
  const [edges] = useAtom(ATOM_edges);
  const [nodesMap] = useAtom(ATOM_nodesMap);
  const onNodesChange = useSetAtom(ATOM_onNodesChange);

  const [selectedPods] = useAtom(ATOM_selectedPods);

  const reactFlowInstance = useReactFlow();

  // const repoId = useStore(store, (state) => state.repoId);
  const [repoId] = useAtom(ATOM_repoId);

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

  const [helperLineHorizontal] = useAtom(ATOM_helperLineHorizontal);
  const [helperLineVertical] = useAtom(ATOM_helperLineVertical);
  const {
    points,
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

export function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasImplWrap />
    </ReactFlowProvider>
  );
}
