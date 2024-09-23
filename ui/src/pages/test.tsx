// import React, { useEffect, useRef, useState } from "react";
// import * as d3 from "d3";
// import * as cola from "webcola";

// // Custom Node Component
// const CustomNode = ({ node, x, y }) => {
//   return (
//     <g transform={`translate(${x}, ${y})`}>
//       <rect
//         width={node.width}
//         height={node.height}
//         rx={5}
//         ry={5}
//         style={{ fill: "lightblue", stroke: "black", strokeWidth: 2 }}
//       />
//       <text
//         x={node.width / 2}
//         y={node.height / 2}
//         fill="black"
//         textAnchor="middle"
//         alignmentBaseline="middle"
//         style={{ fontSize: 14 }}
//       >
//         {node.name}
//       </text>
//       <foreignObject
//         x={10}
//         y={10}
//         width={node.width - 20}
//         height={node.height - 20}
//       >
//         <button
//           style={{ width: "100%", height: "100%" }}
//           onClick={(e) => {
//             e.stopPropagation(); // Prevent triggering drag on button click
//             alert(`Button clicked in node ${node.name}`);
//           }}
//         >
//           Click Me
//         </button>
//       </foreignObject>
//     </g>
//   );
// };

// const data = {
//   nodes: [
//     { name: "a", width: 60, height: 40 },
//     { name: "b", width: 60, height: 40 },
//     { name: "c", width: 160, height: 140 },
//     { name: "d", width: 60, height: 40 },
//     { name: "e", width: 60, height: 40 },
//   ],
//   links: [
//     { source: 0, target: 1 },
//     { source: 1, target: 2 },
//     { source: 2, target: 0 },
//     { source: 2, target: 3 },
//   ],
// };

// const Graph = () => {
//   const svgRef = useRef(null);
//   const [nodesState, setNodesState] = useState<any>([]);

//   const width = 960;
//   const height = 500;

//   useEffect(() => {
//     const nodes = [
//       { name: "a", width: 60, height: 40 },
//       { name: "b", width: 60, height: 40 },
//       { name: "c", width: 160, height: 140 },
//       { name: "d", width: 60, height: 40 },
//       { name: "e", width: 60, height: 40 },
//     ];

//     const links = [
//       { source: 0, target: 1 },
//       { source: 1, target: 2 },
//       { source: 2, target: 0 },
//       { source: 2, target: 3 },
//     ];
//     const colaLayout = cola
//       .d3adaptor(d3)
//       .linkDistance(160)
//       .avoidOverlaps(true)
//       .size([width, height]);

//     colaLayout.nodes(nodes).links(links).start();
//     // colaLayout.nodes(data.nodes).links(data.links).start();

//     colaLayout.on("tick", () => {
//       console.log("tick");
//       setNodesState([...nodes]); // Update node positions after each tick
//     });

//     // const nodes = nodes.map((node) => {
//     //   return { ...node, x: 0, y: 0 };
//     // });
//     // const nodes = [
//     //   { name: "a", width: 60, height: 40, x: 0, y: 0 },
//     //   { name: "b", width: 60, height: 40, x: 0, y: 0 },
//     //   { name: "c", width: 160, height: 140, x: 0, y: 0 },
//     //   { name: "d", width: 60, height: 40, x: 0, y: 0 },
//     //   { name: "e", width: 60, height: 40, x: 0, y: 0 },
//     // ];
//     // const links = data.links;

//     // const simulation = cola
//     //   .d3adaptor(d3)
//     //   .nodes(nodes)
//     //   .links(links)
//     //   // .nodes(sampleData.nodes)
//     //   // .links(sampleData.links)
//     //   // .size([180, 160]) // Set canvas size or get dynamically
//     //   .linkDistance(200) // Distance between nodes
//     //   // Avoid node overlaps
//     //   .avoidOverlaps(true);

//     // simulation.start(10, 0, 0);
//     // // simulation.start();

//     // simulation.on("tick", () => {
//     //   console.log("tick");
//     //   setNodesState([...nodes]); // Update node positions after each tick
//     // });
//   }, []);

