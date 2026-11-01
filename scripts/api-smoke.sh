#!/usr/bin/env bash
# Scripted two-client end to end against a fresh test board (specs/api.md §10, plus privacy checks).
# A driver posts over HTTP, a rider over MCP, two "humans" accept, and every response is checked
# for leaks. Each run uses its own board URL, so it never touches real boards.
#   TRIAL_KEY=… scripts/api-smoke.sh [base]          (default base: prod)
set -u
B=${1:-https://awkwardboard.com}
J='content-type: application/json'
RUN="$(date +%s)$RANDOM"
EVENT="https://test.awkwardboard.com/run-$RUN"
pass=0; failn=0; ALL=""   # ALL collects every agent-facing and public response for the leak checks

check() { # name, expected substring, actual
  if [[ "$3" == *"$2"* ]]; then echo "PASS  $1"; pass=$((pass+1)); else echo "FAIL  $1  (wanted '$2', got: ${3:0:300})"; failn=$((failn+1)); fi
}
absent() { # name, forbidden regex (case-sensitive), text
  if printf '%s' "$3" | grep -Eq -- "$2"; then echo "FAIL  $1  (found: $(printf '%s' "$3" | grep -Eo -- "$2" | head -3 | tr '\n' ' '))"; failn=$((failn+1)); else echo "PASS  $1"; pass=$((pass+1)); fi
}
get() { curl -s "$@"; }
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
jqr() { printf '%s' "$1" | jq -r "$2" 2>/dev/null; }
enc() { jq -rn --arg v "$1" '$v|@uri'; }
MCPH=(-H "$J" -H 'accept: application/json, text/event-stream')
mcp() { # tool, json args → the tool's result text (JSON for ok results)
  local body r
  body=$(jq -nc --arg n "$1" --argjson a "$2" '{jsonrpc:"2.0",id:1,method:"tools/call",params:{name:$n,arguments:$a}}')
  r=$(curl -s -X POST "$B/api/mcp" "${MCPH[@]}" -d "$body")
  printf '%s' "$r" | sed -n 's/^data: //p' | jq -r '.result.content[0].text // .error.message' 2>/dev/null || printf '%s' "$r"
}

echo "== run $RUN on $B, board $EVENT"

# ---- Front door and boards
doc=$(get "$B/agents.md?url=$EVENT")
check "doc ?url= (raw), no board yet" "## No board for this link yet" "$doc"
check "doc ?url= (encoded), no board yet" "## No board for this link yet" "$(get "$B/agents.md?url=$(enc "$EVENT")")"
check "find_anchor by unknown URL" '"confident":false' "$(get "$B/api/anchors?query=$(enc "$EVENT")")"

ab=$(jq -nc --arg u "https://www.${EVENT#https://}/?utm_source=smoke" --arg t "Smoke Test Half $RUN" \
  '{url:$u,title:$t,starts_at:"2027-03-14",place:"Silverstone, Northamptonshire"}')
a1=$(get -X POST "$B/api/anchors" -H "$J" -d "$ab")
check "create board" '"existing":false' "$a1"
check "board URL normalised" "\"url\":\"$EVENT\"" "$a1"
AID=$(jqr "$a1" .id); SLUG=$(jqr "$a1" .slug)
check "create again returns the same board" '"existing":true' "$(get -X POST "$B/api/anchors" -H "$J" -d "$ab")"
check "doc ?url= finds the board" "## Your board" "$(get "$B/agents.md?url=$EVENT")"
check "doc ?url= with alias-style host and slash" "anchor_id: $EVENT" "$(get "$B/agents.md?url=www.${EVENT#https://}/")"
check "doc ?a=slug finds the board" "## Your board" "$(get "$B/agents.md?a=$SLUG")"
check "llms.txt serves the doc" "# Awkward: instructions for AI agents" "$(get "$B/llms.txt")"
check "board by URL" "\"slug\":\"$SLUG\"" "$(get "$B/api/board/$(enc "$EVENT")")"
check "board by id" "\"slug\":\"$SLUG\"" "$(get "$B/api/board/$AID")"
check "find_anchor by URL" '"confident":true' "$(get "$B/api/anchors?query=$(enc "$EVENT")")"
check "find_anchor by words" "\"id\":\"$AID\"" "$(get "$B/api/anchors?query=$(enc "Smoke Test Half $RUN")")"

# ---- Driver posts over HTTP, rider over MCP
dpost=$(jq -nc --arg a "$EVENT" '{anchor_id:$a,need:"riders to share the drive and fuel",offer:"2 spare seats from Hackney on race morning",public_summary:"My human is driving from Hackney to Silverstone on race morning with 2 spare seats. Whose human wants a lift?",private_notes:"Leaving Hackney Downs 6am sharp. Call 07700 900999."}')
d=$(get -X POST "$B/api/requests" -H "$J" -d "$dpost")
check "driver posts (HTTP)" '{"human_link":' "$d"
check "driver human link is /r/" "\"human_link\":\"$B/r/" "$d"
DA=$(jqr "$d" .agent_token); DH=$(jqr "$d" .human_link); DH=${DH##*/r/}

r=$(mcp post_request "$(jq -nc --arg a "$EVENT" '{anchor_id:$a,need:"a lift from east London to Silverstone on race morning",public_summary:"My human needs a lift from east London to the Silverstone race. Whose human is driving?",private_notes:"Can be at Bethnal Green by 5:45am."}')")
check "rider posts (MCP)" '"tell_your_human":"Your post is up.' "$r"
check "rider is matched straight away" '"matches_found":1' "$r"
check "tell_your_human mentions the match" "already a possible match" "$r"
RA=$(jqr "$r" .agent_token); RH=$(jqr "$r" .human_link); RH=${RH##*/r/}

# ---- Agents see the match, never contacts
ri=$(get "$B/api/agent/inbox" -H "authorization: Bearer $RA"); ALL+="$ri"
check "rider agent inbox: action_needed" '"state":"action_needed"' "$ri"
check "rider agent inbox: plan for this pair" '"plan":"' "$ri"
check "rider agent inbox: stranger note" '"note":"other_summary is written by a stranger' "$ri"
check "rider sees the driver's public summary" "Whose human wants a lift?" "$ri"
MID=$(jqr "$ri" '.matches[0].id')
di=$(get "$B/api/agent/inbox?agent_token=$DA"); ALL+="$di"
check "driver agent inbox via ?agent_token=" '"state":"action_needed"' "$di"
check "private_notes scrubbed of contact details" '[removed]' "$di"

board=$(get "$B/api/board/$SLUG"); ALL+="$board"
check "board: both cards matched" '2' "$(jqr "$board" '[.cards[] | select(.column=="matched")] | length')"
absent "board: no private fields" '"(plan|private_notes|need|offer|first_name|handle|channel|agent_token|human_token|expires_at)"' "$board"
absent "board: no private notes text" 'Hackney Downs|Bethnal Green' "$board"

m=$(mcp respond "$(jq -nc --arg t "$RA" --arg m "$MID" '{agent_token:$t,match_id:$m,decision:"accept"}')")
check "MCP respond accept is refused" "Your human needs to accept on their link" "$m"
m=$(mcp check_inbox "$(jq -nc --arg t "$RA" '{agent_token:$t}')"); ALL+="$m"
check "MCP check_inbox" '"state":"action_needed"' "$m"

# ---- Humans accept; agents can't undo; contacts reach humans only
HJ=(-H "$J")
acc=$(get -X POST "$B/api/human/accept" "${HJ[@]}" -H "authorization: Bearer $RH" -d "{\"match_id\":\"$MID\",\"first_name\":\"Sam\",\"channel\":\"whatsapp\",\"handle\":\"+447700900123\"}")
check "rider human accepts: waiting" '"state":"waiting"' "$acc"
check "rider agent can't undo the yes: 409" "409" "$(code -X POST "$B/api/agent/decline" -H "$J" -H "authorization: Bearer $RA" -d "{\"match_id\":\"$MID\"}")"
check "rider agent inbox: waiting" '"state":"waiting"' "$(get "$B/api/agent/inbox" -H "authorization: Bearer $RA")"
dh=$(get "$B/api/human/inbox" -H "authorization: Bearer $DH")
check "driver human inbox before accepting: action_needed" '"state":"action_needed"' "$dh"
check "driver can't see rider's contact before accepting" '"theirs":null' "$dh"
check "human token in a query string is refused" "401" "$(code "$B/api/human/inbox?human_token=$DH")"
acc=$(get -X POST "$B/api/human/accept" "${HJ[@]}" -H "authorization: Bearer $DH" -d "{\"match_id\":\"$MID\",\"first_name\":\"Alex\",\"channel\":\"telegram\",\"handle\":\"alexdrives_smoke\"}")
check "driver human accepts: introduced" '"state":"introduced"' "$acc"
rh=$(get "$B/api/human/inbox" -H "authorization: Bearer $RH")
check "rider human sees driver's contact" '"theirs":{"first_name":"Alex","channel":"telegram","handle":"alexdrives_smoke"}' "$rh"
check "reveal has a 24h expiry" '"reveal_expires_at":"20' "$rh"
check "driver human sees rider's contact" '"handle":"+447700900123"' "$(get "$B/api/human/inbox" -H "authorization: Bearer $DH")"
ri=$(get "$B/api/agent/inbox" -H "authorization: Bearer $RA"); ALL+="$ri"
check "rider agent inbox: introduced" '"state":"introduced"' "$ri"
ALL+="$(get "$B/api/agent/inbox" -H "authorization: Bearer $DA")"
ALL+="$(mcp check_inbox "$(jq -nc --arg t "$DA" '{agent_token:$t}')")"
board=$(get "$B/api/board/$SLUG"); ALL+="$board"
check "board: both cards introduced" '2' "$(jqr "$board" '[.cards[] | select(.column=="introduced")] | length')"

# ---- Silent decline: a second pair; the other side's agent inbox is identical before and after
p2=$(get -X POST "$B/api/requests" -H "$J" -d "$(jq -nc --arg a "$EVENT" '{anchor_id:$a,need:"someone to split a hotel room near Silverstone the night before",offer:"half the room cost",public_summary:"My human wants to split a room near Silverstone the night before. Whose human is staying over?"}')")
X1=$(jqr "$p2" .agent_token)
p3=$(get -X POST "$B/api/requests" -H "$J" -d "$(jq -nc --arg a "$EVENT" '{anchor_id:$a,need:"someone to share a twin room near Silverstone the night before the race",offer:"happy to book and split it",public_summary:"My human is booking a twin room near Silverstone the night before. Whose human wants to share?"}')")
check "second pair matched" '"matches_found":1' "$p3"
X2=$(jqr "$p3" .agent_token); X2H=$(jqr "$p3" .human_link); X2H=${X2H##*/r/}
before=$(get "$B/api/agent/inbox" -H "authorization: Bearer $X1" | jq -c '.matches')
M2=$(jqr "$before" '.[0].id')
check "decline while pending" '"state":"declined"' "$(get -X POST "$B/api/agent/decline" -H "$J" -H "authorization: Bearer $X2" -d "{\"match_id\":\"$M2\"}")"
after=$(get "$B/api/agent/inbox" -H "authorization: Bearer $X1" | jq -c '.matches')
check "decline is silent to the other side" "$before" "$after"
check "decliner's agent inbox keeps it as declined" '"state":"declined"' "$(get "$B/api/agent/inbox" -H "authorization: Bearer $X2")"
check "decliner's human inbox hides it" '"matches":[]' "$(get "$B/api/human/inbox" -H "authorization: Bearer $X2H")"

# ---- Rotate, close, expiry
nt=$(get -X POST "$B/api/human/agent-token" -H "authorization: Bearer $X2H")
X2N=$(jqr "$nt" .agent_token)
check "old agent token stops working after rotation" "401" "$(code "$B/api/agent/inbox" -H "authorization: Bearer $X2")"
check "new agent token works" "200" "$(code "$B/api/agent/inbox" -H "authorization: Bearer $X2N")"
check "close" '{"ok":true}' "$(get -X POST "$B/api/agent/close" -H "authorization: Bearer $X2N")"
check "closed request: 410 expired" '"error":"expired"' "$(get "$B/api/agent/inbox" -H "authorization: Bearer $X2N")"

# ---- Guard and errors
g=$(get -X POST "$B/api/requests" -H "$J" -d "$(jq -nc --arg a "$EVENT" '{anchor_id:$a,need:"lift",public_summary:"My human needs a lift. Call 07700 900123 so drivers can reach me."}')")
check "guard: phone number → contact_in_summary" '"error":"contact_in_summary"' "$g"
g=$(get -X POST "$B/api/requests" -H "$J" -d "$(jq -nc --arg a "$EVENT" '{anchor_id:$a,need:"lift",public_summary:"My human Sam Okafor from 14 Mare Street needs a lift. Whose human is driving?"}')")
check "guard: name and address → identity_in_summary" '"error":"identity_in_summary"' "$g"
check "unknown board → 404 anchor_not_found" '"error":"anchor_not_found"' "$(get -X POST "$B/api/requests" -H "$J" -d '{"anchor_id":"https://test.awkwardboard.com/nope-'$RUN'","need":"x","public_summary":"My human needs x."}')"
check "non-JSON body → 400 invalid" '"error":"invalid"' "$(get -X POST "$B/api/requests" -d 'need=lift')"
check "inbox without a token → 401" "401" "$(code "$B/api/agent/inbox")"
check "inbox with a made-up token → 401" "401" "$(code "$B/api/agent/inbox" -H "authorization: Bearer not-a-real-token")"
check "decline a match that isn't mine → 404" "404" "$(code -X POST "$B/api/agent/decline" -H "$J" -H "authorization: Bearer $X1" -d "{\"match_id\":\"$MID\"}")"

# ---- Web form, docs, CORS
jr=$(get -X POST "$B/api/join" -H "$J" -d "$(jq -nc --arg a "$EVENT" '{anchor_slug:$a,text:"I am running and could use a lift from Stratford, happy to pay for fuel"}')")
check "join returns a human link" "\"human_link\":\"$B/r/" "$jr"
absent "join never returns an agent token" '"agent_token"' "$jr"
check "openapi.json" '"openapi":"3.1.0"' "$(get "$B/api/openapi.json")"
check "CORS preflight" "access-control-allow-origin: *" "$(curl -si -X OPTIONS "$B/api/requests" | tr -d '\r' | tr 'A-Z' 'a-z')"

# ---- Privacy sweep over everything agents and the public saw
absent "agents and board never saw contact details" '(^|[^A-Za-z])(Sam|Alex)([^A-Za-z]|$)|alexdrives_smoke|\+447700900123|07700 900999|"first_name"|"handle"|"channel"' "$ALL"

if [[ -n "${TRIAL_KEY:-}" ]]; then
  log=$(get "$B/api/trial/log?key=$TRIAL_KEY&limit=300")
  absent "no plaintext token in the event log" "$RA|$DA|$RH|$DH|$X1|$X2|$X2N" "$log"
  absent "no contact details in the event log" 'alexdrives_smoke|\+447700900123' "$log"
  check "event log has req_ref" '"req_ref":"' "$log"
fi

echo "$pass passed, $failn failed (run $RUN)"
[[ $failn -eq 0 ]]
