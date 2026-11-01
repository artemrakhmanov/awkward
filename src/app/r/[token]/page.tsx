import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { InboxLive } from "@/components/inbox-live";
import { Toaster } from "@/components/ui/sonner";

// Private page. Nothing private goes in the title or preview tags, and nothing changes on GET:
// link-preview bots open these links. The inbox loads in the browser with the token as a bearer header.
export const metadata: Metadata = {
  title: "Your private link · Awkward",
  description: "A private page.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
  openGraph: null,
  twitter: null,
};

export default function Page(props: PageProps<"/r/[token]">) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[34rem] flex-col gap-10 p-4 pb-16 text-lg leading-[1.3] tracking-[-0.01em] sm:pt-6">
      <header className="text-base">
        <Link href="/" className="font-semibold">
          awkward
        </Link>
      </header>
      <Suspense fallback={<InboxSkeleton />}>
        <TokenLoader params={props.params} />
      </Suspense>
      <Toaster position="bottom-center" />
    </main>
  );
}

async function TokenLoader({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <InboxLive token={token} />;
}

function InboxSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <div className="h-4 w-32 animate-pulse rounded-full bg-secondary" />
      <div className="h-16 animate-pulse rounded-2xl bg-secondary" />
    </div>
  );
}
