#!/usr/bin/env bash
# Called by cli/gh-extension-precompile. Builds the Go CLI in ./cli for every
# gh-supported platform into ./dist/<os>-<arch>[.exe].
set -euo pipefail
tag="${GITHUB_REF_NAME:-dev}"
platforms=(
  darwin-amd64 darwin-arm64
  linux-386 linux-amd64 linux-arm linux-arm64
  windows-386 windows-amd64 windows-arm64
  freebsd-386 freebsd-amd64 freebsd-arm64
  android-arm64
)
mkdir -p dist
cd cli
for p in "${platforms[@]}"; do
  os="${p%-*}"; arch="${p#*-}"
  ext=""; [[ "$os" == "windows" ]] && ext=".exe"
  echo "building $p"
  CGO_ENABLED=0 GOOS="$os" GOARCH="$arch" \
    go build -trimpath -ldflags "-s -w -X github.com/maastrich/gh-stack-tree/cli/cmd.Version=${tag}" \
    -o "../dist/${p}${ext}" .
done
