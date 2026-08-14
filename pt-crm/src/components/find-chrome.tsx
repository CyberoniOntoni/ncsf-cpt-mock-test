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
          <div className="flex items-center gap-1.5">
            <Link
              href="/find/account"
              className="inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-medium text-stone-300 hover:bg-stone-900/70 hover:text-stone-50"
            >
              {seeker.firstName}
            </Link>
            <form action={logoutSeekerAction}>
              <button
                type="submit"
                className="inline-flex min-h-10 items-center rounded-lg px-3 text-sm text-stone-500 hover:bg-stone-900/70 hover:text-stone-300"
              >
                Log out
              </button>
            </form>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <Link
              href="/find/login"
              className="hidden min-h-10 items-center rounded-lg px-3 text-sm font-medium text-stone-400 hover:bg-stone-900/70 hover:text-stone-100 sm:inline-flex"
            >
              Log in
            </Link>
            <Link
              href="/find/register"
              className="inline-flex min-h-10 items-center justify-center rounded-xl bg-emerald-800 px-3.5 text-sm font-semibold text-stone-50 hover:bg-emerald-700"
            >
              Create account
            </Link>
          </div>
        )
      }
    />
  );
}
