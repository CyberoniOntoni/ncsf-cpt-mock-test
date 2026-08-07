import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { nanoid } from "nanoid";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function id(prefix?: string) {
  return prefix ? `${prefix}_${nanoid(12)}` : nanoid(16);
}

export function fullName(first: string, last?: string | null) {
  return [first, last].filter(Boolean).join(" ").trim();
}

export function clientSearchHaystack(c: {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  tags?: string | null;
  goals?: string | null;
  injuries?: string | null;
}) {
  return [c.firstName, c.lastName, c.email, c.phone, c.tags, c.goals, c.injuries]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}
