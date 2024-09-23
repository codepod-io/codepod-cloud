import { Getter, Setter, atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import * as Y from "yjs";
import { ATOM_codeMap, ATOM_nodesMap, ATOM_richMap } from "./yjsSlice";

import { ATOM_updateView, getAbsPos, updateView } from "./canvasSlice";
import { AppNode } from "./types";
import { Node, Edge } from "@xyflow/react";

import * as cola from "webcola";
import * as d3 from "d3";
import { quadtree } from "d3-quadtree";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCollide,
  forceCenter,
  forceX,
  forceY,
  SimulationNodeDatum,
  SimulationLinkDatum,
} from "d3-force";
import { resolve } from "path";
import { useEffect } from "react";
import { myassert } from "../utils/utils";

const scopeSizeMap = new Map<string, { width: number; height: number }>();

function generateEdge(
  nodesMap: Y.Map<AppNode>
): { source: number; target: number }[] {
  const nodes = Array.from(nodesMap.values());
  const symbol2defNode = new Map<string, string>();
  nodes.forEach((node) => {
    node.data.defs?.forEach((def) => {
      symbol2defNode.set(def, node.id);
    });
  });
  const id2index = new Map<string, number>();
  nodes.forEach((node, index) => {
    id2index.set(node.id, index);
  });
  const res: { source: number; target: number }[] = [];
  nodes.forEach((node) => {
    node.data.uses?.forEach((use) => {
      const defNodeId = symbol2defNode.get(use);
      if (defNodeId) {
        const defnode = nodesMap.get(defNodeId);
        res.push({
          source: id2index.get(node.id)!,
          target: id2index.get(defNodeId)!,
        });
      }
    });
  });
  return res;
}

const sampleData = {
  nodes: [
    { name: "a", width: 60, height: 40 },
    { name: "b", width: 60, height: 40 },
    { name: "c", width: 60, height: 40 },
    { name: "d", width: 60, height: 40 },
    { name: "e", width: 60, height: 40 },
  ],
  links: [
    { source: 1, target: 2 },
    { source: 2, target: 0 },
    { source: 2, target: 3 },
    { source: 2, target: 4 },
  ],
  constraints: [
    {
      type: "alignment",
      axis: "x",
      offsets: [
        { node: "1", offset: "0" },
        { node: "2", offset: "0" },
        { node: "3", offset: "0" },
      ],
    },
    {
      type: "alignment",
      axis: "y",
      offsets: [
        { node: "0", offset: "0" },
        { node: "1", offset: "0" },
        { node: "4", offset: "0" },
      ],
    },
  ],
};

type LayoutNode = {
  id: string;
  width: number;
  height: number;
  x?: number;
  y?: number;
};

type LayoutEdge = {
  source: number;
  target: number;
};

