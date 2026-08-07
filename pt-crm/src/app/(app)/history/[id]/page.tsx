import Link from "next/link";
import { notFound } from "next/navigation";
import { getConversationAction } from "@/app/actions/coach";
import { Card, Badge } from "@/components/ui";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getConversationAction(id);
  if (!data) notFound();

  return (
    <div className="space-y-4 p-6">
      <div>
        <Link href="/history" className="text-xs text-emerald-400 hover:underline">
          ← History
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">
          {data.conversation.title || "Conversation"}
        </h1>
      </div>
      <div className="space-y-3">
        {data.messages.map((m) => (
          <Card key={m.id}>
            <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-zinc-500">
              {m.role}
              {m.structured && typeof m.structured === "object" && "type" in m.structured && (
                <Badge>{String((m.structured as { type: string }).type)}</Badge>
              )}
            </div>
            <div className="whitespace-pre-wrap text-sm text-zinc-200">{m.content}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
