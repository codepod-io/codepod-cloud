import * as Y from "yjs";
import { match, P } from "ts-pattern";
import { flextree } from "d3-flextree";

import prisma from "../prisma";
import { json2yxml } from "./utils";
import { PodResult } from "./types";
import { assert } from "console";
import { Node } from "reactflow";
import { NodeData } from "@/../../ui/src/lib/store/types";

/**
 * Auto layout.
 */
export function layoutSubTree(nodesMap: Y.Map<Node<NodeData>>, id: string) {
  // const data = subtree("1");
  const rootNode = nodesMap.get(id);
  if (!rootNode) throw new Error("Root node not found");
  function subtree(id: string) {
    const node = nodesMap.get(id);
    if (!node) throw new Error("Node not found");
    const children = node.data.children;
    return {
      id: node.id,
      width: node.width!,
      height: node.height!,
      children: node.data.folded ? [] : children ? children.map(subtree) : [],
    };
  }
  const data = subtree(id);
  const paddingX = 100;
  const paddingY = 100;
  // const paddingX = 0;
  // const paddingY = 0;

  const layout = flextree({
    children: (data) => data.children,
    // horizontal
    nodeSize: (node) => [
      node.data.height + paddingY,
      node.data.width + paddingX,
    ],
    // spacing: 100,
  });
  const tree = layout.hierarchy(data);
  layout(tree);
  // console.log("Layout Result", layout.dump(tree)); //=> prints the results
  // tree.each((node) => console.log(`(${node.x}, ${node.y})`));
  // update the nodesMap
  tree.each((node) => {
    const n = nodesMap.get(node.data.id)!;
    // horizontal
    nodesMap.set(node.data.id, {
      ...n,
      position: {
        x: rootNode.position.x + node.y,
        // center the node
        y:
          rootNode.position.y +
          rootNode.height! / 2 +
          node.x -
          node.data.height / 2,
        // y: node.x,
      },
    });
  });
}

/**
 * Load content from the DB and migrate to the new Y.Doc format.
 * // TODO run the migration script seprately.
 */
