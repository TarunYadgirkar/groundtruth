import type { Address, Category, LookupResult } from "./types";

export const DEFAULT_AS_OF = "2026-10-01";
export const SLIDER_MIN = "2024-01-01";
export const SLIDER_MAX = "2028-01-01";
export const TEST_DATES = ["2025-12-31", "2026-01-02", "2027-07-02"] as const;

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: "rent_increase_limits", label: "Rent increase limits" },
  { id: "just_cause_eviction", label: "Just-cause eviction" },
  { id: "security_deposits", label: "Security deposits" },
  { id: "application_screening_fees", label: "Application and screening fees" },
  { id: "screening_restrictions", label: "Tenant screening restrictions" },
  { id: "algorithmic_rent_setting", label: "Algorithmic rent setting" },
];

export const STATUS_ORDER: LookupResult[] = ["applies", "unknown", "not_yet_effective", "superseded", "pending"];

export const STATUS_LABEL: Record<LookupResult, string> = {
  applies: "Applies",
  unknown: "Unknown",
  superseded: "Superseded",
  not_yet_effective: "Not yet in effect",
  pending: "Pending bill",
};

export const STATE_NAME: Record<Address["state"], string> = {
  CA: "California",
  NJ: "New Jersey",
  MA: "Massachusetts",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

const DAY_MS = 86_400_000;

export function isoToDay(iso: string): number {
  return Math.round(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);
}

export function dayToIso(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

export function cityLine(a: Address): string {
  return `${a.legal_city ?? a.postal_city}, ${a.state} ${a.zip}`.trim();
}
