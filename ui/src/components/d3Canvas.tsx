import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceX,
  forceY,
} from "d3-force";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Panel,
  useNodesState,
  useEdgesState,
  useReactFlow,
  useNodesInitialized,
  addEdge,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
} from "@xyflow/react";

import * as d3 from "d3";

import "@xyflow/react/dist/style.css";

import { quadtree } from "d3-quadtree";
import { Flex } from "@radix-ui/themes";

export function collide() {
  let nodes: any[] = [];
  let force = (alpha) => {
    const tree = quadtree(
      nodes,
      (d) => d.x,
      (d) => d.y
    );

    for (const node of nodes) {
      const r = node.measured.width / 2;
      const nx1 = node.x - r;
      const nx2 = node.x + r;
      const ny1 = node.y - r;
      const ny2 = node.y + r;

      tree.visit((quad, x1, y1, x2, y2) => {
        if (!quad.length) {
          do {
            if (quad.data !== node) {
              const r = node.measured.width / 2 + quad.data.width / 2;
              let x = node.x - quad.data.x;
              let y = node.y - quad.data.y;
              let l = Math.hypot(x, y);

              if (l < r) {
                l = ((l - r) / l) * alpha;
                node.x -= x *= l;
                node.y -= y *= l;
                quad.data.x += x;
                quad.data.y += y;
              }
            }
          } while ((quad = quad.next));
        }

        return x1 > nx2 || x2 < nx1 || y1 > ny2 || y2 < ny1;
      });
    }
  };

  (force as any).initialize = (newNodes) => (nodes = newNodes);

  return force;
}

function forceCollideRect() {
  let nodes;

  function force(alpha) {
    const padding = 5;
    const quad = quadtree(
      nodes,
      (d: any) => d.x,
      (d) => d.y
    );
    for (const d of nodes) {
      quad.visit((q: any, x1, y1, x2, y2) => {
        let updated = false;
        if (q.data && q.data !== d) {
          let x = d.x - q.data.x,
            y = d.y - q.data.y,
            xSpacing = padding + (q.data.width + d.width) / 2,
            ySpacing = padding + (q.data.height + d.height) / 2,
            absX = Math.abs(x),
            absY = Math.abs(y),
            l,
            lx,
            ly;

          if (absX < xSpacing && absY < ySpacing) {
            l = Math.sqrt(x * x + y * y);

            lx = (absX - xSpacing) / l;
            ly = (absY - ySpacing) / l;

            // the one that's barely within the bounds probably triggered the collision
            if (Math.abs(lx) > Math.abs(ly)) {
              lx = 0;
            } else {
              ly = 0;
            }
            d.x -= x *= lx;
            d.y -= y *= ly;
            q.data.x += x;
            q.data.y += y;

            updated = true;
          }
        }
        return updated;
      });
    }
  }

  force.initialize = (_) => (nodes = _);

  return force;
}

// const initialNodes = [
//   {
//     id: "1",
//     type: "input",
//     data: { label: "input" },
//     position: { x: 0, y: 0 },
//   },
//   {
//     id: "2",
//     data: { label: "node 2" },
//     position: { x: 0, y: 100 },
//   },
//   {
//     id: "2a",
//     data: { label: "node 2a" },
//     position: { x: 0, y: 200 },
//   },
//   {
//     id: "2b",
//     data: { label: "node 2b" },
//     position: { x: 0, y: 300 },
//   },
//   {
//     id: "2c",
//     data: { label: "node 2c" },
//     position: { x: 0, y: 400 },
//   },
//   {
//     id: "2d",
//     data: { label: "node 2d" },
//     position: { x: 0, y: 500 },
//   },
//   {
//     id: "3",
//     data: { label: "node 3" },
//     position: { x: 200, y: 100 },
//   },
// ];

// const initialEdges = [
//   { id: "e12", source: "1", target: "2", animated: true },
//   { id: "e13", source: "1", target: "3", animated: true },
//   { id: "e22a", source: "2", target: "2a", animated: true },
//   { id: "e22b", source: "2", target: "2b", animated: true },
//   { id: "e22c", source: "2", target: "2c", animated: true },
//   { id: "e2c2d", source: "2c", target: "2d", animated: true },
// ];

// a graph with 100 nodes
const initialNodes = new Array(100).fill(0).map((_, i) => ({
  id: i.toString(),
  position: { x: 0, y: 0 },
  data: { label: `node ${i}` },
}));
const initialEdges = new Array(100).fill(0).map((_, i) => ({
  id: i.toString(),
  source: i.toString(),
  target: ((i + 1) % 100).toString(),
}));

export const LayoutFlow = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const initialized = useNodesInitialized();

  const { getNodes, getEdges } = useReactFlow();

  const onNodeDrag = useCallback(
    (event, node) => {
      console.log("drag");
      if (!initialized) return;
      const nodes = getNodes().map((node) => ({
        ...node,
        x: node.position.x,
        y: node.position.y,
      }));
      const edges = getEdges().map((edge) => edge);
      getNodes().forEach((node, i) => {
        const dragging = Boolean(
          document.querySelector(`[data-id="${node.id}"].dragging`)
        );

        // Setting the fx/fy properties of a node tells the simulation to "fix"
        // the node at that position and ignore any forces that would normally
        // cause it to move.
        (nodes[i] as any).fx = dragging ? node.position.x : null;
        (nodes[i] as any).fy = dragging ? node.position.y : null;
      });

      // const simulation = d3
      //   .forceSimulation(nodes as any)
      //   .force(
      //     "link",
      //     d3
      //       .forceLink(edges)
      //       .id((d: any) => d.id)
      //       .distance(100)
      //   )
      //   // .force("charge", d3.forceManyBody().strength(-300))
      //   .force("center", d3.forceCenter(300, 300))
      //   .force("collide", collide());

      // simulation.stop();
      // simulation.tick(10);

      const global_simulation = forceSimulation()
        .force("charge", forceManyBody().strength(-1000))
        .force("x", forceX().x(0).strength(0.05))
        .force("y", forceY().y(0).strength(0.05))
        .force("collide", collide())
        .alphaTarget(0.05)
        .stop();

      global_simulation.nodes(nodes).force(
        "link",
        forceLink(edges)
          .id((d: any) => d.id)
          .strength(0.05)
          .distance(100)
      );
      global_simulation.tick(10);
      console.log("set");
      setNodes((prevNodes) =>
        prevNodes.map((n: any, i) => {
          if (n.id === node.id) return n;
          return {
            ...n,
            position: { x: nodes[i].x, y: nodes[i].y },
          };
        })
      );

      // setNodes(
      //   nodes.map((node: any) => ({
      //     ...node,
      //     position: { x: node.x, y: node.y },
      //   }))
      // );
    },
    [initialized]
  );

  return (
    <Flex flexGrow={"1"}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        // onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        // onNodeDragStop={onNodeDragStop}
        zoomOnScroll={false}
        panOnScroll={true}
      >
        <Controls />
        <MiniMap />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
      </ReactFlow>
    </Flex>
  );
};
