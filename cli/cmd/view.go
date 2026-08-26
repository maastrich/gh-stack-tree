package cmd

import (
	"flag"
	"fmt"
	"strings"

	"github.com/maastrich/gh-stack-tree/cli/internal/gh"
	"github.com/maastrich/gh-stack-tree/cli/internal/git"
)

func runView(args []string) error {
	fs := flag.NewFlagSet("view", flag.ContinueOnError)
	stack := fs.String("stack", "", "stack name")
	pos, err := parseAnywhere(fs, args)
	if err != nil {
		return err
	}
	_ = pos
	label, err := resolveStack(*stack)
	if err != nil {
		return err
	}
	t, prs, err := loadTree(label)
	if err != nil {
		return err
	}
	cur, _ := git.CurrentBranch()
	fmt.Printf("stack %s — %d open, %d merged\n", strings.TrimPrefix(label, gh.LabelPrefix), len(t.Nodes), countMerged(prs))
	fmt.Print(t.Render(cur))
	return nil
}

func countMerged(prs []gh.PR) int {
	n := 0
	for _, p := range prs {
		if p.State == "MERGED" {
			n++
		}
	}
	return n
}
