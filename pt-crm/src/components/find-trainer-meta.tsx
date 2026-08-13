import { formatMoney } from "@/lib/money";
import {
  MARKETPLACE_SERVICE_MODES,
  specialtyLabel,
} from "@/lib/marketplace/specialties";

export function FindTrainerMeta(props: {
  credentials?: string | null;
  title?: string | null;
  region?: string | null;
  city?: string | null;
  facilityNames?: string[];
  specialties?: string[];
  serviceModes?: string[];
  hourlyRateCents?: number | null;
  sessionRateCents?: number | null;
  currency?: string;
}) {
  const creds = props.credentials || props.title;
  const place = [props.region, props.city].filter(Boolean).join(" · ");
  const gyms = (props.facilityNames || []).join(", ");
  const specs = (props.specialties || []).map(specialtyLabel).join(" · ");
  const modes = (props.serviceModes || [])
    .map((s) => MARKETPLACE_SERVICE_MODES.find((m) => m.slug === s)?.label || s)
    .join(" · ");
  const rates = [
    props.hourlyRateCents != null
      ? `${formatMoney(props.hourlyRateCents, props.currency || "SGD", { compact: true })}/hr`
      : null,
    props.sessionRateCents != null
      ? `${formatMoney(props.sessionRateCents, props.currency || "SGD", { compact: true })}/session`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mt-1 space-y-0.5 text-xs text-zinc-500">
      {creds ? <p className="text-zinc-400">{creds}</p> : null}
      {place || gyms ? <p>{[place, gyms].filter(Boolean).join(" · ")}</p> : null}
      {specs ? <p>{specs}</p> : null}
      {modes ? <p>{modes}</p> : null}
      {rates ? <p className="text-zinc-300">{rates}</p> : null}
    </div>
  );
}
