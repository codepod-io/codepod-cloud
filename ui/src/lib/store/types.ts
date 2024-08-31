import { Node } from "@xyflow/react";

export type NodeData = CodeNodeData | RichNodeData | ScopeNodeData;

type CommonData = {
  // common data
  treeChildrenIds: string[];
  treeParentId?: string;
  scopeParentId?: string;
  folded: boolean;
  isScope: boolean;
};

export type CodeNodeData = CommonData & {
  // special data
  lang: "python" | "julia" | "javascript" | "racket";
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
