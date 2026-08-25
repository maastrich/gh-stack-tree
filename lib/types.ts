/** Wire format written by the CLI into PR bodies between markers. */
export interface TreeNode {
  /** PR number */
  pr: number;
  branch: string;
  /** PR number of parent; null = based on trunk */
  parent: number | null;
  title?: string;
  merged?: boolean;
}

export interface Tree {
  trunk: string;
  nodes: TreeNode[];
}
