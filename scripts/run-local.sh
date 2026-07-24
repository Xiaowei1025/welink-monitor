#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_dir"

if ! command -v node >/dev/null 2>&1; then
  echo "未找到 Node.js。请安装 Node.js 22.13 或更高版本后重试。" >&2
  exit 1
fi

node_major="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$node_major" -lt 22 ]; then
  echo "当前 Node.js 版本为 $(node --version)，需要 22.13 或更高版本。" >&2
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "首次运行：正在安装依赖…"
  npm ci
fi

if [ ! -f .env ]; then
  cp .env.example .env
  echo "已创建 .env。请填写 AI 服务配置后重新运行。" >&2
  exit 1
fi

echo "正在初始化本地巡检台账…"
./node_modules/.bin/wrangler d1 migrations apply site-creator-d1 --local --config wrangler.jsonc

port="${WELINK_MONITOR_PORT:-4173}"
host="${WELINK_MONITOR_HOST:-127.0.0.1}"
echo "巡检台将在 http://${host}:${port} 启动。按 Ctrl+C 停止。"
exec ./node_modules/.bin/vinext dev --host "$host" --port "$port"
