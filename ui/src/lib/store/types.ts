import { Node } from "@xyflow/react";

export type NodeData = CodeNodeData | RichNodeData | ScopeNodeData;

export type CodeNodeData = {
  // common data
  children: string[];
  parent?: string;
  folded: boolean;
  isScope: boolean;
  // special data
  lang: "python" | "julia" | "javascript" | "racket";
};

export type RichNodeData = {
  // common data
  children: string[];
  parent?: string;
  folded: boolean;
  isScope: boolean;
};

export type ScopeNodeData = {
  // common data
  children: string[];
  parent?: string;
  folded: boolean;
  isScope: boolean;
  // special data
  scopeChildren: string[];
};

export type CodeNodeType = Node<CodeNodeData, "CODE">;
export type RichNodeType = Node<RichNodeData, "RICH">;
export type ScopeNodeType = Node<ScopeNodeData, "SCOPE">;

export type AppNode = CodeNodeType | RichNodeType | ScopeNodeType;
