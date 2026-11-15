import { supabaseClient } from "../supabaseClient";

// Parking Details data comes ONLY from the read-only database function
//   get_public_parking_details(p_location_id)   (migration 20261110120000)
// It returns an explicit allowlist of public fields, aggregate availability,
// photo metadata (no file paths), amenities and operating hours. The browser
// never reads the underlying tables for this page.

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidLocationId(id) {
  return typeof id === "string" && UUID_RE.test(id);
}

const NOT_FOUND = Object.freeze({ notFound: true });

function mapDetails(row) {
  return {
    notFound: false,
    id: row.location_id,
    name: row.name,
    description: row.description,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    city: row.city,
    state: row.state,
    postalCode: row.postal_code,
    country: row.country,
    is24x7: row.is_24_7,
    rate2w: Number(row.rate_2w_per_hour),
    rate4w: Number(row.rate_4w_per_hour),
    totalSlots: Number(row.total_slots),
    availableSlots: Number(row.available_slots),
    photoCount: Array.isArray(row.photos) ? row.photos.length : 0,
    amenities: Array.isArray(row.amenities)
      ? row.amenities.map((a) => ({
          kind: a.kind,
          code: a.amenity_code,
          label: a.custom_label,
        }))
      : [],
    hours: Array.isArray(row.hours)
      ? row.hours.map((h) => ({
          day: Number(h.day_of_week),
          closed: Boolean(h.is_closed),
          open: h.open_time,
          close: h.close_time,
        }))
      : [],
  };
}

// Resolves to the mapped details, or { notFound: true } when the location does
// not exist or is not public (the database returns NULL for both). Throws on a
// real error (network, server).
export async function fetchParkingDetails(id) {
  // A malformed id can never match a location: skip the request entirely.
  if (!isValidLocationId(id)) return NOT_FOUND;

  const { data, error } = await supabaseClient.rpc(
    "get_public_parking_details",
    { p_location_id: id }
  );

  if (error) {
    throw new Error(error.message || "Could not load parking details.");
  }
  if (!data) return NOT_FOUND;

  return mapDetails(data);
}

// ---- Address ----------------------------------------------------------------
export function formatFullAddress(d) {
  return [
    d.addressLine1,
    d.addressLine2,
    d.city,
    [d.state, d.postalCode].filter(Boolean).join(" "),
    d.country,
  ]
    .filter(Boolean)
    .join(", ");
}

// ---- Photos -----------------------------------------------------------------
// No Storage bucket exists yet, so image files cannot be shown. Distinguish
// "nobody uploaded anything" from "records exist but delivery isn't set up".
export function photoNotice(photoCount) {
  return photoCount > 0 ? "Photos unavailable" : "No photos yet";
}

// ---- Amenities --------------------------------------------------------------
const AMENITY_LABELS = {
  covered: "Covered",
  cctv: "CCTV",
  security_guard: "Security guard",
  ev_charging: "EV charging",
  well_lit: "Well lit",
  washroom: "Washroom",
  wheelchair_accessible: "Wheelchair accessible",
  car_wash: "Car wash",
  valet: "Valet",
  gated: "Gated",
};

export function amenityLabel(amenity) {
  if (amenity.kind === "custom") return amenity.label;
  if (AMENITY_LABELS[amenity.code]) return AMENITY_LABELS[amenity.code];
  // Unknown future code: show it readable rather than hide it.
  return String(amenity.code || "")
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
}

// ---- Operating hours --------------------------------------------------------
// Day numbering from the database: 0 = Sunday ... 6 = Saturday.
const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
// Shown Monday first.
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

// "08:00" -> "8:00 AM", "22:30" -> "10:30 PM", "00:00" -> "12:00 AM"
export function formatTime(hhmm) {
  const match = /^(\d{1,2}):(\d{2})/.exec(hhmm || "");
  if (!match) return "";
  const hour24 = Number(match[1]);
  const minutes = match[2];
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${minutes} ${suffix}`;
}

// close earlier than open means the window ends the next day.
export function isOvernight(open, close) {
  return Boolean(open && close) && close < open;
}

function describeDay(entry) {
  if (!entry) return "Hours not provided";
  if (entry.closed) return "Closed";
  const range = `${formatTime(entry.open)} – ${formatTime(entry.close)}`;
  return isOvernight(entry.open, entry.close)
    ? `${range} (next day)`
    : range;
}

// Returns { kind, rows }:
//   kind "24/7"     -> rows []                       (show "Open 24/7")
//   kind "none"     -> rows []                       (show "Hours not provided")
//   kind "custom"   -> rows [{ day, text }] x 7      (Monday first)
export function buildHoursView(details) {
  if (details.is24x7) return { kind: "24/7", rows: [] };
  if (!details.hours || details.hours.length === 0) {
    return { kind: "none", rows: [] };
  }
  const byDay = new Map(details.hours.map((h) => [h.day, h]));
  return {
    kind: "custom",
    rows: DISPLAY_ORDER.map((day) => ({
      day: DAY_NAMES[day],
      text: describeDay(byDay.get(day)),
    })),
  };
}
