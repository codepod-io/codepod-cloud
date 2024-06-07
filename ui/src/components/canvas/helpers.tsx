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

import * as Y from "yjs";

import { timer } from "d3-timer";

import { ATOM_isAddingNode } from "@/lib/store/canvasSlice";
import { useAtom } from "jotai";

/**
 * Animate nodes and edges when their positions change.
 */
export function useAnimatedNodes(nodes: Node[]) {
  const [tmpNodes, setTmpNodes] = useState(nodes);

  // When adding node, set the animation duration to 0 so that the temp node follows mouse.
  const [isAddingNode] = useAtom(ATOM_isAddingNode);
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

export function useCopyPaste() {
  const rfDomNode = useRfStore((state) => state.domNode);
  const reactFlowInstance = useReactFlow();
  // const handleCopy = useStore(store, (state) => state.handleCopy);
  // const handlePaste = useStore(store, (state) => state.handlePaste);

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

  // const paste = useCallback(
  //   (event) => {
  //     handlePaste(event, posRef.current);
  //   },
  //   [handlePaste, posRef]
  // );

  // // bind copy/paste events
  // useEffect(() => {
  //   if (!rfDomNode) return;
  //   document.addEventListener("copy", handleCopy);
  //   document.addEventListener("paste", paste);

  //   return () => {
  //     document.removeEventListener("copy", handleCopy);
  //     document.removeEventListener("paste", paste);
  //   };
  // }, [handleCopy, handlePaste, rfDomNode]);
}
