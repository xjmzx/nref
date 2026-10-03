import { useEffect, useState } from "react";

/** A value kept in localStorage; falls back silently when storage is denied. */
export function useStored<T extends string>(key: string, initial: T, allowed?: readonly T[]): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const v = localStorage.getItem(key) as T | null;
      if (v !== null && (!allowed || allowed.includes(v))) return v;
    } catch {
      /* a convenience; fine to lose */
    }
    return initial;
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* a convenience; fine to lose */
    }
  }, [key, value]);
  return [value, setValue];
}

export type Toast = { text: string; tone: "ok" | "alert" } | null;

/** A footer message that clears itself after 6 s. */
export function useToast(): [Toast, (t: Toast) => void] {
  const [toast, setToast] = useState<Toast>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);
  return [toast, setToast];
}

/** SUITE.md § Top-bar grammar: the chip shows major.minor.patch only. */
export function shortVersion(v: string): string {
  return v.split(/[-+]/)[0];
}

/** "3 days ago" for a commit date. */
export function ago(iso: string | null): string {
  if (!iso) return "";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (!Number.isFinite(s)) return "";
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  const d = Math.round(s / 86400);
  return d === 1 ? "yesterday" : `${d} days ago`;
}
