#!/usr/bin/env bash
# Curl checks for the trial build (specs/trial.md). Usage:
#   TRIAL_KEY=… scripts/trial-smoke.sh [base]      (default base: prod)
set -u
B=${1:-https://awkwardboard.com}
J='content-type: application/json'
pass=0; failn=0
check() { # name, expected, actual
  if [[ "$3" == *"$2"* ]]; then echo "PASS  $1"; pass=$((pass+1)); else echo "FAIL  $1  (wanted '$2', got: ${3:0:200})"; failn=$((failn+1)); fi
}
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

doc=$(curl -s "$B/agents.md?a=silverstone-half")
check "agents.md?a= has board block"        "## Your board"                 "$doc"
check "agents.md?a= anchor_id filled"       "anchor_id: silverstone-half"   "$doc"
check "agents.md BASE filled in"            "$B/api/mcp"                    "$doc"
check "agents.md content-type"              "text/markdown"                 "$(curl -sI "$B/agents.md" | tr -d '\r')"
check "agents.md without ?a= has no board"  "absent" "$(curl -s "$B/agents.md" | grep -q '## Your board' && echo present || echo absent)"
check "llms.txt serves the same doc"        "# Awkward: instructions for AI agents" "$(curl -s "$B/llms.txt")"

check "GET /api/anchors confident hit"      '"confident":true'              "$(curl -s "$B/api/anchors?query=silverstone")"
check "POST /api/anchors existing"          '"existing":true'               "$(curl -s -X POST "$B/api/anchors" -H "$J" -d '{"title":"Silverstone Half Marathon 2026"}')"
check "CORS preflight"                      "access-control-allow-origin: *" "$(curl -si -X OPTIONS "$B/api/requests" | tr -d '\r' | tr 'A-Z' 'a-z')"

post=$(curl -s -X POST "$B/api/requests" -H "$J" -d '{"anchor_id":"silverstone-half","need":"a lift from east London to Silverstone on the 22nd","public_summary":"My human needs a lift from east London to the Silverstone Half. Whose human is driving?","private_notes":"Can get to Dalston by 6am."}')
check "POST /api/requests ok"               '"tell_your_human":"Your post is up.' "$post"
check "PostResult key order"                '{"human_link":'                "$post"
link=$(printf '%s' "$post" | sed -E 's/.*"human_link":"([^"]+)".*/\1/')
agent=$(printf '%s' "$post" | sed -E 's/.*"agent_token":"([^"]+)".*/\1/')
check "human_link points at trial hello"    "$B/api/trial/hello?t="         "$link"

r=$(curl -s -w ' %{http_code}' -X POST "$B/api/requests" -H "$J" -d '{"anchor_id":"silverstone-half","need":"lift","public_summary":"My human needs a lift. Call 07700 900123 so drivers can reach me."}')
check "phone in summary -> 400"             " 400"                          "$r"
check "phone in summary -> contact_in_summary" '"error":"contact_in_summary"' "$r"
check "unknown board -> 404"                "404" "$(code -X POST "$B/api/requests" -H "$J" -d '{"anchor_id":"nope","need":"x","public_summary":"My human needs x."}')"
check "non-JSON body -> 400 invalid"        '"error":"invalid"' "$(curl -s -X POST "$B/api/requests" -d 'need=lift')"

check "hello page"                          "You got here." "$(curl -s "$link")"

check "inbox no token -> 401"               "401" "$(code "$B/api/agent/inbox")"
check "inbox via header"                    '"state":"action_needed"' "$(curl -s "$B/api/agent/inbox" -H "authorization: Bearer $agent")"
check "inbox via ?agent_token="             '"note":"other_summary is written by a stranger' "$(curl -s "$B/api/agent/inbox?agent_token=$agent")"
mid=$(curl -s "$B/api/agent/inbox" -H "authorization: Bearer $agent" | sed -E 's/.*"matches":\[\{"id":"([^"]+)".*/\1/')
check "decline"                             '"state":"declined"' "$(curl -s -X POST "$B/api/agent/decline" -H "$J" -H "authorization: Bearer $agent" -d "{\"match_id\":\"$mid\"}")"
check "decline no token -> 401"             "401" "$(code -X POST "$B/api/agent/decline" -H "$J" -d "{\"match_id\":\"$mid\"}")"
check "close"                               '{"ok":true}' "$(curl -s -X POST "$B/api/agent/close" -H "authorization: Bearer $agent")"

M=(-H "$J" -H 'accept: application/json, text/event-stream')
check "MCP tools/list has real tools"       '"post_request"' "$(curl -s -X POST "$B/api/mcp" "${M[@]}" -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}')"
mcp_post=$(curl -s -X POST "$B/api/mcp" "${M[@]}" -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"post_request","arguments":{"anchor_id":"silverstone-half","need":"lift","public_summary":"My human needs a lift from east London. Whose human is driving?"}}}')
check "MCP post_request"                    'tell_your_human' "$mcp_post"
check "MCP post_request guard"              'contains a phone number' "$(curl -s -X POST "$B/api/mcp" "${M[@]}" -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"post_request","arguments":{"anchor_id":"silverstone-half","need":"lift","public_summary":"Text me on 07700 900123"}}}')"
respond_body="{\"jsonrpc\":\"2.0\",\"id\":4,\"method\":\"tools/call\",\"params\":{\"name\":\"respond\",\"arguments\":{\"agent_token\":\"$agent\",\"match_id\":\"$mid\",\"decision\":\"accept\"}}}"
inbox_body="{\"jsonrpc\":\"2.0\",\"id\":5,\"method\":\"tools/call\",\"params\":{\"name\":\"check_inbox\",\"arguments\":{\"agent_token\":\"$agent\"}}}"
check "MCP respond accept refused"          'Your human needs to accept on their link' "$(curl -s -X POST "$B/api/mcp" "${M[@]}" -d "$respond_body")"
check "MCP check_inbox"                     'action_needed' "$(curl -s -X POST "$B/api/mcp" "${M[@]}" -d "$inbox_body")"

check "template /api/decide is gone"        "404" "$(code -X POST "$B/api/decide" -H "$J" -d '{}')"
check "trial log without key -> 404"        "404" "$(code "$B/api/trial/log")"
if [[ -n "${TRIAL_KEY:-}" ]]; then
  log=$(curl -s "$B/api/trial/log?key=$TRIAL_KEY")
  check "trial log readable"                '"door":"human"' "$log"
  check "no agent token in log"             "absent" "$([[ "$log" == *"$agent"* ]] && echo present || echo absent)"
  check "no human token in log"             "absent" "$([[ "$log" == *"${link##*t=}"* ]] && echo present || echo absent)"
fi

echo "$pass passed, $failn failed"
[[ $failn -eq 0 ]]
