"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { saveSeekerPrefsAction } from "@/app/actions/marketplace-seeker";
import { TRAINING_AREAS } from "@/lib/marketplace/areas";
import {
  INDEPENDENT_NETWORK,
  gymOutletLabel,
  gymsInNetwork,
} from "@/lib/marketplace/gym-catalog";
import type { SeekerPublic } from "@/lib/seeker-auth";

export function SeekerAccountForms(props: {
  seeker: SeekerPublic;
  gyms: {
    id: string;
    name: string;
    slug?: string;
    brand: string | null;
    independent?: boolean;
  }[];
  brands: string[];
  setup?: boolean;
}) {
  const s = props.seeker;
  const router = useRouter();
  const [prefMsg, setPrefMsg] = useState<string | null>(null);
  const [brand, setBrand] = useState(s.preferredBrand || "");
  const [facilityId, setFacilityId] = useState(s.preferredFacilityId || "");
  const gymChoices = useMemo(() => {
    const withSlug = props.gyms.map((g) => ({
      ...g,
      slug: g.slug || g.id,
    }));
    const list = gymsInNetwork(withSlug, brand);
    return list.slice().sort((a, b) => {
      if (brand === INDEPENDENT_NETWORK) return a.name.localeCompare(b.name);
      return gymOutletLabel(a).localeCompare(gymOutletLabel(b));
    });
  }, [props.gyms, brand]);

  return (
    <form
      className="space-y-3 rounded-xl border border-zinc-800 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const result = await saveSeekerPrefsAction({
          preferredArea: String(fd.get("preferredArea") || ""),
          radiusKm: Number(fd.get("radiusKm") || 15),
          preferredFacilityId: String(fd.get("preferredFacilityId") || ""),
          preferredBrand: String(fd.get("preferredBrand") || ""),
        });
        if (!result.ok) {
          setPrefMsg(result.error);
          return;
        }
        setPrefMsg("Profile saved.");
        if (props.setup) router.replace("/portal/profile");
      }}
    >
      <h2 className="font-medium">Where you train</h2>
      <label className="block text-sm text-zinc-500">
        Area
        <select
          name="preferredArea"
          required
          defaultValue={s.preferredArea || ""}
          className="mt-1 min-h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-zinc-100"
        >
          <option value="">Choose an area</option>
          {TRAINING_AREAS.map((a) => (
            <option key={a.slug} value={a.slug}>
              {a.label}, {a.city}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm text-zinc-500">
        Gym network
        <select
          name="preferredBrand"
          value={brand}
          onChange={(e) => {
            setBrand(e.target.value);
            setFacilityId("");
          }}
          className="mt-1 min-h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-zinc-100"
        >
          <option value="">No network</option>
          {props.brands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm text-zinc-500">
        Specific gym
        <select
          name="preferredFacilityId"
          value={facilityId}
          onChange={(e) => setFacilityId(e.target.value)}
          className="mt-1 min-h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-zinc-100"
        >
          <option value="">No specific gym</option>
          {gymChoices.map((g) => (
            <option key={g.id} value={g.id}>
              {brand && brand !== INDEPENDENT_NETWORK
                ? gymOutletLabel(g)
                : g.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm text-zinc-500">
        Search radius (km)
        <input
          name="radiusKm"
          type="number"
          min={5}
          max={80}
          defaultValue={s.radiusKm}
          className="mt-1 min-h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-zinc-100"
        />
      </label>
      <button
        type="submit"
        className="min-h-11 rounded-lg bg-emerald-800 px-4 text-sm font-semibold text-stone-50"
      >
        {props.setup ? "Save profile" : "Save training spots"}
      </button>
      {prefMsg ? <p className="text-sm text-zinc-400">{prefMsg}</p> : null}
    </form>
  );
}
