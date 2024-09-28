import { ServerBlockNoteEditor } from "@blocknote/server-util";

const editor = ServerBlockNoteEditor.create();

export async function getInitYXml() {
  const blocks = await editor.tryParseMarkdownToBlocks(`
### Welcome to CodePod IDE

Let's get started!
`);
  return editor.blocksToYXmlFragment(blocks);
}
