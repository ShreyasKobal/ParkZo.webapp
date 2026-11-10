"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchFeaturedParking, fetchPublicParking } from "./publicParking";

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
function useRefreshingData(fetcher) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const requestId = useRef(0);
  const lastFetchAt = useRef(0);

  const load = useCallback(
    async ({ silent = false } = {}) => {
      const id = ++requestId.current;
      lastFetchAt.current = Date.now();
      if (!silent) {
        setState((s) => ({ ...s, loading: true, error: null }));
      }

      try {
        const data = await fetcher();
        if (id !== requestId.current) return; // a newer request replaced this one
        setState({ data, loading: false, error: null });
      } catch (err) {
        if (id !== requestId.current) return;
        setState((s) =>
          silent && s.data
            ? s // background refresh failed: keep showing the last good data
            : {
                data: null,
                loading: false,
                error: err?.message || "Could not load parking.",
              }
        );
      }
    },
    [fetcher]
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

  return { data: state.data, loading: state.loading, error: state.error, refresh };
}

// /parking: searchable list (get_public_parking_overview).
export function usePublicParking({ search = "", limit = 50 } = {}) {
  const fetcher = useCallback(
    () => fetchPublicParking({ search, limit }),
    [search, limit]
  );
  return useRefreshingData(fetcher);
}

// Home / Dashboard: top N across the whole dataset (get_featured_parking).
export function useFeaturedParking({ count = 3 } = {}) {
  const fetcher = useCallback(() => fetchFeaturedParking({ count }), [count]);
  return useRefreshingData(fetcher);
}
