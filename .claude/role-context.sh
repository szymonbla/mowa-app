#!/usr/bin/env bash
set -uo pipefail
export LC_ALL=C

ROOT="/home/szymon/mowa"
ROLES="$ROOT/roles"
role="${MOWA_ROLE:-}"

[ -n "$role" ] || exit 0
case "$role" in
  *[!a-z-]* | "" | -* ) exit 0 ;;
esac
[ "${#role}" -le 32 ] || exit 0

[ -d "$ROLES" ] || ROLES="$(pwd)/roles"
file="$ROLES/$role.md"
[ -f "$file" ] || exit 0

echo "You are the $role worker session for mowa."
echo "Your ticket path arrives in your first prompt. Read it before touching code."
echo
common="$ROLES/_common.md"
[ -f "$common" ] && cat "$common" && echo
cat "$file"