let count = 0;
async function migrate_v_0_0_1(ydoc: Y.Doc, repoId: string) {
  // 1. query DB for repo.pods
  const repo = await prisma.repo.findFirst({
    where: { id: repoId },
    include: {
      owner: true,
      collaborators: true,
      pods: {
        include: {
          children: true,
          parent: true,
        },
        orderBy: {
          index: "asc",
        },
      },
      edges: true,
    },
  });
  if (!repo) {
    throw new Error("repo not found");
  }
  // TODO make sure the ydoc is empty.
  // 2. construct Y doc types
  const rootMap = ydoc.getMap("rootMap");
  const nodesMap = new Y.Map<Node<NodeData>>();
  const edgesMap = new Y.Map<any>();
  const codeMap = new Y.Map<Y.Text>();
  const richMap = new Y.Map<Y.XmlFragment>();
  const resultMap = new Y.Map<PodResult>();
  rootMap.set("nodesMap", nodesMap);
  rootMap.set("edgesMap", edgesMap);
  rootMap.set("codeMap", codeMap);
  rootMap.set("richMap", richMap);
  rootMap.set("resultMap", resultMap);
  const metaMap = new Y.Map();
  metaMap.set("version", "v0.0.1");
  rootMap.set("metaMap", metaMap);
  // skip empty repo
  if (repo.pods.length === 0) {
    return;
  }
  // print progress
  count++;
  console.log(count, `migrating ${repo.id}`);
  // nodes
  const node2children = new Map<string, string[]>();
  repo.pods.forEach((pod) => {
    const parent = pod.parent?.id || "ROOT";
    const children = node2children.get(parent) || [];
    // TODO order by geometry
    children.push(pod.id);
    node2children.set(parent, children);
  });
  repo.pods.forEach((pod) => {
    nodesMap.set(pod.id, {
      id: pod.id,
      type: match(pod.type)
        .with("CODE", () => "CODE")
        .with("DECK", () => "RICH")
        .with("WYSIWYG", () => "RICH")
        .with(P.union("MD", "REPL", "SCOPE"), () => {
          throw new Error(`should not have dbtype ${pod.type}`);
        })
        .exhaustive(),
      data: {
        name: pod.name || undefined,
        children: node2children.get(pod.id) || [],
        level: 0,
        lang: (pod.lang || "python") as
          | "python"
          | "julia"
          | "javascript"
          | "racket",
        isScope: false,
        folded: false,
      },
      position: {
        x: pod.x,
        y: pod.y,
      },
      // TODO width & height
      width: pod.type === "DECK" ? 300 : pod.width,
      height: pod.type === "DECK" ? 100 : pod.height,
      style: {
        width: pod.type === "DECK" ? 300 : pod.width,
      },
      dragHandle: ".custom-drag-handle",
    });
  });
  assert(!nodesMap.has("ROOT"));
  nodesMap.set("ROOT", {
    id: "ROOT",
    type: "RICH",
    data: {
      level: 0,
      children: node2children.get("ROOT") || [],
      folded: false,
      isScope: false,
    },
    position: { x: 0, y: 0 },
    width: 300,
    height: 100,
    style: {
      width: 300,
    },
  });
  richMap.set("ROOT", new Y.XmlFragment());

  layoutSubTree(nodesMap, "ROOT");

  // Edges are no longer used.
  //
  // repo.edges.forEach((edge) => {
  //   edgesMap.set(`${edge.sourceId}_${edge.targetId}`, {
  //     id: `${edge.sourceId}_${edge.targetId}`,
  //     source: edge.sourceId,
  //     target: edge.targetId,
  //   });
  // });

  // content
  repo.pods.forEach((pod) => {
    // let content : Y.Text | Y.XmlFragment;
    if (pod.type === "CODE") {
      // content
      if (!pod.content) {
        codeMap.set(pod.id, new Y.Text(""));
      } else {
        const str = JSON.parse(pod.content || "");
        const content = new Y.Text(str || undefined);
        codeMap.set(pod.id, content);
      }
      // result
      const data: any[] = [];
      if (pod.result) {
        const json = JSON.parse(pod.result);
        if (pod.result) {
          // data.push({ type: "execute_result", text: pod.result });
          data.push({ type: "execute_result", ...json });
        }
      }

      if (pod.stdout) {
        data.push({
          type: "stream_stdout",
          text: JSON.parse(pod.stdout),
        });
      }
      // FIXME pod.error??
      resultMap.set(pod.id, { data });
    } else if (pod.type === "WYSIWYG") {
      if (pod.content) {
        const yxml = json2yxml(JSON.parse(pod.content));
        richMap.set(pod.id, yxml);
      }
    } else if (pod.type === "DECK") {
      // replace with Rich
      if (pod.name) {
        // put the scope name into the pod.
        const json2 = {
          type: "doc",
          content: [
            {
              type: "heading",
              attrs: { level: 2 },
              content: [{ type: "text", text: pod.name }],
            },
            { type: "paragraph" },
          ],
        };
        const yxml = json2yxml(json2);
        richMap.set(pod.id, yxml);
      } else {
        richMap.set(pod.id, new Y.XmlFragment());
      }
    } else {
      throw new Error(`unknown pod type ${pod.type}`);
    }
  });
}

async function main() {
  await prisma.$transaction(
    async (tx) => {
      const repos = await tx.repo.findMany();
      for (const repo of repos) {
        const ydoc = new Y.Doc();
        await migrate_v_0_0_1(ydoc, repo.id);
        // now the ydoc should be populated with the content from the DB.
        // save to the ydocblob field
        const update = Y.encodeStateAsUpdate(ydoc);
        await tx.repo.update({
          where: { id: repo.id },
          data: {
            yDocBlob: Buffer.from(update),
          },
        });
      }
    },
    {
      timeout: 10000,
    }
  );
}

main()
  .catch(async (e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    console.log("Finished. Disconnecting from the DB.");
    await prisma.$disconnect();
  });
