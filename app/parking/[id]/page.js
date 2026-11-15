"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import Navbar from "../../../components/Navbar";
import { useParkingDetails } from "../../../lib/parking/usePublicParking";
import {
  STATE_LABEL,
  getAvailabilityState,
  percentUsed,
  slotsText,
} from "../../../lib/parking/publicParking";
import {
  amenityLabel,
  buildHoursView,
  formatFullAddress,
  photoNotice,
} from "../../../lib/parking/publicParkingDetails";
import "../../../css/parking.css";
import "../../../css/parking-details.css";

function formatRate(value) {
  return `₹${Number(value).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

function BackLink() {
  return (
    <Link href="/parking" className="pd-back">
      ← All parking
    </Link>
  );
}

function DetailsSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="pd-skeleton pd-skeleton-photo"></div>
      <div className="pd-skeleton pd-skeleton-line pd-skeleton-title"></div>
      <div className="pd-skeleton pd-skeleton-line"></div>
      <div className="pd-grid">
        <div className="pd-skeleton pd-skeleton-card"></div>
        <div className="pd-skeleton pd-skeleton-card"></div>
      </div>
    </div>
  );
}

function ParkingDetails({ details }) {
  const state = getAvailabilityState(
    details.availableSlots,
    details.totalSlots
  );
  const hours = buildHoursView(details);

  return (
    <article>
      {/* Neutral placeholder: no Storage bucket exists yet, so no image files. */}
      <div className="pd-photo">
        <div className="parking-photo-placeholder" aria-hidden="true">
          <span>P</span>
        </div>
        <p className="pd-photo-note">{photoNotice(details.photoCount)}</p>
      </div>

      <h1 className="pd-title">{details.name}</h1>
      <p className="pd-address">{formatFullAddress(details)}</p>
      {details.description && (
        <p className="pd-description">{details.description}</p>
      )}

      <div className="pd-grid">
        <section className="pd-card" aria-labelledby="pd-rates-title">
          <h2 id="pd-rates-title">Pricing</h2>
          <dl className="pd-rates">
            <div>
              <dt>2-wheeler</dt>
              <dd>{formatRate(details.rate2w)} / hr</dd>
            </div>
            <div>
              <dt>4-wheeler</dt>
              <dd>{formatRate(details.rate4w)} / hr</dd>
            </div>
          </dl>
        </section>

        <section
          className={`pd-card pd-avail ${state}`}
          aria-labelledby="pd-avail-title"
        >
          <h2 id="pd-avail-title">Availability</h2>
          {state === "unset" ? (
            <p className="pd-unset">{STATE_LABEL.unset}</p>
          ) : (
            <>
              <div className="pd-avail-row">
                <span className="status">{STATE_LABEL[state]}</span>
                <span className="pd-avail-slots">
                  {slotsText(details.availableSlots, details.totalSlots)}
                </span>
              </div>
              <div className="progress">
                <div
                  className="progress-fill"
                  style={{
                    width: `${percentUsed(
                      details.availableSlots,
                      details.totalSlots
                    )}%`,
                  }}
                ></div>
              </div>
              <p className="pd-avail-note">
                Right now through the next hour.
              </p>
            </>
          )}
        </section>

        <section className="pd-card" aria-labelledby="pd-amenities-title">
          <h2 id="pd-amenities-title">Amenities</h2>
          {details.amenities.length === 0 ? (
            <p className="pd-muted">No amenities listed.</p>
          ) : (
            <ul className="pd-chips">
              {details.amenities.map((amenity, index) => (
                <li key={`${amenity.code || amenity.label}-${index}`}>
                  {amenityLabel(amenity)}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="pd-card" aria-labelledby="pd-hours-title">
          <h2 id="pd-hours-title">Operating hours</h2>
          {hours.kind === "24/7" && <p className="pd-open24">Open 24/7</p>}
          {hours.kind === "none" && (
            <p className="pd-muted">Hours not provided</p>
          )}
          {hours.kind === "custom" && (
            <dl className="pd-hours">
              {hours.rows.map((row) => (
                <div key={row.day}>
                  <dt>{row.day}</dt>
                  <dd>{row.text}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      </div>
    </article>
  );
}

export default function ParkingDetailsPage() {
  const params = useParams();
  const rawId = params?.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  const { data, loading, error, refresh } = useParkingDetails({ id });

  let content;
  if (error && !data) {
    content = (
      <div className="parking-state" role="alert">
        <h2>Couldn’t load parking details</h2>
        <p>Something went wrong while loading this parking location.</p>
        <button
          type="button"
          className="btn btn-secondary parking-retry"
          onClick={refresh}
        >
          Try again
        </button>
      </div>
    );
  } else if (loading && !data) {
    content = <DetailsSkeleton />;
  } else if (data && data.notFound) {
    content = (
      <div className="parking-state">
        <h2>Parking not found</h2>
        <p>
          This parking location doesn’t exist or isn’t available right now.
        </p>
        <Link href="/parking" className="pd-state-link">
          View all parking
        </Link>
      </div>
    );
  } else if (data) {
    content = <ParkingDetails details={data} />;
  }

  return (
    <>
      <Navbar />
      <main className="parking-page pd-page" aria-busy={loading}>
        <div className="parking-wrap pd-wrap">
          <BackLink />
          {content}
        </div>
      </main>
    </>
  );
}
