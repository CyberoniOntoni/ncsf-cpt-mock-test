export type ServiceMode = "in_home" | "at_gym" | "online" | "studio";
export type IntroStatus = "pending" | "accepted" | "declined" | "expired";
export type ChargeKind = "intro_accept" | "featured_month";
export type ChargeStatus = "due" | "paid" | "waived";

export const INTRO_FEE_CENTS = 1900;
export const FEATURED_FEE_CENTS = 2900;
export const FREE_INTROS_PER_ORG = 3;
export const MAX_UNPAID_INTRO_CHARGES = 2;
export const INTROS_PER_EMAIL_PER_DAY = 3;
export const DEFAULT_RADIUS_KM = 15;
export const FEATURED_DAYS = 30;
