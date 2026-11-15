"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchFeaturedParking, fetchPublicParking } from "./publicParking";
import { fetchParkingDetails } from "./publicParkingDetails";

// Ignore a focus/visibility refresh that arrives right after a fetch
// (switching tabs fires both events, and the page just loaded fresh data).
const MIN_REFRESH_GAP_MS = 2000;

// Shared loader. `fetcher` must be a stable function (useCallback) that
// returns a promise of the data. Refreshes on mount, whenever `fetcher`
// changes, and when the browser tab becomes visible/focused again.
// No polling.
//
// Returned `loading` is true during any fetch the user is waiting on, but
// previously loaded `data` is kept so the list does not blink while typing.
//
// Optional `scopeKey` (used only by the details route): identifies WHICH item
// the data belongs to. When the key changes, the previous item's data/error is
// never returned for the new key - the caller sees an empty loading state until
// the new item's fetch finishes. Leave it undefined (the list hooks do) to keep
// the "keep previous data while refetching" behaviour.
function useRefreshingData(fetcher, scopeKey) {
  const [state, setState] = useState({
    data: null,
    loading: true,
    error: null,
    key: scopeKey,
  });
  const requestId = useRef(0);
  const lastFetchAt = useRef(0);

  const load = useCallback(
    async ({ silent = false } = {}) => {
      const id = ++requestId.current;
      lastFetchAt.current = Date.now();
      if (!silent) {
        setState((s) =>
          s.key === scopeKey
            ? { ...s, loading: true, error: null }
            : { data: null, loading: true, error: null, key: scopeKey }
        );
      }

      try {
        const data = await fetcher();
        if (id !== requestId.current) return; // a newer request replaced this one
        setState({ data, loading: false, error: null, key: scopeKey });
      } catch (err) {
        if (id !== requestId.current) return;
        setState((s) =>
          silent && s.data && s.key === scopeKey
            ? s // background refresh failed: keep showing the last good data
            : {
                data: null,
                loading: false,
                error: err?.message || "Could not load parking.",
                key: scopeKey,
              }
        );
      }
    },
    [fetcher, scopeKey]
  );

  useEffect(() => {
    load();
    return () => {
      requestId.current++; // drop any in-flight result after unmount/param change
    };
  }, [load]);

  useEffect(() => {
    function refreshIfStale() {
      if (Date.now() - lastFetchAt.current < MIN_REFRESH_GAP_MS) return;
      load({ silent: true });
    }
    function handleVisibility() {
      if (document.visibilityState === "visible") refreshIfStale();
    }
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", refreshIfStale);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", refreshIfStale);
    };
  }, [load]);

  const refresh = useCallback(() => load(), [load]);

  // State left over from a DIFFERENT key (the render right after the id
  // changed, before the new fetch starts) is never exposed.
  const stale = scopeKey !== undefined && state.key !== scopeKey;
  const view = stale ? { data: null, loading: true, error: null } : state;

  return { data: view.data, loading: view.loading, error: view.error, refresh };
}

// /parking: searchable list (get_public_parking_overview).
export function usePublicParking({ search = "", limit = 50 } = {}) {
  const fetcher = useCallback(
    () => fetchPublicParking({ search, limit }),
    [search, limit]
  );
  return useRefreshingData(fetcher);
}

// /parking/[id]: one location (get_public_parking_details). `data` is the
// mapped details, or { notFound: true } for an unknown / non-public id.
export function useParkingDetails({ id }) {
  const fetcher = useCallback(() => fetchParkingDetails(id), [id]);
  // Keyed by id: another location's details are never shown under this id.
  return useRefreshingData(fetcher, id);
}

// Home / Dashboard: top N across the whole dataset (get_featured_parking).
export function useFeaturedParking({ count = 3 } = {}) {
  const fetcher = useCallback(() => fetchFeaturedParking({ count }), [count]);
  return useRefreshingData(fetcher);
}
