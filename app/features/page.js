"use client";

import { useEffect, useRef } from "react";
import { supabaseClient } from "../../lib/supabaseClient";
import "./features.css";

export default function FeaturesPage() {
  // Refs mirror the getElementById() calls in js/auth.js and js/chatbot.js
  const userNameRef = useRef(null);
  const userEmailRef = useRef(null);
  const navAvatarRef = useRef(null);
  const dropdownAvatarRef = useRef(null);
  const userMenuBtnRef = useRef(null);
  const userDropdownRef = useRef(null);
  const logoutBtnRef = useRef(null);

  const chatbotToggleRef = useRef(null);
  const chatbotRef = useRef(null);
  const closeChatRef = useRef(null);
  const sendBtnRef = useRef(null);
  const chatInputRef = useRef(null);
  const chatMessagesRef = useRef(null);
  const resizeHandleRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    // ===================== AUTH GATE (ported from js/auth-gate.js) =====================
    // Active on this page in the original. Original redirected to
    // "index.html"; per the established conversion convention, that's "/".
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

    // ===================== CHATBOT (ported from js/chatbot.js) =====================
    const toggleBtn = chatbotToggleRef.current;
    const chatbot = chatbotRef.current;
    const closeChat = closeChatRef.current;
    const sendBtn = sendBtnRef.current;
    const chatInput = chatInputRef.current;
    const chatMessages = chatMessagesRef.current;
    const resizeHandle = resizeHandleRef.current;

    function openChat() {
      if (chatbot) chatbot.classList.remove("hidden");
    }
    function closeChatWindow() {
      if (chatbot) chatbot.classList.add("hidden");
    }

    function sendMessage() {
      const text = chatInput.value.trim();
      if (!text) return;

      const userMsg = document.createElement("div");
      userMsg.className = "user-msg";
      userMsg.textContent = text;
      chatMessages.appendChild(userMsg);

      chatInput.value = "";
      chatMessages.scrollTop = chatMessages.scrollHeight;

      const typingMsg = document.createElement("div");
      typingMsg.className = "bot-msg";
      typingMsg.textContent = "Thinking...";
      chatMessages.appendChild(typingMsg);
      chatMessages.scrollTop = chatMessages.scrollHeight;

      // Same existing "chat-ai" Supabase Edge Function as the other pages,
      // via the shared client — nothing hardcoded here.
      supabaseClient.functions
        .invoke("chat-ai", { body: { message: text } })
        .then(({ data, error }) => {
          if (error) {
            typingMsg.textContent = "Something went wrong.";
            console.error(error);
            return;
          }
          typingMsg.remove();
          const botMsg = document.createElement("div");
          botMsg.className = "bot-msg";
          botMsg.textContent = data?.reply;
          chatMessages.appendChild(botMsg);
          chatMessages.scrollTop = chatMessages.scrollHeight;
        })
        .catch((err) => {
          typingMsg.textContent = "Something went wrong.";
          console.error(err);
        });
    }

    function handleChatInputKeypress(e) {
      if (e.key === "Enter") sendMessage();
    }

    if (toggleBtn) toggleBtn.addEventListener("click", openChat);
    if (closeChat) closeChat.addEventListener("click", closeChatWindow);
    if (sendBtn) sendBtn.addEventListener("click", sendMessage);
    if (chatInput)
      chatInput.addEventListener("keypress", handleChatInputKeypress);

    let isResizing = false;
    function handleResizeMouseDown() {
      isResizing = true;
    }
    function handleResizeMouseMove(e) {
      if (!isResizing) return;
      const newWidth = window.innerWidth - e.clientX - 24;
      const minWidth = 280;
      const maxWidth = 500;
      if (newWidth >= minWidth && newWidth <= maxWidth) {
        chatbot.style.width = newWidth + "px";
      }
    }
    function handleResizeMouseUp() {
      isResizing = false;
    }

    if (resizeHandle)
      resizeHandle.addEventListener("mousedown", handleResizeMouseDown);
    document.addEventListener("mousemove", handleResizeMouseMove);
    document.addEventListener("mouseup", handleResizeMouseUp);

    return () => {
      cancelled = true;
      if (userMenuBtn)
        userMenuBtn.removeEventListener("click", handleUserMenuClick);
      document.removeEventListener("click", handleDocumentClickForDropdown);
      if (logoutBtn)
        logoutBtn.removeEventListener("click", handleLogoutClick);
      if (toggleBtn) toggleBtn.removeEventListener("click", openChat);
      if (closeChat) closeChat.removeEventListener("click", closeChatWindow);
      if (sendBtn) sendBtn.removeEventListener("click", sendMessage);
      if (chatInput)
        chatInput.removeEventListener("keypress", handleChatInputKeypress);
      if (resizeHandle)
        resizeHandle.removeEventListener("mousedown", handleResizeMouseDown);
      document.removeEventListener("mousemove", handleResizeMouseMove);
      document.removeEventListener("mouseup", handleResizeMouseUp);
    };
  }, []);

  return (
    <>
      {/* Route-scoped body override, ported from features.css's page-specific
          body { background: #fafafa; color: #0f172a; } rule. Using an
          embedded <style> tag (mounts/unmounts with this component) rather
          than putting this in features.css, so it can never leak onto other
          routes after client-side navigation — same technique already used
          for receipt.html's dark theme. */}
      <style>{`
        body {
          background: #fafafa;
          color: #0f172a;
        }
      `}</style>

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
            <a href="contact.html" className="nav-link">
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

            {/* Chatbot Window */}
            <div className="chatbot hidden" id="chatbot" ref={chatbotRef}>
              <div className="resize-handle" ref={resizeHandleRef}></div>
              <div className="chatbot-header">
                <span>ParkZo Assistant</span>
                <button id="closeChat" ref={closeChatRef}>
                  ✕
                </button>
              </div>

              <div
                className="chatbot-messages"
                id="chatMessages"
                ref={chatMessagesRef}
              >
                <div className="bot-msg">
                  👋 Hi! I’m ParkZo Assistant. How can I help you today?
                </div>
              </div>

              <div className="chatbot-input">
                <input
                  type="text"
                  id="chatInput"
                  ref={chatInputRef}
                  placeholder="Ask about parking, booking, prices..."
                />
                <button id="sendBtn" ref={sendBtnRef}>
                  ➤
                </button>
              </div>
            </div>
          </div>
        </nav>
      </header>

      {/* ================= FEATURES HERO ================= */}
      <section className="features-hero">
        <h1>Everything ParkZo helps you do</h1>
        <p className="hero-subtext">
          Discover how ParkZo makes parking faster, smarter, and stress-free.
        </p>
      </section>

      {/* ================= FEATURES CONTENT ================= */}
      <section className="features-wrapper">
        <div className="feature-group">
          <h2>Finding Parking</h2>

          <div className="feature-card">
            <h3>Smart Search</h3>
            <ul>
              <li>Live nearby parking availability</li>
              <li>Distance and price based sorting</li>
              <li>Map-based navigation</li>
            </ul>
          </div>

          <div className="feature-card">
            <h3>Save Time</h3>
            <ul>
              <li>No circling streets</li>
              <li>Instant parking discovery</li>
              <li>Accurate directions</li>
            </ul>
          </div>
        </div>

        <div className="feature-group">
          <h2>Booking &amp; Payments</h2>

          <div className="feature-card">
            <h3>Instant Booking</h3>
            <ul>
              <li>Reserve before arrival</li>
              <li>Guaranteed parking slots</li>
              <li>Flexible timings</li>
            </ul>
          </div>

          <div className="feature-card">
            <h3>Secure Payments</h3>
            <ul>
              <li>Multiple payment options</li>
              <li>Transparent pricing</li>
              <li>Auto-generated receipts</li>
            </ul>
          </div>
        </div>

        {/* NOTE: the original HTML has an extra, unmatched closing </div>
            immediately after this card. Browsers silently absorb stray
            closing tags, so it had no visual effect — but JSX requires
            balanced tags and will not compile with it. Dropped as the
            minimum change required for this page to build, per the
            migration rules' own carve-out for compile-required fixes. */}
        <div className="feature-bottom-card">
          <h3>Ready to park smarter?</h3>
          <a href="/booking" className="cta-btn">
            Start using ParkZo
          </a>
        </div>
      </section>

      {/* ================= FOOTER ================= */}
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
              href="contact.html"
              className="footer-link"
              onClick={() => {
                window.location.href = "contact.html";
              }}
            >
              Contact
            </a>
          </div>
        </div>

        <div className="footer-bottom">© 2026 ParkZo. All rights reserved.</div>
      </footer>

      <div className="chatbot-toggle" id="chatbotToggle" ref={chatbotToggleRef}>
        💬
      </div>
    </>
  );
}
