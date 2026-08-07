#!/bin/bash
# Jeden przebieg Ralpha, interaktywnie. Widzisz, co robi agent.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "To nie jest repozytorium git. Ralph commituje po kazdym ticketcie." >&2
  echo "Uruchom najpierw: git init && git add -A && git commit -m 'stan poczatkowy'" >&2
  exit 1
fi

mkdir -p .scratch/architecture-deepening
touch .scratch/architecture-deepening/progress.md

claude --permission-mode acceptEdits \
  --allowedTools \
    "Bash(npm run typecheck)" \
    "Bash(npm test:*)" \
    "Bash(npm install:*)" \
    "Bash(npx vitest:*)" \
    "Bash(git add:*)" \
    "Bash(git commit:*)" \
    "Bash(git status:*)" \
    "Bash(git diff:*)" \
    "Bash(git log:*)" \
    "Bash(git restore:*)" \
    "Bash(git rev-parse:*)" \
  "@scripts/ralph-prompt.md @.scratch/architecture-deepening/progress.md

Wykonaj instrukcje z ralph-prompt.md. Dokladnie jeden ticket."
