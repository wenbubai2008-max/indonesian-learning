#!/usr/bin/env bash
set -Eeuo pipefail
: "${GEMINI_API_KEY:?Missing GEMINI_API_KEY (unbilled Free Tier project)}"
git fetch --no-tags origin main
git checkout -B main origin/main
base="$(git rev-parse HEAD)"
date="$(TZ=Asia/Jakarta date +%F)"
branch="extensive-reading-$date"
echo "Reading date=$date base=$base"
if node - "$date" <<'NODE'
const fs=require('fs'),vm=require('vm');
const w={window:Object.create(null)};
vm.runInNewContext(fs.readFileSync('data/extensive-reading-data.js','utf8'),w,{timeout:1000});
const a=w.window.EXTENSIVE_READING_DB;
if(!Array.isArray(a)||a.length!==1)process.exit(2);
process.exit(a[0].date===process.argv[2]?0:1);
NODE
then
 echo 'Already published today; no duplicate or empty commit.'
 exit 0
fi
git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
if git ls-remote --exit-code --heads origin "$branch" >/dev/null 2>&1; then
 git fetch --no-tags origin "$branch"
 git checkout -B "$branch" FETCH_HEAD
 if [ ! -f data/extensive-reading-candidate.json ]; then
  echo '::error title=Incomplete reading release::Existing branch has no candidate; preserve for inspection.'
  exit 1
 fi
 echo 'Reusing previously generated candidate.'
else
 git checkout -b "$branch" "$base"
 node --check .github/scripts/generate-extensive-reading.js
 node .github/scripts/generate-extensive-reading.js
 test -f data/extensive-reading-candidate.json
 git add -- data/extensive-reading-candidate.json
 git commit -m "Add $date extensive reading candidate"
 git push -u origin "HEAD:$branch"
fi
if ! git merge-base --is-ancestor "$base" HEAD; then
 git merge --no-edit "$base"
fi
changed="$(git diff --name-only "$base" HEAD)"
bad="$(printf '%s\n' "$changed" | grep -Ev '^(data/extensive-reading-candidate[.]json|data/extensive-reading-data[.]js|data/extensive-reading-history[.]js|data/extensive-reading-history/[0-9]{4}-[0-9]{2}-[0-9]{2}(-[a-z0-9-]+)?[.]js)$' || true)"
if [ -n "$bad" ]; then echo "::error title=Unexpected reading paths::$bad"; exit 1; fi
trusted="$RUNNER_TEMP/publish-extensive-reading-candidate.js"
git show "$base:.github/scripts/publish-extensive-reading-candidate.js" > "$trusted"
node --check "$trusted"
node "$trusted" prepare --repo "$GITHUB_WORKSPACE" --base "$base" --date "$date"
node .github/scripts/regression-guard.js
git add -A -- data/extensive-reading-candidate.json data/extensive-reading-data.js data/extensive-reading-history.js data/extensive-reading-history
if git diff --cached --quiet; then echo 'No change; no empty commit'; exit 0; fi
git commit -m "Prepare extensive reading $date"
final="$(git rev-parse HEAD)"
node "$trusted" validate --repo "$GITHUB_WORKSPACE" --base "$base" --date "$date"
git push origin "HEAD:$branch"
git fetch --no-tags origin main
if [ "$(git rev-parse origin/main)" != "$base" ]; then echo '::error title=Main advanced::Preserving branch'; exit 1; fi
pr="$(gh pr list --repo "$GITHUB_REPOSITORY" --state open --head "$branch" --base main --json number --jq '.[0].number // empty')"
if [ -z "$pr" ]; then
 gh pr create --repo "$GITHUB_REPOSITORY" --head "$branch" --base main --title "Publish $date extensive reading" --body 'AUTO_PUBLISH_EXTENSIVE_READING=1

Generated and validated by the scheduled trusted GitHub Actions job.'
 pr="$(gh pr list --repo "$GITHUB_REPOSITORY" --state open --head "$branch" --base main --json number --jq '.[0].number // empty')"
fi
test -n "$pr"
remote=''
mergeable=''
for n in 1 2 3 4 5 6 7 8 9 10; do
 info="$(gh api "repos/$GITHUB_REPOSITORY/pulls/$pr")"
 remote="$(jq -r '.head.sha // empty' <<< "$info")"
 mergeable="$(jq -r 'if .mergeable == null then "unknown" else (.mergeable|tostring) end' <<< "$info")"
 if [ "$remote" = "$final" ] && [ "$mergeable" = true ]; then break; fi
 if [ "$remote" = "$final" ] && [ "$mergeable" = false ]; then echo '::error title=PR not mergeable::Preserving branch'; exit 1; fi
 sleep 3
done
if [ "$remote" != "$final" ] || [ "$mergeable" != true ]; then echo '::error title=PR mergeability timeout::Preserving branch'; exit 1; fi
git fetch --no-tags origin main
if [ "$(git rev-parse origin/main)" != "$base" ]; then echo '::error title=Main advanced before squash::Preserving branch'; exit 1; fi
gh api --method PUT "repos/$GITHUB_REPOSITORY/pulls/$pr/merge" -f merge_method=squash -f sha="$final" > "$RUNNER_TEMP/reading-merge.json"
test "$(jq -r '.merged' "$RUNNER_TEMP/reading-merge.json")" = true
echo "EXTENSIVE_READING_PUBLISHED date=$date pr=$pr merge=$(jq -r .sha "$RUNNER_TEMP/reading-merge.json")"
