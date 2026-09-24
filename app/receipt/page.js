"use client";

import { useEffect, useState } from "react";
import { supabaseClient } from "../../lib/supabaseClient";

export default function ReceiptPage() {
  const [receipt, setReceipt] = useState(null);

  useEffect(() => {
    let cancelled = false;

    // Ported from receipt.html's inline loadReceipt() exactly, including
    // its existing quirks: no redirect on a Supabase query error (just an
    // alert, leaving the card blank), and no loading indicator — fields
    // render empty until the query resolves, same visible flash as today.
    async function loadReceipt() {
      const bookingId = sessionStorage.getItem("receiptBookingId");

      if (!bookingId) {
        alert("No receipt found");
        window.location.href = "/";
        return;
      }

      const { data, error } = await supabaseClient
        .from("parking_bookings")
        .select("*")
        .eq("id", bookingId)
        .single();

      if (cancelled) return;

      if (error) {
        alert("Failed to load receipt");
        return;
      }

      setReceipt(data);
    }

    loadReceipt();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      {/* Embedded styles, ported verbatim from receipt.html's <style> block
          rather than a new css/receipt.css file, per approved decision.
          The body { background: ... } rule below only applies while this
          page is mounted — it reverts automatically once the user
          navigates elsewhere, same as the original per-page <style> did. */}
      <style>{`
        body {
          background: linear-gradient(135deg, #0f172a, #020617);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
        }

        .receipt-card {
          width: 100%;
          max-width: 520px;
          background: #ffffff;
          border-radius: 16px;
          padding: 28px;
          box-shadow: 0 25px 60px rgba(0,0,0,0.25);
          animation: fadeUp 0.4s ease;
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .receipt-header {
          text-align: center;
          margin-bottom: 24px;
        }

        .receipt-header h2 {
          margin: 0;
          font-size: 24px;
          color: #0f172a;
        }

        .receipt-header p {
          margin-top: 6px;
          color: #16a34a;
          font-weight: 600;
        }

        .receipt-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 12px;
          font-size: 15px;
        }

        .receipt-row span:first-child {
          color: #64748b;
        }

        .receipt-row span:last-child {
          font-weight: 600;
          color: #0f172a;
          text-align: right;
        }

        .divider {
          height: 1px;
          background: #0f172a;
          margin: 18px 0;
        }

        .total {
          font-size: 18px;
          font-weight: 700;
          color: #16a34a;
        }

        .footer-actions {
          margin-top: 24px;
          display: flex;
          justify-content: center;
        }

        .home-btn {
          background: #020617;
          color: #fff;
          padding: 12px 26px;
          border-radius: 10px;
          text-decoration: none;
          font-weight: 600;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          border: #131702 solid 1px;
        }

        .home-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 10px 20px rgba(0,0,0,0.25);
          background-color: white;
          color: #020617;
          border: #020617 solid 1px;
        }
      `}</style>

      <div className="receipt-card">
        <div className="receipt-header">
          <h2>ParkZo Receipt</h2>
          {/* Preserved exactly as-is, unconditional, per approved decision:
              not tied to the real payment_status field. */}
          <p>Payment Successful ✅</p>
        </div>

        <div className="receipt-row">
          <span>Booking ID</span>
          <span>{receipt?.id ?? ""}</span>
        </div>

        <div className="receipt-row">
          <span>Customer Name</span>
          <span>{receipt?.customer_name ?? ""}</span>
        </div>

        <div className="receipt-row">
          <span>Vehicle Number</span>
          <span>{receipt?.vehicle_number ?? ""}</span>
        </div>

        <div className="receipt-row">
          <span>Location</span>
          <span>{receipt?.location ?? ""}</span>
        </div>

        <div className="receipt-row">
          <span>Date</span>
          <span>{receipt?.booking_date ?? ""}</span>
        </div>

        <div className="receipt-row">
          <span>Time</span>
          <span>
            {receipt ? `${receipt.start_time} - ${receipt.end_time}` : ""}
          </span>
        </div>

        <div className="receipt-row">
          <span>Vehicle Type</span>
          {/* .replace("_", " ") only replaces the first underscore — same
              as the original, preserved as-is. */}
          <span>{receipt?.vehicle_type?.replace("_", " ") ?? ""}</span>
        </div>

        <div className="divider"></div>

        <div className="receipt-row total">
          <span>Amount Paid</span>
          <span>{receipt ? `₹${receipt.amount_paid}` : ""}</span>
        </div>

        <div className="footer-actions">
          <a href="/" className="home-btn">
            Go to Home
          </a>
        </div>
      </div>
    </>
  );
}
