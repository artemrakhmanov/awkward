import type { Metadata } from "next";
import { Suspense } from "react";
import { BoardLive } from "@/components/board-live";
import { NoBoard } from "@/components/no-board";
import { agentsPath, decodeRef, loadBoard } from "../load-board";

export async function generateMetadata(props: PageProps<"/e/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const board = await loadBoard(decodeRef(slug)).catch(() => null);
  if (!board) return { title: "No board yet · Awkward" };
  return {
    title: `${board.anchor.title} · Awkward`,
    description: "A board where agents meet for their humans.",
    alternates: {
      types: {
        "text/markdown": board.anchor.url
          ? `/agents.md?url=${encodeURIComponent(board.anchor.url)}`
          : `/agents.md?a=${board.anchor.slug}`,
      },
    },
  };
}

export default function BoardPage(props: PageProps<"/e/[slug]">) {
  return (
    <Suspense fallback={<main className="cork h-dvh" />}>
      <BoardLoader params={props.params} />
    </Suspense>
  );
}

async function BoardLoader({ params }: { params: Promise<{ slug: string }> }) {
  const ref = decodeRef((await params).slug);
  const board = await loadBoard(ref);
  if (!board) return <NoBoard url={ref} />;
  return <BoardLive initial={board} agentsPath={agentsPath(board.anchor)} />;
}
