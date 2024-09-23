import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceX,
  forceY,
} from "d3-force";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Panel,
  useNodesState,
  useEdgesState,
  useReactFlow,
  useNodesInitialized,
  Node,
  Handle,
  Position,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";

import { quadtree } from "d3-quadtree";

import * as cola from "webcola";
import * as d3 from "d3";
import { css } from "@emotion/css";
import { Flex } from "@radix-ui/themes";

const initialNodes = [
  {
    id: "1",
    type: "input",
    data: { label: "input" },
    position: { x: 0, y: 0 },
  },
  {
    id: "2",
    data: { label: "node 2" },
    position: { x: 0, y: 100 },
  },
  {
    id: "2a",
    data: { label: "node 2a" },
    position: { x: 0, y: 200 },
  },
  {
    id: "2b",
    data: { label: "node 2b" },
    position: { x: 0, y: 300 },
  },
  {
    id: "2c",
    data: { label: "node 2c" },
    position: { x: 0, y: 400 },
  },
  {
    id: "2d",
    data: { label: "node 2d" },
    position: { x: 0, y: 500 },
  },
  {
    id: "3",
    data: { label: "node 3" },
    position: { x: 200, y: 100 },
  },
];

const initialEdges = [
  { id: "e12", source: "1", target: "2", animated: true },
  { id: "e13", source: "1", target: "3", animated: true },
  { id: "e22a", source: "2", target: "2a", animated: true },
  { id: "e22b", source: "2", target: "2b", animated: true },
  { id: "e22c", source: "2", target: "2c", animated: true },
  { id: "e2c2d", source: "2c", target: "2d", animated: true },
];

const links = [
  { source: 0, target: 1 },
  { source: 0, target: 2 },
  { source: 1, target: 3 },
  { source: 1, target: 4 },
  { source: 1, target: 5 },
  { source: 5, target: 6 },
];

const data = {
  nodes: [
    { name: "a", width: 60, height: 40 },
    { name: "b", width: 60, height: 40 },
    { name: "c", width: 160, height: 140 },
    { name: "d", width: 60, height: 40 },
    { name: "e", width: 60, height: 40 },
  ],
  links: [
    { source: 0, target: 1 },
    { source: 1, target: 2 },
    { source: 2, target: 0 },
    { source: 2, target: 3 },
  ],
};

// const useLayoutedElements = (draggingNodeRef) => {
//   const { getNodes, setNodes, getEdges, fitView } = useReactFlow<
//     Node & { fx?: number; fy?: number }
//   >();
//   const initialized = useNodesInitialized();

//   useEffect(() => {
//     if (initialized) {
//       let nodes = getNodes().map((node) => ({
//         ...node,
//         x: node.position.x,
//         y: node.position.y,
//       }));
//       let edges = getEdges().map((edge) => edge);
//       //   const links = data.links;
//       const links = links2;

//       // If React Flow hasn't initialized our nodes with a width and height yet, or
//       // if there are no nodes in the flow, then we can't run the simulation!
//       if (nodes.length === 0) return;

//       const simulation = cola
//         .d3adaptor(d3)
//         .nodes(nodes)
//         .links(links)
//         // .nodes(sampleData.nodes)
//         // .links(sampleData.links)
//         // .size([180, 160]) // Set canvas size or get dynamically
//         .linkDistance(200) // Distance between nodes
//         // Avoid node overlaps
//         .avoidOverlaps(true);

//       simulation.start(10, 0, 0);
//       // simulation.start();

//       simulation.on("tick", () => {
//         console.log("tick");
//         // console.log("nodes", new Date(), nodes);
//         // return;
//         getNodes().forEach((node, i) => {
//           const dragging = draggingNodeRef?.current?.id === node.id;

//           // Setting the fx/fy properties of a node tells the simulation to "fix"
//           // the node at that position and ignore any forces that would normally
//           // cause it to move.
//           if (dragging) {
//             nodes[i].fx = node.position.x;
//             nodes[i].fy = node.position.y;
//           } else {
//             delete nodes[i].fx;
//             delete nodes[i].fy;
//           }
//         });

//         // simulation.tick();
//         setNodes(
//           nodes.map((node) => ({
//             ...node,
//             position: { x: node.fx ?? node.x, y: node.fy ?? node.y },
//           }))
//         );

//         // window.requestAnimationFrame(() => {
//         //     // Give React and React Flow a chance to update and render the new node
//         //     // positions before we fit the viewport to the new layout.
//         //     //   fitView();

//         //     // If the simulation hasn't been stopped, schedule another tick.
//         //     if (running) tick();
//         // });
//       });
//     }
//   });
// };

