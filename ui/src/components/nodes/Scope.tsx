import {
  useCallback,
  useState,
  useRef,
  useContext,
  useEffect,
  memo,
} from "react";
import * as React from "react";
import ReactFlow, {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  MiniMap,
  Controls,
  Handle,
  useReactFlow,
  Position,
  ConnectionMode,
  MarkerType,
  Node,
  NodeProps,
  useStore as useReactFlowStore,
} from "reactflow";

import Box from "@mui/material/Box";
import InputBase from "@mui/material/InputBase";
import CircularProgress from "@mui/material/CircularProgress";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import Grid from "@mui/material/Grid";
import ContentCutIcon from "@mui/icons-material/ContentCut";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import ViewTimelineOutlinedIcon from "@mui/icons-material/ViewTimelineOutlined";
import CompressIcon from "@mui/icons-material/Compress";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";

import { shallow } from "zustand/shallow";

import { NodeResizer, NodeResizeControl } from "reactflow";
import { ConfirmDeleteButton, ResizeIcon } from "./utils";
import { CopyToClipboard } from "react-copy-to-clipboard";
import { runtimeTrpc, trpc } from "@/lib/trpc";
import { ATOM_editMode, ATOM_repoId } from "@/lib/store/atom";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  ATOM_getScopeChain,
  ATOM_preprocessChain,
} from "@/lib/store/runtimeSlice";
import { ATOM_autoLayoutTree } from "@/lib/store/canvasSlice";
import { ATOM_nodesMap, ATOM_runtimeReady } from "@/lib/store/yjsSlice";
import { ATOM_devMode } from "@/lib/store/settingSlice";

function MyFloatingToolbar({ id }: { id: string }) {
  const reactFlowInstance = useReactFlow();
  const [editMode] = useAtom(ATOM_editMode);
  const preprocessChain = useSetAtom(ATOM_preprocessChain);
  const getScopeChain = useSetAtom(ATOM_getScopeChain);

  const repoId = useAtomValue(ATOM_repoId)!;
  const runChain = runtimeTrpc.container.runChain.useMutation();
  const runtimeReady = useAtomValue(ATOM_runtimeReady);

  const autoLayoutTree = useSetAtom(ATOM_autoLayoutTree);

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
      }}
    >
      {editMode === "edit" && (
        <Tooltip title="Run (shift-enter)">
          <IconButton
            disabled={!runtimeReady}
            onClick={() => {
              const chain = getScopeChain(id);
              const specs = preprocessChain(chain);
              if (specs) runChain.mutate({ repoId, specs });
            }}
          >
            <PlayCircleOutlineIcon />
          </IconButton>
        </Tooltip>
      )}
      {/* auto force layout */}
      {editMode === "edit" && (
        <Tooltip title="force layout">
          <IconButton
            onClick={() => {
              autoLayoutTree();
            }}
          >
            <ViewTimelineOutlinedIcon />
          </IconButton>
        </Tooltip>
      )}
      {editMode === "edit" && (
        <Tooltip title="Delete" className="nodrag">
          <ConfirmDeleteButton
            handleConfirm={(e: any) => {
              // This does not work, will throw "Parent node
              // jqgdsz2ns6k57vich0bf not found" when deleting a scope.
              //
              // nodesMap.delete(id);
              //
              // But this works:
              reactFlowInstance.deleteElements({ nodes: [{ id }] });
            }}
          />
        </Tooltip>
      )}
    </Box>
  );
}

export const ScopeNode = memo<NodeProps>(function ScopeNode({
  data,
  id,
  isConnectable,
  selected,
  xPos,
  yPos,
}) {
  // add resize to the node
  const ref = useRef(null);
  const [nodesMap] = useAtom(ATOM_nodesMap);
  const [editMode] = useAtom(ATOM_editMode);
  const inputRef = useRef<HTMLInputElement>(null);

  const [devMode] = useAtom(ATOM_devMode);

  const [showToolbar, setShowToolbar] = useState(false);

  const { width, height, parent } = useReactFlowStore((s) => {
    const node = s.nodeInternals.get(id)!;

    return {
      width: node.width,
      height: node.height,
      parent: node.parentNode,
    };
  }, shallow);

  const node = nodesMap.get(id);
  if (!node) return null;

  return (
    <Box
      ref={ref}
      sx={{
        width: "100%",
        height: "100%",
        border: "solid 1px #d6dee6",
        borderColor: selected ? "#003c8f" : undefined,
        borderRadius: "4px",
        cursor: "auto",
      }}
      onMouseEnter={() => {
        setShowToolbar(true);
      }}
      onMouseLeave={() => {
        setShowToolbar(false);
      }}
      className="custom-drag-handle"
    >
      {/* <NodeResizer color="#ff0071" minWidth={100} minHeight={30} /> */}
      <Box sx={{ opacity: showToolbar ? 1 : 0 }}>
        <NodeResizeControl
          style={{
            background: "transparent",
            border: "none",
          }}
          minWidth={100}
          minHeight={50}
        >
          <ResizeIcon />
        </NodeResizeControl>
      </Box>

      <Box
        sx={{
          opacity: showToolbar ? 1 : 0,
          marginLeft: "10px",
          borderRadius: "4px",
          position: "absolute",
          border: "solid 1px #d6dee6",
          right: "25px",
          top: "-60px",
          background: "white",
          zIndex: 250,
          justifyContent: "center",
        }}
      >
        <MyFloatingToolbar id={id} />
      </Box>
      <Box
        sx={{
          opacity: showToolbar ? 1 : 0,
        }}
      >
        {/* <Handles
          id={id}
          width={width}
          height={height}
          parent={parent}
          xPos={xPos}
          yPos={yPos}
        /> */}
      </Box>
      {/* The header of scope nodes. */}
      <Box
        // bgcolor={"rgb(225,225,225)"}
        sx={{ display: "flex" }}
      >
        {devMode && (
          <Box
            sx={{
              position: "absolute",
              top: "-48px",
              userSelect: "text",
              cursor: "auto",
            }}
          >
            {id} at ({xPos}, {yPos}), w: {width}, h: {height} parent: {parent}{" "}
            level: {data.level}
          </Box>
        )}
        <Grid container spacing={2} sx={{ alignItems: "center" }}>
          <Grid item xs={4}>
            {/* <IconButton size="small">
                <CircleIcon sx={{ color: "red" }} fontSize="inherit" />
              </IconButton> */}
          </Grid>
          <Grid item xs={4}>
            <Box
              sx={{
                display: "flex",
                flexGrow: 1,
                justifyContent: "center",
              }}
            >
              <InputBase
                className="nodrag"
                defaultValue={data.name || "Scope"}
                onBlur={(e) => {
                  const name = e.target.value;
                  if (name === data.name) return;
                  const node = nodesMap.get(id);
                  if (node) {
                    nodesMap.set(id, {
                      ...node,
                      data: { ...node.data, name },
                    });
                  }
                  // setPodName({ id, name });
                }}
                inputRef={inputRef}
                disabled={editMode === "view"}
                inputProps={{
                  style: {
                    padding: "0px",
                    textAlign: "center",
                    textOverflow: "ellipsis",
                    width: width ? width : undefined,
                  },
                }}
              ></InputBase>
            </Box>
          </Grid>
          <Grid item xs={4}></Grid>
        </Grid>
      </Box>
    </Box>
  );
});
