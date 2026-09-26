"use client";

import Navbar from "../../components/Navbar";

export default function ContactPage() {
  return (
    <>
      <Navbar />

      {/* CONTACT SECTION */}
      <main className="contact-page">
        <div className="contact-container">
          <h2 className="contact-title">Get in Touch</h2>
          <p className="contact-subtitle">
            Have a question, feedback, or need help? We’re here for you.
          </p>

          {/* No onSubmit, no action/method — exactly as in the original,
              which has no id, no handler, and no backend wired to it at
              all. Left as plain native form markup, matching the current
              (non-functional) behavior: submitting reloads the page via
              the browser's default GET submission. Not fixed, not given
              a fake success/error message. */}
          <form className="contact-form">
            <div className="form-group">
              <label>Name</label>
              <input type="text" placeholder="Your full name" required />
            </div>

            <div className="form-group">
              <label>Email</label>
              <input type="email" placeholder="you@example.com" required />
            </div>

            <div className="form-group">
              <label>Phone Number</label>
              <input type="tel" placeholder="+91 XXXXX XXXXX" />
            </div>

            <div className="form-group">
              <label>Message</label>
              <textarea
                rows="4"
                placeholder="Write your message here..."
                required
              ></textarea>
            </div>

            <button type="submit" className="contact-btn">
              Send Message
            </button>
          </form>
        </div>
      </main>

      {/* FOOTER */}
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
            <a href="/contact" className="footer-link">
              Contact
            </a>
          </div>
        </div>

        <div className="footer-bottom">© 2026 ParkZo. All rights reserved.</div>
      </footer>
    </>
  );
}
