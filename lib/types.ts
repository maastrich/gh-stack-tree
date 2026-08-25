export interface TreeNode {
  pr: number;
  branch: string;
  /** PR number of parent; null = based on trunk */
  parent: number | null;
  title?: string;
  merged?: boolean;
  draft?: boolean;
}

export interface Tree {
  trunk: string;
  nodes: TreeNode[];
}
