import "@blocknote/core/fonts/inter.css";
import {
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
  useCreateBlockNote,
} from "@blocknote/react";

import {
  BasicTextStyleButton,
  BlockTypeSelect,
  ColorStyleButton,
  CreateLinkButton,
  FileCaptionButton,
  FileReplaceButton,
  FormattingToolbar,
  FormattingToolbarController,
  NestBlockButton,
  TextAlignButton,
  UnnestBlockButton,
} from "@blocknote/react";

import {
  Block,
  BlockNoteSchema,
  defaultInlineContentSpecs,
  filterSuggestionItems,
  locales,
} from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";

import { RiFormula } from "react-icons/ri";

import { InlineEquation } from "./RichEditor_KatexEquation";
import { memo, useEffect, useState } from "react";
import { Separator } from "@radix-ui/themes";

import * as Y from "yjs";
import { WebsocketProvider } from "@/../../api/src/runtime/y-websocket";

import { css } from "@emotion/css";
import { Extension } from "@tiptap/core";
import { MyDropcursor } from "./MyDropCursor_tiptap";
import { useAtomValue } from "jotai";
import { ATOM_simpleAwareness } from "@/lib/store/yjsSlice";

// import { WebrtcProvider } from "y-webrtc";

// const doc = new Y.Doc();
// const provider = new WebrtcProvider("my-document-id2", doc);

// Our schema with block specs, which contain the configs and implementations for blocks
// that we want our editor to use.
const schema = BlockNoteSchema.create({
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
    inlineEquation: InlineEquation,
  },
});

// Slash menu item to insert an Alert block
const insertLaTex = (editor: typeof schema.BlockNoteEditor) => ({
  icon: <RiFormula size={18} />,
  title: "Inline Equation",
  key: "inlineEquation",
  subtext: "Insert mathematical symbols in text.",
  aliases: ["equation", "latex", "katex"],
  group: "Other",
  onItemClick: () => {
    const view = editor._tiptapEditor.view;
    const pos = editor._tiptapEditor.state.selection.from;
    const tr = view.state.tr.insert(
      pos,
      view.state.schema.nodes.inlineEquation.create()
    );
    view.dispatch(tr);
  },
});

const ArrowConversionExtension = Extension.create({
  name: "arrowConversion",

  addInputRules() {
    return [
      {
        find: /->/g,
        handler: ({ state, range, chain }) => {
          const { from, to } = range;
          const tr = state.tr.replaceWith(from, to, state.schema.text("→"));
          chain().insertContent(tr).run();
        },
      },
    ];
  },
});

