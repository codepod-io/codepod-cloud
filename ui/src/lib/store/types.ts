import { Node } from "@xyflow/react";

export type NodeData = CodeNodeData | RichNodeData;

type CommonData = {
  // common data

  // Record the width and height of the node after resizing. These values are
  // used in the style of the component. The actual node.width and node.height
  // are set to undefined to let reactflow measure them, so that folding a pod
  // works correctly.
  level?: number;
  mywidth?: number;
  myheight?: number;
  // If true, this pod is shown when the scope is folded.
  isReadme?: boolean;
  // If true, this pod is run first before other pods in the scope.
  isInit?: boolean;
  // If true, this pod or scope is marked as a test, and won't be executed when "run all".
  isTest?: boolean;
  // If true, the pod is marked as public API.
  isPublic?: boolean;
  // subpage ID. If set, the pod belongs to a subpage.
  subpageId?: string;
};

export type SupportedLanguage = "python" | "julia" | "javascript" | "racket";

export type CodeNodeData = CommonData & {
  // special data
  lang: SupportedLanguage;
};

export type RichNodeData = CommonData & {};

export type CodeNodeType = Node<CodeNodeData, "CODE">;
export type RichNodeType = Node<RichNodeData, "RICH">;
type ScopeNodeType = Node<
  CommonData & {
    childrenIds: string[];
    folded?: boolean;
  },
  "SCOPE"
>;

export type SubpageRefNodeType = Node<
  CommonData & { refId: string },
  "SubpageRef"
>;

export type AppNode =
  | CodeNodeType
  | RichNodeType
  | ScopeNodeType
  | SubpageRefNodeType;
