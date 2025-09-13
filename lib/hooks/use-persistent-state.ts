"use client";

import * as React from "react";

export function usePersistentState<T>(key: string, initialValue: T) {
  const load = React.useCallback((): T => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initialValue;
    } catch {
      return initialValue;
    }
  }, [key, initialValue]);

  const [value, setValue] = React.useState<T>(() => load());

  const setAndPersist = React.useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved =
          typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        try {
          localStorage.setItem(key, JSON.stringify(resolved));
        } catch {}
        return resolved;
      });
    },
    [key]
  );

  React.useEffect(() => {
    // keep state in sync if external tabs mutate localStorage
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) {
        setValue(load());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key, load]);

  return [value, setAndPersist] as const;
}
