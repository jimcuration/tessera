import { notFound } from "next/navigation";
import { Player } from "@/components/player";
import { TITLES, titleById } from "@/lib/catalog";

export function generateStaticParams() {
  return TITLES.map((title) => ({ id: title.id }));
}

export default async function WatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const title = titleById(id);
  if (!title) notFound();
  return <Player title={title} />;
}
