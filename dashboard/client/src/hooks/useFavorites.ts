import { useState, useCallback, useEffect, useRef } from "react";
import { lookupTraders, apiFetchFavorites, apiAddFavorite, apiRemoveFavorite } from "../services/api.js";
import type { TraderSummary } from "../../../shared/types.js";

function isAuthenticated(): boolean {
  return !!localStorage.getItem("hl-auth-token");
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<Map<string, TraderSummary>>(new Map());
  const didFetch = useRef(false);

  // Load favorites from server on mount (if authenticated)
  useEffect(() => {
    if (didFetch.current || !isAuthenticated()) return;
    didFetch.current = true;

    apiFetchFavorites()
      .then(({ favorites: addrs }) => {
        if (addrs.length === 0) return;
        const m = new Map<string, TraderSummary>();
        for (const addr of addrs) {
          m.set(addr.toLowerCase(), {
            rank: 0, address: addr, accountValue: 0, displayName: null,
            pnl: { day: 0, week: 0, month: 0, allTime: 0 },
            roi: { day: 0, week: 0, month: 0, allTime: 0 },
            volume: { day: 0, week: 0, month: 0, allTime: 0 },
          });
        }
        setFavorites(m);
        // Fetch fresh data
        return lookupTraders(addrs);
      })
      .then((result) => {
        if (result && result.traders.length > 0) {
          setFavorites((prev) => {
            const next = new Map(prev);
            for (const t of result.traders) {
              const key = t.address.toLowerCase();
              if (next.has(key)) next.set(key, t);
            }
            return next;
          });
        }
      })
      .catch(() => {}); // stale data is fine as fallback
  }, []);

  const toggleFavorite = useCallback((address: string, trader?: TraderSummary) => {
    if (!isAuthenticated()) return;

    const key = address.toLowerCase();
    setFavorites((prev) => {
      const next = new Map(prev);
      if (next.has(key)) {
        next.delete(key);
        apiRemoveFavorite(address).catch(() => {});
      } else if (trader) {
        next.set(key, trader);
        apiAddFavorite(address).catch(() => {});
      }
      return next;
    });
  }, []);

  const isFavorite = useCallback(
    (address: string) => favorites.has(address.toLowerCase()),
    [favorites]
  );

  const refreshFavorites = useCallback((traders: TraderSummary[]) => {
    setFavorites((prev) => {
      if (prev.size === 0) return prev;
      let changed = false;
      const next = new Map(prev);
      for (const t of traders) {
        const key = t.address.toLowerCase();
        if (next.has(key)) {
          next.set(key, t);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  const favoriteTraders = useCallback(
    () => [...favorites.values()],
    [favorites]
  );

  return { favorites, toggleFavorite, isFavorite, favoriteTraders, refreshFavorites };
}
