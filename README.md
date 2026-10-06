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

## Google authentication

Better Auth uses the existing Neon database through its Drizzle adapter. Set
these server-only values in `.env.local`:

```bash
BETTER_AUTH_SECRET=       # a random secret of at least 32 characters
BETTER_AUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

Register `http://localhost:3000/api/auth/callback/google` as an authorized
redirect URI for your Google OAuth web client. In production, set
`BETTER_AUTH_URL` to the deployed HTTPS origin and register that origin's
`/api/auth/callback/google` URL in Google Cloud. Configure the same private
environment variables on the deployment.

Run `npm run db:migrate` to create the `user`, `session`, `account`, and
`verification` tables. The sidebar's **Sign in** button opens Google and returns
to the current page. Signed-in users see their avatar, name, and a sign-out
button. Browsing remains available without signing in.

## Personal profile and resume import

`/me` saves each signed-in user's background, skills, desired roles, location,
work arrangement, company sizes, interests, and boundaries in `user_profiles`.
Locus Focus reads only the requesting user's saved profile and uses it for
personal recommendations. A current question takes precedence over preferences.

Resume import accepts text-based PDF (up to 15 pages), DOCX, and UTF-8 TXT files
under 3 MB. It extracts text on the server and makes one structured-output call
to `gpt-6-luna` through the existing `OPENCODE_GO_API_KEY` connection. Files are
not stored; users review and edit the resulting factual background and skills
before applying them to the form, then save explicitly. Resume history never
automatically sets job preferences. Attempts have a persisted one-minute
cooldown, no automatic provider retries, and bounded input/output sizes.

Run the profile checks with:

```bash
node --import tsx --test tests/user-profile.test.ts tests/auth-schema.test.ts
```

With the local server running, the integration test creates temporary accounts,
checks authentication and profile isolation, and deletes the accounts afterward:

```bash
LOCUS_PROFILE_TEST_URL=http://localhost:3000 node --env-file=.env.local \
  --conditions=react-server --import tsx --test tests/profile-api.test.ts
```

Set `LOCUS_TEST_RESUME_INFERENCE=1` for that test to make one paid inference call
using a synthetic resume and verify the extraction/cooldown/review contract.
