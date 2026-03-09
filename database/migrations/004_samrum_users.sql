-- Migration 004: Samrum User Administration Tables
-- For B000 screen: Administrera användare

-- Users table
CREATE TABLE IF NOT EXISTS samrum_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255),
    password_hash VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User roles (e.g., global_security_admin)
CREATE TABLE IF NOT EXISTS samrum_user_roles (
    user_id INTEGER NOT NULL REFERENCES samrum_users(id) ON DELETE CASCADE,
    role VARCHAR(100) NOT NULL,
    PRIMARY KEY (user_id, role)
);

-- User project access
CREATE TABLE IF NOT EXISTS samrum_user_projects (
    user_id INTEGER NOT NULL REFERENCES samrum_users(id) ON DELETE CASCADE,
    project_id INTEGER NOT NULL REFERENCES samrum_projects(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, project_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_samrum_user_roles_user ON samrum_user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_samrum_user_projects_user ON samrum_user_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_samrum_user_projects_project ON samrum_user_projects(project_id);

-- Seed: Admin user (password will need to be set)
INSERT INTO samrum_users (username, email) 
VALUES ('admin', 'admin@samrum.local')
ON CONFLICT (username) DO NOTHING;

-- Assign admin role
INSERT INTO samrum_user_roles (user_id, role)
SELECT id, 'global_security_admin' 
FROM samrum_users 
WHERE username = 'admin'
ON CONFLICT DO NOTHING;

-- Grant admin access to all projects
INSERT INTO samrum_user_projects (user_id, project_id)
SELECT u.id, p.id
FROM samrum_users u
CROSS JOIN samrum_projects p
WHERE u.username = 'admin'
ON CONFLICT DO NOTHING;

-- Seed: Some sample users
INSERT INTO samrum_users (username, email) VALUES
    ('lars.haggstrom', 'lars@example.com'),
    ('mats.arkitekt', 'mats@example.com'),
    ('security.guard', 'security@example.com')
ON CONFLICT (username) DO NOTHING;
