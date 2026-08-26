// Package tree builds and orders the branch tree formed by stacked PRs.
package tree

import (
	"fmt"
	"sort"

	"github.com/maastrich/gh-stack-tree/cli/internal/gh"
)

type Node struct {
	PR       gh.PR
	Parent   *Node // nil = based on trunk (or on a merged branch)
	Children []*Node
}

type Tree struct {
	Trunk  string
	Nodes  []*Node // every open node, sorted by PR number
	Roots  []*Node
	Merged []gh.PR // merged into trunk, oldest first
}

// Build links PRs by base <- head. Only open PRs become nodes; merged ones are
// kept in Merged so callers can tell "parent merged" from "parent unknown".
func Build(trunk string, prs []gh.PR) *Tree {
	t := &Tree{Trunk: trunk}
	byHead := map[string]*Node{}
	for _, p := range prs {
		if p.State == "MERGED" && p.Base == trunk {
			t.Merged = append(t.Merged, p)
		}
		if p.State != "OPEN" {
			continue
		}
		n := &Node{PR: p}
		t.Nodes = append(t.Nodes, n)
		byHead[p.Head] = n
	}
	sort.Slice(t.Nodes, func(i, j int) bool { return t.Nodes[i].PR.Number < t.Nodes[j].PR.Number })
	sort.Slice(t.Merged, func(i, j int) bool { return t.Merged[i].Number < t.Merged[j].Number })
	for _, n := range t.Nodes {
		if p, ok := byHead[n.PR.Base]; ok {
			n.Parent = p
			p.Children = append(p.Children, n)
		} else {
			t.Roots = append(t.Roots, n)
		}
	}
	return t
}

// Order returns nodes parents-first (DFS preorder from the roots).
func (t *Tree) Order() ([]*Node, error) {
	var out []*Node
	seen := map[*Node]bool{}
	var walk func(n *Node, depth int) error
	walk = func(n *Node, depth int) error {
		if depth > len(t.Nodes) {
			return fmt.Errorf("cycle in the pull request tree")
		}
		if seen[n] {
			return nil
		}
		seen[n] = true
		out = append(out, n)
		for _, c := range n.Children {
			if err := walk(c, depth+1); err != nil {
				return err
			}
		}
		return nil
	}
	for _, r := range t.Roots {
		if err := walk(r, 0); err != nil {
			return nil, err
		}
	}
	if len(out) != len(t.Nodes) {
		return nil, fmt.Errorf("cycle in the pull request tree")
	}
	return out, nil
}

// Subtree returns n and all its descendants, parents first.
func Subtree(n *Node) []*Node {
	out := []*Node{n}
	for _, c := range n.Children {
		out = append(out, Subtree(c)...)
	}
	return out
}

// Render draws the tree with box characters. mark is highlighted with ◀.
// PRs already merged into trunk are listed above it.
func (t *Tree) Render(mark string) string {
	s := ""
	for _, m := range t.Merged {
		s += fmt.Sprintf("┆  #%d %s (merged)\n", m.Number, m.Head)
	}
	s += "(" + t.Trunk + ")\n"
	var walk func(n *Node, prefix string, last bool)
	walk = func(n *Node, prefix string, last bool) {
		conn := "├─ "
		next := "│  "
		if last {
			conn = "└─ "
			next = "   "
		}
		state := ""
		if n.PR.Draft {
			state = " (draft)"
		}
		cur := ""
		if n.PR.Head == mark {
			cur = " ◀"
		}
		s += fmt.Sprintf("%s%s#%d %s%s%s\n", prefix, conn, n.PR.Number, n.PR.Head, state, cur)
		for i, c := range n.Children {
			walk(c, prefix+next, i == len(n.Children)-1)
		}
	}
	for i, r := range t.Roots {
		walk(r, "", i == len(t.Roots)-1)
	}
	return s
}
