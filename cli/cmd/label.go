package cmd

import (
	"errors"
	"flag"
	"fmt"
	"strings"

	"github.com/maastrich/gh-stack-tree/cli/internal/gh"
	"github.com/maastrich/gh-stack-tree/cli/internal/git"
)

func targetPR(number int) (*gh.PR, error) {
	if number > 0 {
		// Look up by number through the branch list is awkward; gh pr view is simpler.
		return gh.ByNumber(number)
	}
	branch, err := git.CurrentBranch()
	if err != nil {
		return nil, err
	}
	pr, err := gh.ForBranch(branch)
	if err != nil {
		return nil, err
	}
	if pr == nil {
		return nil, fmt.Errorf("no pull request for branch %s — open one first (gh pr create --base <parent>)", branch)
	}
	return pr, nil
}

func runLabel(args []string) error {
	fs := flag.NewFlagSet("label", flag.ContinueOnError)
	number := fs.Int("pr", 0, "pull request number (default: current branch)")
	pos, err := parseAnywhere(fs, args)
	if err != nil {
		return err
	}
	_ = pos
	pr, err := targetPR(*number)
	if err != nil {
		return err
	}
	if existing := pr.StackLabel(); existing != "" {
		return fmt.Errorf("#%d already belongs to %s (run unlabel first)", pr.Number, existing)
	}

	name := ""
	if len(pos) > 0 {
		name = pos[0]
	}
	if name == "" {
		// Inherit the parent's stack when the base branch has one.
		parent, err := gh.ForBranch(pr.Base)
		if err != nil {
			return err
		}
		if parent != nil && parent.StackLabel() != "" {
			name = parent.StackLabel()
		} else {
			return errors.New("stack name required: base branch " + pr.Base + " is not in a stack")
		}
	}
	label := gh.LabelPrefix + strings.TrimPrefix(name, gh.LabelPrefix)
	if err := gh.EnsureLabel(label); err != nil {
		return err
	}
	if err := gh.AddLabel(pr.Number, label); err != nil {
		return err
	}
	fmt.Printf("#%d (%s ← %s) added to %s\n", pr.Number, pr.Base, pr.Head, label)
	return nil
}

func runUnlabel(args []string) error {
	fs := flag.NewFlagSet("unlabel", flag.ContinueOnError)
	number := fs.Int("pr", 0, "pull request number (default: current branch)")
	pos, err := parseAnywhere(fs, args)
	if err != nil {
		return err
	}
	_ = pos
	pr, err := targetPR(*number)
	if err != nil {
		return err
	}
	label := pr.StackLabel()
	if label == "" {
		return fmt.Errorf("#%d is not in a stack", pr.Number)
	}
	if err := gh.RemoveLabel(pr.Number, label); err != nil {
		return err
	}
	fmt.Printf("#%d removed from %s\n", pr.Number, label)
	return nil
}
