import {
  FREE_INTROS_PER_ORG,
  INTRO_FEE_CENTS,
  MAX_UNPAID_INTRO_CHARGES,
} from "./types";

export function introFeeDecision(opts: {
  acceptedIntroCountForOrg: number;
  unpaidIntroCharges: number;
}): { action: "waive" | "charge" | "hide_listing"; amountCents: number } {
  if (opts.unpaidIntroCharges >= MAX_UNPAID_INTRO_CHARGES) {
    return { action: "hide_listing", amountCents: INTRO_FEE_CENTS };
  }
  if (opts.acceptedIntroCountForOrg < FREE_INTROS_PER_ORG) {
    return { action: "waive", amountCents: 0 };
  }
  return { action: "charge", amountCents: INTRO_FEE_CENTS };
}

export function listingVisibleInSearch(opts: {
  published: boolean;
  unpaidIntroCharges: number;
}): boolean {
  if (!opts.published) return false;
  return opts.unpaidIntroCharges < MAX_UNPAID_INTRO_CHARGES;
}
