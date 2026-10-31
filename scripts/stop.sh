#!/usr/bin/env bash
set -euo pipefail
PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd -- "$PROJECT_ROOT"
export PANDA_MODE="${PANDA_MODE:-dev}"
case "$PANDA_MODE" in dev|production) ;; *) echo "PANDA_MODE 无效。" >&2; exit 1 ;; esac
if [[ ! -s "logs/$PANDA_MODE.pid" ]]; then
  echo "没有本项目的运行记录。"
  exit 0
fi
if [[ "${OSTYPE:-}" == msys* || "${OSTYPE:-}" == cygwin* ]]; then
  export PANDA_PROJECT_ROOT="$(cygpath -w "$PROJECT_ROOT")"
  powershell.exe -NoProfile -NonInteractive -Command '
    $ErrorActionPreference = "Stop"
    $root = $env:PANDA_PROJECT_ROOT
    $pidFile = Join-Path $root ("logs\" + $env:PANDA_MODE + ".pid")
    $serviceId = 0
    if (-not [int]::TryParse((Get-Content -LiteralPath $pidFile -Raw).Trim(), [ref]$serviceId)) {
      throw "运行记录不是有效进程编号。"
    }
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$serviceId"
    if ($process) {
      $cli = Join-Path $root "node_modules\next\dist\bin\next"
      if (-not $process.CommandLine.Contains($cli)) { throw "进程不属于本项目，已停止操作。" }
      & taskkill.exe /PID $serviceId /T /F | Out-Null
      if ($LASTEXITCODE -ne 0) { throw "停止开发服务失败。" }
    }
    Set-Content -LiteralPath $pidFile -Value ""
    Write-Output "本项目所选模式的服务已停止。"
  '
else
  service_pid="$(cat "logs/$PANDA_MODE.pid")"
  if [[ ! "$service_pid" =~ ^[0-9]+$ ]]; then
    echo "无效的进程编号。" >&2
    exit 1
  fi
  if kill -0 "$service_pid" 2>/dev/null; then
    process_args="$(ps -p "$service_pid" -o args=)"
    if [[ "$process_args" != *"$PROJECT_ROOT/node_modules/next/dist/bin/next"* ]]; then
      echo "进程不属于本项目，已停止操作。" >&2
      exit 1
    fi
    kill "$service_pid"
  fi
  : >"logs/$PANDA_MODE.pid"
fi
