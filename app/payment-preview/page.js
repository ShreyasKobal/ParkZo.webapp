"use client";

import { useEffect, useState } from "react";
import { supabaseClient } from "../../lib/supabaseClient";
import "../../css/payment-preview.css";

export default function PaymentPreviewPage() {
  const [preview, setPreview] = useState({
    location: "",
    time: "",
    vehicle: "",
    price: "",
  });

  useEffect(() => {
    const bookingLocation = sessionStorage.getItem("bookingLocation");
    const timeRange = sessionStorage.getItem("timeRange");
    const amountPaid = sessionStorage.getItem("amountPaid");
    const bookingDate = sessionStorage.getItem("bookingDate");

    if (!bookingLocation || !timeRange || !amountPaid || !bookingDate) {
      alert("Booking data missing. Please book again.");
      // Original redirected to booking.html; booking is already migrated,
      // so this points to /booking.
      window.location.href = "/booking";
      return;
    }

    setPreview({
      location: bookingLocation,
      time: `${bookingDate} | ${timeRange}`,
      // Preserved exactly, including the fragile inference: amountPaid is
      // a string from sessionStorage, and "%" coerces it the same way the
      // original did. Not fixed here.
      vehicle: amountPaid % 30 === 0 ? "4 Wheeler" : "2 Wheeler",
      price: `₹${amountPaid}`,
    });
  }, []);

  // Ported from the original's payNowBtn click handler, unchanged in
  // behavior. bookingId is read fresh at click time, same as before.
  async function handlePayNow() {
    const bookingId = sessionStorage.getItem("bookingId");

    if (!bookingId) {
      alert("Booking not found");
      return;
    }

    const { error } = await supabaseClient
      .from("parking_bookings")
      .update({
        payment_status: "paid",
        payment_time: new Date().toISOString(),
      })
      .eq("id", bookingId);

    if (error) {
      alert("Payment failed");
      console.error(error);
      return;
    }

    sessionStorage.clear();
    window.location.href = "/payment-success";
  }

  return (
    <>
      <header className="navbar">
        <nav className="nav-container">
          {/* LEFT SECTION — no onClick on .brand here, matching the
              original exactly (unlike other pages, this page's brand
              isn't wired to navigate home). */}
          <div className="nav-left">
            <button className="menu-btn">☰</button>

            <div className="brand">
              <button className="brand-btn">
                <h1 className="brand-name">ParkZo</h1>
                <span className="brand-dots">...</span>
                <div className="car-anim-wrapper">
                  <img
                    src="/images/carlogo.png"
                    alt="Car Logo"
                    className="brand-logo car-anim"
                  />
                </div>
              </button>
              <p className="brand-tagline">Find Park Go!</p>
            </div>
          </div>

          {/* Center search bar is commented out in the original — omitted
              here too, not reintroduced. */}

          {/* RIGHT SECTION — intentionally decorative, no handlers, no
              dropdown, no chatbot. This page never loaded js/auth.js or
              js/chatbot.js, so none of that functionality is ported here. */}
          <div className="nav-right">
            <button className="nav-link">Contact</button>

            <button className="icon-btn notification-btn">
              🔔
              <span className="notification-dot"></span>
            </button>

            <button className="icon-btn">
              <img src="/images/chatbotlogo.png" alt="Chat" />
            </button>

            <button className="icon-btn">
              <img src="/images/userlogo.png" alt="User" />
            </button>
          </div>
        </nav>
      </header>

      <main>
        <div className="preview-page">
          <div className="preview-card">
            <h2>Available Parking</h2>

            <div className="preview-row">
              <span className="label">Location</span>
              <span className="value">{preview.location}</span>
            </div>

            <div className="preview-row">
              <span className="label">Date | Time</span>
              <span className="value">{preview.time}</span>
            </div>

            <div className="preview-row">
              <span className="label">Vehicle Type</span>
              <span className="value">{preview.vehicle}</span>
            </div>

            <div className="preview-row price">
              <span className="label">Price</span>
              <span className="value">{preview.price}</span>
            </div>

            <button className="pay-btn" onClick={handlePayNow}>
              Proceed to Pay
            </button>
          </div>
        </div>
      </main>

      <footer className="footer">
        <div className="footer-container">
          <div className="footer-left">
            <div className="footer-branding">
              <span className="footer-brand-name">ParkZo</span>
              <span className="footer-brand-dots">...</span>
              <img
                src="/images/carlogo.png"
                alt="ParkZo car"
                className="footer-car"
              />
            </div>

            <p className="footer-tagline">
              Smart, reliable parking for smarter cities.
            </p>
          </div>

          <div className="footer-right">
            <a href="#" className="footer-link">
              Privacy
            </a>
            <a href="#" className="footer-link">
              Terms
            </a>
            <a href="#" className="footer-link">
              Contact
            </a>
          </div>
        </div>

        <div className="footer-bottom">© 2026 ParkZo. All rights reserved.</div>
      </footer>
    </>
  );
}
