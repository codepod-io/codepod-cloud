import { useAtomValue, useSetAtom } from "jotai";
import { ATOM_nodesMap } from "@/lib/store/yjsSlice";
import { AppNode } from "@/lib/store/types";

import * as Y from "yjs";
import { XYPosition } from "@xyflow/react";

/**
 * Generate the coordinates of the node and its children.
 */
function getCoordinates(id: string, nodesMap: Y.Map<AppNode>): XYPosition[] {
  const node = nodesMap.get(id);
  if (!node) return [];
  const x = node.position.x;
  const y = node.position.y;
  const width = node.measured?.width || 0;
  const height = node.measured?.height || 0;
  const res1 = [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];
  const res2 = node.data.treeChildrenIds
    .map((childId) => getCoordinates(childId, nodesMap))
    .flat();
  return [...res1, ...res2];
}

/**
 * Generate the coordinates only of the node.
 */
function getCoordinates1(id: string, nodesMap: Y.Map<AppNode>): XYPosition[] {
  const node = nodesMap.get(id);
  if (!node) return [];
  const x = node.position.x;
  const y = node.position.y;
  const width = node.measured?.width || 0;
  const height = node.measured?.height || 0;
  const res1 = [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];
  return res1;
}

/**
 * Generate the coordinates of the right side of the node and its children.
 */
function getCoordinates2(id: string, nodesMap: Y.Map<AppNode>): XYPosition[] {
  const node = nodesMap.get(id);
  if (!node) return [];
  const x = node.position.x;
  const y = node.position.y;
  const width = node.measured?.width || 0;
  const height = node.measured?.height || 0;
  const res1 = [
    { x: x + width, y },
    { x: x + width, y: y + height },
  ];
  const res2 = node.data.treeChildrenIds
    .map((childId) => getCoordinates(childId, nodesMap))
    .flat();
  return [...res1, ...res2];
}

function generateHullPoints(
  points: XYPosition[],
  padding: number = 15
): XYPosition[] {
  if (points.length < 3) {
    return [];
  }

  // Find the convex hull using the Graham scan algorithm
  const hull = grahamScan(points);

  // Add padding to the hull points
  const paddedHull = addPadding(hull, padding);
  return paddedHull;
}

function generateSVGPath(points: XYPosition[]): string {
  // Generate the SVG path
  const path = points
    .map((p, i) => {
      return `${i === 0 ? "M" : "L"} ${p.x},${p.y}`;
    })
    .join(" ");

  return path + " Z";
}

function grahamScan(points: XYPosition[]): XYPosition[] {
  // Sort points lexicographically
  points.sort((a, b) => a.x - b.x || a.y - b.y);

  const lowerHull: XYPosition[] = [];
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

  const upperHull: XYPosition[] = [];
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

function orientation(p: XYPosition, q: XYPosition, r: XYPosition): number {
  return (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
}

function addPadding(hull: XYPosition[], padding: number): XYPosition[] {
  const n = hull.length;
  const paddedHull: XYPosition[] = [];

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
  const points1 = getCoordinates1(data.id, nodesMap);
  const points2 = getCoordinates2(data.id, nodesMap);
  const hull1 = generateHullPoints(points1);
  const hull2 = generateHullPoints(points2);
  // Draw the outside contour of all points.
  // Here we merge the hull1 and hull2 to form the final hull.
  const paths = generateSVGPath([
    hull1[0],
    hull1[1],
    hull1[2],
    ...hull2.slice(2),
    hull1[3],
  ]);
  return (
    <div className="nodrag">
      <svg style={{ display: "block", overflow: "visible" }}>
        <path d={paths} stroke="black" fill="blue" fillOpacity={0.1} />
      </svg>
    </div>
  );
}
