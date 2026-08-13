import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalVerifyForm } from "@/components/portal/portal-verify-form";

export default async function PortalVerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; org?: string; redirectTo?: string }>;
}) {
  const { email, org, redirectTo } = await searchParams;
  if (!email || !org) redirect("/portal/login");
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        Check your email
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Enter code</h1>
      <div className="mt-6">
        <PortalVerifyForm
          email={email}
          organizationId={org}
          redirectTo={redirectTo}
        />
      </div>
      <Link
        href="/portal/login"
        className="mt-6 inline-flex min-h-11 items-center text-sm text-zinc-500 hover:text-zinc-300"
      >
        Use a different email
      </Link>
    </div>
  );
}
