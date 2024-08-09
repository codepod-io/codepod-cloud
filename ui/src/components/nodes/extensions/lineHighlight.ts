import { CreateExtensionPlugin, PlainExtension } from "@remirror/core";
import { Decoration, DecorationSet } from "@remirror/pm/view";

/**
 * This extension highlights the current line of the cursor in the editor.
 */
export class HighlightCurrentLineExtension extends PlainExtension {
  get name() {
    return "highlightCurrentLine" as const;
  }

  /**
   * Create the plugin that manages the decorations.
   */
  createPlugin(): CreateExtensionPlugin {
    return {
      state: {
        init() {
          return DecorationSet.empty;
        },
        apply: (tr, decorationSet, oldState, newState) => {
          if (!tr.docChanged && !tr.selectionSet) {
            return decorationSet;
          }

          const { $from } = newState.selection;
          const lineStart = $from.before();
          const lineEnd = $from.after();

          const decorations: Decoration[] = [
            Decoration.inline(lineStart, lineEnd, {
              // style: "background-color: lightblue;",
              class: "remirror-line-highlight",
            }),
          ];

          return DecorationSet.create(tr.doc, decorations);
        },
      },

      props: {
        decorations: (state) => this.getPluginState(state),
      },
    };
  }
}
