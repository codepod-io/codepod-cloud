import { Extension } from "@tiptap/core";
import { dropCursor } from "./MyDropCursor";

export interface DropcursorOptions {
  /**
   * The color of the drop cursor
   * @default 'currentColor'
   * @example 'red'
   */
  color: string | undefined;

  /**
   * The width of the drop cursor
   * @default 1
   * @example 2
   */
  width: number | undefined;

  /**
   * The class of the drop cursor
   * @default undefined
   * @example 'drop-cursor'
   */
  class: string | undefined;
}

/**
 * This extension allows you to add a drop cursor to your editor.
 * A drop cursor is a line that appears when you drag and drop content
 * inbetween nodes.
 * @see https://tiptap.dev/api/extensions/dropcursor
 */
export const MyDropcursor = Extension.create<DropcursorOptions>({
  name: "myDropCursor",

  addOptions() {
    return {
      // color: "currentColor",
      // width: 1,
      // color: "red",
      color: "#ddeeff",
      width: 5,
      class: undefined,
    };
  },

  addProseMirrorPlugins() {
    return [dropCursor(this.options)];
  },
});
