import { myassert } from "@/lib/utils/utils";
import {
  Node,
  BaseEdge,
  ConnectionLineComponent,
  ConnectionLineComponentProps,
  EdgeProps,
  getStraightPath,
  useInternalNode,
  XYPosition,
  useStore,
  ReactFlowState,
} from "@xyflow/react";

import { Position, MarkerType } from "@xyflow/react";

// this helper function returns the intersection point
// of the line between the center of the intersectionNode and the target node
function getNodeIntersection(intersectionNode, targetNode) {
  // https://math.stackexchange.com/questions/1724792/an-algorithm-for-finding-the-intersection-point-between-a-center-of-vision-and-a
  const { width: intersectionNodeWidth, height: intersectionNodeHeight } =
    intersectionNode.measured;
  const intersectionNodePosition = intersectionNode.internals.positionAbsolute;
  const targetPosition = targetNode.internals.positionAbsolute;

  const w = intersectionNodeWidth / 2;
  const h = intersectionNodeHeight / 2;

  const x2 = intersectionNodePosition.x + w;
  const y2 = intersectionNodePosition.y + h;
  const x1 = targetPosition.x + targetNode.measured.width / 2;
  const y1 = targetPosition.y + targetNode.measured.height / 2;

  const xx1 = (x1 - x2) / (2 * w) - (y1 - y2) / (2 * h);
  const yy1 = (x1 - x2) / (2 * w) + (y1 - y2) / (2 * h);
  const a = 1 / (Math.abs(xx1) + Math.abs(yy1) || 1);
  const xx3 = a * xx1;
  const yy3 = a * yy1;
  const x = w * (xx3 + yy3) + x2;
  const y = h * (-xx3 + yy3) + y2;

  return { x, y };
}

// returns the position (top,right,bottom or right) passed node compared to the intersection point
function getEdgePosition(node, intersectionPoint) {
  const n = { ...node.measured.positionAbsolute, ...node };
  const nx = Math.round(n.x);
  const ny = Math.round(n.y);
  const px = Math.round(intersectionPoint.x);
  const py = Math.round(intersectionPoint.y);

  if (px <= nx + 1) {
    return Position.Left;
  }
  if (px >= nx + n.measured.width - 1) {
    return Position.Right;
  }
  if (py <= ny + 1) {
    return Position.Top;
  }
  if (py >= n.y + n.measured.height - 1) {
    return Position.Bottom;
  }

  return Position.Top;
}

// returns the parameters (sx, sy, tx, ty, sourcePos, targetPos) you need to create an edge
function getEdgeParams(source, target) {
  const sourceIntersectionPoint = getNodeIntersection(source, target);
  const targetIntersectionPoint = getNodeIntersection(target, source);

  const sourcePos = getEdgePosition(source, sourceIntersectionPoint);
  const targetPos = getEdgePosition(target, targetIntersectionPoint);

  return {
    sx: sourceIntersectionPoint.x,
    sy: sourceIntersectionPoint.y,
    tx: targetIntersectionPoint.x,
    ty: targetIntersectionPoint.y,
    sourcePos,
    targetPos,
  };
}

export function StraightFloatingEdge({
  id,
  source,
  target,
  markerEnd,
  style,
}: EdgeProps) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);

  if (!sourceNode || !targetNode) {
    return null;
  }

  const { sx, sy, tx, ty } = getEdgeParams(sourceNode, targetNode);

  const [edgePath] = getStraightPath({
    sourceX: sx,
    sourceY: sy,
    targetX: tx,
    targetY: ty,
  });

  return <BaseEdge path={edgePath} style={style} markerEnd={markerEnd} />;

  return (
    <path
      id={id}
      className="react-flow__edge-path"
      d={edgePath}
      markerEnd={markerEnd}
      style={style}
    />
  );
}

