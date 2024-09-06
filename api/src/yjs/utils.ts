import { ServerBlockNoteEditor } from "@blocknote/server-util";

import { customAlphabet } from "nanoid";
import { lowercase, numbers } from "nanoid-dictionary";

export const myNanoId = customAlphabet(lowercase + numbers, 20);

const editor = ServerBlockNoteEditor.create();

export async function getInitYXml() {
  const blocks = await editor.tryParseMarkdownToBlocks(`
### Welcome to CodePod IDE

Let's get started!
`);
  return editor.blocksToYXmlFragment(blocks);
}
