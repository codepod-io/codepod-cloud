import { useAtomValue, useSetAtom } from "jotai";
import { ATOM_nodesMap } from "@/lib/store/yjsSlice";
import { ScopeNodeType } from "@/lib/store/types";
import { ATOM_addNode, ATOM_addScope } from "@/lib/store/canvasSlice";
import {
  DeleteButton,
  JavaScriptLogo,
  JuliaLogo,
  PodToolbar,
  PythonLogo,
  RacketLogo,
  SlurpButton,
  UnslurpButton,
} from "./utils";
import { Button, DropdownMenu, IconButton } from "@radix-ui/themes";
import { Ellipsis, NotebookPen } from "lucide-react";
import { Handle, Position } from "@xyflow/react";
import { ATOM_cutId } from "@/lib/store/atom";
import { motion } from "framer-motion";
import { useState } from "react";

function getCoordinates(id: string, nodesMap): { x: number; y: number }[] {
  const node = nodesMap.get(id);
  if (!node) return [];
  const x = node.position.x;
  const y = node.position.y;
  const width = node.width!;
  const height = node.height!;
  const res1 = [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];
  const res2 = node.data.children
    .map((childId) => getCoordinates(childId, nodesMap))
    .flat();
  return [...res1, ...res2];
}

interface Point {
  x: number;
  y: number;
}

function generateSVGPath(points: Point[], padding: number = 5): string {
  if (points.length < 3) {
    return "";
  }

  // Find the convex hull using the Graham scan algorithm
  const hull = grahamScan(points);

  // Add padding to the hull points
  const paddedHull = addPadding(hull, padding);

  // Generate the SVG path
  const path = paddedHull
    .map((p, i) => {
      return `${i === 0 ? "M" : "L"} ${p.x},${p.y}`;
    })
    .join(" ");

  return path + " Z";
}

function grahamScan(points: Point[]): Point[] {
  // Sort points lexicographically
  points.sort((a, b) => a.x - b.x || a.y - b.y);

  const lowerHull: Point[] = [];
  for (const p of points) {
    while (
      lowerHull.length >= 2 &&
      orientation(
        lowerHull[lowerHull.length - 2],
        lowerHull[lowerHull.length - 1],
        p
      ) <= 0
    ) {
      lowerHull.pop();
    }
    lowerHull.push(p);
  }

  const upperHull: Point[] = [];
  for (let i = points.length - 1; i >= 0; i--) {
    while (
      upperHull.length >= 2 &&
      orientation(
        upperHull[upperHull.length - 2],
        upperHull[upperHull.length - 1],
        points[i]
      ) <= 0
    ) {
      upperHull.pop();
    }
    upperHull.push(points[i]);
  }

  // Remove duplicate points
  return [...new Set([...lowerHull, ...upperHull])];
}

