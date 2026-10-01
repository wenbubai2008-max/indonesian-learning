# Requires --arg branch "lesson-release-YYYY-MM-DD-am|pm" --argjson number <open authorized PR number>.
# A queued/running original ChatGPT/manual release always gets first chance to publish.
# An already failed/completed PR must NOT suppress the V2 failure recovery.
[
  .workflow_runs[]?
  | select(.event == "pull_request" and .head_branch == $branch)
  | select(.status == "queued" or .status == "in_progress" or .status == "waiting" or .status == "pending" or .status == "requested")
  | select((((.pull_requests // []) | length) == 0)
      or (([.pull_requests[]? | select(.number == $number)] | length) > 0))
] | length > 0
