"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { TRAINING_AREAS } from "@/lib/marketplace/areas";

type Gym = { id: string; name: string; slug: string; city: string; brand: string | null };

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

  function go() {
    const q = new URLSearchParams();
    q.set("gym", gym);
    q.set("brand", brand);
    q.set("area", area);
    if (radius) q.set("radius", radius);
    router.push(`/find?${q.toString()}`);
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
      <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-sm">
        <span className="text-zinc-500">Gym</span>
        <select
          className="min-h-11 rounded-lg border border-zinc-800 bg-zinc-950 px-3"
          value={gym}
          onChange={(e) => setGym(e.target.value)}
        >
          <option value="">Any gym</option>
          {props.gyms.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-sm">
        <span className="text-zinc-500">Gym network</span>
        <select
          className="min-h-11 rounded-lg border border-zinc-800 bg-zinc-950 px-3"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
        >
          <option value="">Any network</option>
          {props.brands.map((b) => (
            <option key={b} value={b}>
              {b}
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