function orientation(p: Point, q: Point, r: Point): number {
  return (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
}

function addPadding(hull: Point[], padding: number): Point[] {
  const n = hull.length;
  const paddedHull: Point[] = [];

  for (let i = 0; i < n; i++) {
    const prev = hull[(i - 1 + n) % n];
    const curr = hull[i];
    const next = hull[(i + 1) % n];

    const v1 = { x: curr.x - prev.x, y: curr.y - prev.y };
    const v2 = { x: next.x - curr.x, y: next.y - curr.y };

    const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

    const n1 = { x: -v1.y / len1, y: v1.x / len1 };
    const n2 = { x: -v2.y / len2, y: v2.x / len2 };

    const bisector = {
      x: (n1.x + n2.x) / 2,
      y: (n1.y + n2.y) / 2,
    };

    const lenBisector = Math.sqrt(
      bisector.x * bisector.x + bisector.y * bisector.y
    );
    const paddedPoint = {
      x: curr.x + (padding * bisector.x) / lenBisector,
      y: curr.y + (padding * bisector.y) / lenBisector,
    };

    paddedHull.push(paddedPoint);
  }

  return paddedHull;
}

export function SvgNode({ data }) {
  const nodesMap = useAtomValue(ATOM_nodesMap);
  const points = getCoordinates(data.id, nodesMap);
  // draw the outside contour of all points
  const paths = generateSVGPath(points);
  return (
    <div className="nodrag">
      <svg style={{ display: "block", overflow: "visible" }}>
        <path d={paths} stroke="black" fill="blue" fillOpacity={0.1} />
      </svg>
    </div>
  );
}

function ScopeToolbar({ node }: { node: ScopeNodeType }) {
  const addScope = useSetAtom(ATOM_addScope);
  const id = node.id;

  return (
    <PodToolbar id={id}>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger>
          <IconButton
            variant="ghost"
            radius="small"
            style={{
              margin: 3,
              padding: 0,
            }}
          >
            <Ellipsis />
          </IconButton>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content>
          {/* Structural edit */}
          <DropdownMenu.Separator />
          <DropdownMenu.Item
            onSelect={() => {
              addScope(id);
            }}
          >
            Add Scope
          </DropdownMenu.Item>
          <SlurpButton id={id} />
          <UnslurpButton id={id} />
          <DropdownMenu.Separator />
          <DeleteButton id={id} />
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </PodToolbar>
  );
}

export const ScopeNode = function ({ id }) {
  const nodesMap = useAtomValue(ATOM_nodesMap);
  const node = nodesMap.get(id);
  const cutId = useAtomValue(ATOM_cutId);
  const [hover, setHover] = useState(false);
  const addNode = useSetAtom(ATOM_addNode);
  if (!node) return null;
  if (node.type !== "SCOPE") throw new Error("Invalid node type");
  // node.data.scopeChildren
  return (
    <div
      style={{
        color: "red",
        width: "100%",
        height: "100%",
        border: cutId === id ? "3px dashed red" : "3px solid transparent",
        backgroundColor: "rgba(255, 0, 0, 0.1)",
      }}
      className="nodrag"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      Scope
      <motion.div
        animate={{
          opacity: hover ? 1 : 0,
        }}
      >
        <ScopeToolbar node={node} />
      </motion.div>
      <Handle id="left" type="source" position={Position.Left} />
      <Handle id="right" type="source" position={Position.Right} />
      {node.data.scopeChildren.length === 0 && (
        <DropdownMenu.Root>
          <DropdownMenu.Trigger
            style={{
              // align to the center
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
            }}
          >
            <Button variant="outline">+</Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content variant="soft">
            <DropdownMenu.Item
              shortcut="⌘ D"
              onSelect={() => {
                addNode({ anchorId: id, position: "in", type: "RICH" });
              }}
            >
              <NotebookPen /> Doc
            </DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Item
              shortcut="⌘ E"
              onSelect={() => {
                addNode({
                  anchorId: id,
                  position: "in",
                  type: "CODE",
                  lang: "python",
                });
              }}
            >
              <PythonLogo /> Python
            </DropdownMenu.Item>
            <DropdownMenu.Item
              shortcut="⌘ E"
              onSelect={() => {
                addNode({
                  anchorId: id,
                  position: "in",
                  type: "CODE",
                  lang: "julia",
                });
              }}
            >
              <JuliaLogo /> Julia
            </DropdownMenu.Item>

            <DropdownMenu.Item
              shortcut="⌘ E"
              onSelect={() => {
                addNode({
                  anchorId: id,
                  position: "in",
                  type: "CODE",
                  lang: "javascript",
                });
              }}
            >
              <JavaScriptLogo /> JavaScript
            </DropdownMenu.Item>

            <DropdownMenu.Item
              shortcut="⌘ E"
              onSelect={() => {
                addNode({
                  anchorId: id,
                  position: "in",
                  type: "CODE",
                  lang: "racket",
                });
              }}
            >
              <RacketLogo /> Racket
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      )}
    </div>
  );
};
