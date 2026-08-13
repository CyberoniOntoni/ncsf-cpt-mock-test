"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Gym = { id: string; name: string; slug: string; city: string; brand: string | null };

export function FindSearch(props: {
  gyms: Gym[];
  gym?: string;
  lat?: string;
  lng?: string;
  radius?: string;
}) {
  const router = useRouter();
  const [gym, setGym] = useState(props.gym || "");
  const [radius, setRadius] = useState(props.radius || "15");
  const [geoError, setGeoError] = useState<string | null>(null);

  function go(extra?: { lat?: string; lng?: string }) {
    const q = new URLSearchParams();
    if (gym) q.set("gym", gym);
    if (radius) q.set("radius", radius);
    if (extra?.lat) q.set("lat", extra.lat);
    else if (props.lat) q.set("lat", props.lat);
    if (extra?.lng) q.set("lng", extra.lng);
    else if (props.lng) q.set("lng", props.lng);
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
      <label className="flex w-28 flex-col gap-1 text-sm">
        <span className="text-zinc-500">Radius km</span>
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
      <button
        type="button"
        className="min-h-11 rounded-lg border border-zinc-700 px-4 text-sm"
        onClick={() => {
          setGeoError(null);
          if (!navigator.geolocation) {
            setGeoError("Location is not available in this browser.");
            return;
          }
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              go({
                lat: String(pos.coords.latitude),
                lng: String(pos.coords.longitude),
              });
            },
            () => setGeoError("Could not read location. Search by gym instead.")
          );
        }}
      >
        Use my location
      </button>
      {geoError ? <p className="w-full text-sm text-amber-400">{geoError}</p> : null}
    </form>
  );
}
