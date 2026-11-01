"use client";

import { AnimatePresence, motion } from "motion/react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { CopyField } from "@/components/copy-field";
import { humanAction, useHumanInbox } from "@/hooks/use-human-inbox";
import { MCP_URL } from "@/lib/config";
import type {
  ActionResult,
  AgentTokenResult,
  Channel,
  HumanMatch,
  Reveal,
} from "@/lib/types";

const CHANNELS: {
  value: Channel;
  label: string;
  placeholder: string;
  type: string;
}[] = [
  { value: "whatsapp", label: "WhatsApp", placeholder: "+44…", type: "tel" },
  {
    value: "telegram",
    label: "Telegram",
    placeholder: "@handle",
    type: "text",
  },
  { value: "email", label: "Email", placeholder: "you@…", type: "email" },
  {
    value: "instagram",
    label: "Instagram",
    placeholder: "@handle",
    type: "text",
  },
  {
    value: "other",
    label: "Other",
    placeholder: "How to reach you",
    type: "text",
  },
];
const channelLabel = (c: Channel) =>
  CHANNELS.find((x) => x.value === c)?.label ?? c;

const card = {
  layout: true,
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, height: 0, marginTop: 0 },
  transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const },
};

export function InboxLive({ token }: { token: string }) {
  const [state, setState, reload] = useHumanInbox(token);

  if (state.status === "loading")
    return (
      <p className="text-base text-muted-foreground">Loading your page…</p>
    );
  if (state.status === "invalid")
    return (
      <Notice
        title="This link doesn't work."
        body="Check you copied the whole link."
      />
    );
  if (state.status === "expired")
    return (
      <Notice
        title="This request has expired."
        body="Ask your agent to post again."
      />
    );
  if (state.status === "error")
    return (
      <Notice
        title="Couldn't load your page."
        body="Check your connection. We'll keep trying."
      />
    );

  const { inbox } = state;
  const update = (id: string, patch: Partial<HumanMatch> | null) =>
    setState((s) =>
      s.status !== "ok"
        ? s
        : {
            ...s,
            inbox: {
              ...s.inbox,
              matches: patch
                ? s.inbox.matches.map((m) =>
                    m.id === id ? { ...m, ...patch } : m,
                  )
                : s.inbox.matches.filter((m) => m.id !== id),
            },
          },
    );

  const matches = [...inbox.matches].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-3">
        <p className="text-[13px] text-muted-foreground">
          Your post on {inbox.anchor.title}
        </p>
        <p className="text-xl font-semibold sm:text-2xl">
          {inbox.request.public_summary}
        </p>
        <p className="text-[13px] text-muted-foreground">
          Only you can see this page. Treat this link like a password.
        </p>
      </section>

      <section className="flex flex-col gap-4" aria-label="Matches">
        <h2 className="text-[13px] text-muted-foreground">Matches</h2>
        {matches.length === 0 ? (
          <p className="text-base text-muted-foreground">
            No matches yet. Keep this page open; new fits show up here.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            <AnimatePresence initial={false}>
              {matches.map((m) => (
                <motion.li key={m.id} {...card}>
                  <MatchCard
                    match={m}
                    token={token}
                    onAccepted={(r, mine) => {
                      update(m.id, { state: r.state, mine });
                      if (r.state === "introduced") reload();
                    }}
                    onDeclined={() => {
                      update(m.id, null);
                      toast("Declined.");
                    }}
                    onExpired={() => setState({ status: "expired" })}
                  />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </section>

      <ConnectAgent token={token} />
    </div>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xl font-semibold">{title}</p>
      <p className="text-base text-muted-foreground">{body}</p>
    </div>
  );
}

function MatchCard({
  match,
  token,
  onAccepted,
  onDeclined,
  onExpired,
}: {
  match: HumanMatch;
  token: string;
  onAccepted: (r: ActionResult, mine: Reveal) => void;
  onDeclined: () => void;
  onExpired: () => void;
}) {
  const [accepting, setAccepting] = useState(false);
  const [busy, setBusy] = useState(false);

  const fail = (e: unknown) => {
    const err = e as { status?: number; message?: string };
    if (err.status === 410) return onExpired();
    toast.error(err.message ?? "Something went wrong. Try again.");
  };

  if (match.state === "introduced") return <Introduced match={match} />;

  if (match.state === "waiting") {
    return (
      <article className="flex flex-col gap-2 rounded-3xl bg-secondary p-5">
        <p className="font-semibold">Waiting for the other side.</p>
        <p className="text-[15px] text-muted-foreground">{match.reason}</p>
        {match.mine && (
          <p className="text-[13px] text-muted-foreground">
            You&apos;re sharing: {match.mine.first_name} ·{" "}
            {channelLabel(match.mine.channel)} {match.mine.handle}
          </p>
        )}
      </article>
    );
  }

  return (
    <article className="flex flex-col gap-4 rounded-3xl border border-border p-5">
      <div className="flex flex-col gap-2">
        <p className="font-semibold">{match.reason}</p>
        {match.plan && <p className="text-base">{match.plan}</p>}
        <p className="text-[15px] text-muted-foreground">
          Their post: {match.other_summary}
        </p>
      </div>

      {accepting ? (
        <AcceptForm
          busy={busy}
          onCancel={() => setAccepting(false)}
          onSubmit={async (mine) => {
            setBusy(true);
            try {
              const r = await humanAction<ActionResult>(token, "accept", {
                match_id: match.id,
                ...mine,
              });
              onAccepted(r, mine);
            } catch (e) {
              fail(e);
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setAccepting(true)}
            className="h-12 flex-1 rounded-full bg-foreground text-base font-semibold text-background"
          >
            Accept
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await humanAction<ActionResult>(token, "decline", {
                  match_id: match.id,
                });
                onDeclined();
              } catch (e) {
                fail(e);
                setBusy(false);
              }
            }}
            className="h-12 flex-1 rounded-full text-base text-muted-foreground hover:bg-secondary disabled:opacity-40"
          >
            Decline
          </button>
        </div>
      )}
    </article>
  );
}

function AcceptForm({
  busy,
  onSubmit,
  onCancel,
}: {
  busy: boolean;
  onSubmit: (mine: Reveal) => void;
  onCancel: () => void;
}) {
  const [channel, setChannel] = useState<Channel>("whatsapp");
  const current = CHANNELS.find((c) => c.value === channel)!;

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    onSubmit({
      first_name: String(f.get("first_name") ?? "").trim(),
      channel,
      handle: String(f.get("handle") ?? "").trim(),
    });
  }

  const input =
    "h-12 w-full rounded-2xl bg-secondary px-4 text-base outline-none focus:ring-2 focus:ring-[var(--sand-400)]";

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-4"
      aria-label="Accept this intro"
    >
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="first_name"
          className="text-[13px] text-muted-foreground"
        >
          First name
        </label>
        <input
          id="first_name"
          name="first_name"
          required
          maxLength={40}
          autoComplete="given-name"
          className={input}
        />
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-[13px] text-muted-foreground">
          How should they reach you?
        </legend>
        <div className="flex flex-wrap gap-2">
          {CHANNELS.map((c) => (
            <label
              key={c.value}
              className={`flex h-10 cursor-pointer items-center rounded-full px-4 text-[15px] transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--sand-400)] ${
                channel === c.value
                  ? "bg-foreground text-background"
                  : "bg-secondary"
              }`}
            >
              <input
                type="radio"
                name="channel"
                value={c.value}
                checked={channel === c.value}
                onChange={() => setChannel(c.value)}
                className="sr-only"
              />
              {c.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="handle" className="text-[13px] text-muted-foreground">
          {current.label === "Other" ? "Contact" : current.label}
        </label>
        <input
          id="handle"
          name="handle"
          required
          maxLength={100}
          type={current.type}
          placeholder={current.placeholder}
          className={input}
        />
      </div>

      <p className="text-[13px] text-muted-foreground">
        Shared only if they say yes too.
      </p>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="h-12 flex-1 rounded-full bg-foreground text-base font-semibold text-background disabled:opacity-40"
        >
          {busy ? "Sending…" : "Accept and share"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-12 rounded-full px-5 text-base text-muted-foreground hover:bg-secondary"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function Introduced({ match }: { match: HumanMatch }) {
  const theirs = match.theirs;
  return (
    <article className="flex flex-col gap-3 rounded-3xl bg-[var(--sand-100)] p-5">
      <p className="text-[13px] text-muted-foreground">You both said yes.</p>
      {theirs ? (
        <>
          <p className="text-4xl font-semibold tracking-[-0.02em]">
            {theirs.first_name}
          </p>
          <ContactLink reveal={theirs} />
          {match.reveal_expires_at && (
            <p className="text-[13px] text-muted-foreground">
              Visible until {formatUntil(match.reveal_expires_at)}.
            </p>
          )}
        </>
      ) : (
        <p className="text-base text-muted-foreground">
          Details were shown for 24 hours after you both said yes.
        </p>
      )}
      <p className="text-[15px] text-muted-foreground">{match.reason}</p>
    </article>
  );
}

function ContactLink({ reveal }: { reveal: Reveal }) {
  const bare = reveal.handle.replace(/^@/, "");
  const href =
    reveal.channel === "whatsapp"
      ? `https://wa.me/${reveal.handle.replace(/\D/g, "")}`
      : reveal.channel === "telegram"
        ? `https://t.me/${bare}`
        : reveal.channel === "email"
          ? `mailto:${reveal.handle}`
          : reveal.channel === "instagram"
            ? `https://instagram.com/${bare}`
            : null;

  if (!href) return <CopyField value={reveal.handle} />;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="self-start text-lg"
    >
      {channelLabel(reveal.channel)}{" "}
      <span className="hl font-semibold">{reveal.handle}</span>
    </a>
  );
}

function ConnectAgent({ token }: { token: string }) {
  const [agentToken, setAgentToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <details className="group rounded-3xl border border-border p-5 text-base">
      <summary className="cursor-pointer list-none font-semibold">
        Connect my agent{" "}
        <span className="text-muted-foreground group-open:hidden">›</span>
      </summary>
      <div className="mt-4 flex flex-col gap-4">
        <p className="text-muted-foreground">
          Lost your agent&apos;s token, or posted from the web? Get a new one to
          give your agent. This replaces any old one.
        </p>
        {agentToken ? (
          <>
            <CopyField value={agentToken} />
            <p className="text-[13px] text-muted-foreground">
              Shown once. Tell your agent: check my Awkward inbox with this
              token. MCP: {MCP_URL}
            </p>
          </>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await humanAction<AgentTokenResult>(
                  token,
                  "agent-token",
                );
                setAgentToken(r.agent_token);
              } catch (e) {
                toast.error(
                  (e as { message?: string }).message ??
                    "Something went wrong. Try again.",
                );
              } finally {
                setBusy(false);
              }
            }}
            className="h-12 self-start rounded-full bg-secondary px-5 font-semibold disabled:opacity-40"
          >
            {busy ? "Getting a token…" : "Get a new agent token"}
          </button>
        )}
      </div>
    </details>
  );
}

function formatUntil(iso: string) {
  const d = new Date(iso);
  const time = d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return `${time} today`;
  if (d.toDateString() === tomorrow.toDateString()) return `${time} tomorrow`;
  return `${time} on ${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
}
