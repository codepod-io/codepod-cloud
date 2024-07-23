// Adapted from https://github.com/phxtho/poche/blob/main/src/components/remirror-editor/extensions/math-inline-extension/math-inline-extension.ts

import {
  ApplySchemaAttributes,
  command,
  CommandFunction,
  extension,
  ExtensionTag,
  NodeExtension,
  NodeExtensionSpec,
  NodeSpecOverride,
  PrioritizedKeyBindings,
} from "@remirror/core";
import {
  defaultInlineMathParseRules,
  defaultBlockMathParseRules,
} from "./mathParseRules";

export interface MathInlineOptions {}
export interface MathBlockOptions {}

@extension<MathInlineOptions>({
  defaultOptions: {},
})
export class MathInlineExtension extends NodeExtension<MathInlineOptions> {
  get name() {
    return "math_inline" as const;
  }

  createTags() {
    return [ExtensionTag.InlineNode];
  }

  createNodeSpec(
    extra: ApplySchemaAttributes,
    override: NodeSpecOverride
  ): NodeExtensionSpec {
    return {
      group: "math",
      content: "text*",
      inline: true,
      atom: true,
      ...override,
      attrs: {
        ...extra.defaults(),
      },
      parseDOM: [
        {
          tag: "math-inline",
        },
        ...defaultInlineMathParseRules,
      ],
      toDOM: () => ["math-inline", { class: "math-node" }, 0],
    };
  }
}

@extension<MathBlockOptions>({
  defaultOptions: {},
})
export class MathBlockExtension extends NodeExtension<MathBlockOptions> {
  get name() {
    return "math_display" as const;
  }

  createTags() {
    return [ExtensionTag.BlockNode];
  }

  createNodeSpec(
    extra: ApplySchemaAttributes,
    override: NodeSpecOverride
  ): NodeExtensionSpec {
    return {
      group: "block math",
      content: "text*",
      atom: true,
      code: true,
      ...override,
      attrs: {
        ...extra.defaults(),
      },
      parseDOM: [
        {
          tag: "math-display",
        },
        ...defaultBlockMathParseRules,
      ],
      toDOM: () => ["math-display", { class: "math-node" }, 0],
    };
  }
}

declare global {
  namespace Remirror {
    interface AllExtensions {
      math_inline: MathInlineExtension;
      block_math: MathBlockExtension;
    }
  }
}