//   return (
//     <div>
//       <h1>React component as SVG node</h1>
//       <svg ref={svgRef} width={width} height={height}>
//         {nodesState.map((node, i) => (
//           <CustomNode
//             key={i}
//             node={node}
//             x={node.x - node.width / 2}
//             y={node.y - node.height / 2}
//           />
//         ))}
//       </svg>
//       <p>Drag the nodes around to see the layout dynamically adjust.</p>
//     </div>
//   );
// };

// export function Test() {
//   return <Graph />;
// }

// import React, { useEffect, useRef, useState } from "react";
// import * as d3 from "d3";
// import * as cola from "webcola";
// import ReactDOM from "react-dom/client";

// interface Node {
//   name: string;
//   width: number;
//   height: number;
//   x?: number;
//   y?: number;
// }

// interface Link {
//   source: number;
//   target: number;
// }

// interface GraphData {
//   nodes: Node[];
//   links: Link[];
// }

// const graphData: GraphData = {
//   nodes: [
//     { name: "a", width: 60, height: 40 },
//     { name: "b", width: 60, height: 40 },
//     { name: "c", width: 160, height: 140 },
//     { name: "d", width: 60, height: 40 },
//     { name: "e", width: 60, height: 40 },
//   ],
//   links: [
//     { source: 0, target: 1 },
//     { source: 1, target: 2 },
//     { source: 2, target: 0 },
//     { source: 2, target: 3 },
//   ],
// };

// interface CustomNodeProps {
//   name: string;
//   width: number;
//   height: number;
//   color: string;
//   onClick: (name: string) => void;
// }

// const CustomNode: React.FC<CustomNodeProps> = React.memo(
//   ({ name, width, height, color, onClick }) => (
//     <g>
//       <rect
//         width={width}
//         height={height}
//         rx={5}
//         ry={5}
//         fill={color}
//         stroke="#fff"
//         strokeWidth={1.5}
//       />
//       <text
//         x={width / 2}
//         y={height / 2}
//         textAnchor="middle"
//         dominantBaseline="middle"
//         fill="white"
//         fontFamily="Verdana"
//         fontSize="14px"
//       >
//         {name}
//       </text>
//       <foreignObject x={5} y={height - 25} width={width - 10} height={20}>
//         <button
//           style={{
//             width: "100%",
//             height: "100%",
//             fontSize: "10px",
//             padding: "2px",
//           }}
//           onClick={(e) => {
//             e.stopPropagation();
//             onClick(name);
//           }}
//         >
//           Click me
//         </button>
//       </foreignObject>
//     </g>
//   )
// );

// const Graph: React.FC = () => {
//   const svgRef = useRef<SVGSVGElement>(null);
//   const [nodes, setNodes] = useState<Node[]>(graphData.nodes);
//   const [links] = useState<Link[]>(graphData.links);

//   useEffect(() => {
//     if (!svgRef.current) return;

//     const width = 960;
//     const height = 500;

//     const svg = d3
//       .select(svgRef.current)
//       .attr("width", width)
//       .attr("height", height);

//     svg.selectAll("*").remove(); // Clear previous render

//     const color = d3.scaleOrdinal(d3.schemeCategory10);

//     const colaLayout = cola
//       .d3adaptor(d3)
//       .size([width, height])
//       .avoidOverlaps(true)
//       .linkDistance(160)
//       .handleDisconnected(true);

//     colaLayout.nodes(nodes).links(links).start(30);

//     const link = svg
//       .append("g")
//       .selectAll(".link")
//       .data(links)
//       .enter()
//       .append("line")
//       .attr("class", "link")
//       .style("stroke", "#999")
//       .style("stroke-width", "3px")
//       .style("stroke-opacity", "1");

//     const node = svg
//       .append("g")
//       .selectAll(".node")
//       .data(nodes)
//       .enter()
//       .append("g")
//       .attr("class", "node")
//       .call(colaLayout.drag() as any);

