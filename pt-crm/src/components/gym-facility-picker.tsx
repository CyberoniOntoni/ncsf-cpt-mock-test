"use client";

import { useMemo, useState } from "react";
import {
  INDEPENDENT_NETWORK,
  gymNetworkOf,
  gymOutletLabel,
  gymsInNetwork,
  listGymNetworks,
} from "@/lib/marketplace/gym-catalog";

export type PickerGym = {
  id: string;
  name: string;
  slug: string;
  brand: string | null;
  independent?: boolean;
};

const MAX_GYMS = 8;

export function GymFacilityPicker(props: {
  gyms: PickerGym[];
  selectedIds: string[];
  onChange?: (ids: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>(props.selectedIds);
  const [network, setNetwork] = useState("");
  const [gymId, setGymId] = useState("");
  const [query, setQuery] = useState("");

  const byId = useMemo(
    () => new Map(props.gyms.map((g) => [g.id, g])),
    [props.gyms]
  );
  const networks = useMemo(() => listGymNetworks(props.gyms), [props.gyms]);

  const gymOptions = useMemo(() => {
    if (!network) return [];
    let list = gymsInNetwork(props.gyms, network);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          gymOutletLabel(g).toLowerCase().includes(q) ||
          (g.brand || "").toLowerCase().includes(q)
      );
    }
    return list
      .filter((g) => !selected.includes(g.id))
      .slice()
      .sort((a, b) => {
        if (network === INDEPENDENT_NETWORK) {
          return a.name.localeCompare(b.name);
        }
        return gymOutletLabel(a).localeCompare(gymOutletLabel(b));
      });
  }, [props.gyms, network, query, selected]);

  function commit(next: string[]) {
    setSelected(next);
    props.onChange?.(next);
  }

  function addGym() {
    if (!gymId || selected.includes(gymId) || selected.length >= MAX_GYMS) {
      return;
    }
    commit([...selected, gymId]);
    setGymId("");
    setQuery("");
  }

  function removeGym(id: string) {
    commit(selected.filter((x) => x !== id));
  }

  return (
    <div className="space-y-2 text-sm">
      <p className="text-zinc-500">Gyms you train at</p>
      <p className="text-xs text-zinc-600">
        Network, then branch. Boutiques are under {INDEPENDENT_NETWORK}. Max{" "}
        {MAX_GYMS}.
      </p>
      {selected.map((id) => (
        <input key={id} type="hidden" name="facilityIds" value={id} />
      ))}
      {selected.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {selected.map((id) => {
            const g = byId.get(id);
            const net = g ? gymNetworkOf(g) : "";
            return (
              <li
                key={id}
                className="flex min-h-11 items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3"
              >
                <span>
                  {g?.name || id}
                  {net && net !== g?.name ? (
                    <span className="ml-1 text-xs text-zinc-500">{net}</span>
                  ) : null}
                </span>
                <button
                  type="button"
                  className="text-zinc-500 hover:text-zinc-200"
                  onClick={() => removeGym(id)}
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-zinc-600">No gyms added yet.</p>
      )}
      {selected.length < MAX_GYMS ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block text-zinc-500">
            Gym network
            <select
              className="mt-1 min-h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-zinc-100"
              value={network}
              onChange={(e) => {
                setNetwork(e.target.value);
                setGymId("");
                setQuery("");
              }}
            >
              <option value="">Choose a network</option>
              {networks.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-zinc-500">
            Gym
            <select
              className="mt-1 min-h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-zinc-100"
              value={gymId}
              onChange={(e) => setGymId(e.target.value)}
              disabled={!network}
            >
              <option value="">
                {network
                  ? gymOptions.length
                    ? "Choose a gym"
                    : "No matching gyms"
                  : "Pick a network first"}
              </option>
              {gymOptions.map((g) => (
                <option key={g.id} value={g.id}>
                  {network === INDEPENDENT_NETWORK
                    ? g.name
                    : gymOutletLabel(g)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-zinc-500 sm:col-span-2">
            Filter gyms
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                network === INDEPENDENT_NETWORK
                  ? "Filter by studio name"
                  : "Filter by branch, e.g. Tampines"
              }
              className="mt-1 min-h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-zinc-100"
              disabled={!network}
            />
          </label>
          <button
            type="button"
            className="min-h-11 rounded-lg border border-zinc-700 px-4 text-zinc-200 disabled:opacity-40"
            disabled={!gymId}
            onClick={addGym}
          >
            Add gym
          </button>
        </div>
      ) : (
        <p className="text-xs text-zinc-600">Maximum of {MAX_GYMS} gyms.</p>
      )}
    </div>
  );
}
