"use client";

import { useState } from "react";
import { requestIntroAction } from "@/app/actions/marketplace";

export function FindIntroForm(props: {
  profileId: string;
  facilities: { id: string; name: string }[];
  defaultName?: string;
  defaultEmail?: string;
  defaultFacilityId?: string;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="mt-6 space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setStatus(null);
        const fd = new FormData(e.currentTarget);
        const result = await requestIntroAction({
          profileId: props.profileId,
          seekerName: String(fd.get("seekerName") || ""),
          seekerEmail: String(fd.get("seekerEmail") || ""),
          seekerPhone: String(fd.get("seekerPhone") || "") || undefined,
          facilityId: String(fd.get("facilityId") || "") || undefined,
          message: String(fd.get("message") || "") || undefined,
        });
        setPending(false);
        setStatus(result.ok ? "Intro sent. Check your email." : result.error);
      }}
    >
      <h2 className="font-medium">Request an intro</h2>
      <input
        name="seekerName"
        required
        defaultValue={props.defaultName || ""}
        placeholder="Your name"
        className="min-h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3"
      />
      <input
        name="seekerEmail"
        type="email"
        required
        defaultValue={props.defaultEmail || ""}
        placeholder="Email"
        className="min-h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3"
      />
      <input
        name="seekerPhone"
        placeholder="Phone (optional)"
        className="min-h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3"
      />
      {props.facilities.length > 0 ? (
        <select
          name="facilityId"
          defaultValue={props.defaultFacilityId || ""}
          className="min-h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3"
        >
          <option value="">No specific gym</option>
          {props.facilities.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      ) : null}
      <textarea
        name="message"
        placeholder="When and where you want to train"
        className="min-h-24 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2"
      />
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded-lg bg-emerald-800 px-4 text-sm font-semibold text-stone-50 disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send intro"}
      </button>
      {status ? <p className="text-sm text-zinc-400">{status}</p> : null}
    </form>
  );
}
