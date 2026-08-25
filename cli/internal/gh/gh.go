// Package gh wraps the GitHub CLI for the few queries the tool needs.
package gh

import (
	"encoding/json"
	"fmt"
	"os/exec"
	"strings"
)

// LabelPrefix marks pull requests that belong to a stack tree.
const LabelPrefix = "stacktree:"

// PR is the subset of pull request fields the tool uses.
type PR struct {
	Number int     `json:"number"`
	Title  string  `json:"title"`
	Head   string  `json:"headRefName"`
	Base   string  `json:"baseRefName"`
	State  string  `json:"state"` // OPEN, MERGED, CLOSED
	Draft  bool    `json:"isDraft"`
	Labels []Label `json:"labels"`
	Fork   bool    `json:"isCrossRepository"`
}

type Label struct {
	Name string `json:"name"`
}

func (p PR) StackLabel() string {
	for _, l := range p.Labels {
		if strings.HasPrefix(l.Name, LabelPrefix) {
			return l.Name
		}
	}
	return ""
}

func run(args ...string) ([]byte, error) {
	cmd := exec.Command("gh", args...)
	out, err := cmd.Output()
	if err != nil {
		if ee, ok := err.(*exec.ExitError); ok && len(ee.Stderr) > 0 {
			return nil, fmt.Errorf("gh %s: %s", strings.Join(args, " "), strings.TrimSpace(string(ee.Stderr)))
		}
		return nil, fmt.Errorf("gh %s: %w", strings.Join(args, " "), err)
	}
	return out, nil
}

const prFields = "number,title,headRefName,baseRefName,state,isDraft,labels,isCrossRepository"

func Available() bool {
	_, err := exec.LookPath("gh")
	return err == nil
}

func DefaultBranch() (string, error) {
	out, err := run("repo", "view", "--json", "defaultBranchRef", "--jq", ".defaultBranchRef.name")
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(out)), nil
}

// ListByLabel returns every PR (any state) carrying label.
func ListByLabel(label string) ([]PR, error) {
	out, err := run("pr", "list", "--state", "all", "--limit", "200", "--label", label, "--json", prFields)
	if err != nil {
		return nil, err
	}
	var prs []PR
	return prs, json.Unmarshal(out, &prs)
}

// ForBranch returns the most recent PR whose head is branch, or nil.
func ForBranch(branch string) (*PR, error) {
	out, err := run("pr", "list", "--state", "all", "--limit", "1", "--head", branch, "--json", prFields)
	if err != nil {
		return nil, err
	}
	var prs []PR
	if err := json.Unmarshal(out, &prs); err != nil {
		return nil, err
	}
	if len(prs) == 0 {
		return nil, nil
	}
	return &prs[0], nil
}

// StackLabels lists the stacktree:* labels defined in the repository.
func StackLabels() ([]string, error) {
	out, err := run("label", "list", "--search", LabelPrefix, "--limit", "100", "--json", "name", "--jq", ".[].name")
	if err != nil {
		return nil, err
	}
	var names []string
	for _, l := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		if strings.HasPrefix(l, LabelPrefix) {
			names = append(names, l)
		}
	}
	return names, nil
}

func EnsureLabel(label string) error {
	name := strings.TrimPrefix(label, LabelPrefix)
	_, err := run("label", "create", label, "--color", "0E8A16", "--description", "PR stack tree: "+name, "--force")
	return err
}

func AddLabel(number int, label string) error {
	_, err := run("pr", "edit", fmt.Sprint(number), "--add-label", label)
	return err
}

func RemoveLabel(number int, label string) error {
	_, err := run("pr", "edit", fmt.Sprint(number), "--remove-label", label)
	return err
}

func SetBase(number int, base string) error {
	_, err := run("pr", "edit", fmt.Sprint(number), "--base", base)
	return err
}

// ByNumber fetches a single PR.
func ByNumber(number int) (*PR, error) {
	out, err := run("pr", "view", fmt.Sprint(number), "--json", prFields)
	if err != nil {
		return nil, err
	}
	var pr PR
	if err := json.Unmarshal(out, &pr); err != nil {
		return nil, err
	}
	return &pr, nil
}
