import { z } from "zod";

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
  street_address: z.string().max(200),
  postal_city: z.string().max(80),
  state: z.enum(["CA", "NJ", "MA"]),
  zip: z.string().max(12),
  year_built: z.number().int().nullable(),
  units: z.number().int().nullable(),
  use_code: z.string().max(40),
  use_description: z.string().max(120),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  legal_city: z.string().max(80).nullable(),
  county: z.string().max(80).nullable(),
  geocode_match: z.string().max(40).nullable(),
});

export const AskRequest = z.object({
  question: z.string().trim().min(3).max(500),
  asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  address_id: z.string().max(80).optional(),
  live_address: AddressInput.optional(),
});

export type AskRequest = z.infer<typeof AskRequest>;
