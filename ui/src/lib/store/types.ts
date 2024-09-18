import { Node } from "@xyflow/react";

export type NodeData = CodeNodeData | RichNodeData | ScopeNodeData;

type CommonData = {
  // common data
  treeChildrenIds: string[];
  parent?: { id: string; relation: "TREE" | "SCOPE" };
  podFolded?: boolean;
  treeFolded?: boolean;
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

export type ScopeNodeData = CommonData & {
  // special data
  scopeChildrenIds: string[];
};

export type CodeNodeType = Node<CodeNodeData, "CODE">;
export type RichNodeType = Node<RichNodeData, "RICH">;
export type ScopeNodeType = Node<ScopeNodeData, "SCOPE">;

export type AppNode = CodeNodeType | RichNodeType | ScopeNodeType;
