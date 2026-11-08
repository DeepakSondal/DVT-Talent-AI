-- DVT Talent AI — PostgreSQL Initialization
-- Run automatically on first container start

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Create database if not exists (handled by POSTGRES_DB env var)
-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE dvt_talent TO dvt_user;

-- Performance settings (applied at session level here; set in postgresql.conf for persistence)
-- These are applied via ALTER SYSTEM in production
DO $$
BEGIN
  RAISE NOTICE 'DVT Talent AI database initialized successfully';
END $$;
