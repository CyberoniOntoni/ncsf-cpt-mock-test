"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TRAINING_AREAS } from "@/lib/marketplace/areas";
import {
  INDEPENDENT_NETWORK,
  gymOutletLabel,
  gymsInNetwork,
} from "@/lib/marketplace/gym-catalog";

type Gym = {
  id: string;
  name: string;
  slug: string;
  city: string;
  brand: string | null;
  independent?: boolean;
};

export function FindSearch(props: {
  gyms: Gym[];
  brands: string[];
  gym?: string;
  brand?: string;
  area?: string;
  radius?: string;
}) {
  const router = useRouter();
  const [gym, setGym] = useState(props.gym || "");
  const [brand, setBrand] = useState(props.brand || "");
  const [area, setArea] = useState(props.area || "");
  const [radius, setRadius] = useState(props.radius || "15");
  const gymChoices = useMemo(() => {
    const list = gymsInNetwork(props.gyms, brand);
    return list.slice().sort((a, b) => {
      if (brand === INDEPENDENT_NETWORK) return a.name.localeCompare(b.name);
      return gymOutletLabel(a).localeCompare(gymOutletLabel(b));
    });
  }, [props.gyms, brand]);

  function go() {
    const q = new URLSearchParams();
    q.set("gym", gym);
    q.set("brand", brand);
    q.set("area", area);
    if (radius) q.set("radius", radius);
    router.push(`/portal/find?${q.toString()}`);
  }

  return (
    <form
      className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        go();
      }}
    >
      <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-sm">
        <span className="text-zinc-500">Area</span>
        <select
          className="min-h-11 rounded-lg border border-zinc-800 bg-zinc-950 px-3"
          value={area}
          onChange={(e) => setArea(e.target.value)}
        >
          <option value="">Any area</option>
          {TRAINING_AREAS.map((a) => (
            <option key={a.slug} value={a.slug}>
              {a.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-sm">
        <span className="text-zinc-500">Gym network</span>
        <select
          className="min-h-11 rounded-lg border border-zinc-800 bg-zinc-950 px-3"
          value={brand}
          onChange={(e) => {
            setBrand(e.target.value);
            setGym("");
          }}
        >
          <option value="">Any network</option>
          {props.brands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </label>
      <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-sm">
        <span className="text-zinc-500">Gym</span>
        <select
          className="min-h-11 rounded-lg border border-zinc-800 bg-zinc-950 px-3"
          value={gym}
          onChange={(e) => setGym(e.target.value)}
        >
          <option value="">
            {brand ? "Any gym in this network" : "Any gym"}
          </option>
          {gymChoices.map((g) => (
            <option key={g.id} value={g.id}>
              {brand && brand !== INDEPENDENT_NETWORK
                ? gymOutletLabel(g)
                : g.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex w-28 flex-col gap-1 text-sm">
        <span className="text-zinc-500">Within km</span>
        <input
          className="min-h-11 rounded-lg border border-zinc-800 bg-zinc-950 px-3"
          type="number"
          min={5}
          max={80}
          value={radius}
          onChange={(e) => setRadius(e.target.value)}
        />
      </label>
      <button
        type="submit"
        className="min-h-11 rounded-lg bg-emerald-800 px-4 text-sm font-semibold text-stone-50"
      >
        Search
      </button>
    </form>
  );
}
