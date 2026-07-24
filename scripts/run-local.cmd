@echo off
setlocal EnableExtensions
for %%I in ("%~dp0..") do set "PROJECT_DIR=%%~fI"
cd /d "%PROJECT_DIR%"

where node >nul 2>nul
if errorlevel 1 (
  echo 未找到 Node.js。请安装 Node.js 22.13 或更高版本后重试。
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo 未找到 npm。请重新安装 Node.js 22.13 或更高版本后重试。
  pause
  exit /b 1
)

node -e "const [major, minor] = process.versions.node.split('.').map(Number); process.exit(major ^> 22 ^|^| (major === 22 ^&^& minor ^>= 13) ? 0 : 1)"
if errorlevel 1 (
  echo 当前 Node.js 版本为:
  node --version
  echo 本工具需要 Node.js 22.13 或更高版本。
  pause
  exit /b 1
)

if not exist "node_modules\.bin\vinext.cmd" (
  echo 首次运行：正在安装依赖...
  call npm ci
  if errorlevel 1 goto :error
)

if not exist ".env" (
  copy ".env.example" ".env" >nul
  echo 已创建 .env。请填写 AI 服务配置后重新运行。
  start "" notepad.exe ".env"
  pause
  exit /b 1
)

echo 正在初始化本地巡检台账...
call node_modules\.bin\wrangler.cmd d1 migrations apply site-creator-d1 --local --config wrangler.jsonc
if errorlevel 1 goto :error

if "%WELINK_MONITOR_PORT%"=="" set "WELINK_MONITOR_PORT=4173"
if "%WELINK_MONITOR_HOST%"=="" set "WELINK_MONITOR_HOST=127.0.0.1"

echo 正在启动巡检台：http://%WELINK_MONITOR_HOST%:%WELINK_MONITOR_PORT%
echo 浏览器将在服务就绪后自动打开。关闭此窗口或按 Ctrl+C 可停止服务。
start "" /b powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 3; Start-Process 'http://%WELINK_MONITOR_HOST%:%WELINK_MONITOR_PORT%/'"
call node_modules\.bin\vinext.cmd dev --host "%WELINK_MONITOR_HOST%" --port "%WELINK_MONITOR_PORT%"
goto :eof

:error
echo 启动失败，请检查上方错误信息。
pause
exit /b 1
