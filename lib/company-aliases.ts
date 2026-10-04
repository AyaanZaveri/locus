import { z } from "zod";

export const companyAliasSchema = z
  .object({
    companySlug: z.string().regex(/^[a-z0-9-]+$/),
    name: z.string().trim().min(2).max(80),
    kind: z.enum(["former-name", "abbreviation", "alternate-name"]),
    sourceUrl: z.string().url(),
  })
  .strict();

// Versioned, evidence-backed search aliases. Products, investors and acquired
// companies are not aliases. Do not generate acronyms or infer former names.
// Keeping this registry separate from imported profiles prevents a profile
// refresh from silently deleting curated search identities.
export const companyAliases = z.array(companyAliasSchema).parse([
  {
    companySlug: "vercel",
    name: "ZEIT",
    kind: "former-name",
    sourceUrl: "https://vercel.com/blog/zeit-is-now-vercel",
  },
]);
