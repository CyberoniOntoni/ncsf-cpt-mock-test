import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Building2, User } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { Card } from "@/components/ui";
import { SITE_COPY } from "@/lib/site/copy";

export const metadata: Metadata = {
  title: "Create account",
  description: "Join FloorScribe as an individual PT or create a studio team.",
};

export default function RegisterChooserPage() {
  return (
    <AuthShell
      title="How will you use FloorScribe?"
      subtitle={SITE_COPY.heroEyebrow}
    >
      <div className="space-y-3">
        <Link
          href="/register/solo"
          className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
        >
          <Card className="border-zinc-800/80 p-4 transition group-hover:border-emerald-800/50 group-hover:bg-emerald-950/15">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-emerald-900/40 bg-emerald-950/40 text-emerald-400">
                <User className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-zinc-100">
                    Individual PT
                  </h2>
                  <ArrowRight
                    className="h-4 w-4 shrink-0 text-zinc-600 transition group-hover:translate-x-0.5 group-hover:text-emerald-400"
                    aria-hidden
                  />
                </div>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                  Solo practice. You own your clients and run the floor yourself.
                  Join a studio later with an invite if you need to.
                </p>
              </div>
            </div>
          </Card>
        </Link>
        <Link
          href="/register/studio"
          className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
        >
          <Card className="border-zinc-800/80 p-4 transition group-hover:border-emerald-800/50 group-hover:bg-emerald-950/15">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-emerald-900/40 bg-emerald-950/40 text-emerald-400">
                <Building2 className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-zinc-100">
                    Studio / team
                  </h2>
                  <ArrowRight
                    className="h-4 w-4 shrink-0 text-zinc-600 transition group-hover:translate-x-0.5 group-hover:text-emerald-400"
                    aria-hidden
                  />
                </div>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                  Multi-trainer studio. You’re the owner — invite PTs from
                  Settings after signup.
                </p>
              </div>
            </div>
          </Card>
        </Link>
      </div>
      <p className="mt-6 text-center text-xs leading-relaxed text-zinc-600">
        Already invited? Open the link from your studio owner.
        <br className="sm:hidden" />
        {" "}
        <Link href="/login" className="text-emerald-400 hover:underline">
          Sign in
        </Link>
        {" · "}
        <Link href="/marketing" className="text-zinc-500 hover:text-zinc-300">
          About FloorScribe
        </Link>
      </p>
    </AuthShell>
  );
}
