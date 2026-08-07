import type { Metadata } from "next";
import Link from "next/link";
import { registerSoloAction } from "@/app/actions/auth";
import { AuthShell } from "@/components/auth-shell";
import { AuthSubmitButton } from "@/components/auth-submit-button";
import { RegisterOptionalFields } from "@/components/register-optional-fields";
import { Alert, Card, Input, Label } from "@/components/ui";

export const metadata: Metadata = {
  title: "Individual PT signup",
  description: "Create a solo FloorScribe practice.",
};

export default async function RegisterSoloPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <AuthShell
      title="Individual PT"
      subtitle="Your practice — clients, sessions, and packs under you."
    >
      <Card className="border-zinc-800/80 p-5 shadow-xl shadow-black/40">
        <form action={registerSoloAction} className="space-y-3.5">
          <div>
            <Label htmlFor="name">Your name</Label>
            <Input
              id="name"
              name="name"
              required
              minLength={2}
              autoComplete="name"
              placeholder="Alex Chen"
              className="mt-0.5 min-h-11"
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              className="mt-0.5 min-h-11"
            />
          </div>
          <div>
            <Label htmlFor="practiceName">Practice name (optional)</Label>
            <Input
              id="practiceName"
              name="practiceName"
              placeholder="Defaults to Your name’s practice"
              className="mt-0.5 min-h-11"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="Min 8 characters"
                className="mt-0.5 min-h-11"
              />
            </div>
            <div>
              <Label htmlFor="confirmPassword">Confirm</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className="mt-0.5 min-h-11"
              />
            </div>
          </div>
          <RegisterOptionalFields />
          {params.error && <Alert tone="error">{params.error}</Alert>}
          <AuthSubmitButton>Create practice</AuthSubmitButton>
        </form>
        <p className="mt-5 border-t border-zinc-800 pt-4 text-center text-xs text-zinc-600">
          <Link href="/register" className="hover:text-zinc-300">
            ← Other options
          </Link>
          {" · "}
          <Link
            href="/register/studio"
            className="text-emerald-400 hover:underline"
          >
            Studio instead
          </Link>
          {" · "}
          <Link href="/login" className="hover:text-zinc-300">
            Sign in
          </Link>
        </p>
      </Card>
    </AuthShell>
  );
}
