import { describe, expect, it } from "vitest";
import { inferTree, stackLabel } from "./infer";
import { flatten, pathTo, prefix } from "./tree";

const tree = {
  trunk: "main",
  nodes: [
    { pr: 1, branch: "a", parent: null },
    { pr: 2, branch: "b", parent: 1 },
    { pr: 3, branch: "c", parent: 1 },
    { pr: 4, branch: "d", parent: 3 },
  ],
};

describe("flatten", () => {
  it("dfs order with guides", () => {
    expect(flatten(tree).map((r) => prefix(r) + r.node.branch)).toEqual([
      "└─ a",
      "   ├─ b",
      "   └─ c",
      "      └─ d",
    ]);
  });
});

describe("pathTo", () => {
  it("trunk-first path", () => {
    expect(pathTo(tree, 4).map((n) => n.pr)).toEqual([1, 3, 4]);
  });
});

describe("inferTree", () => {
  it("builds parents from base<-head and picks trunk", () => {
    const t = inferTree([
      { number: 4, head: "d", base: "c" },
      { number: 1, head: "a", base: "main" },
      { number: 3, head: "c", base: "a" },
      { number: 2, head: "b", base: "a" },
      { number: 5, head: "e", base: "main" },
    ]);
    expect(t.trunk).toBe("main");
    expect(t.nodes.map((n) => [n.pr, n.parent])).toEqual([[1, null], [2, 1], [3, 1], [4, 3], [5, null]]);
  });
});

describe("stackLabel", () => {
  it("finds prefixed label", () => {
    expect(stackLabel(["bug", "stacktree:lcm"])).toBe("stacktree:lcm");
    expect(stackLabel(["bug"])).toBeNull();
  });
});
