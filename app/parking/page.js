"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Navbar from "../../components/Navbar";
import { usePublicParking } from "../../lib/parking/usePublicParking";
import {
  STATE_LABEL,
  formatAddress,
  formatRates,
  getAvailabilityState,
  percentUsed,
  slotsText,
} from "../../lib/parking/publicParking";
import "../../css/parking.css";

const RESULT_LIMIT = 100; // the database function clamps to 100
const SEARCH_DEBOUNCE_MS = 300;

function ParkingCard({ location }) {
  const state = getAvailabilityState(
    location.availableSlots,
    location.totalSlots
  );

  return (
    <article className={`parking-card ${state}`}>
      <div className="parking-photo-placeholder" aria-hidden="true">
        <span>P</span>
      </div>
      <div className="parking-card-body">
        <h2 className="parking-card-name">{location.name}</h2>
        <p className="parking-card-address">{formatAddress(location)}</p>
        {location.description && (
          <p className="parking-card-desc">{location.description}</p>
        )}
        <p className="parking-card-rates">{formatRates(location)}</p>
        {location.is24x7 && <span className="parking-card-tag">Open 24/7</span>}

        <div className="parking-card-avail">
          {state === "unset" ? (
            <p className="parking-card-unset">{STATE_LABEL.unset}</p>
          ) : (
            <>
              <div className="parking-card-avail-row">
                <span className="status">{STATE_LABEL[state]}</span>
                <span className="parking-card-slots">
                  {slotsText(location.availableSlots, location.totalSlots)}
                </span>
              </div>
              <div className="progress">
                <div
                  className="progress-fill"
                  style={{
                    width: `${percentUsed(
                      location.availableSlots,
                      location.totalSlots
                    )}%`,
                  }}
                ></div>
              </div>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

function ParkingBrowser() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get("q") ?? "";

  const [input, setInput] = useState(urlQuery);
  const [query, setQuery] = useState(urlQuery.trim());
  // The last query this page itself wrote to the URL, so we can tell our own
  // URL updates apart from a change made elsewhere (e.g. the navbar search).
  const lastPushed = useRef(urlQuery.trim());

  // URL changed from outside (navbar search, back/forward): follow it.
  useEffect(() => {
    const next = urlQuery.trim();
    if (next === lastPushed.current) return;
    lastPushed.current = next;
    setInput(urlQuery);
    setQuery(next);
  }, [urlQuery]);

  // Debounced typing: commit the search and keep ?q= in the URL.
  useEffect(() => {
    const next = input.trim();
    if (next === query) return;
    const timer = setTimeout(() => {
      lastPushed.current = next;
      setQuery(next);
      router.replace(
        next ? `/parking?q=${encodeURIComponent(next)}` : "/parking",
        { scroll: false }
      );
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [input, query, router]);

  const { data, loading, error, refresh } = usePublicParking({
    search: query,
    limit: RESULT_LIMIT,
  });

  function submitNow(e) {
    e.preventDefault();
    const next = input.trim();
    lastPushed.current = next;
    setQuery(next);
    router.replace(
      next ? `/parking?q=${encodeURIComponent(next)}` : "/parking",
      { scroll: false }
    );
  }

  let content;
  if (error && !data) {
    content = (
      <div className="parking-state" role="alert">
        <h2>Couldn’t load parking</h2>
        <p>Something went wrong while loading parking locations.</p>
        <button type="button" className="btn btn-secondary parking-retry" onClick={refresh}>
          Try again
        </button>
      </div>
    );
  } else if (loading && !data) {
    content = (
      <div className="parking-grid" aria-hidden="true">
        <div className="parking-skeleton"></div>
        <div className="parking-skeleton"></div>
        <div className="parking-skeleton"></div>
      </div>
    );
  } else if (data && data.length === 0) {
    content = (
      <div className="parking-state">
        {query ? (
          <>
            <h2>No results for “{query}”</h2>
            <p>Try a different name, area, city or address.</p>
          </>
        ) : (
          <>
            <h2>No parking available yet</h2>
            <p>Approved parking locations will appear here.</p>
          </>
        )}
      </div>
    );
  } else if (data) {
    content = (
      <>
        <div className="parking-grid">
          {data.map((location) => (
            <ParkingCard key={location.id} location={location} />
          ))}
        </div>
        {data.length >= RESULT_LIMIT && (
          <p className="parking-note">
            Showing the first {RESULT_LIMIT} locations. Use search to narrow the
            results.
          </p>
        )}
      </>
    );
  }

  let countText = "";
  if (data) {
    countText = `${data.length} parking location${data.length === 1 ? "" : "s"}${
      query ? ` for “${query}”` : ""
    }`;
  } else if (loading) {
    countText = "Loading parking…";
  }

  return (
    <main className="parking-page" aria-busy={loading}>
      <div className="parking-wrap">
        <h1 className="parking-title">Find Parking</h1>
        <p className="parking-subtitle">
          Availability shown for right now through the next hour.
        </p>

        <form className="parking-search" onSubmit={submitNow} role="search">
          <div className="search-wrapper">
            <input
              type="text"
              className="search-input"
              placeholder="Search by name, area or address..."
              aria-label="Search parking by name, area or address"
              maxLength={100}
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button type="submit" className="search-btn" aria-label="Search">
              <i className="fas fa-search"></i>
            </button>
          </div>
        </form>

        <p className="parking-count" aria-live="polite">
          {countText}
        </p>

        {content}
      </div>
    </main>
  );
}

export default function ParkingPage() {
  return (
    <>
      <Navbar />
      <Suspense
        fallback={
          <main className="parking-page">
            <div className="parking-wrap">
              <p className="parking-count">Loading parking…</p>
            </div>
          </main>
        }
      >
        <ParkingBrowser />
      </Suspense>
    </>
  );
}
