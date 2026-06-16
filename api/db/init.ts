import pool from './pool.js';
import bcrypt from 'bcryptjs';

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'admin',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS trials (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    randomization_method VARCHAR(50) NOT NULL DEFAULT 'stratified_block',
    block_sizes INTEGER[] NOT NULL DEFAULT '{4,6}',
    minimization_probability NUMERIC(3,2) NOT NULL DEFAULT 0.70,
    seed INTEGER NOT NULL DEFAULT 42,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS groups (
    id SERIAL PRIMARY KEY,
    trial_id INTEGER NOT NULL REFERENCES trials(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL,
    ratio INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS stratification_factors (
    id SERIAL PRIMARY KEY,
    trial_id INTEGER NOT NULL REFERENCES trials(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    levels TEXT[] NOT NULL
);

CREATE TABLE IF NOT EXISTS sites (
    id SERIAL PRIMARY KEY,
    trial_id INTEGER NOT NULL REFERENCES trials(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS subjects (
    id SERIAL PRIMARY KEY,
    trial_id INTEGER NOT NULL REFERENCES trials(id) ON DELETE CASCADE,
    site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    subject_code VARCHAR(100) NOT NULL UNIQUE,
    initials VARCHAR(10),
    age_group VARCHAR(50),
    gender VARCHAR(20),
    disease_stage VARCHAR(50),
    stratification_data JSONB DEFAULT '{}'::jsonb,
    allocation_status VARCHAR(50) NOT NULL DEFAULT 'pending',
    drug_code VARCHAR(100),
    group_id INTEGER REFERENCES groups(id),
    enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    allocated_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS allocation_sequences (
    id SERIAL PRIMARY KEY,
    trial_id INTEGER NOT NULL REFERENCES trials(id) ON DELETE CASCADE,
    stratification_key VARCHAR(255) NOT NULL,
    position INTEGER NOT NULL,
    group_id INTEGER NOT NULL REFERENCES groups(id),
    drug_code VARCHAR(100) NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    subject_id INTEGER REFERENCES subjects(id),
    used_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS unblind_records (
    id SERIAL PRIMARY KEY,
    subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    unblinded_by INTEGER NOT NULL REFERENCES users(id),
    reason TEXT NOT NULL,
    revealed_group VARCHAR(100) NOT NULL,
    unblinded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_subjects_trial ON subjects(trial_id);
CREATE INDEX IF NOT EXISTS idx_subjects_site ON subjects(site_id);
CREATE INDEX IF NOT EXISTS idx_subjects_status ON subjects(allocation_status);
CREATE INDEX IF NOT EXISTS idx_allocation_seq_trial ON allocation_sequences(trial_id);
CREATE INDEX IF NOT EXISTS idx_allocation_seq_strat ON allocation_sequences(stratification_key, position);
CREATE INDEX IF NOT EXISTS idx_allocation_seq_used ON allocation_sequences(used);
CREATE UNIQUE INDEX IF NOT EXISTS idx_allocation_seq_unique ON allocation_sequences(trial_id, stratification_key, position);
CREATE UNIQUE INDEX IF NOT EXISTS idx_allocation_seq_drug_code ON allocation_sequences(drug_code);
CREATE INDEX IF NOT EXISTS idx_unblind_subject ON unblind_records(subject_id);
`;

async function ensureAdminUser() {
  const result = await pool.query('SELECT id FROM users WHERE username = $1', ['admin']);
  if (result.rows.length === 0) {
    const hash = await bcrypt.hash('admin123', 10);
    await pool.query(
      'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)',
      ['admin', hash, 'admin']
    );
    console.log('Admin user created: admin / admin123');
  }
}

export async function initializeDatabase() {
  try {
    await pool.query(SCHEMA_SQL);
    console.log('Database schema initialized');
    await ensureAdminUser();
  } catch (err) {
    console.error('Database initialization failed:', err);
    throw err;
  }
}

export async function waitForDatabase(maxRetries = 30, delayMs = 2000): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await pool.query('SELECT 1');
      console.log('Database connection established');
      return;
    } catch (err) {
      console.log(`Waiting for database... (${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  throw new Error('Could not connect to database after maximum retries');
}
