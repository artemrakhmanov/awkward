-- Consent logic tests for accept_match / decline_match / match_candidates and grants.
-- Run as one statement. It always ends in RAISE EXCEPTION, so everything rolls back:
-- the error message is the report. Each line is "PASS|FAIL name: got (want)".
do $$
declare
  an uuid; ra uuid; rb uuid; rc uuid; m1 uuid; m2 uuid; m3 uuid;
  v extensions.vector(1536) := array_fill(0.1::real, array[1536])::extensions.vector;
  got text; n int; ok boolean; report text := '';
begin
  insert into public.anchors (slug, title, url) values ('t-consent', 'Consent test', 'https://test.awkwardboard.com/consent')
    returning id into an;
  insert into public.requests (anchor_id, public_summary, need, need_emb, agent_token_hash, human_token_hash, expires_at)
    values (an, 'rider', 'lift', v, 'agent-a', 'human-a', now() + interval '1 day') returning id into ra;
  insert into public.requests (anchor_id, public_summary, need, offer, need_emb, offer_emb, agent_token_hash, human_token_hash, expires_at)
    values (an, 'driver', 'riders', 'seats', v, v, 'agent-b', 'human-b', now() + interval '1 day') returning id into rb;
  insert into public.requests (anchor_id, public_summary, need, need_emb, agent_token_hash, human_token_hash, expires_at)
    values (an, 'third', 'lift', v, 'agent-c', 'human-c', now() + interval '1 day') returning id into rc;

  -- candidates before any match: A sees B and C
  select count(*) into n from public.match_candidates(ra);
  report := report || format(E'\n%s candidates A before match: %s (2)', case when n = 2 then 'PASS' else 'FAIL' end, n);

  insert into public.matches (anchor_id, req_a, req_b, reason, plan) values (an, ra, rb, 'r', 'p') returning id into m1;
  insert into public.matches (anchor_id, req_a, req_b, reason, plan) values (an, rc, rb, 'r', 'p') returning id into m2;

  select count(*) into n from public.match_candidates(ra);
  report := report || format(E'\n%s candidates A excludes matched B: %s (1)', case when n = 1 then 'PASS' else 'FAIL' end, n);

  begin
    insert into public.matches (anchor_id, req_a, req_b, reason, plan) values (an, rb, ra, 'r', 'p');
    report := report || E'\nFAIL reverse pair rejected: inserted';
  exception when unique_violation then
    report := report || E'\nPASS reverse pair rejected: 23505';
  end;

  got := public.accept_match('nope', m1, 'X', 'other', 'x');
  report := report || format(E'\n%s accept with unknown token: %s (not_found)', case when got = 'not_found' then 'PASS' else 'FAIL' end, got);
  got := public.accept_match('human-c', m1, 'X', 'other', 'x');
  report := report || format(E'\n%s accept a match that is not mine: %s (not_found)', case when got = 'not_found' then 'PASS' else 'FAIL' end, got);

  got := public.accept_match('human-a', m1, 'Sam', 'whatsapp', '+447700900000');
  report := report || format(E'\n%s rider accepts first: %s (waiting)', case when got = 'waiting' then 'PASS' else 'FAIL' end, got);
  got := public.decline_match('agent', 'agent-a', m1);
  report := report || format(E'\n%s rider agent cannot undo the yes: %s (not_pending)', case when got = 'not_pending' then 'PASS' else 'FAIL' end, got);
  got := public.decline_match('human', 'human-a', m1);
  report := report || format(E'\n%s rider human cannot decline after accepting: %s (not_pending)', case when got = 'not_pending' then 'PASS' else 'FAIL' end, got);

  got := public.accept_match('human-b', m1, 'Alex', 'telegram', 'alexdrives');
  report := report || format(E'\n%s driver accepts second: %s (introduced)', case when got = 'introduced' then 'PASS' else 'FAIL' end, got);
  select count(*) into n from public.requests where id in (ra, rb) and status = 'introduced' and expires_at >= now() + interval '23 hours';
  report := report || format(E'\n%s both requests introduced with 24h+ expiry: %s (2)', case when n = 2 then 'PASS' else 'FAIL' end, n);
  select count(*) into n from public.reveals where match_id = m1 and expires_at between now() + interval '23 hours' and now() + interval '25 hours';
  report := report || format(E'\n%s both reveals with a 24h window: %s (2)', case when n = 2 then 'PASS' else 'FAIL' end, n);

  -- m2 is C<->B; B is introduced (status) but its side on m2 is pending: C declines silently
  got := public.decline_match('agent', 'agent-c', m2);
  report := report || format(E'\n%s agent declines while pending: %s (declined)', case when got = 'declined' then 'PASS' else 'FAIL' end, got);
  select b_status into got from public.matches where id = m2;
  report := report || format(E'\n%s other side untouched by decline: %s (pending)', case when got = 'pending' then 'PASS' else 'FAIL' end, got);
  got := public.accept_match('human-c', m2, 'Cat', 'email', 'c@example.com');
  report := report || format(E'\n%s accept after my side declined: %s (declined)', case when got = 'declined' then 'PASS' else 'FAIL' end, got);
  select count(*) into n from public.reveals where match_id = m2;
  report := report || format(E'\n%s no reveal kept on a declined match: %s (0)', case when n = 0 then 'PASS' else 'FAIL' end, n);

  -- expiry and close
  insert into public.matches (anchor_id, req_a, req_b, reason, plan) values (an, ra, rc, 'r', 'p') returning id into m3;
  update public.requests set expires_at = now() - interval '1 minute' where id = rc;
  got := public.accept_match('human-c', m3, 'Cat', 'email', 'c@example.com');
  report := report || format(E'\n%s accept on an expired request: %s (expired)', case when got = 'expired' then 'PASS' else 'FAIL' end, got);
  update public.requests set expires_at = now() + interval '1 day', status = 'closed' where id = rc;
  got := public.decline_match('agent', 'agent-c', m3);
  report := report || format(E'\n%s decline on a closed request: %s (expired)', case when got = 'expired' then 'PASS' else 'FAIL' end, got);

  -- grants: the API roles can't call the functions; the server role can use everything
  ok := not has_function_privilege('anon', 'public.accept_match(text,uuid,text,text,text)', 'execute')
    and not has_function_privilege('authenticated', 'public.decline_match(text,text,uuid)', 'execute')
    and has_function_privilege('service_role', 'public.accept_match(text,uuid,text,text,text)', 'execute')
    and has_function_privilege('service_role', 'public.match_candidates(uuid)', 'execute')
    and has_table_privilege('service_role', 'public.requests', 'insert,select,update,delete')
    and has_table_privilege('service_role', 'public.reveals', 'select')
    and not has_table_privilege('anon', 'public.reveals', 'select');
  report := report || format(E'\n%s grants (anon/auth blocked, service_role allowed)', case when ok then 'PASS' else 'FAIL' end);

  raise exception 'ROLLED BACK. Results:%', report;
end;
$$;
