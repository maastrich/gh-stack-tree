package tree

import (
	"testing"

	"github.com/maastrich/gh-stack-tree/cli/internal/gh"
)

func pr(n int, head, base string) gh.PR {
	return gh.PR{Number: n, Head: head, Base: base, State: "OPEN"}
}

func TestOrderAndRender(t *testing.T) {
	tr := Build("main", []gh.PR{
		pr(4, "d", "c"), pr(1, "a", "main"), pr(3, "c", "a"), pr(2, "b", "a"),
		{Number: 9, Head: "old", Base: "main", State: "MERGED"},
	})
	order, err := tr.Order()
	if err != nil {
		t.Fatal(err)
	}
	got := ""
	for _, n := range order {
		got += n.PR.Head
	}
	if got != "abcd" {
		t.Fatalf("order = %q", got)
	}
	want := "(main)\n└─ #1 a\n   ├─ #2 b\n   └─ #3 c ◀\n      └─ #4 d\n"
	if r := tr.Render("c"); r != want {
		t.Fatalf("render:\n%s\nwant:\n%s", r, want)
	}
	if len(Subtree(order[2])) != 2 {
		t.Fatal("subtree of c should be c,d")
	}
}
