import type { Metadata } from "next";
import Link from "next/link";
import { loginAction } from "@/app/actions/auth";
import { AuthShell } from "@/components/auth-shell";
import { AuthSubmitButton } from "@/components/auth-submit-button";
import { Alert, Card, Input, Label } from "@/components/ui";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to FloorScribe — the floor OS for personal trainers.",
};

const showDemoHint = process.env.NODE_ENV !== "production";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const next =
    params.next &&
    params.next.startsWith("/") &&
    !params.next.startsWith("//")
      ? params.next
      : "";
  const isInviteReturn = next.startsWith("/invite/");

  return (
    <AuthShell
      title="Sign in"
      subtitle={
        isInviteReturn
          ? "Sign in to accept your studio invite."
          : "Sessions, clients, programs & coach — on the floor."
      }
    >
      <Card className="border-zinc-800/80 p-5 shadow-xl shadow-black/40">
        <form action={loginAction} className="space-y-4">
          {next ? <input type="hidden" name="next" value={next} /> : null}
          {isInviteReturn && (
            <Alert tone="info">
              After you sign in, you’ll return to the invite to join the team.
            </Alert>
          )}
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="username"
              placeholder="you@studio.com"
              className="mt-0.5 min-h-11"
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="mt-0.5 min-h-11"
            />
          </div>
          {params.error && <Alert tone="error">{params.error}</Alert>}
          <AuthSubmitButton>
            {isInviteReturn ? "Sign in to continue" : "Sign in"}
          </AuthSubmitButton>
        </form>
        <p className="mt-5 border-t border-zinc-800 pt-4 text-center text-xs text-zinc-600">
          New trainer?{" "}
          <Link
            href="/register"
            className="font-medium text-emerald-400 hover:underline"
          >
            Individual PT or studio
          </Link>
          {" · "}
          <Link href="/marketing" className="text-zinc-500 hover:text-zinc-300">
            About FloorScribe
          </Link>
        </p>
        {showDemoHint && (
          <p className="mt-2 text-center text-[11px] text-zinc-700">
            Local demo:{" "}
            <span className="text-zinc-500">pt@demo.local</span> /{" "}
            <span className="text-zinc-500">trainer123</span>
          </p>
        )}
      </Card>
    </AuthShell>
  );
}
