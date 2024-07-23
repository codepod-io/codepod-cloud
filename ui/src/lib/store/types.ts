// TODO add node's data typing.
export type NodeData = {
  level: number;
  name?: string;
  children: string[];
  parent?: string;
  folded: boolean;
  lang?: string;
};
