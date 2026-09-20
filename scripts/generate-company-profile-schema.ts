import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";

import { companyProfileSchema } from "../lib/company-profile.ts";

const outputPath = resolve(
  process.cwd(),
  "data/companies/company-profile.schema.json",
);
const schema = z.toJSONSchema(companyProfileSchema, {
  target: "draft-2020-12",
});

await writeFile(outputPath, `${JSON.stringify(schema, null, 2)}\n`);
