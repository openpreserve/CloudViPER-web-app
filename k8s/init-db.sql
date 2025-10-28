-- Initialize database schema for viper-cloud-web-gui
-- This script is idempotent and can be run multiple times safely

-- Create sessions table for express-mysql-session
CREATE TABLE IF NOT EXISTS sessions (
    session_id VARCHAR(128) COLLATE utf8mb4_bin NOT NULL PRIMARY KEY,
    expires INT UNSIGNED NOT NULL,
    data MEDIUMTEXT COLLATE utf8mb4_bin
) ENGINE=InnoDB 
  DEFAULT CHARSET=utf8mb4 
  COLLATE=utf8mb4_unicode_ci;

-- Add index for session cleanup queries
CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions (expires);

-- Log successful initialization
SELECT 'Database initialization complete' as status;
