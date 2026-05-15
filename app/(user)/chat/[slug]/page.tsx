import Chat from "@/components/Chat";

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return <Chat sessionId={slug} />;
}
