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


export async function loginUser(username: string, password: string): Promise<User> {
  // Phase 8: Real Authentication Call
  const res = await fetch('http://localhost:3000/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Invalid credentials');
  }

  const user = data.data as User;

  // Store token in localStorage (browser-safe base64 for basic auth demo)
  const token = typeof window !== 'undefined' ? btoa(`${username}:${password}`) : '';
  localStorage.setItem('auth_token', token);
  localStorage.setItem('auth_user', JSON.stringify(user));

  // Set API token
  api.setToken(token);

  return user;
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