const initialNodes2 = [
  {
    id: "a",
    width: 60,
    height: 40,
    position: { x: 0, y: 0 },
    data: { label: "a" },
  },
  {
    id: "b",
    width: 60,
    height: 40,
    position: { x: 0, y: 100 },
    data: { label: "b" },
  },
  {
    id: "c",
    width: 160,
    height: 140,
    position: { x: 0, y: 200 },
    data: { label: "c" },
  },
  {
    id: "d",
    width: 60,
    height: 40,
    position: { x: 0, y: 300 },
    data: { label: "d" },
  },
  {
    id: "e",
    width: 60,
    height: 40,
    position: { x: 0, y: 400 },
    data: { label: "e" },
  },
];
const initialEdges2 = [
  { id: "e_ab", source: "a", target: "b" },
  //   { source: "b", target: "c" },
  { id: "e_bc", source: "b", target: "c" },
  //   { source: "c", target: "a" },
  { id: "e_ca", source: "c", target: "a" },
  //   { source: "c", target: "d" },
  { id: "e_cd", source: "c", target: "d" },
];

const links2 = [
  { source: 0, target: 1 },
  { source: 1, target: 2 },
  { source: 2, target: 0 },
  { source: 2, target: 3 },
];

function MyNode({ data }) {
  return (
    <div>
      <Handle type="source" position={Position.Left} id="a" />
      {data.label}
    </div>
  );
}

const nodeTypes = {
  MyNode,
};

async function waitForCola(simulation) {
  let count = 0;
  return new Promise((resolve) => {
    simulation.on("tick", () => {
      count += 1;
      if (count == 10) {
        simulation.stop();
        resolve(true);
      }
      // resolve(true);
    });
  });
}

export const ColaLayoutFlow = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes2);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges2);
  const initialized = useNodesInitialized();
  const { getNodes, getEdges } = useReactFlow();

  const onNodeDrag = useCallback(
    async (event, node) => {
      console.log("drag");
      if (!initialized) return;
      const nodes = getNodes().map((node) => ({
        ...node,
        x: node.position.x,
        y: node.position.y,
      }));
      const links2 = [
        { source: 0, target: 1 },
        { source: 1, target: 2 },
        { source: 2, target: 0 },
        { source: 2, target: 3 },
      ];
      getNodes().forEach((node, i) => {
        const dragging = Boolean(
          document.querySelector(`[data-id="${node.id}"].dragging`)
        );

        // Setting the fx/fy properties of a node tells the simulation to "fix"
        // the node at that position and ignore any forces that would normally
        // cause it to move.
        // (nodes[i] as any).fx = dragging ? node.position.x : undefined;
        // (nodes[i] as any).fy = dragging ? node.position.y : undefined;
        (nodes[i] as any).fixed = dragging ? true : undefined;
      });

      // console.log("nodes", nodes);

      const simulation = cola
        .d3adaptor(d3)
        // .size([180, 160]) // Set canvas size or get dynamically
        .linkDistance(160) // Distance between nodes
        // .handleDisconnected(false)
        // Avoid node overlaps
        .avoidOverlaps(true);

      simulation.stop();
      simulation.nodes(nodes).links(links2);
      // simulation.convergenceThreshold(0.1)
      // simulation.start(10, 15, 20);
      simulation.start(10, 0, 10);
      // simulation.start();
      await waitForCola(simulation);
      console.log("set");
      setNodes((prevNodes) =>
        prevNodes.map((n: any, i) => {
          if (n.id === node.id)
            return {
              ...n,
              // position: {
              //   x: (nodes[i] as any).fx - (nodes[i] as any).width / 2,
              //   y: (nodes[i] as any).fy - (nodes[i] as any).height / 2,
              // },
            };
          return {
            ...n,
            position: {
              x: nodes[i].x - (nodes[i] as any).width / 2,
              y: nodes[i].y - (nodes[i] as any).height / 2,
              // x: nodes[i].x,
              // y: nodes[i].y,
            },
          };
        })
      );
      // simulation.on("tick", () => {
      //   console.log(
      //     "tick",
      //     nodes.map((n) => n.x)
      //   );
      //   // console.log("tick", nodes);
      //   setNodes((prevNodes) =>
      //     prevNodes.map((n: any, i) => {
      //       if (n.id === node.id)
      //         return {
      //           ...n,
      //           // position: {
      //           //   x: (nodes[i] as any).fx - (nodes[i] as any).width / 2,
      //           //   y: (nodes[i] as any).fy - (nodes[i] as any).height / 2,
      //           // },
      //         };
      //       return {
      //         ...n,
      //         position: {
      //           x: nodes[i].x - (nodes[i] as any).width / 2,
      //           y: nodes[i].y - (nodes[i] as any).height / 2,
      //           // x: nodes[i].x,
      //           // y: nodes[i].y,
      //         },
      //       };
      //     })
      //   );
      // });

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
    <Flex
      flexGrow={"1"}
      // className={css`
      //   .react-flow .react-flow__handle {
      //     top: 50%;
      //     left: 50%;
      //     right: auto;
      //     bottom: auto;
      //     transform: translate(-50%, -50%);
      //   }
      // `}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={{
          type: "straight",
        }}
        onNodeDrag={onNodeDrag}
        // onNodeDragStop={onNodeDrag}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        zoomOnScroll={false}
        panOnScroll={true}
      ></ReactFlow>
    </Flex>
  );
};
