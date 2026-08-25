import { describe, expect, it } from "vitest";
import { parseTree, serializeTree } from "./markers";
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
    const rows = flatten(tree);
    expect(rows.map((r) => prefix(r) + r.node.branch)).toEqual([
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

describe("markers", () => {
  it("round-trips fenced block", () => {
    const body = `hello\n\n${serializeTree(tree)}\n\nbye`;
    expect(parseTree(body)).toEqual(tree);
  });
  it("null when absent", () => {
    expect(parseTree("nothing")).toBeNull();
  });
});