async function layoutNodesAndEdges(nodesMap: Y.Map<AppNode>) {
  console.log("layoutNodesAndEdges");
  // get all nodes
  const _nodes = Array.from(nodesMap.values());
  const nodes: LayoutNode[] = _nodes.map((node) => {
    return {
      id: node.id,
      // width: node.data.mywidth!,
      // height: node.data.myheight!,
      width: node.measured?.width || 60,
      height: node.measured?.height || 40,
      x: node.position?.x,
      y: node.position?.y,
    };
  });
  // get all edges
  const links = generateEdge(nodesMap);

  console.log("nodes", nodes);
  console.log("links", links);

  // Use cola.js for layout
  const colaLayout = cola
    .d3adaptor(d3)
    .nodes(nodes)
    .links(links)
    // .nodes(sampleData.nodes)
    // .links(sampleData.links)
    .size([180, 160]) // Set canvas size or get dynamically
    .linkDistance(200) // Distance between nodes
    // Avoid node overlaps
    .avoidOverlaps(true)
    .start(20);

  return new Promise<void>((resolve) => {
    colaLayout.on("end", () => {
      console.log("=== end");
      nodes.forEach((node) => {
        console.log(
          `node-${node.id} auto layout to ${node.x! - node.width / 2},${node.y! - node.height / 2}`
        );
        nodesMap.set(node.id, {
          ...nodesMap.get(node.id)!,
          position: {
            x: node.x! - node.width / 2,
            y: node.y! - node.height / 2,
          },
        });
        // const nodeElem = d3.select(`#node-${node.id}`);
        // nodeElem.attr(
        //   "transform",
        //   `translate(${node.position.x},${node.position.y})`
        // );
      });
      resolve();
    });
  });
  return;
  // Update node positions
  // colaLayout.on("tick", () => {
  //   // This is way too often. We could use 'end' event instead.
  //   return;
  //   console.log("NONONONONO tick");
  //   // console.log("data", sampleData);

  //   nodes.forEach((node) => {
  //     console.log(`node-${node.id} auto layout to ${node.x},${node.y}`);
  //     nodesMap.set(node.id, {
  //       ...nodesMap.get(node.id)!,
  //       position: { x: node.x! - node.width / 2, y: node.y! - node.height / 2 },
  //     });
  //     // const nodeElem = d3.select(`#node-${node.id}`);
  //     // nodeElem.attr(
  //     //   "transform",
  //     //   `translate(${node.position.x},${node.position.y})`
  //     // );
  //   });

  //   links.forEach((edge, index) => {
  //     // console.log(
  //     //   `edge-${index} auto layout from ${nodes[edge.source].id} to ${nodes[edge.target].id}`
  //     // );
  //     // const edgeElem = d3.select(`#edge-${index}`);
  //     // const source = nodes[edge.source];
  //     // const target = nodes[edge.target];
  //     // if (source && target) {
  //     //   edgeElem
  //     //     .attr("x1", source.position.x)
  //     //     .attr("y1", source.position.y)
  //     //     .attr("x2", target.position.x)
  //     //     .attr("y2", target.position.y);
  //     // }
  //   });
  // });
}

function generateEdgeD3(
  nodesMap: Y.Map<AppNode>
): { source: string; target: string }[] {
  const nodes = Array.from(nodesMap.values());
  const symbol2defNode = new Map<string, string>();
  nodes.forEach((node) => {
    node.data.defs?.forEach((def) => {
      symbol2defNode.set(def, node.id);
    });
  });
  const id2index = new Map<string, number>();
  nodes.forEach((node, index) => {
    id2index.set(node.id, index);
  });
  const res: { source: string; target: string }[] = [];
  nodes.forEach((node) => {
    node.data.uses?.forEach((use) => {
      const defNodeId = symbol2defNode.get(use);
      if (defNodeId) {
        const defnode = nodesMap.get(defNodeId);
        res.push({
          source: node.id,
          target: defNodeId,
        });
      }
    });
  });
  return res;
}

type NodeType = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

