"use client";

import { useState } from "react";
import {
  saveMarketplaceListingAction,
  startPlatformCheckoutAction,
} from "@/app/actions/marketplace-trainer";
import { TRAINING_AREAS } from "@/lib/marketplace/areas";
import {
  MARKETPLACE_CURRENCIES,
  MARKETPLACE_SERVICE_MODES,
  MARKETPLACE_SPECIALTIES,
  parseCsvSlugs,
} from "@/lib/marketplace/specialties";
import { MAX_UNPAID_INTRO_CHARGES } from "@/lib/marketplace/types";

type Profile = {
  id: string;
  headline: string;
  bio: string;
  credentials: string;
  specialties: string;
  hourlyRateCents: number | null;
  sessionRateCents: number | null;
  currency: string;
  preferredArea: string | null;
  city: string;
  radiusKm: number;
  published: boolean;
  featuredUntil: Date | null;
  facilityIds: string[];
  serviceModes: string;
};

export function MarketplaceListingForm(props: {
  profile: Profile | null;
  gyms: { id: string; name: string; slug: string }[];
  dueIntroCharges?: { id: string; amountCents: number }[];
  defaultCredentials?: string;
}) {
  const p = props.profile;
  const dueIntroCharges = props.dueIntroCharges ?? [];
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const selectedSpecs = new Set(parseCsvSlugs(p?.specialties));
  const selectedModes = new Set(
    parseCsvSlugs(p?.serviceModes || "studio,at_gym")
  );

  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        const fd = new FormData(e.currentTarget);
        const facilityIds = fd.getAll("facilityIds").map(String);
        const specialties = fd.getAll("specialties").map(String).join(",");
        const serviceModes = fd.getAll("serviceModes").map(String).join(",");
        const hourlyRaw = String(fd.get("hourlyRate") || "").trim();
        const sessionRaw = String(fd.get("sessionRate") || "").trim();
        const result = await saveMarketplaceListingAction({
          headline: String(fd.get("headline") || ""),
          bio: String(fd.get("bio") || ""),
          credentials: String(fd.get("credentials") || ""),
          specialties,
          hourlyRateCents: hourlyRaw ? Math.round(Number(hourlyRaw) * 100) : null,
          sessionRateCents: sessionRaw
            ? Math.round(Number(sessionRaw) * 100)
            : null,
          currency: String(fd.get("currency") || "SGD"),
          preferredArea: String(fd.get("preferredArea") || "") || null,
          radiusKm: Number(fd.get("radiusKm") || 15),
          published: fd.get("published") === "on",
          facilityIds,
          serviceModes: serviceModes || "studio",
        });
        setPending(false);
        setMsg(result.ok ? "Trainer card saved." : result.error);
      }}
    >
      <div>
        <h2 className="font-medium">Your trainer card</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Credentials, where you train, specialties, and rates. This is what
          clients see on Find a trainer.
        </p>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Credentials
        </legend>
        <input
          name="credentials"
          defaultValue={p?.credentials || props.defaultCredentials || ""}
          placeholder="e.g. NCSF-CPT, CSCS"
          className="min-h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3"
        />
        <input
          name="headline"
          defaultValue={p?.headline || ""}
          placeholder="Short headline (required to publish)"
          className="min-h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3"
        />
        <textarea
          name="bio"
          defaultValue={p?.bio || ""}
          placeholder="How you coach"
          className="min-h-24 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2"
        />
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Where you train
        </legend>
        <label className="block text-sm text-zinc-500">
          Primary area
          <select
            name="preferredArea"
            defaultValue={p?.preferredArea || ""}
            className="mt-1 min-h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-zinc-100"
          >
            <option value="">No primary area</option>
            {TRAINING_AREAS.map((a) => (
              <option key={a.slug} value={a.slug}>
                {a.label}, {a.city}
              </option>
            ))}
          </select>
        </label>
        <div className="space-y-1 text-sm">
          <p className="text-zinc-500">Gyms</p>
          {props.gyms.length === 0 ? (
            <p className="text-zinc-500">No gyms in the directory yet.</p>
          ) : null}
          {props.gyms.map((g) => (
            <label key={g.id} className="flex min-h-11 items-center gap-2">
              <input
                type="checkbox"
                name="facilityIds"
                value={g.id}
                defaultChecked={p?.facilityIds.includes(g.id)}
              />
              {g.name}
            </label>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          {MARKETPLACE_SERVICE_MODES.map((m) => (
            <label key={m.slug} className="flex items-center gap-2">
              <input
                type="checkbox"
                name="serviceModes"
                value={m.slug}
                defaultChecked={selectedModes.has(m.slug)}
              />
              {m.label}
            </label>
          ))}
        </div>
        <label className="block text-sm text-zinc-500">
          Travel radius (km)
          <input
            name="radiusKm"
            type="number"
            min={5}
            max={80}
            defaultValue={p?.radiusKm ?? 15}
            className="mt-1 min-h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-zinc-100"
          />
        </label>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Specialties
        </legend>
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {MARKETPLACE_SPECIALTIES.map((s) => (
            <label key={s.slug} className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="specialties"
                value={s.slug}
                defaultChecked={selectedSpecs.has(s.slug)}
              />
              {s.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          What you charge
        </legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <label className="col-span-1 text-sm text-zinc-500">
            Currency
            <select
              name="currency"
              defaultValue={p?.currency || "SGD"}
              className="mt-1 min-h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-zinc-100"
            >
              {MARKETPLACE_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-zinc-500">
            Hourly
            <input
              name="hourlyRate"
              inputMode="decimal"
              defaultValue={
                p?.hourlyRateCents != null ? p.hourlyRateCents / 100 : ""
              }
              placeholder="120"
              className="mt-1 min-h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-zinc-100"
            />
          </label>
          <label className="text-sm text-zinc-500">
            Per session
            <input
              name="sessionRate"
              inputMode="decimal"
              defaultValue={
                p?.sessionRateCents != null ? p.sessionRateCents / 100 : ""
              }
              placeholder="150"
              className="mt-1 min-h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-zinc-100"
            />
          </label>
        </div>
      </fieldset>

      {dueIntroCharges.length >= MAX_UNPAID_INTRO_CHARGES ? (
        <p className="text-sm text-amber-400">
          Find a trainer is hiding your card until unpaid intro fees are settled.
        </p>
      ) : null}
      {dueIntroCharges.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {dueIntroCharges.map((c) => (
            <button
              key={c.id}
              type="button"
              className="min-h-11 rounded-lg border border-amber-800 px-4 text-sm text-amber-200"
              onClick={async () => {
                const r = await startPlatformCheckoutAction({
                  kind: "intro_accept",
                  chargeId: c.id,
                });
                if (r.ok) window.location.href = r.url;
                else setMsg(r.error);
              }}
            >
              Pay intro fee USD {(c.amountCents / 100).toFixed(0)}
            </button>
          ))}
        </div>
      ) : null}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="published" defaultChecked={!!p?.published} />
        Show me on Find a trainer
      </label>
      {p?.featuredUntil ? (
        <p className="text-xs text-emerald-500">
          Featured until {new Date(p.featuredUntil).toLocaleDateString()}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded-lg bg-emerald-800 px-4 text-sm font-semibold text-stone-50"
        >
          {pending ? "Saving…" : "Save trainer card"}
        </button>
        <button
          type="button"
          className="min-h-11 rounded-lg border border-zinc-700 px-4 text-sm"
          onClick={async () => {
            const r = await startPlatformCheckoutAction({
              kind: "featured_month",
            });
            if (r.ok) window.location.href = r.url;
            else setMsg(r.error);
          }}
        >
          Feature for USD 29/mo
        </button>
      </div>
      {msg ? <p className="text-sm text-zinc-400">{msg}</p> : null}
    </form>
  );
}
