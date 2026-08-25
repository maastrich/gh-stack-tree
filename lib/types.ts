export type CIState = "SUCCESS" | "FAILURE" | "PENDING" | "ERROR" | "EXPECTED" | null;
export type ReviewDecision = "APPROVED" | "CHANGES_REQUESTED" | "REVIEW_REQUIRED" | null;

export interface TreeNode {
  pr: number;
  branch: string;
  /** PR number of parent; null = based on trunk */
  parent: number | null;
  title?: string;
  merged?: boolean;
  draft?: boolean;
  additions?: number;
  deletions?: number;
  ci?: CIState;
  review?: ReviewDecision;
  /** Behind its base branch (needs rebase) */
  behind?: boolean;
}

export interface Tree {
  trunk: string;
  nodes: TreeNode[];
}
