package cmd

import (
	"errors"
	"flag"
	"fmt"
	"os"
	"strings"

	"github.com/maastrich/gh-stack-tree/cli/internal/gh"
	"github.com/maastrich/gh-stack-tree/cli/internal/git"
	"github.com/maastrich/gh-stack-tree/cli/internal/tree"
)

// restack rebases every open branch of a stack tree onto its parent —
// the parent's new tip when it moved, the trunk when the parent's PR was
// merged. Parents go first so children always land on fresh tips.
//
// Safety rules, in order of appearance:
//   - working tree must be clean
//   - only PRs carrying the stack label are touched
//   - a local branch that diverged from origin is refused (--allow-diverged
//     to keep local commits), never silently force-pushed
//   - a parent missing from the open set must have a MERGED PR, otherwise
//     the branch is skipped instead of being rebased onto trunk
//   - every fork point is snapshotted before anything moves
//   - each branch is backed up under refs/stack-tree/backup/<branch>
//   - a conflict aborts the rebase and stops; nothing is pushed
//   - push only when every branch sits on its parent, and only with
//     --force-with-lease, and only after --yes or an interactive confirmation
func runRestack(args []string) error {
	fs := flag.NewFlagSet("restack", flag.ContinueOnError)
	stack := fs.String("stack", "", "stack name")
	dry := fs.Bool("dry-run", false, "print the plan, change nothing")
	fs.BoolVar(dry, "n", false, "alias for --dry-run")
	noPush := fs.Bool("no-push", false, "rebase locally, skip the push")
	yes := fs.Bool("yes", false, "push without asking")
	fs.BoolVar(yes, "y", false, "alias for --yes")
	allowDiverged := fs.Bool("allow-diverged", false, "rebase branches whose local copy has commits origin lacks")
	pos, err := parseAnywhere(fs, args)
	if err != nil {
		return err
	}
	_ = pos

	if !git.IsClean() {
		return errors.New("working tree is dirty, commit or stash first")
	}
	label, err := resolveStack(*stack)
	if err != nil {
		return err
	}
	start, err := git.CurrentBranch()
	if err != nil {
		return err
	}

	fmt.Println("fetching…")
	if err := git.Fetch(); err != nil {
		return err
	}
	t, prs, err := loadTree(label)
	if err != nil {
		return err
	}
	if len(t.Nodes) == 0 {
		fmt.Println("no open pull request in", label)
		return nil
	}
	merged := map[string]bool{}
	for _, p := range prs {
		if p.State == "MERGED" {
			merged[p.Head] = true
		}
	}
	trunk := "origin/" + t.Trunk

	// 1. make every branch available locally and in sync with origin
	skip := map[*tree.Node]string{}
	for _, n := range t.Nodes {
		h := n.PR.Head
		if n.PR.Fork {
			skip[n] = "comes from a fork"
			continue
		}
		switch {
		case !git.Verify(h):
			if !git.Verify("origin/" + h) {
				skip[n] = "not on origin"
				continue
			}
			if *dry {
				fmt.Printf("  + %s would be pulled from origin (#%d)\n", h, n.PR.Number)
			} else {
				if err := git.Track(h); err != nil {
					return err
				}
				fmt.Printf("  + %s pulled from origin (#%d)\n", h, n.PR.Number)
			}
		case git.Verify("origin/"+h) && git.Rev(h) != git.Rev("origin/"+h):
			if git.IsAncestor(h, "origin/"+h) {
				if *dry {
					fmt.Printf("  ↑ %s would be fast-forwarded to origin\n", h)
				} else {
					if err := git.Reset(h, "origin/"+h); err != nil {
						return err
					}
					fmt.Printf("  ↑ %s fast-forwarded to origin\n", h)
				}
			} else if *allowDiverged {
				fmt.Printf("  ~ %s differs from origin (local commits kept)\n", h)
			} else {
				skip[n] = "diverged from origin (push it first, or --allow-diverged)"
			}
		}
	}
	// a skipped node takes its subtree with it: children can't land on a stale parent
	for _, n := range t.Nodes {
		for p := n.Parent; p != nil; p = p.Parent {
			if r, ok := skip[p]; ok {
				skip[n] = "parent " + p.PR.Head + " skipped: " + r
				break
			}
		}
	}
	for n, r := range skip {
		fmt.Fprintf(os.Stderr, "  ! %s skipped: %s\n", n.PR.Head, r)
	}

	// 2. new base per node; a parent that vanished must be merged
	newBase := map[*tree.Node]string{}
	reason := map[*tree.Node]string{}
	for _, n := range t.Nodes {
		if _, ok := skip[n]; ok {
			continue
		}
		switch {
		case n.Parent != nil:
			newBase[n] = n.Parent.PR.Head
			reason[n] = "follows " + n.Parent.PR.Head
		case n.PR.Base == t.Trunk:
			newBase[n] = trunk
			reason[n] = "root of the stack"
		case merged[n.PR.Base]:
			newBase[n] = trunk
			reason[n] = n.PR.Base + " merged → " + t.Trunk
		default:
			skip[n] = "base " + n.PR.Base + " has no open or merged PR in this stack (label it, or retarget)"
			fmt.Fprintf(os.Stderr, "  ! %s skipped: %s\n", n.PR.Head, skip[n])
		}
	}

	// local ref for a head: the branch when present, origin/<head> otherwise
	// (dry run before the branch was pulled)
	local := func(head string) string {
		if git.Verify(head) {
			return head
		}
		return "origin/" + head
	}

	// 3. snapshot fork points before anything moves
	fork := map[*tree.Node]string{}
	for _, n := range t.Nodes {
		if _, ok := skip[n]; ok || !git.Verify(local(n.PR.Head)) {
			continue
		}
		ref := newBase[n]
		if n.Parent != nil {
			ref = local(n.Parent.PR.Head)
		} else if n.PR.Base != t.Trunk && git.Verify(local(n.PR.Base)) {
			ref = local(n.PR.Base) // merged parent still around: exact fork point
		}
		f, err := git.MergeBase(local(n.PR.Head), ref)
		if err != nil {
			return err
		}
		fork[n] = f
	}

	// 4. rebase, parents first
	order, err := t.Order()
	if err != nil {
		return err
	}
	var moved []string
	planned := map[*tree.Node]bool{}
	for _, n := range order {
		if _, ok := skip[n]; ok {
			continue
		}
		f, ok := fork[n]
		if !ok {
			continue
		}
		h, nb := n.PR.Head, newBase[n]
		shown := strings.TrimPrefix(nb, "origin/")
		parentPlanned := *dry && n.Parent != nil && planned[n.Parent]
		if !parentPlanned && git.IsAncestor(local(nb), local(h)) {
			fmt.Printf("  = %s (already on top of %s)\n", h, shown)
			continue
		}
		fmt.Printf("  → %s onto %s [%s]\n", h, shown, reason[n])
		if *dry {
			planned[n] = true
			continue
		}
		if err := git.Backup(h); err != nil {
			return err
		}
		if err := git.Rebase(nb, f, h); err != nil {
			_ = git.Checkout(start)
			return fmt.Errorf(`conflict while rebasing %s onto %s.
  Replay it by hand, then run restack again:
    git rebase --onto %s %s %s --update-refs
  Undo: git branch -f %s refs/stack-tree/backup/%s
  (git config rerere.enabled true replays known resolutions)`, h, shown, nb, f, h, h, h)
		}
		moved = append(moved, h)
	}
	if err := git.Checkout(start); err != nil {
		return err
	}

	if *dry {
		fmt.Println("dry run, nothing changed")
		return nil
	}
	if len(moved) == 0 {
		fmt.Println("everything already up to date")
		return nil
	}

	// 5. push only a fully consistent tree
	for _, n := range order {
		if _, ok := skip[n]; ok {
			continue
		}
		if !git.IsAncestor(newBase[n], n.PR.Head) {
			return fmt.Errorf("%s is not on top of %s, nothing pushed", n.PR.Head, strings.TrimPrefix(newBase[n], "origin/"))
		}
	}
	fmt.Printf("rebased %d branch(es); backups in refs/stack-tree/backup/\n", len(moved))
	if *noPush {
		fmt.Println("push skipped; run:\n  git push --force-with-lease origin", strings.Join(moved, " "))
		return nil
	}
	if !*yes && !confirm(fmt.Sprintf("push %d branch(es) with --force-with-lease?", len(moved))) {
		fmt.Println("not pushed; run:\n  git push --force-with-lease origin", strings.Join(moved, " "))
		return nil
	}
	if err := git.Push(moved); err != nil {
		return err
	}
	fmt.Println("pushed", strings.Join(moved, " "))
	return nil
}

var _ = gh.LabelPrefix
