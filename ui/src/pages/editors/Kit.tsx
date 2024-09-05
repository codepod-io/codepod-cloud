import React from "react";
import { defaultValueCtx, Editor, rootCtx } from "@milkdown/kit/core";
import { nord } from "@milkdown/theme-nord";
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";
import { commonmark } from "@milkdown/kit/preset/commonmark";
import { gfm } from "@milkdown/kit/preset/gfm";

import tooltip, {
  tooltipFactory,
  TooltipProvider,
} from "@milkdown/kit/plugin/tooltip";

import "@milkdown/theme-nord/style.css";

import { slashFactory, SlashProvider } from "@milkdown/kit/plugin/slash";

import { block, blockConfig } from "@milkdown/kit/plugin/block";
import { BlockView } from "./Block";
import { cursor } from "@milkdown/kit/plugin/cursor";

import {
  ProsemirrorAdapterProvider,
  usePluginViewFactory,
} from "@prosemirror-adapter/react";
import { findParent } from "@milkdown/kit/prose";

const slash = slashFactory("my-slash");

const markdown = `# Milkdown React

> You're scared of a world where you're needed.

This is a demo for using Milkdown with **React**.

# h1
## h2
### h3
#### h4
1. list
2. list
   1. list
   2. list
      1. list
      2. list
         1. list
         2. list
- list
- list
  - list
  - list


`;

const MilkdownEditor: React.FC = () => {
  const pluginViewFactory = usePluginViewFactory();
  useEditor((root) => {
    return (
      Editor.make()
        .config((ctx) => {
          ctx.set(rootCtx, root);
          ctx.set(defaultValueCtx, markdown);
          ctx.set(blockConfig.key, {
            filterNodes: (pos) => {
              const filter = findParent((node) =>
                ["table", "blockquote"].includes(node.type.name)
              )(pos);
              if (filter) return false;

              return true;
            },
          });
          ctx.set(block.key, {
            view: pluginViewFactory({
              component: BlockView,
            }),
            // view: () => BlockView(),
            // view: () => new BlockHandleView(ctx),
          });
        })
        .config(nord)
        // .config((ctx) => {
        //   ctx.set(slash.key, {
        //     view: slashPluginView
        //   })
        // })
        .use(commonmark)
        // .use(slash)
        .use(block)
        .use(cursor)
        .use(gfm)
    );
  }, []);

  return <Milkdown />;
};

export const MilkdownEditorWrapper: React.FC = () => {
  return (
    <MilkdownProvider>
      <ProsemirrorAdapterProvider>
        <MilkdownEditor />
      </ProsemirrorAdapterProvider>
    </MilkdownProvider>
  );
};
