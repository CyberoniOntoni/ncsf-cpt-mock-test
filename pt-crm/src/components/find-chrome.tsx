import Link from "next/link";
import { logoutSeekerAction } from "@/app/actions/marketplace-seeker";
import { optionalSeekerSession } from "@/lib/seeker-auth";

export async function FindChrome() {
  const seeker = await optionalSeekerSession();
  return (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-4">
      <nav className="flex flex-wrap items-center gap-3 text-sm">
        <Link href="/find" className="font-medium text-emerald-400">
          Find a trainer
        </Link>
        <Link href="/marketing" className="text-zinc-500 hover:text-zinc-300">
          For trainers
        </Link>
      </nav>
      <div className="flex items-center gap-2 text-sm">
        {seeker ? (
          <>
            <Link href="/find/account" className="text-zinc-200 hover:text-white">
              {seeker.firstName} · Account
            </Link>
            <form action={logoutSeekerAction}>
              <button type="submit" className="text-zinc-500 hover:text-zinc-300">
                Log out
              </button>
            </form>
          </>
        ) : (
          <>
            <Link href="/find/login" className="text-zinc-300 hover:text-white">
              Log in
            </Link>
            <Link
              href="/find/register"
              className="rounded-lg bg-emerald-800 px-3 py-1.5 font-semibold text-stone-50"
            >
              Create account
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
