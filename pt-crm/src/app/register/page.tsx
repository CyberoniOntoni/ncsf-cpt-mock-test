import type { Metadata } from "next";
import Link from "next/link";
import { registerAction } from "@/app/actions/auth";
import { AuthShell } from "@/components/auth-shell";
import { AuthSubmitButton } from "@/components/auth-submit-button";
import { RegisterOptionalFields } from "@/components/register-optional-fields";
import { Alert, Card, Input, Label } from "@/components/ui";

export const metadata: Metadata = {
  title: "Create account",
  description:
    "Create your FloorScribe studio account — sessions, clients, programs & coach.",
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const existingEmail = params.error?.toLowerCase().includes("already exists");

  return (
    <AuthShell
      title="Create your studio"
      subtitle="One trainer account + studio. Invite more later."
    >
      <Card className="border-zinc-800/80 p-5 shadow-xl shadow-black/40">
        <form action={registerAction} className="space-y-3.5">
          <div>
            <Label htmlFor="name">Your name</Label>
            <Input
              id="name"
              name="name"
              type="text"
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
              placeholder="you@studio.com"
              className="mt-0.5 min-h-11"
            />
          </div>
          <div>
            <Label htmlFor="studioName">Studio name</Label>
            <Input
              id="studioName"
              name="studioName"
              type="text"
              required
              minLength={2}
              autoComplete="organization"
              placeholder="Your PT studio"
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

          {params.error && (
            <Alert tone="error">
              {params.error}
              {existingEmail && (
                <>
                  {" "}
                  <Link
                    href="/login"
                    className="font-medium text-red-100 underline"
                  >
                    Sign in
                  </Link>
                </>
              )}
            </Alert>
          )}
          <AuthSubmitButton>Create account</AuthSubmitButton>
          <p className="text-center text-[11px] text-zinc-600">
            By creating an account you get an isolated studio on this server.
          </p>
        </form>
        <p className="mt-5 border-t border-zinc-800 pt-4 text-center text-xs text-zinc-600">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-emerald-400 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </Card>
    </AuthShell>
  );
}
