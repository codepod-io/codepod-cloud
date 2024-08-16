import { useRef, useEffect } from "react";
import ReactFlow, {
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
} from "reactflow";
import "reactflow/dist/style.css";

import { useAtom, useAtomValue, useSetAtom } from "jotai";

import { RichNode } from "./nodes/Rich";
import { CodeNode } from "./nodes/Code";
import FloatingEdge from "./nodes/FloatingEdge";
import CustomConnectionLine from "./nodes/CustomConnectionLine";
import HelperLines from "./HelperLines";

import { ContextMenu, useContextMenu, useUpload } from "./canvas/ContextMenu";
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
import {
  ATOM_editMode,
  ATOM_repoId,
  ATOM_repoX,
  ATOM_repoY,
  ATOM_repoZoom,
  ATOM_shareOpen,
  INIT_ZOOM,
} from "@/lib/store/atom";
import { Box, Flex } from "@radix-ui/themes";
import { trpc } from "@/lib/trpc";
import { debounce } from "lodash";
import { env } from "../lib/vars";

const nodeTypes = {
  CODE: CodeNode,
  RICH: RichNode,
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
  const reactFlowWrapper = useRef<any>(null);

  const [nodes] = useAtom(ATOM_nodes);

  const { nodes: animatedNodes } = useAnimatedNodes(nodes);
  const [edges] = useAtom(ATOM_edges);
  const [nodesMap] = useAtom(ATOM_nodesMap);
  const onNodesChange = useSetAtom(ATOM_onNodesChange);

  const [selectedPods] = useAtom(ATOM_selectedPods);

  const reactFlowInstance = useReactFlow();

  // const repoId = useStore(store, (state) => state.repoId);
  const repoId = useAtomValue(ATOM_repoId)!;

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

  const saveViewPort = trpc.repo.saveViewPort.useMutation();
  const debouncedSaveViewPort = debounce(saveViewPort.mutate, 50, {
    maxWait: 5000,
  });

  const zoom = useAtomValue(ATOM_repoZoom);
  const x = useAtomValue(ATOM_repoX);
  const y = useAtomValue(ATOM_repoY);

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
      ref={reactFlowWrapper}
    >
      <ReactFlow
        nodes={animatedNodes}
        edges={edges}
        onNodesChange={onNodesChange}
        attributionPosition="top-right"
        maxZoom={2}
        minZoom={0.1}
        onPaneContextMenu={onPaneContextMenu}
        onNodeContextMenu={onNodeContextMenu}
        nodeTypes={nodeTypes}
        // custom edge for easy connect
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{
          style: { strokeWidth: 3, stroke: "lightgray" },
          type: "floating",
          // markerEnd: {
          //   type: MarkerType.ArrowClosed,
          //   color: "black",
          // },
        }}
        connectionLineComponent={CustomConnectionLine}
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
        zoomOnScroll={false}
        panOnScroll={true}
        connectionMode={ConnectionMode.Loose}
        nodesDraggable={editMode === "edit"}
        // disable node delete on backspace when the user is a guest.
        deleteKeyCode={editMode === "view" ? null : "Backspace"}
        multiSelectionKeyCode={isMac ? "Meta" : "Control"}
        selectionMode={SelectionMode.Partial}
        // Restore previous viewport.
        defaultViewport={{ zoom, x, y }}
        // Center node on repo creation. INIT_ZOOM is a magic number (1.001) to
        // trigger initial centering.
        fitView={zoom === INIT_ZOOM}
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
          {/* <Background
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
            left: `${points.x}px`,
            top: `${points.y}px`,
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
          />
        </Box>
      )}
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