function forceCollideRect() {
  let nodes;

  function force(alpha) {
    const padding = 5;
    const quad = quadtree(
      nodes,
      (d: NodeType) => d.x,
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

async function layoutD3Force(nodesMap: Y.Map<AppNode>) {
  // get all nodes
  const _nodes = Array.from(nodesMap.values());
  const nodes: LayoutNode[] = _nodes.map((node) => {
    return {
      id: node.id,
      // width: node.data.mywidth!,
      // height: node.data.myheight!,
      width: node.measured?.width || 60,
      height: node.measured?.height || 40,
      x: node.position?.x,
      y: node.position?.y,
    };
  });
  // get all edges
  const links = generateEdgeD3(nodesMap);

  console.log("nodes", nodes);
  console.log("links", links);

  // Use cola.js for layout
  // const colaLayout = cola.d3adaptor(d3);
  //   .nodes(nodes)
  //   .links(links)
  //   // .nodes(sampleData.nodes)
  //   // .links(sampleData.links)
  //   .size([180, 160]) // Set canvas size or get dynamically
  //   .linkDistance(200) // Distance between nodes
  //   // Avoid node overlaps
  //   .avoidOverlaps(true)
  //   .start(20);

  // Create a simulation with several forces.
  const simulation = d3
    .forceSimulation(nodes)
    .force("collide", forceCollideRect())
    // .force(
    //   "link",
    //   d3.forceLink(links).id((d) => d.id)
    // )
    .force("charge", d3.forceManyBody())
    .force("center", d3.forceCenter(0, 0))
    .stop();

  simulation.tick(10);

  nodes.forEach((node) => {
    console.log(
      `node-${node.id} auto layout to ${node.x! - node.width / 2},${node.y! - node.height / 2}`
    );
    nodesMap.set(node.id, {
      ...nodesMap.get(node.id)!,
      position: {
        x: node.x! - node.width / 2,
        y: node.y! - node.height / 2,
      },
    });
    // const nodeElem = d3.select(`#node-${node.id}`);
    // nodeElem.attr(
    //   "transform",
    //   `translate(${node.position.x},${node.position.y})`
    // );
  });
  return;

  return new Promise<void>((resolve) => {
    simulation.on("end", () => {
      // colaLayout.on("end", () => {
      console.log("=== end");
      nodes.forEach((node) => {
        console.log(
          `node-${node.id} auto layout to ${node.x! - node.width / 2},${node.y! - node.height / 2}`
        );
        nodesMap.set(node.id, {
          ...nodesMap.get(node.id)!,
          position: {
            x: node.x! - node.width / 2,
            y: node.y! - node.height / 2,
          },
        });
        // const nodeElem = d3.select(`#node-${node.id}`);
        // nodeElem.attr(
        //   "transform",
        //   `translate(${node.position.x},${node.position.y})`
        // );
      });
      resolve();
    });
  });
  return;
  // Update node positions
  // colaLayout.on("tick", () => {
  //   // This is way too often. We could use 'end' event instead.
  //   return;
  //   console.log("NONONONONO tick");
  //   // console.log("data", sampleData);

  //   nodes.forEach((node) => {
  //     console.log(`node-${node.id} auto layout to ${node.x},${node.y}`);
  //     nodesMap.set(node.id, {
  //       ...nodesMap.get(node.id)!,
  //       position: { x: node.x! - node.width / 2, y: node.y! - node.height / 2 },
  //     });
  //     // const nodeElem = d3.select(`#node-${node.id}`);
  //     // nodeElem.attr(
  //     //   "transform",
  //     //   `translate(${node.position.x},${node.position.y})`
  //     // );
  //   });

  //   links.forEach((edge, index) => {
  //     // console.log(
  //     //   `edge-${index} auto layout from ${nodes[edge.source].id} to ${nodes[edge.target].id}`
  //     // );
  //     // const edgeElem = d3.select(`#edge-${index}`);
  //     // const source = nodes[edge.source];
  //     // const target = nodes[edge.target];
  //     // if (source && target) {
  //     //   edgeElem
  //     //     .attr("x1", source.position.x)
  //     //     .attr("y1", source.position.y)
  //     //     .attr("x2", target.position.x)
  //     //     .attr("y2", target.position.y);
  //     // }
  //   });
  // });
}

export async function autoLayout(get: Getter, set: Setter) {
  // console.log("autoLayoutTree");
  // measure the time of the operation
  const start = performance.now();
  const nodesMap = get(ATOM_nodesMap);
  // const richMap = get(ATOM_richMap);
  // const codeMap = get(ATOM_codeMap);
  // // load data into nodesMap
  // nodesMap.clear();
  // richMap.clear();
  // codeMap.clear();
  // sampleNodes.forEach((node, id) => {
  //   nodesMap.set(id, node);
  //   codeMap.set(id, new Y.Text());
  //   richMap.set(id, new Y.XmlFragment());
  // });

  // prepare data for d3 auto layout
  // await layoutNodesAndEdges(nodesMap);
  // await layoutD3Force(nodesMap);

  updateView(get, set);
  const end = performance.now();
  // round to 2 decimal places
  console.debug("[perf] autoLayoutTree took", (end - start).toFixed(2), "ms");
}

// DEPRECATED
export const ATOM_autoLayout = atom(null, autoLayout);

const simulation = forceSimulation()
  .force("charge", forceManyBody().strength(-1000))
  .force("x", forceX().x(0).strength(0.05))
  .force("y", forceY().y(0).strength(0.05))
  .force("collide", forceCollideRect())
  .alphaTarget(0.05)
  .stop();

export function useForce() {
  // console.log("useForce");
  // return;
  const nodesMap = useAtomValue(ATOM_nodesMap);
  const updateView = useSetAtom(ATOM_updateView);
  // console.log("ref", draggingNodeRef.current);
  useEffect(() => {
    console.log("====");
    const _nodes = Array.from(nodesMap.values());
    const nodes: LayoutNode[] = _nodes.map((node) => {
      return {
        id: node.id,
        // width: node.data.mywidth!,
        // height: node.data.myheight!,
        width: node.measured?.width || 60,
        height: node.measured?.height || 40,
        x: node.position?.x,
        y: node.position?.y,
      };
    });
    // get all edges
    const links = generateEdgeD3(nodesMap);
    // Create a simulation with several forces.
    // const simulation = d3
    //   // .forceSimulation(nodes)
    //   .forceSimulation()
    //   .force("collide", forceCollideRect())
    //   // .force(
    //   //   "link",
    //   //   d3.forceLink(links).id((d) => d.id)
    //   // )
    //   .force("x", forceX().x(0).strength(0.05))
    //   .force("y", forceY().y(0).strength(0.05))
    //   .force("charge", d3.forceManyBody().strength(-1000))
    //   // .force("center", d3.forceCenter(0, 0))
    //   .stop();

    const simulation = forceSimulation()
      .force("charge", forceManyBody().strength(-1000))
      .force("x", forceX().x(0).strength(0.05))
      .force("y", forceY().y(0).strength(0.05))
      .force("collide", forceCollideRect())
      .alphaTarget(0.05)
      .stop();

    // simulation.tick(10);
    // simulation.start();

    simulation.nodes(nodes).force(
      "link",
      forceLink(links)
        .id((d: any) => d.id)
        .strength(0.05)
        .distance(100)
    );
    // simulation.start();
    simulation.tick(80);
    // simulation.restart();
    // simulation.on("tick", () => {
    //   nodes.forEach((node) => {
    //     console.log("tick");
    //     // console.log(
    //     //   `??? node-${node.id} auto layout to ${node.x! - node.width / 2},${node.y! - node.height / 2}`
    //     // );
    //     const dragging = draggingNodeId === node.id;
    //     const reactflowNode = nodesMap.get(node.id);
    //     myassert(reactflowNode);
    //     nodesMap.set(node.id, {
    //       ...reactflowNode,
    //       position: {
    //         // x: node.x! - node.width / 2,
    //         // y: node.y! - node.height / 2,
    //         // x: node.x!,
    //         // y: node.y!,
    //         x: dragging ? reactflowNode.position.x : node.x!,
    //         y: dragging ? reactflowNode.position.y : node.y!,
    //       },
    //       // Setting the fx/fy properties of a node tells the simulation to "fix"
    //       // the node at that position and ignore any forces that would normally
    //       // cause it to move.
    //       fx: dragging ? reactflowNode.position.x : undefined,
    //       fy: dragging ? reactflowNode.position.y : undefined,
    //     });
    //   });
    //   updateView();
    // });

    nodes.forEach((node) => {
      // console.log(
      //   `??? node-${node.id} auto layout to ${node.x! - node.width / 2},${node.y! - node.height / 2}`
      // );
      // const dragging = draggingNodeId === node.id;
      const reactflowNode = nodesMap.get(node.id);
      myassert(reactflowNode);
      nodesMap.set(node.id, {
        ...reactflowNode,
        position: {
          // x: node.x! - node.width / 2,
          // y: node.y! - node.height / 2,
          x: node.x!,
          y: node.y!,
        },
        // Setting the fx/fy properties of a node tells the simulation to "fix"
        // the node at that position and ignore any forces that would normally
        // cause it to move.
        // fx: dragging ? reactflowNode.position.x : undefined,
        // fy: dragging ? reactflowNode.position.y : undefined,
      });
    });
    // updateView();

    return () => {
      // stop the simulation
      simulation.stop();
    };
  });
}

export function useForce2(draggingNodeId) {
  const nodesMap = useAtomValue(ATOM_nodesMap);
  useEffect(() => {
    // get all nodes
    const _nodes = Array.from(nodesMap.values());
    const nodes: LayoutNode[] = _nodes.map((node) => {
      return {
        id: node.id,
        // width: node.data.mywidth!,
        // height: node.data.myheight!,
        width: node.measured?.width || 60,
        height: node.measured?.height || 40,
        x: node.position?.x,
        y: node.position?.y,
      };
    });
    // get all edges
    const links = generateEdge(nodesMap);

    // console.log("nodes", nodes);
    // console.log("links", links);

    // Use cola.js for layout
    const colaLayout = cola
      .d3adaptor(d3)
      .nodes(nodes)
      .links(links)
      // .nodes(sampleData.nodes)
      // .links(sampleData.links)
      .size([180, 160]) // Set canvas size or get dynamically
      .linkDistance(200) // Distance between nodes
      // Avoid node overlaps
      .avoidOverlaps(true);

    colaLayout.start(10, 15, 20);
    // simulation.restart();
    // simulation.on("tick", () => {
    //   nodes.forEach((node) => {
    //     console.log("tick");
    //     // console.log(
    //     //   `??? node-${node.id} auto layout to ${node.x! - node.width / 2},${node.y! - node.height / 2}`
    //     // );
    //     const dragging = draggingNodeId === node.id;
    //     const reactflowNode = nodesMap.get(node.id);
    //     myassert(reactflowNode);
    //     nodesMap.set(node.id, {
    //       ...reactflowNode,
    //       position: {
    //         // x: node.x! - node.width / 2,
    //         // y: node.y! - node.height / 2,
    //         // x: node.x!,
    //         // y: node.y!,
    //         x: dragging ? reactflowNode.position.x : node.x!,
    //         y: dragging ? reactflowNode.position.y : node.y!,
    //       },
    //       // Setting the fx/fy properties of a node tells the simulation to "fix"
    //       // the node at that position and ignore any forces that would normally
    //       // cause it to move.
    //       fx: dragging ? reactflowNode.position.x : undefined,
    //       fy: dragging ? reactflowNode.position.y : undefined,
    //     });
    //   });
    //   updateView();
    // });

    colaLayout.on("tick", () => {
      console.log("tick");
      nodes.forEach((node) => {
        // console.log(
        //   `node-${node.id} auto layout to ${node.x! - node.width / 2},${node.y! - node.height / 2}`
        // );
        nodesMap.set(node.id, {
          ...nodesMap.get(node.id)!,
          position: {
            // x: node.x! - node.width / 2,
            // y: node.y! - node.height / 2,
            x: node.x!,
            y: node.y!,
          },
        });
      });
    });

    // nodes.forEach((node) => {
    //   // console.log(
    //   //   `??? node-${node.id} auto layout to ${node.x! - node.width / 2},${node.y! - node.height / 2}`
    //   // );
    //   const dragging = draggingNodeId === node.id;
    //   const reactflowNode = nodesMap.get(node.id);
    //   myassert(reactflowNode);
    //   nodesMap.set(node.id, {
    //     ...reactflowNode,
    //     position: {
    //       // x: node.x! - node.width / 2,
    //       // y: node.y! - node.height / 2,
    //       x: node.x!,
    //       y: node.y!,
    //     },
    //     // Setting the fx/fy properties of a node tells the simulation to "fix"
    //     // the node at that position and ignore any forces that would normally
    //     // cause it to move.
    //     fx: dragging ? reactflowNode.position.x : undefined,
    //     fy: dragging ? reactflowNode.position.y : undefined,
    //   });
    // });
    // updateView();

    return () => {
      // stop the simulation
      console.log("stop");
      simulation.stop();
    };
  }, [draggingNodeId]);
}
