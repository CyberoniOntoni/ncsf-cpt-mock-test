import { loginAction } from "@/app/actions/auth";
import { Alert, Button, Card, Input, Label } from "@/components/ui";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-zinc-950 px-4 py-10">
      {/* Soft backdrop */}
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
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-900/40 bg-emerald-950/30 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-emerald-400">
            PT CRM
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-zinc-50">
            Sign in
          </h1>
          <p className="mt-1.5 text-sm text-zinc-500">
            Coach workspace — clients, programs, sessions &amp; AI assist
          </p>
        </div>
        <Card className="border-zinc-800/80 p-5 shadow-xl shadow-black/40">
          <form action={loginAction} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue="pt@demo.local"
                required
                autoComplete="username"
                className="mt-0.5"
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                defaultValue="trainer123"
                required
                autoComplete="current-password"
                className="mt-0.5"
              />
            </div>
            {params.error && (
              <Alert tone="error">{params.error}</Alert>
            )}
            <Button type="submit" className="w-full" size="lg">
              Sign in
            </Button>
          </form>
          <p className="mt-5 border-t border-zinc-800 pt-4 text-center text-xs text-zinc-600">
            Demo account:{" "}
            <span className="text-zinc-400">pt@demo.local</span> /{" "}
            <span className="text-zinc-400">trainer123</span>
          </p>
        </Card>
      </div>
    </div>
  );
}
