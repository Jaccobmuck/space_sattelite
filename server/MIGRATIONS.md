# Database Migrations

This project uses **Supabase CLI** for database migrations. Migrations are SQL files that track schema changes over time.

## Prerequisites

Install the Supabase CLI globally (or use via npx):

```bash
npm install -g supabase
```

## Directory Structure

```
server/
├── supabase/
│   ├── config.toml          # Supabase local dev configuration
│   ├── seed.sql              # Seed data for local development
│   └── migrations/
│       └── YYYYMMDDHHMMSS_name.sql
└── scripts/
    └── migrate.js            # Migration helper script
```

## Available Commands

| Command | Description |
|---------|-------------|
| `npm run migrate` | Apply pending migrations to the remote database |
| `npm run migrate:make <name>` | Create a new migration file |
| `npm run migrate:status` | List local migration files |
| `npm run migrate:rollback` | Show rollback instructions |

## Creating a New Migration

```bash
npm run migrate:make add_notifications_table
```

This creates a timestamped SQL file in `supabase/migrations/`:

```
supabase/migrations/20260323150000_add_notifications_table.sql
```

Edit the file with your SQL changes:

```sql
-- Migration: add_notifications_table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read);
```

## Running Migrations

### Local Development

For local development with Supabase local stack:

```bash
# Start local Supabase (Docker required)
npx supabase start

# Apply migrations to local DB
npx supabase db reset
```

### Production / Remote Database

First, link your project (one-time setup):

```bash
npx supabase link --project-ref <your-project-ref>
```

Then push migrations:

```bash
npm run migrate
# or directly:
npx supabase db push
```

**Environment variables required:**
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (for admin operations)

## Rollback Procedure

Supabase migrations are **forward-only** by design. To revert changes:

### Option 1: Create a Reverse Migration (Recommended for Production)

```bash
npm run migrate:make revert_notifications_table
```

Then write the reverse SQL:

```sql
-- Revert: add_notifications_table
DROP TABLE IF EXISTS notifications;
```

### Option 2: Reset Local Database (Development Only)

```bash
# This drops all data and re-runs migrations from scratch
npx supabase db reset
```

### Option 3: Manual Rollback via Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Run the reverse SQL manually
4. Delete the migration file locally if needed

## Best Practices

1. **Use IF EXISTS / IF NOT EXISTS** - Makes migrations idempotent
   ```sql
   CREATE TABLE IF NOT EXISTS ...
   DROP TABLE IF EXISTS ...
   ```

2. **One logical change per migration** - Easier to track and rollback

3. **Test locally first** - Use `npx supabase start` to test migrations

4. **Include rollback SQL in comments** - Document how to reverse the change
   ```sql
   -- Down migration:
   -- DROP INDEX IF EXISTS idx_example;
   ```

5. **Never modify existing migrations** - Create new migrations instead

6. **Use transactions for complex changes**
   ```sql
   BEGIN;
   -- multiple statements
   COMMIT;
   ```

## Checking Migration Status

View local migrations:

```bash
npm run migrate:status
```

Compare local vs remote schema:

```bash
npx supabase db diff --linked
```

## Troubleshooting

### "Project not linked"

```bash
npx supabase link --project-ref <your-project-ref>
```

Find your project ref in the Supabase dashboard URL: `https://supabase.com/dashboard/project/<project-ref>`

### "Migration already applied"

Supabase tracks applied migrations in `supabase_migrations.schema_migrations`. If a migration was partially applied, you may need to:

1. Fix the issue in the remote database manually
2. Mark the migration as applied: `INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('20260323000000');`

### "Permission denied"

Ensure your `SUPABASE_SERVICE_ROLE_KEY` is set correctly. The service role key has admin privileges needed for migrations.

## Current Schema

The initial migration (`20260323000000_initial_schema.sql`) includes:

- **profiles** - User profiles linked to Supabase Auth
- **journal_entries** - Satellite sighting journal entries
- **community_likes** - Likes on public sightings
- **community_comments** - Comments on public sightings

See the migration file for full schema details including indexes and RLS policies.
