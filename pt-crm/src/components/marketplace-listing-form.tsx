"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  saveMarketplaceListingAction,
  startPlatformCheckoutAction,
} from "@/app/actions/marketplace-trainer";
import { GymFacilityPicker } from "@/components/gym-facility-picker";
import { FindTrainerMeta } from "@/components/find-trainer-meta";
import { findTrainingArea, TRAINING_AREAS } from "@/lib/marketplace/areas";
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

type Gym = {
  id: string;
  name: string;
  slug: string;
  brand: string | null;
  independent?: boolean;
};

export function MarketplaceListingForm(props: {
  profile: Profile | null;
  gyms: Gym[];
  dueIntroCharges?: { id: string; amountCents: number }[];
  defaultCredentials?: string;
}) {
  const p = props.profile;
  const dueIntroCharges = props.dueIntroCharges ?? [];
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [credentials, setCredentials] = useState(
    p?.credentials || props.defaultCredentials || ""
  );
  const [headline, setHeadline] = useState(p?.headline || "");
  const [bio, setBio] = useState(p?.bio || "");
  const [area, setArea] = useState(p?.preferredArea || "");
  const [facilityIds, setFacilityIds] = useState(p?.facilityIds ?? []);
  const [modes, setModes] = useState(
    () => new Set(parseCsvSlugs(p?.serviceModes || "studio,at_gym"))
  );
  const [specs, setSpecs] = useState(
    () => new Set(parseCsvSlugs(p?.specialties))
  );
  const [currency, setCurrency] = useState(p?.currency || "SGD");
  const [hourly, setHourly] = useState(
    p?.hourlyRateCents != null ? String(p.hourlyRateCents / 100) : ""
  );
  const [session, setSession] = useState(
    p?.sessionRateCents != null ? String(p.sessionRateCents / 100) : ""
  );
  const [published, setPublished] = useState(!!p?.published);

  const gymById = useMemo(
    () => new Map(props.gyms.map((g) => [g.id, g])),
    [props.gyms]
  );
  const areaRow = findTrainingArea(area);
  const facilityNames = facilityIds
    .map((id) => gymById.get(id)?.name)
    .filter((n): n is string => !!n);

  function toggle(set: Set<string>, slug: string, on: boolean) {
    const next = new Set(set);
    if (on) next.add(slug);
    else next.delete(slug);
    return next;
  }

  return (
    <form
      className="space-y-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        const result = await saveMarketplaceListingAction({
          headline,
          bio,
          credentials,
          specialties: [...specs].join(","),
          hourlyRateCents: hourly.trim()
            ? Math.round(Number(hourly) * 100)
            : null,
          sessionRateCents: session.trim()
            ? Math.round(Number(session) * 100)
            : null,
          currency,
          preferredArea: area || null,
          radiusKm: Number(
            (e.currentTarget.elements.namedItem("radiusKm") as HTMLInputElement)
              ?.value || 15
          ),
          published,
          facilityIds,
          serviceModes: [...modes].join(",") || "studio",
        });
        setPending(false);
        setMsg(result.ok ? "Trainer card saved." : result.error);
      }}
    >
      <section className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Preview
          </p>
          <Link href="/find" className="text-xs text-emerald-400 hover:underline">
            Open Find a trainer
          </Link>
        </div>
        <h2 className="mt-2 font-medium">
          {headline.trim() || "Your headline"}
        </h2>
        {bio.trim() ? (
          <p className="mt-1 line-clamp-3 text-sm text-zinc-400">{bio}</p>
        ) : (
          <p className="mt-1 text-sm text-zinc-600">
            Add a short bio so clients know how you coach.
          </p>
        )}
        <FindTrainerMeta
          credentials={credentials}
          region={areaRow?.label}
          city={areaRow?.city}
          facilityNames={facilityNames}
          specialties={[...specs]}
          serviceModes={[...modes]}
          hourlyRateCents={hourly.trim() ? Math.round(Number(hourly) * 100) : null}
          sessionRateCents={
            session.trim() ? Math.round(Number(session) * 100) : null
          }
          currency={currency}
        />
        <p className="mt-2 text-xs text-zinc-600">
          {published
            ? "This card is live on Find a trainer."
            : "Hidden until you turn on “Show me on Find a trainer”."}
        </p>
      </section>

      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Credentials
        </legend>
        <label className="block text-sm text-zinc-500">
          Certifications
          <input
            name="credentials"
            value={credentials}
            onChange={(e) => setCredentials(e.target.value)}
            placeholder="e.g. NCSF-CPT, CSCS"
            className="mt-1 min-h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-zinc-100"
          />
        </label>
        <label className="block text-sm text-zinc-500">
          Headline
          <input
            name="headline"
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            placeholder="Required to publish"
            className="mt-1 min-h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-zinc-100"
          />
        </label>
        <label className="block text-sm text-zinc-500">
          How you coach
          <textarea
            name="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            placeholder="Who you work with and how sessions run"
            className="mt-1 min-h-24 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100"
          />
        </label>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Where you train
        </legend>
        <label className="block text-sm text-zinc-500">
          Primary area
          <select
            name="preferredArea"
            value={area}
            onChange={(e) => setArea(e.target.value)}
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
        {props.gyms.length === 0 ? (
          <p className="text-sm text-zinc-500">No gyms in the directory yet.</p>
        ) : (
          <GymFacilityPicker
            gyms={props.gyms}
            selectedIds={facilityIds}
            onChange={setFacilityIds}
          />
        )}
        <div>
          <p className="text-sm text-zinc-500">How you train</p>
          <div className="mt-1 flex flex-wrap gap-3 text-sm">
            {MARKETPLACE_SERVICE_MODES.map((m) => (
              <label key={m.slug} className="flex min-h-11 items-center gap-2">
                <input
                  type="checkbox"
                  name="serviceModes"
                  value={m.slug}
                  checked={modes.has(m.slug)}
                  onChange={(e) =>
                    setModes(toggle(modes, m.slug, e.target.checked))
                  }
                />
                {m.label}
              </label>
            ))}
          </div>
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
                checked={specs.has(s.slug)}
                onChange={(e) =>
                  setSpecs(toggle(specs, s.slug, e.target.checked))
                }
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
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
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
              value={hourly}
              onChange={(e) => setHourly(e.target.value)}
              placeholder="120"
              className="mt-1 min-h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-zinc-100"
            />
          </label>
          <label className="text-sm text-zinc-500">
            Per session
            <input
              name="sessionRate"
              inputMode="decimal"
              value={session}
              onChange={(e) => setSession(e.target.value)}
              placeholder="150"
              className="mt-1 min-h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-zinc-100"
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Visibility
        </legend>
        {dueIntroCharges.length >= MAX_UNPAID_INTRO_CHARGES ? (
          <p className="text-sm text-amber-400">
            Find a trainer is hiding your card until unpaid intro fees are
            settled. Pay below or in{" "}
            <Link href="/intros" className="underline">
              Intros
            </Link>
            .
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
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="published"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
          />
          Show me on Find a trainer
        </label>
        {p?.featuredUntil ? (
          <p className="text-xs text-emerald-500">
            Featured until {new Date(p.featuredUntil).toLocaleDateString()}
          </p>
        ) : (
          <p className="text-xs text-zinc-600">
            Featured cards sort first on Find a trainer.
          </p>
        )}
      </fieldset>

      <div className="flex flex-wrap items-center gap-2">
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
        <Link
          href="/intros"
          className="inline-flex min-h-11 items-center px-2 text-sm text-zinc-400 hover:text-zinc-200"
        >
          Intros
        </Link>
      </div>
      {msg ? <p className="text-sm text-zinc-400">{msg}</p> : null}
    </form>
  );
}
