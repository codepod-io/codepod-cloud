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

import { runtimeTrpc, trpc } from "@/lib/trpc";
import {
  ATOM_centerSelection,
  ATOM_focusedEditor,
  ATOM_selectedPods,
} from "@/lib/store/canvasSlice";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { ATOM_nodesMap } from "@/lib/store/yjsSlice";
import {
  ATOM_activeRuntime,
  ATOM_getScopeChain,
  ATOM_preprocessChain,
} from "@/lib/store/runtimeSlice";

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

export function useJump() {
  const setFocusedEditor = useSetAtom(ATOM_focusedEditor);

  const nodesMap = useAtomValue(ATOM_nodesMap);

  const [selectedPods, setSelectedPods] = useAtom(ATOM_selectedPods);

  const preprocessChain = useSetAtom(ATOM_preprocessChain);
  const getScopeChain = useSetAtom(ATOM_getScopeChain);

  const runChain = runtimeTrpc.kernel.runChain.useMutation();
  const [activeRuntime] = useAtom(ATOM_activeRuntime);

  const setCenterSelection = useSetAtom(ATOM_centerSelection);

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
      setSelectedPods(new Set([to.id]));
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
