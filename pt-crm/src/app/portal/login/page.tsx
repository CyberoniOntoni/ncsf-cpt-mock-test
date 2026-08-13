import Link from "next/link";
import { PortalLoginForm } from "@/components/portal/portal-login-form";

export default async function PortalLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  const { redirectTo } = await searchParams;
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        Client portal
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">
        Sign in to your plan
      </h1>
      <p className="mt-2 text-sm text-zinc-400">
        We email a one-time code. No password. If you train at more than one
        studio, you&apos;ll pick which one.
      </p>
      <div className="mt-6">
        <PortalLoginForm redirectTo={redirectTo} />
      </div>
      <p className="mt-8 text-center text-xs text-zinc-600">
        Trainer?{" "}
        <Link href="/login" className="text-emerald-400 hover:underline">
          Staff login
        </Link>
      </p>
    </div>
  );
}
