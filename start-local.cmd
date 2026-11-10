@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
set "PARALLEL_NODE=node"
where node >nul 2>nul
if errorlevel 1 (
  if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" (
    set "PARALLEL_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
  ) else (
    echo 请先安装 Node.js 24 或更新版本，然后按 README 安装依赖。
    pause
    exit /b 1
  )
)
if not exist "node_modules\next\dist\bin\next" (
  echo 首次使用请在此目录运行 pnpm install，然后重试。
  pause
  exit /b 1
)
"%PARALLEL_NODE%" -e "fetch('http://127.0.0.1:3000/api/routes',{signal:AbortSignal.timeout(1000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >nul 2>nul
if not errorlevel 1 (
  start "" "http://127.0.0.1:3000"
  exit /b 0
)
echo 沿着一条纬线 · http://127.0.0.1:3000
echo 服务启动后即可在浏览器访问。关闭此窗口将停止服务。
start "" "http://127.0.0.1:3000"
if exist ".next\BUILD_ID" (
  "%PARALLEL_NODE%" node_modules\next\dist\bin\next start --hostname 127.0.0.1
) else (
  "%PARALLEL_NODE%" node_modules\next\dist\bin\next dev --hostname 127.0.0.1
)
pause