export function RichEditor({
  yXml,
  provider,
}: {
  yXml: Y.XmlFragment;
  provider: WebsocketProvider;
}) {
  const simpleAwareness = useAtomValue(ATOM_simpleAwareness);
  const editor = useCreateBlockNote({
    schema,
    dictionary: {
      ...locales.en,
      placeholders: {
        ...locales.en.placeholders,
        default: "Enter text or type '/'",
      },
    },
    disableExtensions: ["dropCursor"],
    trailingBlock: false,
    _tiptapOptions: {
      extensions: [ArrowConversionExtension, MyDropcursor],
    },
    // initialContent: [
    //   {
    //     type: "paragraph",
    //     content: [
    //       "This is an example inline equation ",
    //       {
    //         type: "inlineEquation",
    //         content: "c = \\pm\\sqrt{a^2 + b^2}",
    //       },
    //     ],
    //   },
    //   {
    //     type: "paragraph",
    //     content: "Press the '/' key to open the Slash Menu and add another",
    //   },
    //   {
    //     type: "paragraph",
    //   },
    //   {
    //     type: "paragraph",
    //   },
    //   {
    //     type: "paragraph",
    //   },
    // ],
    collaboration: {
      // The Yjs Provider responsible for transporting updates:
      provider,
      // Where to store BlockNote data in the Y.Doc:
      // fragment: doc.getXmlFragment("document-store"),
      fragment: yXml,
      // Information (name and color) for this user:
      user: {
        name: simpleAwareness.name,
        color: simpleAwareness.color,
      },
    },
  });

  // Stores the document JSON.
  // const [blocks, setBlocks] = useState<Block[]>([]);
  const [blocks, setBlocks] = useState<typeof editor.document>([]);
  // Stores the editor's contents as Markdown.
  const [markdown, setMarkdown] = useState<string>("");
  // Stores the editor's contents as HTML.
  const [html, setHTML] = useState<string>("");

  const initialHTML = `
  <p>Hello world <inlineequation data-content-type="inlineEquation">x_1 + x_2</inlineequation> test</p>


<font color="red">This text is red!</font>

<span data-text-color="red">world</span>

<span style="color:red">world2</span>

  `;

  const initialMarkdown = `
  Hello world $x_1 + x_2$ test
  `;

  const initialMarkdown2 = `
  Hello <inlineequation data-content-type="inlineEquation">x_1 + x_2</inlineequation> world <span data-text-color="red">world</span>

  <span style="color:red">world2</span>

  <span data-text-color="red">world</span>

<font color="red">This text is red!</font>

<style
  type="text/css">
h1 {color:red;}

p {color:blue;}
</style>

okay

  `;

  useEffect(() => {
    async function loadInitialHTML() {
      // const blocks = await editor.tryParseHTMLToBlocks(initialHTML);
      const blocks = await editor.tryParseMarkdownToBlocks(initialMarkdown2);
      editor.replaceBlocks(editor.document, blocks);
    }
    // loadInitialHTML();
  }, [editor]);
  return (
    <div
      // style={{
      //   margin: "10px",
      //   padding: "10px",
      //   border: "1px solid black",
      // }}
      className={css`
        .bn-editor {
          padding: 10px;
        }
        .bn-side-menu .bn-button {
          background-color: var(--sky-3);
        }
        .bn-side-menu .bn-button svg {
          color: var(--blue-9);
        }
      `}
    >
      <BlockNoteView
        editor={editor}
        slashMenu={false}
        formattingToolbar={false}
        onChange={async () => {
          setBlocks(editor.document);
          const markdown = await editor.blocksToMarkdownLossy(editor.document);
          setMarkdown(markdown);
          // Converts the editor's contents from Block objects to HTML and store to state.
          const html = await editor.blocksToHTMLLossy(editor.document);
          setHTML(html);
        }}
      >
        <SuggestionMenuController
          triggerCharacter={"/"}
          getItems={async (query: any) =>
            filterSuggestionItems(
              [...getDefaultReactSlashMenuItems(editor), insertLaTex(editor)],
              query
            )
          }
        />
        {/* customize the toolbar to add nowheel to the color selector dropdown. */}
        <FormattingToolbarController
          formattingToolbar={() => (
            <FormattingToolbar>
              <BlockTypeSelect key={"blockTypeSelect"} />

              {/* Extra button to toggle blue text & background */}

              <FileCaptionButton key={"fileCaptionButton"} />
              <FileReplaceButton key={"replaceFileButton"} />

              <BasicTextStyleButton
                basicTextStyle={"bold"}
                key={"boldStyleButton"}
              />
              <BasicTextStyleButton
                basicTextStyle={"italic"}
                key={"italicStyleButton"}
              />
              <BasicTextStyleButton
                basicTextStyle={"underline"}
                key={"underlineStyleButton"}
              />
              <BasicTextStyleButton
                basicTextStyle={"strike"}
                key={"strikeStyleButton"}
              />
              {/* Extra button to toggle code styles */}
              <BasicTextStyleButton
                key={"codeStyleButton"}
                basicTextStyle={"code"}
              />

              <TextAlignButton
                textAlignment={"left"}
                key={"textAlignLeftButton"}
              />
              <TextAlignButton
                textAlignment={"center"}
                key={"textAlignCenterButton"}
              />
              <TextAlignButton
                textAlignment={"right"}
                key={"textAlignRightButton"}
              />
              <div className="nowheel">
                <ColorStyleButton key={"colorStyleButton"} />
              </div>

              <NestBlockButton key={"nestBlockButton"} />
              <UnnestBlockButton key={"unnestBlockButton"} />

              <CreateLinkButton key={"createLinkButton"} />
            </FormattingToolbar>
          )}
        />
      </BlockNoteView>
      {/* <Separator orientation="horizontal" size="4" />
      <div>Output (Markdown):</div>
      <div className={"item bordered"}>
        <pre>
          <code>{markdown}</code>
        </pre>
      </div>
      <Separator orientation="horizontal" size="4" />
      <div>Output (HTML):</div>
      <div className="item bordered">
        <pre>
          <code>{html}</code>
        </pre>
      </div>
      <Separator orientation="horizontal" size="4" />
      <div>Document JSON:</div>
      <div className={"item bordered"}>
        <pre>
          <code>{JSON.stringify(blocks, null, 2)}</code>
        </pre>
      </div> */}
    </div>
  );
}
