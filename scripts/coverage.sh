#!/usr/bin/env sh
# Regenerates both coverage reports under docs/coverage/ and prints the totals
# that the README quotes. Runs in any POSIX shell (Linux, macOS, Git Bash).
#
#   sh scripts/coverage.sh
set -eu

root=$(cd "$(dirname "$0")/.." && pwd)
output="$root/docs/coverage"
rm -rf "$output"
mkdir -p "$output"

echo "== backend =="
cd "$root/backend"
go test ./... -count=1 -coverprofile=coverage.out
go tool cover -func=coverage.out | tail -n 1
go tool cover -html=coverage.out -o "$output/backend.html"

echo "== frontend =="
cd "$root/frontend"
npm run coverage -- \
  --coverage.reportsDirectory="$output/frontend" \
  --coverage.reporter=text --coverage.reporter=html

echo "Reports written to docs/coverage/: backend.html and frontend/index.html"
