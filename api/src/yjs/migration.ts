import * as Y from "yjs";

import prisma from "../prisma";
import { json2yxml } from "./utils";

/**
 * For historical reason, the backend DB schema pod.type are "CODE", "DECK",
 * "WYSIWYG", while the node types in front-end are "CODE", "SCOPE", "RICH".
 */

function dbtype2nodetype(dbtype: string) {
  switch (dbtype) {
    case "CODE":
      return "CODE";
    case "DECK":
      return "SCOPE";
    case "WYSIWYG":
      return "RICH";
    default:
      throw new Error(`unknown dbtype ${dbtype}`);
  }
}

function nodetype2dbtype(nodetype: string) {
  switch (nodetype) {
    case "CODE":
      return "CODE";
    case "SCOPE":
      return "DECK";
    case "RICH":
      return "WYSIWYG";
    default:
      throw new Error(`unknown nodetype ${nodetype}`);
  }
}

/**
 * Load content from the DB and migrate to the new Y.Doc format.
 * // TODO run the migration script seprately.
 */
async function migrate_v_0_0_1(ydoc: Y.Doc, repoId: string) {
  console.log("=== initialMigrate");
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
  const nodesMap = new Y.Map<any>();
  const edgesMap = new Y.Map<any>();
  const codeMap = new Y.Map<Y.Text>();
  const richMap = new Y.Map<Y.XmlFragment>();
  rootMap.set("nodesMap", nodesMap);
  rootMap.set("edgesMap", edgesMap);
  rootMap.set("codeMap", codeMap);
  rootMap.set("richMap", richMap);
  const metaMap = new Y.Map();
  metaMap.set("version", "v0.0.1");
  rootMap.set("metaMap", metaMap);
  // nodes
  repo.pods.forEach((pod) => {
    nodesMap.set(pod.id, {
      id: pod.id,
      type: dbtype2nodetype(pod.type),
      data: {
        name: pod.name || undefined,
        level: 0,
      },
      position: {
        x: pod.x,
        y: pod.y,
      },
      parentNode: pod.parent?.id,
      // TODO width & height
      width: pod.width,
      height: pod.height,
      style: {
        width: pod.width,
        height: pod.height,
      },
      dragHandle: ".custom-drag-handle",
    });
  });
  // edges
  repo.edges.forEach((edge) => {
    edgesMap.set(`${edge.sourceId}_${edge.targetId}`, {
      id: `${edge.sourceId}_${edge.targetId}`,
      source: edge.sourceId,
      target: edge.targetId,
    });
  });
  // content
  repo.pods.forEach((pod) => {
    // let content : Y.Text | Y.XmlFragment;
    if (pod.type === "CODE") {
      const content = new Y.Text(pod.content || undefined);
      codeMap.set(pod.id, content);
    } else if (pod.type === "WYSIWYG") {
      if (pod.content) {
        const yxml = json2yxml(JSON.parse(pod.content));
        richMap.set(pod.id, yxml);
      }
    }
  });
}
