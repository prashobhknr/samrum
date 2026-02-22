/**
 * Phase 4: Authentication Layer
 * 
 * Handles Keycloak/LDAP authentication
 * Mock authentication for development
 */

import { api } from './api';

export interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  groups: string[];  // e.g., ['locksmiths', 'supervisors']
}

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const MOCK_USERS: Record<string, { password: string; user: User }> = {
  'john.locksmith': {
    password: 'password123',
    user: {
      id: '1',
      username: 'john.locksmith',
      name: 'John Locksmith',
      email: 'john@example.com',
      groups: ['locksmiths'],
    },
  },
  'jane.supervisor': {
    password: 'password123',
    user: {
      id: '2',
      username: 'jane.supervisor',
      name: 'Jane Supervisor',
      email: 'jane@example.com',
      groups: ['supervisors'],
    },
  },
  'mike.maintenance': {
    password: 'password123',
    user: {
      id: '3',
      username: 'mike.maintenance',
      name: 'Mike Maintenance',
      email: 'mike@example.com',
      groups: ['maintenance'],
    },
  },
  'admin': {
    password: 'password123',
    user: {
      id: '4',
      username: 'admin',
      name: 'Admin User',
      email: 'admin@example.com',
      groups: ['security_admin', 'supervisors'],
    },
  },
};

export async function loginUser(username: string, password: string): Promise<User> {
  // In production, call Keycloak/LDAP API
  const mockUser = MOCK_USERS[username];

  if (!mockUser || mockUser.password !== password) {
    throw new Error('Invalid credentials');
  }

  // Store token in localStorage
  const token = Buffer.from(`${username}:${password}`).toString('base64');
  localStorage.setItem('auth_token', token);
  localStorage.setItem('auth_user', JSON.stringify(mockUser.user));

  // Set API token
  api.setToken(token);

  return mockUser.user;
}

export async function logoutUser(): Promise<void> {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_user');
  api.setToken('');
}

export function getStoredUser(): User | null {
  if (typeof window === 'undefined') return null;

  const stored = localStorage.getItem('auth_user');
  return stored ? JSON.parse(stored) : null;
}

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
}

export function initializeAuth(): void {
  const token = getStoredToken();
  if (token) {
    api.setToken(token);
  }
}
