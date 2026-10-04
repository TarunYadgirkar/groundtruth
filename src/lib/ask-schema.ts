import { z } from "zod";

const IsoDayInRange = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((d) => !Number.isNaN(Date.parse(`${d}T00:00:00Z`)) && d >= "2024-01-01" && d <= "2028-01-01");
export const SafeText = (max: number) => z.string().max(max).regex(/^[\p{L}\p{N} .,'#&/-]*$/u);

export const UiAction = z.union([
  z.object({ type: z.literal("HIGHLIGHT_RULE"), rule_id: z.string() }),
  z.object({ type: z.literal("SET_AS_OF"), date: z.string().describe("ISO date YYYY-MM-DD between 2024-01-01 and 2028-01-01") }),
]);

export const AskAnswer = z.object({
  answer: z.string().describe("Plain-language answer, at most 90 words, grounded only in the supplied rules."),
  cited_rule_ids: z.array(z.string()),
  ui_actions: z.array(UiAction),
});

export type AskAnswer = z.infer<typeof AskAnswer>;
export type UiAction = z.infer<typeof UiAction>;

const AddressInput = z.object({
  address_id: z.string().max(80),
  street_address: SafeText(200),
  postal_city: SafeText(80),
  state: z.enum(["CA", "NJ", "MA"]),
  zip: SafeText(12),
  year_built: z.number().int().min(1600).max(2030).nullable(),
  units: z.number().int().min(1).max(5000).nullable(),
  use_code: z.string().max(40),
  use_description: z.string().max(120),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  legal_city: SafeText(80).nullable(),
  county: SafeText(80).nullable(),
  geocode_match: z.string().max(40).nullable(),
});

export const AskRequest = z.object({
  question: z.string().trim().min(3).max(500),
  asOf: IsoDayInRange,
  address_id: z.string().max(80).optional(),
  live_address: AddressInput.optional(),
});

export const isIsoDayInRange = (d: string) => IsoDayInRange.safeParse(d).success;

export type AskRequest = z.infer<typeof AskRequest>;
