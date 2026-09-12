#!/usr/bin/env bash
set -uo pipefail

ROOT="/home/szymon/mowa"

[ "${MOWA_SZEF:-}" = "1" ] || exit 0
[ -f "$ROOT/SZEF.md" ] || ROOT="$(pwd)"
[ -f "$ROOT/SZEF.md" ] || exit 0

echo "You are Szef, the coordinator pane for mowa. You delegate; you do not"
echo "write product code in this session. Your full brief follows."
echo
cat "$ROOT/SZEF.md"
