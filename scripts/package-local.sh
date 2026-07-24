#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
release_dir="$project_dir/releases"
archive_path="$release_dir/welink-monitor-local-$(date +%Y%m%d-%H%M%S).tar.gz"

mkdir -p "$release_dir"

tar \
  --exclude='.env' \
  --exclude='node_modules' \
  --exclude='.wrangler' \
  --exclude='dist' \
  --exclude='.git' \
  --exclude='docs' \
  --exclude='releases' \
  -czf "$archive_path" \
  -C "$(dirname "$project_dir")" "$(basename "$project_dir")"

echo "已生成部署包：$archive_path"
