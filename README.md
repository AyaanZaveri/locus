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

`companies` retains the complete profile document for the company page;
`jobs` is normalized and indexed for server-side searching and filters. The
app reads from Postgres when a database URL exists, with local JSON as an
offline fallback. Re-run `db:seed` after updating company profile JSON.
