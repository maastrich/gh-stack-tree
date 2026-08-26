// Package cmd implements the gh stack-tree subcommands.
package cmd

import (
	"bufio"
	"errors"
	"flag"
	"fmt"
	"os"
	"strings"

	"github.com/maastrich/gh-stack-tree/cli/internal/gh"
	"github.com/maastrich/gh-stack-tree/cli/internal/git"
	"github.com/maastrich/gh-stack-tree/cli/internal/tree"
	"golang.org/x/term"
)

const usage = `gh stack-tree — tree-shaped PR stacks, declared with a stacktree:<name> label

Usage:
  gh stack-tree view     [--stack NAME]
  gh stack-tree restack  [--stack NAME] [-n|--dry-run] [--no-push] [-y|--yes] [--allow-diverged]
  gh stack-tree label    [NAME] [--pr N]     add the current branch's PR to a stack (creates the label)
  gh stack-tree unlabel  [--pr N]            remove the current branch's PR from its stack
  gh stack-tree stacks                       list stacks in this repository

The stack is detected from the current branch's pull request when --stack is
omitted.
`

func Run(args []string) error {
	if len(args) == 0 || args[0] == "-h" || args[0] == "--help" || args[0] == "help" {
		fmt.Print(usage)
		return nil
	}
	if !gh.Available() {
		return errors.New("gh is required (https://cli.github.com)")
	}
	if !git.IsRepo() {
		return errors.New("not a git repository")
	}
	switch args[0] {
	case "view":
		return runView(args[1:])
	case "restack":
		return runRestack(args[1:])
	case "label":
		return runLabel(args[1:])
	case "unlabel":
		return runUnlabel(args[1:])
	case "stacks":
		return runStacks()
	case "version", "--version":
		fmt.Println("gh-stack-tree", Version)
		return nil
	default:
		fmt.Print(usage)
		return fmt.Errorf("unknown command %q", args[0])
	}
}

// Version is set by the release build.
var Version = "dev"

// resolveStack returns the stacktree label to work on: the flag if given,
// otherwise the label of the current branch's PR.
func resolveStack(flag string) (string, error) {
	if flag != "" {
		return gh.LabelPrefix + strings.TrimPrefix(flag, gh.LabelPrefix), nil
	}
	branch, err := git.CurrentBranch()
	if err != nil {
		return "", err
	}
	pr, err := gh.ForBranch(branch)
	if err != nil {
		return "", err
	}
	if pr == nil || pr.StackLabel() == "" {
		labels, _ := gh.StackLabels()
		hint := ""
		if len(labels) > 0 {
			hint = "\n  stacks here: " + strings.Join(labels, ", ")
		}
		return "", fmt.Errorf("branch %s is not in a stack; pass --stack NAME or run `gh stack-tree label NAME`%s", branch, hint)
	}
	return pr.StackLabel(), nil
}

func loadTree(label string) (*tree.Tree, []gh.PR, error) {
	trunk, err := gh.DefaultBranch()
	if err != nil {
		return nil, nil, err
	}
	prs, err := gh.ListByLabel(label)
	if err != nil {
		return nil, nil, err
	}
	return tree.Build(trunk, prs), prs, nil
}

func confirm(prompt string) bool {
	if !term.IsTerminal(int(os.Stdin.Fd())) {
		return false
	}
	fmt.Printf("%s [y/N] ", prompt)
	line, _ := bufio.NewReader(os.Stdin).ReadString('\n')
	line = strings.ToLower(strings.TrimSpace(line))
	return line == "y" || line == "yes"
}

func runStacks() error {
	labels, err := gh.StackLabels()
	if err != nil {
		return err
	}
	if len(labels) == 0 {
		fmt.Println("no stack trees in this repository")
		return nil
	}
	for _, l := range labels {
		fmt.Println(strings.TrimPrefix(l, gh.LabelPrefix))
	}
	return nil
}

// parseAnywhere lets flags appear before or after positional arguments
// (`label lcm-agent --pr 12` and `label --pr 12 lcm-agent` both work).
func parseAnywhere(fs *flag.FlagSet, args []string) ([]string, error) {
	var flags, pos []string
	for i := 0; i < len(args); i++ {
		a := args[i]
		if strings.HasPrefix(a, "-") {
			flags = append(flags, a)
			name := strings.TrimLeft(a, "-")
			if f := fs.Lookup(strings.SplitN(name, "=", 2)[0]); f != nil && !strings.Contains(a, "=") {
				if b, ok := f.Value.(interface{ IsBoolFlag() bool }); !ok || !b.IsBoolFlag() {
					if i+1 < len(args) {
						i++
						flags = append(flags, args[i])
					}
				}
			}
			continue
		}
		pos = append(pos, a)
	}
	if err := fs.Parse(flags); err != nil {
		return nil, err
	}
	return pos, nil
}
