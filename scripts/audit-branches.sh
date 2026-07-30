#!/usr/bin/env bash
# git-branch-audit — classify local branches against the INTEGRATION branch
# using escalating evidence, and only then propose deletions.
#
# THE CENTRAL LESSON THIS SCRIPT ENCODES:
#   `git branch -d` refuses a branch that is not merged into its UPSTREAM,
#   even when it is fully merged into the integration branch. A branch whose
#   remote has diverged gets reported "not fully merged" while being a straight
#   ancestor of master. Classify against the integration branch; upstream is
#   irrelevant to whether the work landed. This script flags that case
#   explicitly instead of mistaking it for real unmerged work.
#
# Portability notes (both of these cost real time on 2026-07-29):
#   * macOS ships bash 3.2 — no associative arrays, no mapfile. Avoided here.
#   * In zsh, unquoted $VAR does NOT word-split, so `for x in $LIST` iterates
#     once with the whole string. That corrupted a recovery file. This script
#     is bash, and sets are space-delimited strings matched with case globs.
#
# Usage:
#   git-branch-audit.sh [-C <repo>] [-i <integration-ref>] [--delete] [--no-fetch]
#
# Default is a DRY RUN: it reports and writes a recovery file, deletes nothing.

set -o pipefail

REPO="."; INTEGRATION=""; DO_DELETE=0; DO_FETCH=1
while [ $# -gt 0 ]; do
  case "$1" in
    -C) REPO="$2"; shift 2 ;;
    -i) INTEGRATION="$2"; shift 2 ;;
    --delete) DO_DELETE=1; shift ;;
    --no-fetch) DO_FETCH=0; shift ;;
    -h|--help) sed -n '2,25p' "$0"; exit 0 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

cd "$REPO" || exit 1
git rev-parse --git-dir >/dev/null 2>&1 || { echo "not a git repo: $REPO" >&2; exit 1; }

say() { printf '%s\n' "$*"; }
hr()  { printf '%s\n' "------------------------------------------------------------"; }
# contains <needle> <space-delimited-haystack>   (branch names cannot contain spaces)
contains() { case " $2 " in *" $1 "*) return 0 ;; *) return 1 ;; esac; }

# ---------------------------------------------------------------- step 1: fetch
# Stale remote-tracking refs make merged branches look unmerged. Never classify
# before this, and prove the fetch actually reached the network.
if [ "$DO_FETCH" = 1 ]; then
  say "==> git fetch --prune"
  git fetch --prune 2>&1 | sed 's/^/    /'
  if ! git ls-remote --heads origin >/dev/null 2>&1; then
    say "    !! cannot reach origin — refusing to classify on possibly stale refs"
    exit 1
  fi
  say "    remote reachable; refs current"
fi

# ------------------------------------------- step 2: resolve integration branch
if [ -z "$INTEGRATION" ]; then
  INTEGRATION=$(git symbolic-ref -q refs/remotes/origin/HEAD 2>/dev/null | sed 's#^refs/remotes/##')
  if [ -z "$INTEGRATION" ]; then
    for c in origin/main origin/master origin/develop; do
      if git rev-parse --verify -q "$c" >/dev/null; then INTEGRATION="$c"; break; fi
    done
  fi
fi
git rev-parse --verify -q "$INTEGRATION" >/dev/null || {
  say "cannot resolve integration ref: '$INTEGRATION'"; exit 1; }
say "==> integration branch: $INTEGRATION ($(git rev-parse --short "$INTEGRATION"))"

# A staging branch that is a SUPERSET of integration means work may have landed
# there but not yet in integration — classifying against integration is then
# conservative (it will say "keep"), which is the safe direction to err.
for staging in origin/develop origin/main origin/master; do
  [ "$staging" = "$INTEGRATION" ] && continue
  git rev-parse --verify -q "$staging" >/dev/null || continue
  only=$(git rev-list --count "$INTEGRATION..$staging" 2>/dev/null)
  [ -n "$only" ] && [ "$only" -gt 0 ] && say "    note: $staging has $only commit(s) not in $INTEGRATION"
done

