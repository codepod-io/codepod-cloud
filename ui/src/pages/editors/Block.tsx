// function createBlockPluginView(ctx) {
//   return (view) => {
//     const content = document.createElement("div");

//     const provider = new BlockProvider({
//       ctx,
//       content: this.content,
//     });

//     return {
//       update: (updatedView, prevState) => {
//         provider.update(updatedView, prevState);
//       },
//       destroy: () => {
//         provider.destroy();
//         content.remove();
//       },
//     };
//   };
// }

import { BlockProvider } from "@milkdown/kit/plugin/block";
import { useInstance } from "@milkdown/react";
import { motion } from "framer-motion";
import { GripVertical } from "lucide-react";
import { useEffect, useRef } from "react";

export const BlockView = () => {
  const ref = useRef<HTMLDivElement>(null);
  const tooltipProvider = useRef<BlockProvider>();

  const [loading, get] = useInstance();

  useEffect(() => {
    const div = ref.current;
    if (loading || !div) return;

    const editor = get();
    if (!editor) return;

    tooltipProvider.current = new BlockProvider({
      ctx: editor.ctx,
      content: div,
      getPlacement: ({ active, blockDom }) => {
        if (active.node.type.name === "heading") return "left";

        let totalDescendant = 0;
        active.node.descendants((node) => {
          totalDescendant += node.childCount;
        });
        const dom = active.el;
        const domRect = dom.getBoundingClientRect();
        const handleRect = blockDom.getBoundingClientRect();
        const style = window.getComputedStyle(dom);
        const paddingTop = Number.parseInt(style.paddingTop, 10) || 0;
        const paddingBottom = Number.parseInt(style.paddingBottom, 10) || 0;
        const height = domRect.height - paddingTop - paddingBottom;
        const handleHeight = handleRect.height;
        return totalDescendant > 2 || handleHeight < height
          ? "left-start"
          : "left";
      },
    });
    tooltipProvider.current?.update();

    return () => {
      tooltipProvider.current?.destroy();
    };
  }, [loading]);

  return (
    <motion.div
      layout
      layoutId="block-handle"
      ref={ref}
      className="absolute w-6 bg-slate-200 rounded hover:bg-slate-300 cursor-grab"
    >
      <motion.div layout layoutId="block-handle2">
        <GripVertical />
      </motion.div>
    </motion.div>
  );
};
