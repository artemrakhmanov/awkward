-- Test cleanup (POST /api/trial/cleanup) deletes the log rows of test boards it removes.
grant delete on table public.trial_log to service_role;