# --------------------------------------------------- step 3: open-PR protection
# Never delete on an unverified open-PR list. An empty result from a FAILED
# `gh` call is indistinguishable from "no open PRs" unless we check gh's exit
# status — and silently proceeding would happily delete a branch heading an
# open PR whenever gh is merely unauthenticated or offline.
OPEN_PR=""
IS_GITHUB=0
git remote -v 2>/dev/null | grep -q 'github\.com' && IS_GITHUB=1
if [ "$IS_GITHUB" = 0 ]; then
  say "==> no github.com remote; skipping open-PR check (not applicable)"
elif ! command -v gh >/dev/null 2>&1; then
  say "==> gh not found but this IS a GitHub repo — cannot verify open PRs; deletion disabled"
  DO_DELETE=0
else
  if gh_out=$(gh pr list --state open --json headRefName -q '.[].headRefName' 2>&1); then
    OPEN_PR=$(printf '%s' "$gh_out" | paste -sd' ' -)
    say "==> open PR head refs: ${OPEN_PR:-none}"
  else
    say "==> 'gh pr list' FAILED — cannot verify open PRs; deletion disabled"
    say "    $(printf '%s' "$gh_out" | head -1)"
    DO_DELETE=0
  fi
fi

# ------------------------------------------------- step 4: recovery file FIRST
STAMP=$(date '+%Y%m%d-%H%M%S')
RECOVERY="${TMPDIR:-/tmp}/git-branch-audit-$(basename "$PWD")-$STAMP.md"
{
  say "# branch recovery — $(basename "$PWD") — $(date)"
  say ""
  say "Integration: $INTEGRATION = $(git rev-parse "$INTEGRATION")"
  say ""
  say '```bash'
  say "cd $PWD"
  git for-each-ref --format='git branch %(refname:short) %(objectname)' refs/heads
  say '```'
} > "$RECOVERY"
say "==> recovery file: $RECOVERY"

CURRENT=$(git symbolic-ref -q --short HEAD)
# branches checked out in ANY worktree must not be deleted
INUSE=$(git worktree list --porcelain | awk '/^branch /{sub("refs/heads/","",$2); print $2}' | paste -sd' ' -)

SAFE_D=""; SAFE_FORCE=""; KEEP=""; ONLY_COPY=""

