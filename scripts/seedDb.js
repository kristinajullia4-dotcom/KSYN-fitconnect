#!/usr/bin/env node
/**
 * ============================================================================
 * KSYN FitConnect Enterprise - Database Seeding & Migration CLI
 * ============================================================================
 * Command: npm run db:seed
 * 
 * Hydrates PostgreSQL directly when DATABASE_URL is supplied (e.g. Supabase,
 * Render Managed Postgres, Neon) or verifies and synchronizes the durable
 * JSON multi-tenant store fallback.
 */

const fs = require('fs');
const path = require('path');

const STORE_PATH = path.resolve(__dirname, '../data/ksyn_store.json');
const ROOT_STORE_PATH = path.resolve(__dirname, '../../data/ksyn_store.json');
const SCHEMA_PATH = path.resolve(__dirname, '../server/schema.sql');

async function main() {
  console.log('========================================================');
  console.log('   KSYN FITCONNECT ENTERPRISE DATABASE SEEDING ENGINE   ');
  console.log('========================================================');

  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    console.log('[PostgreSQL Mode Detected]');
    console.log(`Connecting to: ${databaseUrl.replace(/:[^:@]+@/, ':****@')}`);
    
    let Pool;
    try {
      Pool = require('pg').Pool;
    } catch (e) {
      console.error('[Error] pg package not found. Run npm install pg in server directory.');
      process.exit(1);
    }

    const pool = new Pool({
      connectionString: databaseUrl,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    try {
      const client = await pool.connect();
      console.log('[PostgreSQL] Connection established successfully.');

      // 1. Run Schema Migrations
      if (fs.existsSync(SCHEMA_PATH)) {
        console.log('[PostgreSQL] Applying schema migrations from schema.sql...');
        const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf8');
        await client.query(schemaSql);
        console.log('[PostgreSQL] Schema applied successfully.');
      }

      // 2. Load Seed Data from Store
      if (fs.existsSync(STORE_PATH)) {
        const raw = fs.readFileSync(STORE_PATH, 'utf8');
        const data = JSON.parse(raw);

        // Seed Branches
        if (Array.isArray(data.branches)) {
          for (const b of data.branches) {
            await client.query(`
              INSERT INTO branches (id, code, name, address, city, phone, operating_hours, royalty_percentage, status, is_active)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
              ON CONFLICT (id) DO UPDATE SET
                code = EXCLUDED.code,
                name = EXCLUDED.name,
                address = EXCLUDED.address,
                city = EXCLUDED.city,
                status = EXCLUDED.status,
                is_active = EXCLUDED.is_active;
            `, [b.id, b.code, b.name, b.address, b.city, b.phone || '', b.operating_hours || '24/7', b.royalty_percentage || 7.5, b.status || 'Active', b.is_active !== false]);
          }
          console.log(`[PostgreSQL] Seeded ${data.branches.length} franchise branches.`);
        }

        // Seed Users
        if (Array.isArray(data.users)) {
          for (const u of data.users) {
            await client.query(`
              INSERT INTO users (id, branch_id, role, email, password_hash, name, phone, status, rfid_card_uid)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
              ON CONFLICT (id) DO UPDATE SET
                branch_id = EXCLUDED.branch_id,
                role = EXCLUDED.role,
                status = EXCLUDED.status,
                name = EXCLUDED.name;
            `, [u.id, u.branch_id || null, u.role, u.email, u.password_hash || '$2a$10$sfojQ//1bnuBXjzjxmXYA.RxPjXJI9Sp96RhqxL4CLoRfz7KrRtT.', u.name, u.phone || null, u.status || 'active', u.rfid_card_uid || null]);
          }
          console.log(`[PostgreSQL] Seeded ${data.users.length} enterprise users.`);
        }

        // Seed Subscriptions
        const subs = data.subscriptions || data.membership_subscriptions || [];
        if (Array.isArray(subs)) {
          for (const s of subs) {
            await client.query(`
              INSERT INTO membership_subscriptions (id, user_id, tier, plan_name, amount, start_date, end_date, billing_status)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
              ON CONFLICT (id) DO NOTHING;
            `, [s.id, s.user_id, s.tier || '1_month', s.plan_name || s.tier, s.amount || 2500, s.start_date || '2026-11-01', s.end_date || '2026-12-10', s.status || 'active']);
          }
          console.log(`[PostgreSQL] Seeded ${subs.length} membership subscriptions.`);
        }
      }

      client.release();
      await pool.end();
      console.log('========================================================');
      console.log('   POSTGRESQL SEEDING COMPLETED SUCCESSFULLY           ');
      console.log('========================================================');
    } catch (err) {
      console.error('[PostgreSQL Seeding Error]:', err);
      process.exit(1);
    }
  } else {
    // Durable JSON Multi-Tenant Store Mode
    console.log('[Multi-Tenant JSON Store Mode]');
    console.log(`Validating data store at: ${STORE_PATH}`);

    if (!fs.existsSync(STORE_PATH)) {
      console.error(`[Error] Store file not found at ${STORE_PATH}`);
      process.exit(1);
    }

    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const data = JSON.parse(raw);

    const branchesCount = Array.isArray(data.branches) ? data.branches.length : 0;
    const usersCount = Array.isArray(data.users) ? data.users.length : 0;
    const subsCount = Array.isArray(data.subscriptions) ? data.subscriptions.length : 0;
    const salesCount = Array.isArray(data.sales) ? data.sales.length : 0;

    console.log(`- Branches Loaded: ${branchesCount}`);
    console.log(`- Users Seeded:    ${usersCount}`);
    console.log(`- Subscriptions:   ${subsCount}`);
    console.log(`- Sales Records:   ${salesCount}`);

    // Verify root copy synchronization
    if (fs.existsSync(ROOT_STORE_PATH)) {
      fs.writeFileSync(ROOT_STORE_PATH, JSON.stringify(data, null, 2), 'utf8');
      console.log(`[Sync] Synchronized root store copy at ${ROOT_STORE_PATH}`);
    }

    console.log('========================================================');
    console.log('   DATA STORE INTEGRITY VERIFIED & HYDRATED            ');
    console.log('========================================================');
  }
}

main().catch(err => {
  console.error('[Fatal Error during db:seed]:', err);
  process.exit(1);
});
