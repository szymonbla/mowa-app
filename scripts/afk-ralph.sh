#!/bin/bash
# Petla AFK: jeden ticket na iteracje, az do konca listy albo do limitu.
#
#   ./scripts/afk-ralph.sh 6
#
# Zatrzymuje sie, gdy agent zglosi COMPLETE albo BLOCKED, gdy typecheck nie przechodzi,
# albo gdy iteracja nie zostawila commita (agent utknal).
set -uo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

max="${1:-}"
if [[ -z "$max" || ! "$max" =~ ^[0-9]+$ ]]; then
  echo "Uzycie: $0 <liczba iteracji>" >&2
  exit 1
fi

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "To nie jest repozytorium git. Petla nie ma jak cofnac zlej iteracji." >&2
  echo "Uruchom najpierw: git init && git add -A && git commit -m 'stan poczatkowy'" >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Katalog roboczy nie jest czysty. Zacommituj albo odrzuc zmiany." >&2
  exit 1
fi

mkdir -p .scratch/architecture-deepening
progress=.scratch/architecture-deepening/progress.md
touch "$progress"

log=".scratch/architecture-deepening/ralph-$(date +%Y%m%d-%H%M%S).log"
echo "Log: $log"

for ((i = 1; i <= max; i++)); do
  echo ""
  echo "───── iteracja $i / $max ─────"
  before="$(git rev-parse HEAD)"

  # acceptEdits przepuszcza tylko edycje plikow. Bez tej listy kazde `npm` i `git`
  # zostaje odrzucone w trybie -p i iteracja konczy sie bez commita.
  result="$(claude --permission-mode acceptEdits \
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
    -p \
    "@scripts/ralph-prompt.md @$progress

Wykonaj instrukcje z ralph-prompt.md. Dokladnie jeden ticket." 2>&1)"

  printf '\n───── iteracja %d ─────\n%s\n' "$i" "$result" >>"$log"
  echo "$result" | tail -40

  if [[ "$result" == *"<promise>COMPLETE</promise>"* ]]; then
    echo ""
    echo "Wszystkie tickety zrobione po $i iteracjach."
    exit 0
  fi

  if [[ "$result" == *"<promise>BLOCKED</promise>"* ]]; then
    echo ""
    echo "Agent zglosil blokade w iteracji $i. Szczegoly w $progress." >&2
    exit 2
  fi

  after="$(git rev-parse HEAD)"
  if [[ "$before" == "$after" ]]; then
    echo ""
    echo "Iteracja $i nie zostawila commita — agent utknal. Przerywam." >&2
    git status --short >&2
    exit 3
  fi

  # Niezalezna kontrola. Nie ufamy raportowi agenta na slowo.
  if ! npm run typecheck >>"$log" 2>&1; then
    echo ""
    echo "typecheck nie przechodzi po iteracji $i. Przerywam, commit $after zostaje." >&2
    exit 4
  fi

  if npm run 2>/dev/null | grep -qE '^\s+test$'; then
    if ! npm test >>"$log" 2>&1; then
      echo ""
      echo "Testy nie przechodza po iteracji $i. Przerywam, commit $after zostaje." >&2
      exit 5
    fi
  fi

  echo "iteracja $i ok → $(git log -1 --format='%h %s')"
done

echo ""
echo "Limit $max iteracji wyczerpany. Zostale tickety: "
grep -l 'Status:\*\* ready-for-agent' .scratch/architecture-deepening/issues/*.md || echo "brak"
