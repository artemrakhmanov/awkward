import { redirect } from "next/navigation";
import { Suspense } from "react";
import { NoBoard } from "@/components/no-board";
import { decodeRef, loadBoard } from "./load-board";

// /e?url=<event url> sends you to that board, or says there isn't one yet.
export default function ResolveBoard(props: PageProps<"/e">) {
  return (
    <Suspense fallback={null}>
      <Resolve searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Resolve({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = (await searchParams).url;
  const url = typeof raw === "string" ? decodeRef(raw.trim()) : "";
  if (!url) redirect("/browse");
  const board = await loadBoard(url);
  if (board) redirect(`/e/${board.anchor.slug}`);
  return <NoBoard url={url} />;
}
