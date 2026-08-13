"use client";

import { useState } from "react";
import {
  saveMarketplaceListingAction,
  startPlatformCheckoutAction,
} from "@/app/actions/marketplace-trainer";

type Profile = {
  id: string;
  headline: string;
  bio: string;
  specialties: string;
  hourlyRateCents: number | null;
  city: string;
  lat: number | null;
  lng: number | null;
  radiusKm: number;
  published: boolean;
  featuredUntil: Date | null;
  facilityIds: string[];
  serviceModes: string;
};

export function MarketplaceListingForm(props: {
  profile: Profile | null;
  gyms: { id: string; name: string; slug: string }[];
}) {
  const p = props.profile;
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        const fd = new FormData(e.currentTarget);
        const facilityIds = fd.getAll("facilityIds").map(String);
        const rateRaw = String(fd.get("hourlyRate") || "").trim();
        const result = await saveMarketplaceListingAction({
          headline: String(fd.get("headline") || ""),
          bio: String(fd.get("bio") || ""),
          specialties: String(fd.get("specialties") || ""),
          hourlyRateCents: rateRaw ? Math.round(Number(rateRaw) * 100) : null,
          city: String(fd.get("city") || ""),
          lat: fd.get("lat") ? Number(fd.get("lat")) : null,
          lng: fd.get("lng") ? Number(fd.get("lng")) : null,
          radiusKm: Number(fd.get("radiusKm") || 15),
          published: fd.get("published") === "on",
          facilityIds,
          serviceModes: String(fd.get("serviceModes") || "studio,at_gym"),
        });
        setPending(false);
        setMsg(result.ok ? "Listing saved." : result.error);
      }}
    >
      <h2 className="font-medium">Find a trainer listing</h2>
      <p className="text-xs text-zinc-500">
        Opt in to appear on /find. FloorScribe introduces you. Session payments
        stay between you and the client.
      </p>
      <input
        name="headline"
        defaultValue={p?.headline || ""}
        placeholder="Headline"
        className="min-h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3"
      />
      <textarea
        name="bio"
        defaultValue={p?.bio || ""}
        placeholder="Bio"
        className="min-h-24 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2"
      />
      <input
        name="specialties"
        defaultValue={p?.specialties || ""}
        placeholder="Specialties (comma-separated)"
        className="min-h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3"
      />
      <input
        name="city"
        defaultValue={p?.city || ""}
        placeholder="City"
        className="min-h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          name="lat"
          defaultValue={p?.lat ?? ""}
          placeholder="Lat"
          className="min-h-11 rounded-lg border border-zinc-800 bg-zinc-950 px-3"
        />
        <input
          name="lng"
          defaultValue={p?.lng ?? ""}
          placeholder="Lng"
          className="min-h-11 rounded-lg border border-zinc-800 bg-zinc-950 px-3"
        />
      </div>
      <input
        name="hourlyRate"
        defaultValue={p?.hourlyRateCents != null ? p.hourlyRateCents / 100 : ""}
        placeholder="Hourly rate"
        className="min-h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3"
      />
      <input
        name="radiusKm"
        type="number"
        defaultValue={p?.radiusKm ?? 15}
        className="min-h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3"
      />
      <input
        name="serviceModes"
        defaultValue={p?.serviceModes || "studio,at_gym"}
        className="min-h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3"
      />
      <fieldset className="space-y-1 text-sm">
        <legend className="text-zinc-500">Gyms you train at</legend>
        {props.gyms.map((g) => (
          <label key={g.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              name="facilityIds"
              value={g.id}
              defaultChecked={p?.facilityIds.includes(g.id)}
            />
            {g.name}
          </label>
        ))}
      </fieldset>
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
          {pending ? "Saving…" : "Save listing"}
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
          Feature for $29/mo
        </button>
      </div>
      {msg ? <p className="text-sm text-zinc-400">{msg}</p> : null}
    </form>
  );
}
