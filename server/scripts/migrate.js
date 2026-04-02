#!/usr/bin/env node
/**
 * Migration helper script for Supabase CLI
 * Wraps common migration commands with environment-aware configuration
 * 
 * Usage:
 *   npm run migrate          - Apply pending migrations
 *   npm run migrate:make     - Create a new migration file
 *   npm run migrate:status   - Show migration status
 *   npm run migrate:rollback - Revert last migration (local only)
 */

import { execSync, spawn } from 'child_process';
import { existsSync, readdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverRoot = join(__dirname, '..');
const supabaseDir = join(serverRoot, 'supabase');
const migrationsDir = join(supabaseDir, 'migrations');

// Load environment variables
dotenv.config({ path: join(serverRoot, '.env') });

const command = process.argv[2] || 'up';
const migrationName = process.argv[3];

// Check if Supabase CLI is installed
function checkSupabaseCLI() {
  try {
    execSync('npx supabase --version', { stdio: 'pipe' });
    return true;
  } catch {
    console.error('❌ Supabase CLI not found. Install with: npm install -g supabase');
    console.error('   Or run: npx supabase <command>');
    return false;
  }
}

// Generate timestamp for migration filename
function generateTimestamp() {
  const now = new Date();
  return now.toISOString()
    .replace(/[-:T]/g, '')
    .replace(/\..+/, '')
    .slice(0, 14);
}

// Create a new migration file
function createMigration(name) {
  if (!name) {
    console.error('❌ Migration name required. Usage: npm run migrate:make <name>');
    process.exit(1);
  }

  const timestamp = generateTimestamp();
  const filename = `${timestamp}_${name.replace(/\s+/g, '_').toLowerCase()}.sql`;
  const filepath = join(migrationsDir, filename);

  const template = `-- Migration: ${name}
-- Created: ${new Date().toISOString()}

-- Write your migration SQL here
-- Use IF EXISTS / IF NOT EXISTS for idempotent migrations

-- Example:
-- CREATE TABLE IF NOT EXISTS example (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );

-- Down migration (for rollback reference):
-- DROP TABLE IF EXISTS example;
`;

  writeFileSync(filepath, template);
  console.log(`✅ Created migration: ${filename}`);
  console.log(`   Path: ${filepath}`);
}

// List migrations and their status
function showStatus() {
  console.log('\n📋 Migration Status\n');
  
  if (!existsSync(migrationsDir)) {
    console.log('No migrations directory found.');
    return;
  }

  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('No migrations found.');
    return;
  }

  console.log('Local migrations:');
  files.forEach(f => {
    console.log(`  📄 ${f}`);
  });

  console.log('\n💡 To check remote status, run: npx supabase db diff --linked');
  console.log('   (Requires project to be linked with: npx supabase link)');
}

// Run migrations against remote database
function runMigrations() {
  const isProduction = process.env.NODE_ENV === 'production';
  
  console.log(`\n🚀 Running migrations (${isProduction ? 'PRODUCTION' : 'development'})...\n`);

  if (!process.env.SUPABASE_URL) {
    console.error('❌ SUPABASE_URL not set in environment');
    process.exit(1);
  }

  // For remote deployments, use supabase db push
  console.log('Pushing migrations to remote database...');
  console.log('Run: npx supabase db push --linked\n');
  console.log('If not linked, first run: npx supabase link --project-ref <your-project-ref>');
  
  // Spawn interactive process for user to confirm
  const child = spawn('npx', ['supabase', 'db', 'push'], {
    cwd: serverRoot,
    stdio: 'inherit',
    shell: true
  });

  child.on('close', (code) => {
    if (code === 0) {
      console.log('\n✅ Migrations applied successfully');
    } else {
      console.error(`\n❌ Migration failed with code ${code}`);
    }
    process.exit(code);
  });
}

// Rollback (local development only)
function rollback() {
  console.log('\n⚠️  Rollback in Supabase\n');
  console.log('Supabase migrations are forward-only by design.');
  console.log('To rollback, create a new migration that reverses the changes.\n');
  console.log('For local development:');
  console.log('  1. npx supabase db reset  - Reset local DB and re-run all migrations');
  console.log('  2. Delete the migration file and run reset\n');
  console.log('For production:');
  console.log('  1. Create a new migration with the reverse SQL');
  console.log('  2. npm run migrate:make revert_<feature_name>');
}

// Main
if (!checkSupabaseCLI()) {
  process.exit(1);
}

switch (command) {
  case 'up':
  case 'push':
    runMigrations();
    break;
  case 'make':
  case 'create':
  case 'new':
    createMigration(migrationName);
    break;
  case 'status':
  case 'list':
    showStatus();
    break;
  case 'rollback':
  case 'down':
    rollback();
    break;
  default:
    console.log(`
Supabase Migration Helper

Commands:
  npm run migrate           Apply pending migrations to remote DB
  npm run migrate:make      Create a new migration file
  npm run migrate:status    Show local migration files
  npm run migrate:rollback  Show rollback instructions

Examples:
  npm run migrate:make add_notifications_table
  npm run migrate:make add_index_to_users
`);
}
