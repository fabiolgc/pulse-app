/**
 * Gera scripts de inicialização do agent Pulse para diferentes SOs.
 *
 * Premissas:
 * - Usuário já clonou o repo (apps/agent/ está no disco). Bootstrap não baixa código.
 * - Script é executado de dentro de apps/agent/.
 * - Token de ingest vem do env do servidor (INGEST_TOKENS) — global por fonte, não por usuário.
 */

export type AgentOS = "windows" | "mac" | "linux"

interface BootstrapInput {
  os: AgentOS
  ingestUrl: string
  ingestToken: string
  symbols?: string
  timeframes?: string
  mt5Path?: string | null
}

const DEFAULT_SYMBOLS = "WIN@N,WDO@N"
const DEFAULT_TIMEFRAMES = "M5,M15"
const MT5_DEFAULT_PATH = "C:\\Program Files\\MetaTrader 5\\terminal64.exe"

export function generateBootstrapScript(input: BootstrapInput): {
  filename: string
  content: string
  mimeType: string
} {
  const symbols = input.symbols ?? DEFAULT_SYMBOLS
  const timeframes = input.timeframes ?? DEFAULT_TIMEFRAMES

  const mt5Path = input.mt5Path?.trim() || ""

  if (input.os === "windows") {
    return {
      filename: "pulse-agent-start.bat",
      mimeType: "application/x-msdos-program",
      content: windowsScript({
        ingestUrl: input.ingestUrl,
        ingestToken: input.ingestToken,
        symbols,
        timeframes,
        mt5Path,
      }),
    }
  }

  return {
    filename: input.os === "mac" ? "pulse-agent-start.command" : "pulse-agent-start.sh",
    mimeType: "application/x-sh",
    content: unixScript({
      ingestUrl: input.ingestUrl,
      ingestToken: input.ingestToken,
      symbols,
      timeframes,
      mt5Path,
      isMac: input.os === "mac",
    }),
  }
}

function windowsScript(p: {
  ingestUrl: string
  ingestToken: string
  symbols: string
  timeframes: string
  mt5Path: string
}): string {
  const mt5Path = p.mt5Path || MT5_DEFAULT_PATH
  return `@echo off
setlocal enabledelayedexpansion

REM === Pulse Agent — Bootstrap (Windows) ===
REM Rode este arquivo na pasta apps\\agent do projeto.

cd /d "%~dp0"
if not exist agent.py (
  echo [ERRO] agent.py nao encontrado em %CD%.
  echo Coloque este arquivo dentro de apps\\agent do repo do Pulse e rode novamente.
  pause
  exit /b 1
)

echo [1/5] Verificando Python...
where python >nul 2>nul
if errorlevel 1 (
  echo [ERRO] Python nao encontrado no PATH.
  echo Instale Python 3.10+ em https://www.python.org/downloads/ e marque "Add to PATH".
  pause
  exit /b 1
)

echo [2/5] Preparando venv...
if not exist .venv (
  python -m venv .venv
  if errorlevel 1 (
    echo [ERRO] Falha ao criar venv.
    pause
    exit /b 1
  )
)
call .venv\\Scripts\\activate.bat

echo [3/5] Instalando dependencias...
python -m pip install --upgrade pip >nul
pip install -r requirements.txt
if errorlevel 1 (
  echo [ERRO] Falha ao instalar requirements.
  pause
  exit /b 1
)

echo [4/5] Configurando .env...
> .env (
  echo SOURCE=mt5
  echo INGEST_URL=${p.ingestUrl}
  echo INGEST_TOKEN=${p.ingestToken}
  echo MT5_PATH=${mt5Path}
  echo SYMBOLS=${p.symbols}
  echo TIMEFRAMES=${p.timeframes}
)

echo [5/5] Abrindo MetaTrader 5 e iniciando agent...
if exist "${mt5Path}" (
  start "" "${mt5Path}"
  echo MT5 desta conta iniciando... aguarde alguns segundos para fazer login.
  timeout /t 8 >nul
) else (
  echo [AVISO] terminal64.exe nao encontrado em "${mt5Path}".
  echo Abra o MetaTrader 5 desta conta manualmente e faca login antes de prosseguir.
  pause
)

echo.
echo Iniciando agent. Para parar, feche esta janela ou pressione Ctrl+C.
echo Logs em agent.log e na console abaixo.
echo.
python agent.py

pause
endlocal
`
}

function unixScript(p: {
  ingestUrl: string
  ingestToken: string
  symbols: string
  timeframes: string
  mt5Path: string
  isMac: boolean
}): string {
  const macWarning = p.isMac
    ? `
echo "[AVISO] MetaTrader 5 não tem build nativo para macOS."
echo "Para rodar o agent você precisa de uma VM Windows ou Wine."
echo
read -p "Continuar mesmo assim? [s/N] " yn
case "$yn" in [Ss]*) ;; *) exit 0 ;; esac
`
    : ""

  return `#!/usr/bin/env bash
set -e

# === Pulse Agent — Bootstrap (Unix) ===
# Rode este arquivo na pasta apps/agent do projeto.

cd "$(dirname "$0")"
if [ ! -f agent.py ]; then
  echo "[ERRO] agent.py não encontrado em $PWD."
  echo "Coloque este arquivo dentro de apps/agent do repo do Pulse e rode novamente."
  exit 1
fi
${macWarning}
echo "[1/5] Verificando Python..."
if command -v python3 >/dev/null 2>&1; then
  PY=python3
elif command -v python >/dev/null 2>&1; then
  PY=python
else
  echo "[ERRO] Python não encontrado."
  echo "Instale Python 3.10+ (https://www.python.org/downloads/)."
  exit 1
fi

PYV=$("$PY" -c 'import sys; print("%d.%d" % sys.version_info[:2])')
echo "  Python $PYV detectado."

echo "[2/5] Preparando venv..."
if [ ! -d .venv ]; then
  "$PY" -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate

echo "[3/5] Instalando dependências..."
python -m pip install --upgrade pip >/dev/null
pip install -r requirements.txt

echo "[4/5] Configurando .env..."
cat > .env <<EOF
SOURCE=mt5
INGEST_URL=${p.ingestUrl}
INGEST_TOKEN=${p.ingestToken}
MT5_PATH=${p.mt5Path}
SYMBOLS=${p.symbols}
TIMEFRAMES=${p.timeframes}
EOF

echo "[5/5] Iniciando agent..."
echo "Lembre-se: o MetaTrader 5 precisa estar aberto e logado para o agent funcionar."
echo
python agent.py
`
}
