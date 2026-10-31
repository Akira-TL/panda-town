#!/usr/bin/env bash
set -euo pipefail
PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd -- "$PROJECT_ROOT"
export PANDA_MODE="${PANDA_MODE:-dev}"
case "$PANDA_MODE" in
  dev) NEXT_COMMAND=dev; PORT="${PORT:-3000}" ;;
  production) NEXT_COMMAND=start; PORT="${PORT:-3018}" ;;
  *) echo "PANDA_MODE 仅支持 dev 或 production。" >&2; exit 1 ;;
esac
export PANDA_NEXT_COMMAND="$NEXT_COMMAND"
export PANDA_LOG_PREFIX="$PANDA_MODE"
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
if [[ "$PANDA_MODE" == production && ! -f .next-production/BUILD_ID ]]; then
  echo "请先执行 PANDA_MODE=production npm run build。" >&2
  exit 1
fi
if [[ "${OSTYPE:-}" == msys* || "${OSTYPE:-}" == cygwin* ]]; then
  export PANDA_PROJECT_ROOT="$(cygpath -w "$PROJECT_ROOT")"
  export PANDA_DEV_PORT="$PORT"
  powershell.exe -NoProfile -NonInteractive -Command '
    $ErrorActionPreference = "Stop"
    $root = $env:PANDA_PROJECT_ROOT
    $cli = Join-Path $root "node_modules\next\dist\bin\next"
    $prefix = $env:PANDA_LOG_PREFIX
    $pidFile = Join-Path $root ("logs\" + $prefix + ".pid")
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
    $launchArgs = @(("`"" + $cli + "`""), $env:PANDA_NEXT_COMMAND, "--hostname", "127.0.0.1")
    $launchArgs += @("--port", $env:PANDA_DEV_PORT)
    $process = Start-Process -FilePath $nodeExe -ArgumentList $launchArgs `
      -WorkingDirectory $root -WindowStyle Hidden `
      -RedirectStandardOutput (Join-Path $root ("logs\" + $prefix + ".log")) `
      -RedirectStandardError (Join-Path $root ("logs\" + $prefix + "-error.log")) -PassThru
    if ($process.WaitForExit(1500)) {
      throw ("服务启动后立即退出，请检查 logs/" + $prefix + "-error.log。")
    }
    Set-Content -LiteralPath $pidFile -Value $process.Id
    Write-Output ("服务已启动：http://127.0.0.1:" + $env:PANDA_DEV_PORT + "；日志前缀 logs/" + $prefix)
  '
else
  if [[ -s "logs/$PANDA_MODE.pid" ]] && kill -0 "$(cat "logs/$PANDA_MODE.pid")" 2>/dev/null; then
    echo "开发服务已运行，请先停止。" >&2
    exit 1
  fi
  nohup node "$PROJECT_ROOT/node_modules/next/dist/bin/next" "$NEXT_COMMAND" \
    --hostname 127.0.0.1 --port "$PORT" >"logs/$PANDA_MODE.log" 2>"logs/$PANDA_MODE-error.log" &
  echo "$!" >"logs/$PANDA_MODE.pid"
  echo "服务已启动：http://127.0.0.1:$PORT；日志前缀 logs/$PANDA_MODE"
fi