export function StraightFloatingEdgeGradient_BlueToRed(props: EdgeProps) {
  return StraightFloatingEdgeGradient({
    ...props,
    startColor: "blue",
    stopColor: "red",
    // This marker svg resource is defined in index.html
    markerEnd: "url('#marker-red')",
    style: {
      ...props.style,
      // stroke: "url(#edge-blue-to-red)",
    },
  });
}

export function StraightFloatingEdgeGradient_GreenToOrange(props: EdgeProps) {
  return StraightFloatingEdgeGradient({
    ...props,
    startColor: "green",
    stopColor: "orange",
    markerEnd: "url('#marker-orange')",
    style: {
      ...props.style,
      // stroke: "url(#edge-green-to-orange)",
    },
  });
}

function StraightFloatingEdgeGradient({
  id,
  source,
  target,
  markerEnd,
  style,
  startColor,
  stopColor,
}: EdgeProps & { startColor: string; stopColor: string }) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);

  if (!sourceNode || !targetNode) {
    return null;
  }

  // All edges between these two nodes.
  const alledges = useStore((s: ReactFlowState) => {
    const edges = s.edges.filter(
      (e) =>
        (e.source === source && e.target === target) ||
        (e.target === source && e.source === target)
    );

    return edges;
  });
  myassert(alledges.length > 0);

  let { sx, sy, tx, ty } = getEdgeParams(sourceNode, targetNode);

  let edgePath = "";

  if (alledges.length > 1) {
    // If there are multiple edges between the same two nodes, we need to offset
    // them so they don't overlap.
    const index = alledges.findIndex((e) => e.id === id);
    myassert(index >= 0);
    const { sourceX, sourceY, targetX, targetY } = {
      sourceX: sx,
      sourceY: sy,
      targetX: tx + 0.01,
      targetY: ty + 0.01,
    };
    const centerX = (sourceX + targetX) / 2;
    const centerY = (sourceY + targetY) / 2;

    // the index:
    // 0, 1, 2, 3
    // should map to
    // -20, -10, 10, 20
    const offset =
      index >= alledges.length / 2
        ? (index + 1 - alledges.length / 2) * 30
        : (index - alledges.length / 2) * 30;

    edgePath = `M ${sourceX} ${sourceY} Q ${centerX + offset} ${
      centerY + offset
    } ${targetX} ${targetY}`;
  } else {
    [edgePath] = getStraightPath({
      sourceX: sx,
      sourceY: sy,
      targetX: tx + 0.01,
      targetY: ty + 0.01,
    });
  }

  let x1, y1, x2, y2;

  if (sx === tx) {
    x1 = "0%";
    x2 = "0%";
    y1 = sy > ty ? "100%" : "0%";
    y2 = sy > ty ? "0%" : "100%";
  } else {
    x1 = sx > tx ? "100%" : "0%";
    x2 = sx > tx ? "0%" : "100%";
    y1 = "0%";
    y2 = "0%";
  }

  return (
    <>
      <defs>
        <linearGradient
          // id={"blue-to-red"}
          id={id}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          // gradientUnits="objectBoundingBox"
          // gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" style={{ stopColor: startColor, stopOpacity: 1 }} />
          <stop
            offset="100%"
            style={{ stopColor: stopColor, stopOpacity: 1 }}
          />
        </linearGradient>
      </defs>
      <path
        id={id}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: `url(#${id})`,
        }}
      />
    </>
  );
}

export function ConnectionLineStraight({
  fromX,
  fromY,
  toX,
  toY,
  connectionLineStyle,
}: ConnectionLineComponentProps<Node>) {
  const [edgePath] = getStraightPath({
    sourceX: fromX,
    sourceY: fromY,
    targetX: toX,
    targetY: toY,
  });

  return (
    <g>
      <path style={connectionLineStyle} fill="none" d={edgePath} />
      <circle
        cx={toX}
        cy={toY}
        fill="black"
        r={3}
        stroke="black"
        strokeWidth={1.5}
      />
    </g>
  );
}
