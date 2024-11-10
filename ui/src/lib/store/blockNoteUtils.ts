import {
  prosemirrorToYDoc,
  prosemirrorToYXmlFragment,
  yXmlFragmentToProseMirrorRootNode,
} from "y-prosemirror";

import {
  Block,
  BlockNoteEditor,
  blockToNode,
  nodeToBlock,
  PartialBlock,
} from "@blocknote/core";

import { Node } from "@tiptap/pm/model";

import * as Y from "yjs";

const editor = BlockNoteEditor.create();

function _blocksToProsemirrorNode(blocks: PartialBlock[]) {
  const pmNodes = blocks.map((b) =>
    blockToNode(b, editor.pmSchema, editor.schema.styleSchema)
  );

  const doc = editor.pmSchema.topNodeType.create(
    null,
    editor.pmSchema.nodes["blockGroup"].create(null, pmNodes)
  );
  return doc;
}

export function blocksToYXmlFragment(
  blocks: Block[],
  xmlFragment?: Y.XmlFragment
) {
  return prosemirrorToYXmlFragment(
    _blocksToProsemirrorNode(blocks),
    xmlFragment
  );
}

export async function markdownToYXml(markdown: string) {
  const blocks = await editor.tryParseMarkdownToBlocks(markdown);
  return blocksToYXmlFragment(blocks);
}

function _prosemirrorNodeToBlocks(pmNode: Node) {
  const blocks: Block[] = [];

  // note, this code is similar to editor.document
  pmNode.firstChild!.descendants((node) => {
    blocks.push(
      nodeToBlock(
        node,
        editor.schema.blockSchema,
        editor.schema.inlineContentSchema,
        editor.schema.styleSchema
      )
    );

    return false;
  });

  return blocks;
}

export function yXmlFragmentToBlocks(xmlFragment: Y.XmlFragment) {
  const pmNode = yXmlFragmentToProseMirrorRootNode(
    xmlFragment,
    editor.pmSchema
  );
  return _prosemirrorNodeToBlocks(pmNode);
}
