#!/usr/bin/env bash
# PreToolUse hook (Bash): block a couple of genuinely dangerous commands.
# Exit 2 = block the tool call. Deterministic, so it can't be "forgotten".
# Intentionally narrow: don't get in the way of normal work.
input=$(cat)
cmd=$(printf '%s' "$input" | python3 -c "import sys,json;print(json.load(sys.stdin).get('tool_input',{}).get('command',''))" 2>/dev/null)

# Force-push: dangerous on a shared branch (can overwrite a teammate's history).
if printf '%s' "$cmd" | grep -Eq 'git[[:space:]]+push[^|;&]*(--force([^-=]|$)|-f([[:space:]]|$))'; then
  echo "BLOCKED by guard-bash: force-push can clobber the other contributor's work. Push manually if you really mean to." >&2
  exit 2
fi

# rm -rf of a dangerous target (root, home, .git, or a bare wildcard).
if printf '%s' "$cmd" | grep -Eq 'rm[[:space:]]+-[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*[[:space:]]+(-[a-zA-Z]+[[:space:]]+)*(/|~|\.git|\*)([[:space:]]|$)'; then
  echo "BLOCKED by guard-bash: 'rm -rf' on a dangerous path. Run it manually if intended." >&2
  exit 2
fi

exit 0