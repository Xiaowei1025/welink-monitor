@echo off
setlocal
cd /d "%~dp0.."

where node >nul 2>nul
if errorlevel 1 (
  echo 未找到 Node.js。请安装 Node.js 22.13 或更高版本后重试。
  pause
  exit /b 1
)

if not exist node_modules (
  echo 首次运行：正在安装依赖...
  call npm ci
  if errorlevel 1 goto :error
)

if not exist .env (
  copy .env.example .env >nul
  echo 已创建 .env。请填写 AI 服务配置后重新运行。
  notepad .env
  pause
  exit /b 1
)

echo 正在初始化本地巡检台账...
call node_modules\.bin\wrangler.cmd d1 migrations apply site-creator-d1 --local --config wrangler.jsonc
if errorlevel 1 goto :error

echo 巡检台已启动：http://127.0.0.1:4173
start "" http://127.0.0.1:4173
call node_modules\.bin\vinext.cmd dev --host 127.0.0.1 --port 4173
goto :eof

:error
echo 启动失败，请检查上方错误信息。
pause
exit /b 1
