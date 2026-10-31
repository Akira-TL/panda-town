#!/usr/bin/env bash
set -euo pipefail
PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd -- "$PROJECT_ROOT"
PORT="${PORT:-3000}"
if [[ ! "$PORT" =~ ^[0-9]+$ ]] || ((PORT < 1024 || PORT > 65535)); then
  echo "PORT 必须是 1024–65535 的整数。" >&2
  exit 1
fi
mkdir -p logs
export NEXT_TELEMETRY_DISABLED=1
if [[ ! -f node_modules/next/dist/bin/next ]]; then
  echo "请先在项目根目录执行 npm ci。" >&2
  exit 1
fi
if [[ "${OSTYPE:-}" == msys* || "${OSTYPE:-}" == cygwin* ]]; then
  export PANDA_PROJECT_ROOT="$(cygpath -w "$PROJECT_ROOT")"
  export PANDA_DEV_PORT="$PORT"
  powershell.exe -NoProfile -NonInteractive -Command '
    $ErrorActionPreference = "Stop"
    $root = $env:PANDA_PROJECT_ROOT
    $cli = Join-Path $root "node_modules\next\dist\bin\next"
    $pidFile = Join-Path $root "logs\dev.pid"
    $probe = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, [int]$env:PANDA_DEV_PORT)
    $probe.Server.ExclusiveAddressUse = $true
    try { $probe.Start() } catch { throw "所选端口已被占用，请使用 PORT 指定其他端口。" }
    finally { $probe.Stop() }
    if (Test-Path -LiteralPath $pidFile) {
      $oldId = 0
      if ([int]::TryParse((Get-Content -LiteralPath $pidFile -Raw).Trim(), [ref]$oldId)) {
        $old = Get-CimInstance Win32_Process -Filter "ProcessId=$oldId"
        if ($old -and $old.CommandLine.Contains($cli)) { throw "本项目开发服务已运行，请先执行 bash scripts/stop.sh。" }
      }
    }
    $nodeExe = (Get-Command node.exe).Source
    $launchArgs = @(("`"" + $cli + "`""), "dev", "--hostname", "127.0.0.1", "--port", $env:PANDA_DEV_PORT)
    $process = Start-Process -FilePath $nodeExe -ArgumentList $launchArgs `
      -WorkingDirectory $root -WindowStyle Hidden `
      -RedirectStandardOutput (Join-Path $root "logs\dev.log") `
      -RedirectStandardError (Join-Path $root "logs\dev-error.log") -PassThru
    if ($process.WaitForExit(1500)) {
      throw "开发服务启动后立即退出，请检查 logs/dev-error.log。"
    }
    Set-Content -LiteralPath $pidFile -Value $process.Id
    Write-Output ("开发服务已启动：http://127.0.0.1:" + $env:PANDA_DEV_PORT + "；日志位于 logs/dev.log")
  '
else
  if [[ -s logs/dev.pid ]] && kill -0 "$(cat logs/dev.pid)" 2>/dev/null; then
    echo "开发服务已运行，请先停止。" >&2
    exit 1
  fi
  nohup node "$PROJECT_ROOT/node_modules/next/dist/bin/next" dev \
    --hostname 127.0.0.1 --port "$PORT" >logs/dev.log 2>logs/dev-error.log &
  echo "$!" >logs/dev.pid
  echo "开发服务已启动：http://127.0.0.1:$PORT；日志位于 logs/dev.log"
fi
