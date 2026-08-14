import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { Alert, Card } from "@/components/ui";
import { isUserEmailVerified, requireSession } from "@/lib/auth";
import { TrainerVerifyForm } from "./trainer-verify-form";

export const dynamic = "force-dynamic";

export default async function TrainerVerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ setup?: string }>;
}) {
  const { setup } = await searchParams;
  const session = await requireSession();
  if (await isUserEmailVerified(session.userId)) {
    redirect("/");
  }

  return (
    <AuthShell
      title="Verify your email"
      subtitle={
        setup === "1"
          ? "Confirm this inbox before you publish your card or invite teammates."
          : "Confirm this inbox to publish your card and invite teammates."
      }
      showAudienceLinks={false}
      footer={
        <p className="mt-6 text-center text-xs text-stone-600">
          You can keep using FloorScribe now.{" "}
          <Link href="/" className="font-medium text-emerald-400 hover:underline">
            Continue to the floor
          </Link>
        </p>
      }
    >
      <Card className="border-zinc-800/80 p-5 shadow-xl shadow-black/40">
        {setup === "1" ? (
          <Alert tone="info" className="mb-4">
            Account created. Check {session.email} for a 6-digit code.
          </Alert>
        ) : null}
        <TrainerVerifyForm email={session.email} />
      </Card>
    </AuthShell>
  );
}
