import { RemirrorManager } from "remirror";

import {
  corePreset,
  BoldExtension,
  CalloutExtension,
  DropCursorExtension,
  ImageExtension,
  ItalicExtension,
  PlaceholderExtension,
  ShortcutHandlerProps,
  SubExtension,
  SupExtension,
  TextHighlightExtension,
  createMarkPositioner,
  wysiwygPreset,
  MarkdownExtension,
  TOP_50_TLDS,
  BidiExtension,
  GapCursorExtension,
  ShortcutsExtension,
  TrailingNodeExtension,
  HardBreakExtension,
  HorizontalRuleExtension,
  BlockquoteExtension,
  CodeBlockExtension,
  HeadingExtension,
  IframeExtension,
  CodeExtension,
  StrikeExtension,
  UnderlineExtension,
  EmojiExtension,
} from "remirror/extensions";

import { ExtensionListTheme } from "@remirror/theme";
import { NodeViewMethod, ProsemirrorNode } from "@remirror/core";

import { MathInlineExtension, MathBlockExtension } from "./mathExtension";

import {
  BulletListExtension,
  OrderedListExtension,
  TaskListExtension,
} from "remirror/extensions";

import { LinkExtension as RemirrorLinkExtension } from "remirror/extensions";
import { markInputRule } from "@remirror/core-utils";
import { InputRule } from "@remirror/pm";

class LinkExtension extends RemirrorLinkExtension {
  createInputRules(): InputRule[] {
    return [
      markInputRule({
        regexp: /\[([^\]]+)\]\(([^)]+)\)/,
        type: this.type,
        getAttributes: (matches: string[]) => {
          const [_, text, href] = matches;
          return { text: text, href: href };
        },
      }),
    ];
  }
}

const manager2 = RemirrorManager.create(() => [
  ...corePreset(),
  new MathInlineExtension(),
  // new MathBlockExtension(),
  new HorizontalRuleExtension({}),
  new BlockquoteExtension(),
  new CodeBlockExtension({}),
  new HeadingExtension({}),
  new BulletListExtension({}),
  new OrderedListExtension(),
  new TaskListExtension(),
  new EmojiExtension({ data: [], plainText: true }),
  new ImageExtension({ enableResizing: true }),

  // mark extensions
  new TextHighlightExtension({}),
  new BoldExtension({}),
  new CodeExtension(),
  new StrikeExtension(),
  new ItalicExtension(),
  new LinkExtension({
    autoLink: true,
    autoLinkAllowedTLDs: ["dev", ...TOP_50_TLDS],
  }),
  new UnderlineExtension(),
]);
console.log("2222", manager2.schema);
