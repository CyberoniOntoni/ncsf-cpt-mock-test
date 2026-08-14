import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalVerifyForm } from "@/components/portal/portal-verify-form";
import { PublicSiteFooter } from "@/components/public-site-footer";
import { PublicSiteHeader } from "@/components/public-site-header";
import { latestOtpOrganizationId } from "@/lib/client-auth";

export default async function PortalVerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; org?: string; redirectTo?: string }>;
}) {
  const { email, org, redirectTo } = await searchParams;
  if (!email) redirect("/portal/login");
  // Multi-studio passes org from the picker; single-studio resolves from the OTP row
  // so requestClientOtp need not return organizationId. Empty org keeps the form up for
  // unknown emails (same path as known) — verify fails until a real code exists.
  const organizationId = org || (await latestOtpOrganizationId(email)) || "";
  return (
    <div className="mkt-root min-h-dvh bg-[#12100e] text-stone-100">
      <PublicSiteHeader
        variant="portal"
        scrolled
        trailing={
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center rounded-lg px-2.5 text-sm text-stone-500 hover:text-stone-300"
          >
            Trainer? Staff login
          </Link>
        }
      />
      <div className="mx-auto flex max-w-md flex-col px-4 py-10">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          Check your email
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Enter code</h1>
        <div className="mt-6">
          <PortalVerifyForm
            email={email}
            organizationId={organizationId}
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
      <PublicSiteFooter variant="portal" />
    </div>
  );
}
