-- OAuth Support Migration
-- Adds OAuth fields to users table to support Google and GitHub authentication

-- Add OAuth fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS oauth_provider VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS oauth_id VARCHAR(255);

-- Create indexes for OAuth fields
CREATE INDEX IF NOT EXISTS idx_users_oauth_provider ON users(oauth_provider);
CREATE INDEX IF NOT EXISTS idx_users_oauth_id ON users(oauth_id);

-- Make password_hash nullable for OAuth users (they don't have passwords)
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Create unique constraint on oauth_provider + oauth_id combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_oauth_unique 
  ON users(oauth_provider, oauth_id) 
  WHERE oauth_provider IS NOT NULL AND oauth_id IS NOT NULL;

-- Add comments for clarity
COMMENT ON COLUMN users.name IS 'User display name from OAuth provider or manual entry';
COMMENT ON COLUMN users.avatar_url IS 'Profile picture URL from OAuth provider';
COMMENT ON COLUMN users.oauth_provider IS 'OAuth provider name (google, github, etc.)';
COMMENT ON COLUMN users.oauth_id IS 'OAuth provider user ID';