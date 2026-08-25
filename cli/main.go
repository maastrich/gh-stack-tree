package main

import (
	"fmt"
	"os"

	"github.com/maastrich/gh-stack-tree/cli/cmd"
)

func main() {
	if err := cmd.Run(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, "stack-tree:", err)
		os.Exit(1)
	}
}