//     node.each(function (d: Node) {
//       const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
//       ReactDOM.createRoot(g).render(
//         <CustomNode
//           name={d.name}
//           width={d.width}
//           height={d.height}
//           color={color("1")}
//           onClick={handleNodeClick}
//         />
//       );
//       d3.select(this).node()?.appendChild(g);
//     });

//     colaLayout.on("tick", () => {
//       link
//         .attr("x1", (d) => (d.source as any).x)
//         .attr("y1", (d) => (d.source as any).y)
//         .attr("x2", (d) => (d.target as any).x)
//         .attr("y2", (d) => (d.target as any).y);

//       node.attr(
//         "transform",
//         (d) => `translate(${d.x! - d.width / 2},${d.y! - d.height / 2})`
//       );
//     });

//     return () => {
//       colaLayout.stop();
//     };
//   }, [nodes, links]);

//   const handleNodeClick = (name: string) => {
//     alert(`Clicked node ${name}`);
//   };

//   return <svg ref={svgRef}></svg>;
// };

// export function Test() {
//   return <Graph />;
// }

import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import * as cola from "webcola";
import ReactDOM from "react-dom/client";

const NodeComponent = ({ name }) => {
  return (
    <div
      style={{
        padding: "5px",
        background: "lightblue",
        borderRadius: "5px",
        textAlign: "center",
      }}
    >
      {name}
      <button style={{ marginTop: "5px" }}>Click Me</button>
    </div>
  );
};

const Graph = () => {
  const svgRef = useRef<SVGSVGElement>(null);
  const width = 960;
  const height = 500;

  useEffect(() => {
    if (!svgRef.current) return;
    const graphData = {
      nodes: [
        { name: "a", width: 60, height: 40, x: 0, y: 0 },
        { name: "b", width: 60, height: 40, x: 0, y: 0 },
        { name: "c", width: 160, height: 140, x: 0, y: 0 },
        { name: "d", width: 60, height: 40, x: 0, y: 0 },
        { name: "e", width: 60, height: 40, x: 0, y: 0 },
      ],
      links: [
        { source: 0, target: 1 },
        { source: 1, target: 2 },
        { source: 2, target: 0 },
        { source: 2, target: 3 },
      ],
    };
    const color = d3.scaleOrdinal(d3.schemeCategory10);
    const colaLayout = cola
      .d3adaptor(d3)
      .linkDistance(160)
      .avoidOverlaps(true)
      .size([width, height]);

    const svg = d3
      .select(svgRef.current)
      .attr("width", width)
      .attr("height", height);

    colaLayout.nodes(graphData.nodes).links(graphData.links).start();

    const link = svg
      .selectAll(".link")
      .data(graphData.links)
      .enter()
      .append("line")
      .attr("class", "link")
      .style("stroke", "#999")
      .style("stroke-width", 3);

    const node = svg
      .selectAll(".node")
      .data(graphData.nodes)
      .enter()
      .append("g")
      .attr("class", "node")
      .call(colaLayout.drag);

    node
      .append("rect")
      .attr("width", (d) => d.width)
      .attr("height", (d) => d.height)
      .attr("rx", 5)
      .attr("ry", 5)
      .style("fill", (d, i) => color("1"));

    node
      .append("text")
      .attr("class", "label")
      .text((d) => d.name)
      .style("fill", "white")
      .style("font-family", "Verdana")
      .style("font-size", "25px")
      .style("text-anchor", "middle");

    node.each(function (d) {
      const g = d3.select(this);
      g.append("foreignObject")
        .attr("width", d.width)
        .attr("height", d.height)
        .append("xhtml:div")
        .html(
          `<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%;"><div>${d.name}</div><button onclick="console.log('clicked');">Click Me</button></div>`
        );
    });

    colaLayout.on("tick", function () {
      console.log("tick");
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node.attr(
        "transform",
        (d: any) => `translate(${d.x - d.width / 2}, ${d.y - d.height / 2})`
      );
    });

    return () => {
      svg.selectAll("*").remove(); // Clean up on component unmount
    };
  }, []);

  return <svg ref={svgRef} />;
};

export const Test = () => (
  <div>
    <h1>Disconnected graph with non-overlap constraints</h1>
    <Graph />
  </div>
);
