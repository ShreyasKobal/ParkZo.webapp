import { supabaseClient } from "../supabaseClient";

// Public parking data comes ONLY from two read-only database functions:
//   get_public_parking_overview()  (migration 20261105120000) - the /parking
//       list: approved locations, optional search, alphabetical.
//   get_featured_parking()         (migration 20261106120000) - Home and
//       Dashboard: the top N locations ranked across ALL approved locations
//       by available slots.
// Both return real total/available slot counts for "right now through the
// next hour" and no private booking/hold/user data.

function mapRow(row) {
  return {
    id: row.location_id,
    name: row.name,
    description: row.description,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    city: row.city,
    state: row.state,
    postalCode: row.postal_code,
    is24x7: row.is_24_7,
    rate2w: Number(row.rate_2w_per_hour),
    rate4w: Number(row.rate_4w_per_hour),
    totalSlots: Number(row.total_slots),
    availableSlots: Number(row.available_slots),
  };
}

export async function fetchPublicParking({ search = "", limit = 50 } = {}) {
  const trimmed = search.trim();
  const { data, error } = await supabaseClient.rpc(
    "get_public_parking_overview",
    {
      p_search: trimmed ? trimmed : null,
      p_limit: limit,
    }
  );

  if (error) {
    throw new Error(error.message || "Could not load parking.");
  }

  return (data ?? []).map(mapRow);
}

// Top `count` locations across the whole dataset, already ranked by the
// database (most available first, then name, then id). Locations with no
// slots are excluded by the database.
export async function fetchFeaturedParking({ count = 3 } = {}) {
  const { data, error } = await supabaseClient.rpc("get_featured_parking", {
    p_count: count,
  });

  if (error) {
    throw new Error(error.message || "Could not load parking.");
  }

  return (data ?? []).map(mapRow);
}

// ---- Availability label (agreed rule) --------------------------------------
//   no slots created yet  -> "unset"   (never shown as Full)
//   0 available           -> "full"
//   20% or less available -> "limited"
//   more than 20%         -> "available"
export function getAvailabilityState(availableSlots, totalSlots) {
  if (totalSlots <= 0) return "unset";
  if (availableSlots <= 0) return "full";
  if (availableSlots * 5 <= totalSlots) return "limited";
  return "available";
}

export const STATE_LABEL = {
  available: "Available",
  limited: "Limited",
  full: "Full",
  unset: "Slots not set up yet",
};

// Progress bar = share of slots in use (same meaning as the original design,
// e.g. 21 of 50 available -> 58% filled).
export function percentUsed(availableSlots, totalSlots) {
  if (totalSlots <= 0) return 0;
  const used = totalSlots - availableSlots;
  return Math.min(100, Math.max(0, Math.round((used / totalSlots) * 100)));
}

export function slotsText(availableSlots, totalSlots) {
  if (totalSlots <= 0) return "Slots not set up yet";
  if (availableSlots <= 0) return "0 slots left";
  return `${availableSlots}/${totalSlots} slots left`;
}

function formatRate(value) {
  return `₹${Number(value).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

// Both rates are always shown (2-wheeler and 4-wheeler).
export function formatRates(location) {
  return `2W ${formatRate(location.rate2w)} · 4W ${formatRate(
    location.rate4w
  )} / hr`;
}

export function formatAddress(location) {
  return [
    location.addressLine1,
    location.addressLine2,
    location.city,
    location.state,
    location.postalCode,
  ]
    .filter(Boolean)
    .join(", ");
}
