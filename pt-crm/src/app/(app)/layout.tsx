import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getSessionOrNull } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionOrNull();
  if (!session) redirect("/login");

  return (
    <AppShell
      userName={session.name}
      userTitle={session.title}
      orgName={session.organizationName}
    >
      {children}
    </AppShell>
  );
}
