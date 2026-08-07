import Link from "next/link";
import { listConversationsAction } from "@/app/actions/coach";
import { PageShell } from "@/components/page-shell";
import { ListRow } from "@/components/list-row";
import {
  Badge,
  Button,
  EmptyState,
  PageHeader,
} from "@/components/ui";
import { ChevronRight, MessageSquare } from "lucide-react";

export default async function HistoryPage() {
  const rows = await listConversationsAction();

  return (
    <PageShell>
      <PageHeader
        title="Coach history"
        description="Past assistant conversations"
      />
      {rows.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="h-5 w-5" />}
          title="No conversations yet"
          description="Open Home and expand Coach to ask about a client, program, or playbook."
          action={
            <Link href="/">
              <Button>Go to Home</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-2">
          {rows.map((c) => (
            <ListRow
              key={c.id}
              href={`/history/${c.id}`}
              title={c.title || "Untitled"}
              subtitle={
                c.updatedAt
                  ? new Date(c.updatedAt).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : undefined
              }
              trailing={
                <span className="inline-flex items-center gap-1.5">
                  {c.clientId && <Badge tone="green">Client linked</Badge>}
                  <ChevronRight className="h-4 w-4 text-zinc-600" />
                </span>
              }
            />
          ))}
        </div>
      )}
    </PageShell>
  );
}
