import type { Metadata } from "next";
import Link from "next/link";
import { registerAction } from "@/app/actions/auth";
import { BrandMark } from "@/components/brand-mark";
import { Alert, Button, Card, Input, Label } from "@/components/ui";

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

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-zinc-950 px-4 py-10">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(16,185,129,0.18), transparent), radial-gradient(ellipse 60% 40% at 100% 100%, rgba(16,185,129,0.06), transparent)",
        }}
      />
      <div className="relative w-full max-w-md animate-in">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center rounded-full border border-emerald-900/40 bg-emerald-950/30 px-3.5 py-1.5">
            <BrandMark size="sm" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-zinc-50">
            Create your studio
          </h1>
          <p className="mt-1.5 text-sm text-zinc-500">
            One trainer account + studio. You can invite more later.
          </p>
        </div>
        <Card className="border-zinc-800/80 p-5 shadow-xl shadow-black/40">
          <form action={registerAction} className="space-y-3.5">
            <div>
              <Label htmlFor="name">Your name</Label>
              <Input
                id="name"
                name="name"
                type="text"
                required
                autoComplete="name"
                placeholder="Alex Chen"
                className="mt-0.5 min-h-11"
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
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="phone">Phone (optional)</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="+65 …"
                  className="mt-0.5 min-h-11"
                />
              </div>
              <div>
                <Label htmlFor="title">Credentials (optional)</Label>
                <Input
                  id="title"
                  name="title"
                  type="text"
                  placeholder="NCSF-CPT"
                  className="mt-0.5 min-h-11"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="unitSystem">Units</Label>
                <select
                  id="unitSystem"
                  name="unitSystem"
                  defaultValue="metric"
                  className="mt-0.5 min-h-11 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="metric">Metric (kg)</option>
                  <option value="imperial">Imperial (lb)</option>
                </select>
              </div>
              <div>
                <Label htmlFor="timezone">Timezone</Label>
                <Input
                  id="timezone"
                  name="timezone"
                  type="text"
                  defaultValue="Asia/Singapore"
                  placeholder="Asia/Singapore"
                  className="mt-0.5 min-h-11"
                />
              </div>
            </div>
            {params.error && <Alert tone="error">{params.error}</Alert>}
            <Button type="submit" className="w-full min-h-11" size="lg">
              Create account
            </Button>
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
      </div>
    </div>
  );
}
