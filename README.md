# Next.js template

This is a Next.js template with shadcn/ui.

## Adding components

To add components to your app, run the following command:

```bash
npx shadcn@latest add button
```

This will place the ui components in the `components` directory.

## Using components

To use the components in your app, import them as follows:

```tsx
import { Button } from "@/components/ui/button";
```

## Database

The app uses Neon Postgres through Drizzle. Keep both of these private values in
`.env.local`:

```bash
DATABASE_URL=             # direct connection, used only by Drizzle migrations
DATABASE_URL_POOLED=      # pooled connection, used by the running app
```

Run migrations and import the versioned company profiles with:

```bash
npm run db:migrate
npm run db:seed
```

Neon is the canonical source for company profiles, jobs, and people. The
repository stores the contract, migrations, and importer—not operational
research data. Import one validated profile JSON file with:

```bash
npm run db:import -- /absolute/path/to/company.json
```

`db:seed` remains available to import a local cache in bulk, but those files
are ignored by Git and are never used as a production fallback.
