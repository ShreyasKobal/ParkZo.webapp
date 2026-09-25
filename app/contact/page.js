"use client";

import { useEffect, useRef } from "react";
import { supabaseClient } from "../../lib/supabaseClient";

export default function ContactPage() {
  // Refs mirror the getElementById() calls in js/auth.js (navbar profile /
  // dropdown / logout). No chatbot refs here — contact.html has no
  // chatbot-toggle button and js/chatbot.js is commented out, so there is
  // nothing to wire up for the chatbot on this page.
  const userNameRef = useRef(null);
  const userEmailRef = useRef(null);
  const navAvatarRef = useRef(null);
  const dropdownAvatarRef = useRef(null);
  const userMenuBtnRef = useRef(null);
  const userDropdownRef = useRef(null);
  const logoutBtnRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    // ===================== AUTH GATE (ported from js/auth-gate.js) =====================
    // Active on this page in the original (unlike booking.html/payment-
    // preview.html, where it's commented out). Original redirected to
    // "index.html"; per the approved navigation conversion, that's now "/".
    async function protectPage() {
      const { data } = await supabaseClient.auth.getUser();
      if (cancelled) return;
      if (!data.user) {
        window.location.href = "/";
      }
    }

    // ===================== NAVBAR PROFILE (ported from js/auth.js) =====================
    function getGravatarUrl(email) {
      const trimmedEmail = email.trim().toLowerCase();
      const hash =
        typeof window !== "undefined" && window.md5
          ? window.md5(trimmedEmail)
          : "";
      return `https://www.gravatar.com/avatar/${hash}?s=200&d=identicon`;
    }

    async function loadUserProfile() {
      const {
        data: { user },
      } = await supabaseClient.auth.getUser();
      if (!user) return;

      const nameEl = userNameRef.current;
      const emailEl = userEmailRef.current;
      const navAvatar = navAvatarRef.current;
      const dropdownAvatar = dropdownAvatarRef.current;

      if (nameEl) {
        const fullName =
          user.user_metadata?.full_name || user.user_metadata?.name || "User";
        nameEl.textContent = `Hi, ${fullName}`;
      }
      if (emailEl) {
        emailEl.textContent = user.email;
      }

      let avatarUrl;
      if (user.user_metadata?.avatar_url) {
        avatarUrl = user.user_metadata.avatar_url;
      } else {
        avatarUrl = getGravatarUrl(user.email);
      }
      if (navAvatar) navAvatar.src = avatarUrl;
      if (dropdownAvatar) dropdownAvatar.src = avatarUrl;
    }

    async function updateAuthUI() {
      const { data } = await supabaseClient.auth.getUser();
      if (cancelled) return;
      if (data.user) {
        loadUserProfile();
      }
    }

    protectPage();
    updateAuthUI();

    // User dropdown toggle (same as js/auth.js)
    const userMenuBtn = userMenuBtnRef.current;
    const userDropdown = userDropdownRef.current;
    function handleUserMenuClick(e) {
      e.stopPropagation();
      if (userDropdown) userDropdown.classList.toggle("hidden");
    }
    function handleDocumentClickForDropdown() {
      if (userDropdown) userDropdown.classList.add("hidden");
    }
    if (userMenuBtn && userDropdown) {
      userMenuBtn.addEventListener("click", handleUserMenuClick);
      document.addEventListener("click", handleDocumentClickForDropdown);
    }

    // Logout (same as js/auth.js)
    const logoutBtn = logoutBtnRef.current;
    async function handleLogoutClick() {
      await supabaseClient.auth.signOut();
      updateAuthUI();
    }
    if (logoutBtn) logoutBtn.addEventListener("click", handleLogoutClick);

    return () => {
      cancelled = true;
      if (userMenuBtn)
        userMenuBtn.removeEventListener("click", handleUserMenuClick);
      document.removeEventListener("click", handleDocumentClickForDropdown);
      if (logoutBtn)
        logoutBtn.removeEventListener("click", handleLogoutClick);
    };
  }, []);

  return (
    <>
      <header className="navbar">
        <nav className="nav-container">
          {/* LEFT SECTION */}
          <div className="nav-left">
            <button className="menu-btn">☰</button>

            <div
              className="brand"
              onClick={() => {
                window.location.href = "/";
              }}
            >
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

          {/* CENTER SECTION */}
          <div className="nav-center">
            <div className="search-wrapper">
              <input
                type="text"
                placeholder="Search for the location..."
                className="search-input"
              />
              <button className="search-btn">
                <i className="fas fa-search"></i>
              </button>
            </div>
          </div>

          {/* RIGHT SECTION */}
          <div className="nav-right">
            <a href="/contact" className="nav-link">
              Contact
            </a>

            <button className="icon-btn notification-btn">🔔</button>

            <div className="user-menu-wrapper">
              <button
                className="icon-btn"
                id="userMenuBtn"
                ref={userMenuBtnRef}
              >
                <div className="nav-avatar-ring">
                  <div className="nav-avatar-inner">
                    <img
                      id="navUserAvatar"
                      ref={navAvatarRef}
                      src="/images/userlogo.png"
                      alt="User"
                    />
                  </div>
                </div>
              </button>

              {/* USER DROPDOWN */}
              <div
                className="user-dropdown hidden"
                id="userDropdown"
                ref={userDropdownRef}
              >
                <div className="user-dropdown-header">
                  <div className="dropdown-avatar-ring">
                    <div className="dropdown-avatar-inner">
                      <img
                        id="dropdownUserAvatar"
                        ref={dropdownAvatarRef}
                        className="user-avatar"
                        src="/images/userlogo.png"
                        alt=""
                      />
                    </div>
                  </div>
                  <div>
                    <strong id="userName" ref={userNameRef}>
                      Hi, User
                    </strong>
                    <br />
                    <span
                      id="userEmail"
                      ref={userEmailRef}
                      className="user-email"
                    ></span>
                  </div>
                </div>

                <ul className="user-dropdown-list">
                  <li>👤 Profile</li>
                  <li>💎 Membership</li>
                  <li>⚙️ Settings</li>
                  <li id="logoutBtn" ref={logoutBtnRef} className="logout">
                    🚪 Sign out
                  </li>
                </ul>
              </div>
            </div>

            {/* Chatbot window markup — present in the DOM exactly as in
                contact.html, but there is no toggle button anywhere on
                this page and no chatbot.js logic attached, so it can
                never actually be opened. Preserved as inert, unreachable
                markup, not activated. */}
            <div className="chatbot hidden" id="chatbot">
              <div className="resize-handle"></div>
              <div className="chatbot-header">
                <span>ParkZo Assistant</span>
                <button id="closeChat">✕</button>
              </div>

              <div className="chatbot-messages" id="chatMessages">
                <div className="bot-msg">
                  👋 Hi! I’m ParkZo Assistant. How can I help you today?
                </div>
              </div>

              <div className="chatbot-input">
                <input
                  type="text"
                  id="chatInput"
                  placeholder="Ask about parking, booking, prices..."
                />
                <button id="sendBtn">➤</button>
              </div>
            </div>
          </div>
        </nav>
      </header>

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
            <a
              href="/contact"
              className="footer-link"
              onClick={() => {
                window.location.href = "/contact";
              }}
            >
              Contact
            </a>
          </div>
        </div>

        <div className="footer-bottom">© 2026 ParkZo. All rights reserved.</div>
      </footer>
    </>
  );
}
