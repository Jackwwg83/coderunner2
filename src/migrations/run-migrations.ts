#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';
import { Pool } from 'pg';
import { createDatabasePool } from '../config/database';

interface Migration {
  id: string;
  filename: string;
  sql: string;
}

class MigrationRunner {
  private pool: Pool;
  private migrationsDir: string;

  constructor() {
    this.pool = createDatabasePool();
    this.migrationsDir = __dirname;
  }

  /**
   * Initialize the migrations table
   */
  private async initializeMigrationsTable(): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        migration_id VARCHAR(255) UNIQUE NOT NULL,
        filename VARCHAR(255) NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        checksum VARCHAR(64)
      );
      
      CREATE INDEX IF NOT EXISTS idx_migrations_migration_id ON migrations(migration_id);
    `;

    try {
      await this.pool.query(sql);
      console.log('✅ Migrations table initialized');
    } catch (error) {
      console.error('❌ Failed to initialize migrations table:', error);
      throw error;
    }
  }

  /**
   * Get list of applied migrations
   */
  private async getAppliedMigrations(): Promise<string[]> {
    try {
      const result = await this.pool.query('SELECT migration_id FROM migrations ORDER BY id');
      return result.rows.map(row => row.migration_id);
    } catch (error) {
      console.error('❌ Failed to get applied migrations:', error);
      throw error;
    }
  }

  /**
   * Load migration files from disk
   */
  private loadMigrationFiles(): Migration[] {
    const files = fs.readdirSync(this.migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    const migrations: Migration[] = [];

    for (const filename of files) {
      const filePath = path.join(this.migrationsDir, filename);
      const sql = fs.readFileSync(filePath, 'utf-8');
      const id = filename.replace(/\.sql$/, '');

      migrations.push({
        id,
        filename,
        sql
      });
    }

    return migrations;
  }

  /**
   * Calculate checksum for migration content
   */
  private calculateChecksum(content: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
  }

  /**
   * Apply a single migration
   */
  private async applyMigration(migration: Migration): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      console.log(`📝 Applying migration: ${migration.filename}`);
      
      // Execute the migration SQL
      await client.query(migration.sql);
      
      // Record the migration as applied
      const checksum = this.calculateChecksum(migration.sql);
      await client.query(
        'INSERT INTO migrations (migration_id, filename, checksum) VALUES ($1, $2, $3)',
        [migration.id, migration.filename, checksum]
      );
      
      await client.query('COMMIT');
      console.log(`✅ Applied migration: ${migration.filename}`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`❌ Failed to apply migration ${migration.filename}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Validate migration checksums
   */
  private async validateMigrationIntegrity(): Promise<void> {
    console.log('🔍 Validating migration integrity...');
    
    const appliedMigrations = await this.pool.query(`
      SELECT migration_id, filename, checksum 
      FROM migrations 
      ORDER BY id
    `);

    const currentMigrations = this.loadMigrationFiles();
    
    for (const appliedMigration of appliedMigrations.rows) {
      const currentMigration = currentMigrations.find(m => m.id === appliedMigration.migration_id);
      
      if (!currentMigration) {
        throw new Error(`Migration ${appliedMigration.migration_id} was applied but file no longer exists`);
      }
      
      const currentChecksum = this.calculateChecksum(currentMigration.sql);
      if (currentChecksum !== appliedMigration.checksum) {
        throw new Error(`Migration ${appliedMigration.migration_id} has been modified after being applied`);
      }
    }
    
    console.log('✅ Migration integrity validated');
  }

  /**
   * Run all pending migrations
   */
  public async runMigrations(): Promise<void> {
    try {
      console.log('🚀 Starting database migrations...');
      console.log('📊 Database:', this.pool.options.database);
      console.log('🏠 Host:', this.pool.options.host);
      
      // Test database connection
      await this.pool.query('SELECT NOW()');
      console.log('✅ Database connection established');

      // Initialize migrations table
      await this.initializeMigrationsTable();

      // Validate existing migrations
      await this.validateMigrationIntegrity();

      // Load migration files
      const migrations = this.loadMigrationFiles();
      console.log(`📄 Found ${migrations.length} migration files`);

      // Get applied migrations
      const appliedMigrations = await this.getAppliedMigrations();
      console.log(`✅ ${appliedMigrations.length} migrations already applied`);

      // Filter pending migrations
      const pendingMigrations = migrations.filter(
        migration => !appliedMigrations.includes(migration.id)
      );

      if (pendingMigrations.length === 0) {
        console.log('✨ All migrations are up to date!');
        return;
      }

      console.log(`⏳ Applying ${pendingMigrations.length} pending migrations...`);

      // Apply each pending migration
      for (const migration of pendingMigrations) {
        await this.applyMigration(migration);
      }

      console.log('🎉 All migrations completed successfully!');
    } catch (error) {
      console.error('💥 Migration failed:', error);
      throw error;
    }
  }

  /**
   * Show migration status
   */
  public async showStatus(): Promise<void> {
    try {
      await this.initializeMigrationsTable();
      
      const migrations = this.loadMigrationFiles();
      const appliedMigrations = await this.getAppliedMigrations();

      console.log('\n📋 Migration Status:');
      console.log('='.repeat(80));
      
      for (const migration of migrations) {
        const isApplied = appliedMigrations.includes(migration.id);
        const status = isApplied ? '✅ Applied' : '⏳ Pending';
        console.log(`${status}  ${migration.filename}`);
      }
      
      console.log('='.repeat(80));
      console.log(`Total: ${migrations.length} migrations, ${appliedMigrations.length} applied, ${migrations.length - appliedMigrations.length} pending`);
    } catch (error) {
      console.error('❌ Failed to show status:', error);
      throw error;
    }
  }

  /**
   * Create a new migration file
   */
  public async createMigration(name: string): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[-T:]/g, '').split('.')[0];
    const filename = `${timestamp}_${name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}.sql`;
    const filepath = path.join(this.migrationsDir, filename);

    const template = `-- Migration: ${name}
-- Created: ${new Date().toISOString()}
-- Description: Add your migration description here

-- Add your SQL statements below:

-- Example:
-- CREATE TABLE example (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     name VARCHAR(255) NOT NULL,
--     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );
`;

    fs.writeFileSync(filepath, template);
    console.log(`✅ Created migration: ${filename}`);
  }

  /**
   * Close database connection
   */
  public async close(): Promise<void> {
    await this.pool.end();
  }
}

// CLI interface
async function main() {
  const runner = new MigrationRunner();

  try {
    const command = process.argv[2];

    switch (command) {
    case 'run':
    case 'migrate':
      await runner.runMigrations();
      break;
      
    case 'status':
      await runner.showStatus();
      break;
      
    case 'create': {
      const name = process.argv[3];
      if (!name) {
        console.error('❌ Please provide a migration name: npm run migrate:create "migration name"');
        process.exit(1);
      }
      await runner.createMigration(name);
      break;
    }
      
    default:
      console.log('📚 CodeRunner Migration Tool');
      console.log('');
      console.log('Usage:');
      console.log('  npm run migrate        - Run pending migrations');
      console.log('  npm run migrate:status - Show migration status');
      console.log('  npm run migrate:create "name" - Create new migration');
      console.log('');
      console.log('Environment variables:');
      console.log('  DATABASE_URL - Full database connection string');
      console.log('  DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD - Individual connection parameters');
      break;
    }
  } catch (error) {
    console.error('💥 Error:', error);
    process.exit(1);
  } finally {
    await runner.close();
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { MigrationRunner };