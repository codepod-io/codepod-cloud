import { Node, XYPosition } from "reactflow";
import { StateCreator } from "zustand";
import { MyState } from "..";

import { match } from "ts-pattern";

export interface AddNodeSlice {
  updateView_addNode: () => void;

  isAddingNode: boolean;
  setIsAddingNode: (b: boolean) => void;
  mousePosition: XYPosition;
  setMousePosition: (pos: XYPosition) => void;

  getInsertPosition: () => void;
  anchorNode:
    | {
        id: string;
        position: "TOP" | "BOTTOM" | "RIGHT" | "LEFT";
        isValid: boolean;
      }
    | undefined;
  addNodeAtAnchor: (type: "CODE" | "RICH") => void;
}

export const createAddNodeSlice: StateCreator<MyState, [], [], AddNodeSlice> = (
  set,
  get
) => ({
  isAddingNode: false,
  setIsAddingNode: (b: boolean) => set({ isAddingNode: b }),
  mousePosition: { x: 0, y: 0 },
  setMousePosition: ({ x, y }) => set({ mousePosition: { x, y } }),

  updateView_addNode: () => {
    if (get().isAddingNode) {
      const newNode = {
        id: "tempNode",
        type: "TEMP",
        position: get().mousePosition,
        width: 300,
        height: 100,
        data: {},
      };
      set({ nodes: [...get().nodes, newNode] });
    }
  },

  getInsertPosition: () => {
    // 1. given the mouse position, find the nearest node as anchor
    // - if the mouse position is to the right of the anchor, insert to the right
    // - if the mouse position is to the top or bottom of the anchor, insert to the top or bottom
    // - otherwise, no position is identified

    // get all the nodes
    const nodes = get().nodes.filter((n) => n.type !== "TEMP");
    // get the mouse position
    const mouse = get().mousePosition;
    // get the nearest node, defined by the bounding box of the node: x, y, x+width, y+height
    const nearest = nodes.reduce<{
      node: Node | undefined;
      distance: number;
    }>(
      (acc, node) => {
        const width = node.width!;
        const height = node.height!;
        const { x, y } = node.position;
        const top = { x: x + width / 2, y };
        const bottom = { x: x + width / 2, y: y + height };
        const left = { x, y: y + height / 2 };
        const right = { x: x + width, y: y + height / 2 };
        const distance = Math.min(
          Math.pow(mouse.x - top.x, 2) + Math.pow(mouse.y - top.y, 2),
          Math.pow(mouse.x - bottom.x, 2) + Math.pow(mouse.y - bottom.y, 2),
          Math.pow(mouse.x - left.x, 2) + Math.pow(mouse.y - left.y, 2),
          Math.pow(mouse.x - right.x, 2) + Math.pow(mouse.y - right.y, 2)
        );
        if (distance < acc.distance) {
          return { node, distance };
        }
        return acc;
      },
      { node: undefined, distance: Infinity }
    );

    // check the relative direction of the mouse to the nearest node
    const node = nearest.node;
    if (!node) return;

    const width = node.width!;
    const height = node.height!;
    const { x, y } = node.position;
    const top = { x: x + width / 2, y };
    const bottom = { x: x + width / 2, y: y + height };
    const left = { x, y: y + height / 2 };
    const right = { x: x + width, y: y + height / 2 };
    const topDistance =
      Math.pow(mouse.x - top.x, 2) + Math.pow(mouse.y - top.y, 2);
    const bottomDistance =
      Math.pow(mouse.x - bottom.x, 2) + Math.pow(mouse.y - bottom.y, 2);
    const leftDistance =
      Math.pow(mouse.x - left.x, 2) + Math.pow(mouse.y - left.y, 2);
    const rightDistance =
      Math.pow(mouse.x - right.x, 2) + Math.pow(mouse.y - right.y, 2);
    const minDistance = Math.min(
      topDistance,
      bottomDistance,
      leftDistance,
      rightDistance
    );
    if (minDistance === topDistance) {
      get().anchorNode = { id: node.id, position: "TOP", isValid: true };
    } else if (minDistance === bottomDistance) {
      get().anchorNode = { id: node.id, position: "BOTTOM", isValid: true };
    } else if (minDistance === leftDistance) {
      get().anchorNode = { id: node.id, position: "LEFT", isValid: false };
    } else if (minDistance === rightDistance) {
      get().anchorNode = {
        id: node.id,
        position: "RIGHT",
        isValid: node.data.children.length === 0,
      };
    }
    // TODO insert a placeholder in the position, and insert the actual node when user clicks.
  },
  anchorNode: undefined,
  addNodeAtAnchor: (type: "CODE" | "RICH") => {
    const anchor = get().anchorNode;
    if (!anchor) return;
    const nodesMap = get().getNodesMap();
    const node = nodesMap.get(anchor.id)!;
    const parentId = node.data.parent!;
    const parentNode = nodesMap.get(parentId)!;
    const index = parentNode?.data.children.indexOf(anchor.id);
    if (anchor.isValid) {
      match(anchor.position)
        .with("TOP", () => {
          get().addNode(type, parentId, index);
        })
        .with("BOTTOM", () => {
          get().addNode(type, parentId, index + 1);
        })
        .with("RIGHT", () => {
          get().addNode(type, anchor.id, 0);
        })
        .otherwise(() => {
          throw new Error("Should not reach here.");
        });
    }
  },
});
