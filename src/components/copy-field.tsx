"use client";

import { useState } from "react";

// A value with a copy button. Used for links, commands and the sentence for your agent.
export function CopyField({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-secondary px-4 py-3 text-base">
      <p className="min-w-0 flex-1 break-words">{value}</p>
      <button
        type="button"
        className="shrink-0 text-[13px] font-semibold text-muted-foreground hover:text-foreground"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {}
        }}
      >
        {copied ? "Copied" : label}
      </button>
    </div>
  );
}