# ------------------------------------------------------- step 5: classify each
while IFS= read -r b; do
  [ -z "$b" ] && continue
  hr; say "branch: $b  ($(git rev-parse --short "$b"))"
  say "  tip: $(git log -1 --format='%an  %ad  %s' --date=short "$b")"

  if [ "$b" = "$CURRENT" ]; then say "  VERDICT: KEEP (current HEAD)"; KEEP="$KEEP $b"; continue; fi
  if contains "$b" "$INUSE"; then say "  VERDICT: KEEP (checked out in a worktree)"; KEEP="$KEEP $b"; continue; fi
  if contains "$b" "$OPEN_PR"; then say "  VERDICT: KEEP (heads an OPEN PR)"; KEEP="$KEEP $b"; continue; fi
  if [ "$b" = "${INTEGRATION#origin/}" ]; then say "  VERDICT: KEEP (local integration branch)"; KEEP="$KEEP $b"; continue; fi

  backing=$(git for-each-ref --contains "$(git rev-parse "$b")" \
            --format='%(refname:short)' refs/remotes 2>/dev/null | paste -sd' ' -)
  say "  remote refs containing tip: ${backing:-NONE (local-only commits)}"

  # ---- LEVEL 1: ancestry, against INTEGRATION (never against upstream)
  if git merge-base --is-ancestor "$b" "$INTEGRATION" 2>/dev/null; then
    say "  L1 ancestry: MERGED into $INTEGRATION (tip is an ancestor)"
    absorbed=$(git log --ancestry-path --merges --format='%h %ad %s' --date=short \
               "$b..$INTEGRATION" 2>/dev/null | tail -1)
    [ -n "$absorbed" ] && say "  absorbed by: $absorbed"
    # Would `-d` agree? It compares to UPSTREAM, so it can disagree. Detect it.
    up=$(git rev-parse --abbrev-ref --symbolic-full-name "$b@{upstream}" 2>/dev/null)
    if [ -n "$up" ] && ! git merge-base --is-ancestor "$b" "$up" 2>/dev/null; then
      ahead=$(git rev-list --count "$up..$b")
      say "  !! upstream $up is BEHIND by $ahead commit(s) -> 'git branch -d' will REFUSE"
      say "     but it IS merged into $INTEGRATION, so -D is exactly as safe as -d"
      SAFE_FORCE="$SAFE_FORCE $b"
      say "  VERDICT: DELETE -D (L1-merged; -d blocked by diverged upstream)"
    else
      SAFE_D="$SAFE_D $b"
      say "  VERDICT: DELETE -d (fully absorbed)"
    fi
    continue
  fi
  say "  L1 ancestry: not an ancestor of $INTEGRATION"

  # ---- LEVEL 2: patch equivalence ('-' = same change already landed)
  cherry=$(git cherry "$INTEGRATION" "$b" 2>/dev/null)
  plus=$(printf '%s\n' "$cherry" | grep -c '^+')
  minus=$(printf '%s\n' "$cherry" | grep -c '^-')
  say "  L2 patch-id: $plus novel / $minus already-landed  (git cherry SKIPS merge commits)"
  if [ "$plus" -eq 0 ]; then
    SAFE_FORCE="$SAFE_FORCE $b"
    say "  VERDICT: DELETE -D (phantom: every non-merge patch already in $INTEGRATION)"
    continue
  fi

  # ---- LEVEL 3: tree identity (strongest content evidence short of ancestry)
  t=$(git rev-parse "$b^{tree}")
  match=$(git log --format='%H %T %ad %s' --date=short "$INTEGRATION" | awk -v t="$t" '$2==t{print; exit}')
  if [ -n "$match" ]; then
    say "  L3 tree-identity: EXACT tree match already in $INTEGRATION history:"
    say "     $match"
    SAFE_FORCE="$SAFE_FORCE $b"
    say "  VERDICT: DELETE -D (content identical to a commit in $INTEGRATION)"
    continue
  fi
  say "  L3 tree-identity: no exact tree match"

  # ---- LEVEL 4: which files would actually be lost?
  mb=$(git merge-base "$b" "$INTEGRATION")
  lost=0; prog=0
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    if git cat-file -e "$mb:$f" 2>/dev/null; then
      prog=$((prog+1))
    else
      lost=$((lost+1)); [ "$lost" -le 10 ] && say "     candidate loss: $f"
    fi
  done < <(comm -23 <(git ls-tree -r --name-only "$b" | sort) \
                    <(git ls-tree -r --name-only "$INTEGRATION" | sort))
  say "  L4 files: $lost branch-added-and-never-landed, $prog pre-existing (integration deleted since = progression)"
  say "  VERDICT: KEEP — real unmerged work ($plus novel commit(s))"
  if [ -z "$backing" ]; then
    say "             *** NO REMOTE COPY — this is the ONLY copy of these commits ***"
    ONLY_COPY="$ONLY_COPY $b"
  fi
  KEEP="$KEEP $b"
done < <(git for-each-ref --format='%(refname:short)' refs/heads)
hr

# ------------------------------------------------------------ step 6: summarise
say ""
say "==> SUMMARY  (integration: $INTEGRATION)"
say "  delete with -d :${SAFE_D:- none}"
say "  delete with -D :${SAFE_FORCE:- none}"
say "  keep           :${KEEP:- none}"
[ -n "$ONLY_COPY" ] && say "  UNPUSHED WORK  :$ONLY_COPY   <-- exists nowhere else"
say ""
say "  worktrees:"
git worktree list | sed 's/^/    /'
prunable=$(git worktree list --porcelain | grep -c '^prunable')
[ "$prunable" -gt 0 ] && say "    $prunable prunable -> 'git worktree prune -v'"
n=$(git stash list | wc -l | tr -d ' ')
[ "$n" -gt 0 ] && say "  stashes: $n (NOT touched; 'stash -u' hides untracked files in a 3rd parent — export those separately)"
say ""
say "  recovery file: $RECOVERY"

if [ "$DO_DELETE" != 1 ]; then
  say ""; say "DRY RUN — nothing deleted. Re-run with --delete to apply."; exit 0
fi

say ""; say "==> deleting"
for b in $SAFE_D;     do git branch -d "$b" 2>&1 | sed 's/^/    /'; done
for b in $SAFE_FORCE; do git branch -D "$b" 2>&1 | sed 's/^/    /'; done
say ""
say "Remote branches are NOT touched by this script — review by hand:"
say "  git for-each-ref --format='%(refname:short) %(authorname) %(committerdate:short)' refs/remotes/origin"
