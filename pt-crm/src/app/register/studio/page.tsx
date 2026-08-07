import type { Metadata } from "next";
import Link from "next/link";
import { registerStudioAction } from "@/app/actions/auth";
import { AuthShell } from "@/components/auth-shell";
import { AuthSubmitButton } from "@/components/auth-submit-button";
import { RegisterOptionalFields } from "@/components/register-optional-fields";
import { Alert, Card, Input, Label } from "@/components/ui";

export const metadata: Metadata = {
  title: "Studio signup",
  description: "Create a FloorScribe studio and invite trainers.",
};

export default async function RegisterStudioPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <AuthShell
      title="Studio / team"
      subtitle="You’re the owner. Invite trainers from Settings after signup."
    >
      <Card className="border-zinc-800/80 p-5 shadow-xl shadow-black/40">
        <form action={registerStudioAction} className="space-y-3.5">
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
              placeholder="owner@studio.com"
              className="mt-0.5 min-h-11"
            />
          </div>
          <div>
            <Label htmlFor="studioName">Studio name</Label>
            <Input
              id="studioName"
              name="studioName"
              required
              minLength={2}
              autoComplete="organization"
              placeholder="Peak Performance Studio"
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
          <AuthSubmitButton>Create studio</AuthSubmitButton>
        </form>
        <p className="mt-5 border-t border-zinc-800 pt-4 text-center text-xs text-zinc-600">
          <Link href="/register" className="hover:text-zinc-300">
            ← Other options
          </Link>
          {" · "}
          <Link
            href="/register/solo"
            className="text-emerald-400 hover:underline"
          >
            Individual PT instead
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
