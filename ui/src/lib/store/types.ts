import { Node } from "@xyflow/react";

export type NodeData = CodeNodeData | RichNodeData;

type CommonData = {
  // common data
  treeChildrenIds: string[];
  treeParentId?: string;
  isScope?: boolean;
  // Record the width and height of the node after resizing. These values are
  // used in the style of the component. The actual node.width and node.height
  // are set to undefined to let reactflow measure them, so that folding a pod
  // works correctly.
  mywidth?: number;
  myheight?: number;
};

export type SupportedLanguage = "python" | "julia" | "javascript" | "racket";

export type CodeNodeData = CommonData & {
  // special data
  lang: SupportedLanguage;
};

export type RichNodeData = CommonData & {};

export type CodeNodeType = Node<CodeNodeData, "CODE">;
export type RichNodeType = Node<RichNodeData, "RICH">;

export type AppNode = CodeNodeType | RichNodeType;
