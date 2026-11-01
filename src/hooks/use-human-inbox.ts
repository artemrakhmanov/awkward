"use client";

import { useCallback, useEffect, useState } from "react";
import { API_ORIGIN } from "@/lib/config";
import type { HumanInbox } from "@/lib/types";

export type InboxState =
  | { status: "loading" }
  | { status: "ok"; inbox: HumanInbox }
  | { status: "invalid" }
  | { status: "expired" }
  | { status: "error" };

// Polls the human inbox with the token as a bearer header. Never logs the token.
export function useHumanInbox(token: string, ms = 3000) {
  const [state, setState] = useState<InboxState>({ status: "loading" });

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_ORIGIN}/api/human/inbox`, {
        cache: "no-store",
        headers: { authorization: `Bearer ${token}` },
      });
      if (res.ok) return setState({ status: "ok", inbox: await res.json() });
      if (res.status === 401 || res.status === 404)
        return setState({ status: "invalid" });
      if (res.status === 410) return setState({ status: "expired" });
      setState((s) => (s.status === "ok" ? s : { status: "error" }));
    } catch {
      setState((s) => (s.status === "ok" ? s : { status: "error" }));
    }
  }, [token]);

  useEffect(() => {
    let alive = true;
    const tick = () => alive && !document.hidden && load();
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, ms);
    return () => {
      alive = false;
      clearTimeout(first);
      clearInterval(id);
    };
  }, [load, ms]);

  return [state, setState, load] as const;
}

// POSTs a human action with the bearer token. Throws { status, message } on failure.
export async function humanAction<T>(
  token: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${API_ORIGIN}/api/human/${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    throw {
      status: res.status,
      message: data.message ?? "Something went wrong. Try again.",
    };
  return data as T;
}
