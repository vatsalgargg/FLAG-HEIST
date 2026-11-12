"use client";

import { useCallback, useSyncExternalStore } from "react";
import { teamCredentials } from "@/data/credentials";

const STORAGE_KEY = "flagheist-session";

export interface Session {
  username: string;
}

let session: Session | null = null;
let loaded = false;
const listeners = new Set<() => void>();

function normalizeName(value: string) {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function normalizePassword(value: string) {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Session>;
    const username = parsed.username;
    if (typeof username === "string" && username.trim()) {
      const credential = teamCredentials.find(
        (entry) => normalizeName(entry.username) === normalizeName(username),
      );
      if (credential) return { username: credential.username };
    }
  } catch {
    return null;
  }
  return null;
}

function getSnapshot() {
  if (!loaded) {
    session = readSession();
    loaded = true;
  }
  return session;
}

function getServerSnapshot() {
  return null;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function persist(next: Session | null) {
  session = next;
  loaded = true;
  listeners.forEach((listener) => {
    listener();
  });
  try {
    if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    return;
  }
}

const subscribeToClient = () => () => {};

export function useIsClient() {
  return useSyncExternalStore(
    subscribeToClient,
    () => true,
    () => false,
  );
}

export function useAuth() {
  const user = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const login = useCallback((username: string, password: string) => {
    const normalized = normalizeName(username);
    const credential = teamCredentials.find(
      (entry) => normalizeName(entry.username) === normalized,
    );
    if (!credential) return false;
    const normalizedPassword = normalizePassword(password);
    const accepted = [credential.password, ...(credential.altPasswords ?? [])];
    if (!accepted.some((entry) => normalizePassword(entry) === normalizedPassword)) {
      return false;
    }
    persist({ username: credential.username });
    return true;
  }, []);

  const logout = useCallback(() => {
    persist(null);
  }, []);

  return { user, login, logout };
}
