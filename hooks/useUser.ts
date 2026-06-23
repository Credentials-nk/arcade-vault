"use client";

import { useCallback, useEffect, useState } from "react";

export interface User {
  name: string;
}

const KEY = "av_user";

export function useUser() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(KEY);
    if (raw) {
      try {
        setUser(JSON.parse(raw) as User);
      } catch {
        localStorage.removeItem(KEY);
      }
    }
  }, []);

  const login = useCallback((name: string) => {
    const u: User = { name: name.toUpperCase().slice(0, 10) };
    localStorage.setItem(KEY, JSON.stringify(u));
    setUser(u);
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem(KEY);
    setUser(null);
  }, []);

  return { user, login, signOut };
}
