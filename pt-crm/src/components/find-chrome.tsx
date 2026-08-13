import Link from "next/link";
import { logoutSeekerAction } from "@/app/actions/marketplace-seeker";
import { PublicSiteHeader } from "@/components/public-site-header";
import { optionalSeekerSession } from "@/lib/seeker-auth";

export async function FindChrome() {
  const seeker = await optionalSeekerSession();
  return (
    <PublicSiteHeader
      variant="find"
      scrolled
      trailing={
        seeker ? (
          <div className="flex items-center gap-2">
            <Link
              href="/find/account"
              className="inline-flex min-h-11 items-center rounded-lg px-2.5 text-sm text-stone-200 hover:text-white"
            >
              {seeker.firstName} · Account
            </Link>
            <form action={logoutSeekerAction}>
              <button
                type="submit"
                className="inline-flex min-h-11 items-center rounded-lg px-2.5 text-sm text-stone-500 hover:text-stone-300"
              >
                Log out
              </button>
            </form>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              href="/find/login"
              className="inline-flex min-h-11 items-center rounded-lg px-2.5 text-sm text-stone-300 hover:text-white"
            >
              Log in
            </Link>
            <Link
              href="/find/register"
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-emerald-800 px-3.5 text-sm font-semibold text-stone-50"
            >
              Create account
            </Link>
          </div>
        )
      }
    />
  );
}
