// Package git wraps the git commands the tool needs. Every function shells out
// to the git binary so behaviour matches what the user would do by hand.
package git

import (
	"bytes"
	"errors"
	"fmt"
	"os/exec"
	"strings"
)

// Run executes git with args and returns trimmed stdout.
func Run(args ...string) (string, error) {
	cmd := exec.Command("git", args...)
	var out, errb bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &errb
	if err := cmd.Run(); err != nil {
		msg := strings.TrimSpace(errb.String())
		if msg == "" {
			msg = err.Error()
		}
		return "", fmt.Errorf("git %s: %s", strings.Join(args, " "), msg)
	}
	return strings.TrimSpace(out.String()), nil
}

func ok(args ...string) bool {
	_, err := Run(args...)
	return err == nil
}

func IsRepo() bool                          { return ok("rev-parse", "--git-dir") }
func IsClean() bool                         { return ok("diff", "--quiet") && ok("diff", "--cached", "--quiet") }
func Verify(ref string) bool                { return ok("rev-parse", "--verify", "--quiet", ref) }
func Rev(ref string) string                 { s, _ := Run("rev-parse", ref); return s }
func IsAncestor(a, b string) bool           { return ok("merge-base", "--is-ancestor", a, b) }
func MergeBase(a, b string) (string, error) { return Run("merge-base", a, b) }
func CurrentBranch() (string, error)        { return Run("rev-parse", "--abbrev-ref", "HEAD") }
func Fetch() error                          { _, err := Run("fetch", "origin", "--prune"); return err }
func Checkout(ref string) error             { _, err := Run("checkout", "-q", ref); return err }

// Track creates a local branch tracking origin/<name>.
func Track(name string) error {
	_, err := Run("branch", "--quiet", "--track", name, "origin/"+name)
	return err
}

// Reset moves branch to ref without checking it out.
func Reset(branch, ref string) error {
	_, err := Run("branch", "--quiet", "-f", branch, ref)
	return err
}

// Backup records a ref under refs/stack-tree/backup/<branch> so a bad rebase
// can be undone with `git branch -f <branch> refs/stack-tree/backup/<branch>`.
func Backup(branch string) error {
	_, err := Run("update-ref", "refs/stack-tree/backup/"+branch, branch)
	return err
}

// Rebase runs `git rebase --onto newbase fork branch --update-refs`.
// On failure the rebase is aborted and the error returned.
func Rebase(newbase, fork, branch string) error {
	_, err := Run("rebase", "--onto", newbase, fork, branch, "--update-refs")
	if err != nil {
		_, _ = Run("rebase", "--abort")
		return errors.New("conflict")
	}
	return nil
}

// Push force-pushes branches with a lease; refuses when the remote moved.
func Push(branches []string) error {
	args := append([]string{"push", "--force-with-lease", "origin"}, branches...)
	cmd := exec.Command("git", args...)
	var errb bytes.Buffer
	cmd.Stderr = &errb
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("push failed: %s", strings.TrimSpace(errb.String()))
	}
	return nil
}
