"use client";

import { useEffect, useRef } from "react";
import { supabaseClient } from "../lib/supabaseClient";

export default function Home() {
  // Refs mirror the getElementById() calls in the original js/auth.js and js/chatbot.js
  const appRef = useRef(null);
  const authOverlayRef = useRef(null);
  const loginCardRef = useRef(null);
  const signupCardRef = useRef(null);
  const forgotCardRef = useRef(null);
  const loginFormRef = useRef(null);
  const signupFormRef = useRef(null);
  const forgotFormRef = useRef(null);
  const userNameRef = useRef(null);
  const userEmailRef = useRef(null);
  const navAvatarRef = useRef(null);
  const dropdownAvatarRef = useRef(null);
  const userMenuBtnRef = useRef(null);
  const userDropdownRef = useRef(null);
  const logoutBtnRef = useRef(null);
  const googleLoginBtnRef = useRef(null);

  const chatbotToggleRef = useRef(null);
  const chatbotRef = useRef(null);
  const closeChatRef = useRef(null);
  const sendBtnRef = useRef(null);
  const chatInputRef = useRef(null);
  const chatMessagesRef = useRef(null);
  const resizeHandleRef = useRef(null);

  useEffect(() => {
    // ===================== AUTH LOGIC (ported from js/auth.js) =====================
    const app = appRef.current;
    const authOverlay = authOverlayRef.current;
    const loginCard = loginCardRef.current;
    const signupCard = signupCardRef.current;
    const forgotCard = forgotCardRef.current;
    const loginForm = loginFormRef.current;
    const signupForm = signupFormRef.current;
    const forgotForm = forgotFormRef.current;

    function lockScreen() {
      if (authOverlay) authOverlay.classList.remove("hidden");
      if (app) app.classList.add("blurred");
      document.body.style.overflow = "hidden";
    }

    function unlockScreen() {
      if (authOverlay) authOverlay.classList.add("hidden");
      if (app) app.classList.remove("blurred");
      document.body.style.overflow = "";
    }

    function showOnly(card) {
      [loginCard, signupCard, forgotCard].forEach((c) => {
        if (c) c.classList.add("hidden");
      });
      if (card) card.classList.remove("hidden");
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

      if (authOverlay) authOverlay.classList.add("ready");

      if (data.user) {
        unlockScreen();
        loadUserProfile();
      } else {
        lockScreen();
        showOnly(loginCard);
      }
    }
    updateAuthUI();

    async function handleLoginSubmit(e) {
      e.preventDefault();
      const email = loginForm.querySelector('input[type="email"]').value;
      const password = loginForm.querySelector("#password").value;

      const { error } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.toLowerCase().includes("email not confirmed")) {
          alert(
            "Your email is not verified yet.\n\nPlease check your inbox and click the confirmation link."
          );
        } else {
          alert(error.message);
        }
        return;
      }

      // NOTE: preserved exactly as in the original js/auth.js, including the
      // existing quirk where this resend call runs on every successful login
      // too (not just failed ones). Not fixed here — Phase 1 is parity only.
      await supabaseClient.auth.resend({
        type: "signup",
        email,
      });

      updateAuthUI();
    }
    if (loginForm) loginForm.addEventListener("submit", handleLoginSubmit);

    async function handleSignupSubmit(e) {
      e.preventDefault();

      const email = signupForm.querySelector('input[type="email"]').value;
      const password = signupForm.querySelector('input[type="password"]').value;
      const fullName = signupForm.querySelector('input[type="text"]').value;

      const { error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) {
        alert(error.message);
        return;
      }

      alert("Signup successful! Please check your email to confirm.");
      showOnly(loginCard);
    }
    if (signupForm) signupForm.addEventListener("submit", handleSignupSubmit);

    async function handleForgotSubmit(e) {
      e.preventDefault();
      const email = forgotForm.querySelector('input[type="email"]').value;

      const { error } = await supabaseClient.auth.resetPasswordForEmail(email);

      if (error) {
        alert(error.message);
        return;
      }

      alert("Password reset link sent! Check your email.");
      showOnly(loginCard);
    }
    if (forgotForm) forgotForm.addEventListener("submit", handleForgotSubmit);

    // Switch links (data-auth)
    const authLinks = document.querySelectorAll("[data-auth]");
    function handleAuthLinkClick(e) {
      e.preventDefault();
      const target = e.currentTarget.dataset.auth;

      if (target === "login") showOnly(loginCard);
      if (target === "signup") showOnly(signupCard);
      if (target === "forgot") showOnly(forgotCard);
    }
    authLinks.forEach((btn) =>
      btn.addEventListener("click", handleAuthLinkClick)
    );

    async function getCurrentUser() {
      const { data } = await supabaseClient.auth.getUser();
      return data.user;
    }
    getCurrentUser().then((user) => {
      console.log("Current user:", user);
    });

    function getGravatarUrl(email) {
      const trimmedEmail = email.trim().toLowerCase();
      const hash =
        typeof window !== "undefined" && window.md5 ? window.md5(trimmedEmail) : "";
      return `https://www.gravatar.com/avatar/${hash}?s=200&d=identicon`;
    }

    // User dropdown toggle
    const userMenuBtn = userMenuBtnRef.current;
    const userDropdown = userDropdownRef.current;

    function handleUserMenuClick(e) {
      e.stopPropagation();
      userDropdown.classList.toggle("hidden");
    }
    function handleDocumentClickForDropdown() {
      if (userDropdown) userDropdown.classList.add("hidden");
    }

    if (userMenuBtn && userDropdown) {
      userMenuBtn.addEventListener("click", handleUserMenuClick);
      document.addEventListener("click", handleDocumentClickForDropdown);
    }

    // Logout
    const logoutBtn = logoutBtnRef.current;
    async function handleLogoutClick() {
      await supabaseClient.auth.signOut();
      updateAuthUI();
    }
    if (logoutBtn) logoutBtn.addEventListener("click", handleLogoutClick);

    // Google login
    const googleBtn = googleLoginBtnRef.current;
    async function handleGoogleLoginClick() {
      const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: "google",
      });
      if (error) {
        console.error("Google login error:", error.message);
      }
    }
    if (googleBtn) googleBtn.addEventListener("click", handleGoogleLoginClick);

    // ===================== CHATBOT LOGIC (ported from js/chatbot.js) =====================
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

      fetch("https://wapnwkqyhvdkvbqtstwt.supabase.co/functions/v1/chat-ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:
            "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhcG53a3F5aHZka3ZicXRzdHd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2MTk3MTUsImV4cCI6MjA4NjE5NTcxNX0.VBe9Lt_j6B74ZA2xvDQFGS1il2Tishb5OyM6IzHFmmY",
        },
        body: JSON.stringify({ message: text }),
      })
        .then((res) => res.json())
        .then((data) => {
          typingMsg.remove();
          const botMsg = document.createElement("div");
          botMsg.className = "bot-msg";
          botMsg.textContent = data.reply;
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

    // ===================== CLEANUP =====================
    return () => {
      if (loginForm) loginForm.removeEventListener("submit", handleLoginSubmit);
      if (signupForm)
        signupForm.removeEventListener("submit", handleSignupSubmit);
      if (forgotForm)
        forgotForm.removeEventListener("submit", handleForgotSubmit);
      authLinks.forEach((btn) =>
        btn.removeEventListener("click", handleAuthLinkClick)
      );
      if (userMenuBtn)
        userMenuBtn.removeEventListener("click", handleUserMenuClick);
      document.removeEventListener("click", handleDocumentClickForDropdown);
      if (logoutBtn) logoutBtn.removeEventListener("click", handleLogoutClick);
      if (googleBtn)
        googleBtn.removeEventListener("click", handleGoogleLoginClick);
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
      <div id="app" ref={appRef}>
        <header className="navbar">
          <nav className="nav-container">
            {/* LEFT SECTION */}
            <div className="nav-left">
              <button className="menu-btn">☰</button>

              <div
                className="brand"
                onClick={() => {
                  window.location.href = "index.html";
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

        <main>
          {/* hero */}
          <section className="hero">
            <div className="hero-container">
              <div className="hero-text">
                <h1 className="hero-title">
                  Smart Parking for Smarter Cities
                </h1>
                <p className="hero-subtitle">
                  Find parking faster, reduce congestion, and save fuel using{" "}
                  <br />
                  AI-powered smart parking solutions.
                </p>
                <div className="hero-actions">
                  <a href="dashboard.html" className="btn btn-primary">
                    Get Started
                  </a>
                  <a href="booking.html" className="btn btn-secondary">
                    Instant Book
                  </a>
                </div>
              </div>

              <div className="hero-visual">
                <div className="dashboard-preview">
                  <div className="dp-header">
                    Nearby Parking
                    <span className="live-indicator">
                      <span className="live-dot"></span> Live
                    </span>
                  </div>

                  <div className="dp-card available">
                    <div className="dp-info">
                      <strong>Mall Plaza Parking</strong>
                      <p>0.2 km • ₹30/hr</p>
                      <div className="progress">
                        <div
                          className="progress-fill"
                          style={{ width: "58%" }}
                        ></div>
                      </div>
                    </div>
                    <div className="status-wrap">
                      <span className="status">Available</span>
                      <span className="slots">21/50 slots left</span>
                    </div>
                  </div>

                  <div className="dp-card limited">
                    <div className="dp-info">
                      <strong>City Center Garage</strong>
                      <p>0.5 km • ₹25/hr</p>
                      <div className="progress">
                        <div
                          className="progress-fill"
                          style={{ width: "90%" }}
                        ></div>
                      </div>
                    </div>
                    <div className="status-wrap">
                      <span className="status">Limited</span>
                      <span className="slots">3/30 slots left</span>
                    </div>
                  </div>

                  <div className="dp-card full">
                    <div className="dp-info">
                      <strong>Metro Station Parking</strong>
                      <p>1.2 km • ₹20/hr</p>
                      <div className="progress">
                        <div
                          className="progress-fill"
                          style={{ width: "100%" }}
                        ></div>
                      </div>
                    </div>
                    <div className="status-wrap">
                      <span className="status">Full</span>
                      <span className="slots">0 slots left</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Explore what ParkZo can do for you */}
          <section className="value-section">
            <div className="value-container">
              <p className="value-eyebrow">More than just a tool</p>
              <h2 className="value-title">
                Explore what ParkZo can do for you
              </h2>

              <div className="value-cards">
                <div className="value-card">
                  <div className="value-icon blue">⏱</div>
                  <h3>Save Time</h3>
                  <p>
                    Quickly find nearby parking without roaming around the
                    city.
                  </p>
                </div>

                <div className="value-card">
                  <div className="value-icon purple">📍</div>
                  <h3>Smart Search</h3>
                  <p>
                    Discover the best parking spots using real-time
                    availability.
                  </p>
                </div>

                <div className="value-card">
                  <div className="value-icon red">🅿️</div>
                  <h3>Instant Booking</h3>
                  <p>
                    Reserve parking slots before you arrive and park
                    stress-free.
                  </p>
                </div>

                <div className="value-card">
                  <div className="value-icon green">🌱</div>
                  <h3>Eco Friendly</h3>
                  <p>
                    Reduce fuel waste and congestion with efficient parking.
                  </p>
                </div>
              </div>

              <a href="features.html" className="value-btn">
                View all features
              </a>
            </div>
          </section>

          {/* How ParkZo Works */}
          <section className="how-it-works">
            <div className="hiw-container">
              <h2 className="hiw-title">How ParkZo Works</h2>
              <p className="hiw-subtitle">
                Find and book parking in just three simple steps
              </p>

              <div className="hiw-steps">
                {/* STEP 1 */}
                <div className="hiw-card">
                  <svg
                    className="hiw-ring"
                    viewBox="0 0 320 220"
                    preserveAspectRatio="none"
                  >
                    <defs>
                      <linearGradient
                        id="greenGlow"
                        gradientUnits="userSpaceOnUse"
                      >
                        <stop offset="0%" stopColor="#16a34a" />
                        <stop offset="50%" stopColor="#22c55e" />
                        <stop offset="100%" stopColor="#16a34a" />
                      </linearGradient>
                    </defs>
                    <rect
                      x="6"
                      y="6"
                      width="308"
                      height="208"
                      rx="22"
                      ry="22"
                      pathLength="1"
                    />
                  </svg>

                  <div className="hiw-content">
                    <div className="hiw-icon">🔍</div>
                    <h3>Search</h3>
                    <p>
                      Search nearby parking locations based on your
                      destination.
                    </p>
                  </div>
                </div>

                {/* STEP 2 */}
                <div className="hiw-card">
                  <svg
                    className="hiw-ring"
                    viewBox="0 0 320 220"
                    preserveAspectRatio="none"
                  >
                    <rect
                      x="6"
                      y="6"
                      width="308"
                      height="208"
                      rx="22"
                      ry="22"
                      pathLength="1"
                    />
                  </svg>

                  <div className="hiw-content">
                    <div className="hiw-icon">🅿️</div>
                    <h3>Book</h3>
                    <p>Select an available slot and reserve it instantly.</p>
                  </div>
                </div>

                {/* STEP 3 */}
                <div className="hiw-card">
                  <svg
                    className="hiw-ring"
                    viewBox="0 0 320 220"
                    preserveAspectRatio="none"
                  >
                    <rect
                      x="6"
                      y="6"
                      width="308"
                      height="208"
                      rx="22"
                      ry="22"
                      pathLength="1"
                    />
                  </svg>

                  <div className="hiw-content">
                    <div className="hiw-icon">🚗</div>
                    <h3>Park</h3>
                    <p>
                      Reach the location, park smoothly, and go stress-free.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Real Impact at City Scale */}
          <section className="impact">
            <div className="impact-container">
              <h2 className="impact-title">Real Impact at City Scale</h2>
              <p className="impact-subtitle">
                ParkZo delivers measurable improvements in time, cost, and
                congestion.
              </p>

              <div className="impact-grid">
                <div className="impact-item">
                  <span className="impact-number">30%</span>
                  <p className="impact-text">
                    Less time spent searching for parking with live
                    availability.
                  </p>
                </div>

                <div className="impact-item">
                  <span className="impact-number">55%</span>
                  <p className="impact-text">
                    Better utilization of existing parking spaces.
                  </p>
                </div>

                <div className="impact-item">
                  <span className="impact-number co2">
                    CO₂ <span className="co2-arrow">↓</span>
                  </span>
                  <p className="impact-text">
                    Lower fuel consumption and reduced carbon emissions.
                  </p>
                </div>

                <div className="impact-item">
                  <span className="impact-number">₹</span>
                  <p className="impact-text">
                    Reduced daily parking-related costs for drivers.
                  </p>
                </div>
              </div>
            </div>
          </section>
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

          <div className="footer-bottom">
            © 2026 ParkZo. All rights reserved.
          </div>
        </footer>

        <div
          className="chatbot-toggle"
          id="chatbotToggle"
          ref={chatbotToggleRef}
        >
          💬
        </div>
      </div>

      {/* AUTH OVERLAY */}
      <div id="authOverlay" className="auth-overlay" ref={authOverlayRef}>
        {/* LOGIN */}
        <div className="auth-card" id="loginCard" ref={loginCardRef}>
          <h2>Welcome back !</h2>
          <p className="auth-subtext">Log in to manage your parking easily</p>

          <form id="loginForm" ref={loginFormRef} className="auth-form">
            <div className="input-group">
              <label>Email</label>
              <input type="email" placeholder="you@example.com" required />
            </div>

            <div className="input-group">
              <label>Password</label>
              <input
                type="password"
                id="password"
                placeholder="••••••••"
                required
              />
            </div>

            <div className="auth-row">
              <label className="show-password">
                <input type="checkbox" id="showPassword" />
                Show password
              </label>
              <a href="#" className="link" data-auth="forgot">
                Forgot password?
              </a>
            </div>

            <button type="submit" className="auth-btn">
              Log in
            </button>

            <div className="divider">OR</div>

            <button
              type="button"
              id="googleLoginBtn"
              ref={googleLoginBtnRef}
              className="auth-btn google-btn"
            >
              <i className="fab fa-google"></i> Continue with Google
            </button>
          </form>

          <p className="auth-footer">
            Don’t have an account?{" "}
            <a href="#" className="link" data-auth="signup">
              Create one
            </a>
          </p>
        </div>

        {/* SIGNUP */}
        <div className="auth-card hidden" id="signupCard" ref={signupCardRef}>
          <h2>Create your account</h2>
          <p className="auth-subtext">Join ParkZo and Park Smarter</p>

          <form id="signupForm" ref={signupFormRef} className="auth-form">
            <div className="input-group">
              <label>Full Name</label>
              <input type="text" required />
            </div>

            <div className="input-group">
              <label>Email</label>
              <input type="email" placeholder="you@example.com" required />
            </div>

            <div className="input-group">
              <label>Password</label>
              <input
                type="password"
                id="password"
                placeholder="••••••••"
                required
              />
            </div>

            <div className="input-group">
              <label>Confirm Password</label>
              <input
                type="password"
                id="confirmPassword"
                placeholder="••••••••"
                required
              />
            </div>

            <div className="auth-row">
              <label className="show-password">
                <input type="checkbox" id="showPassword" />
                Show password
              </label>
            </div>

            <button type="submit" className="auth-btn">
              Sign up
            </button>
          </form>

          <p className="auth-footer">
            Already have an account?{" "}
            <a href="#" className="link" data-auth="login">
              Log in
            </a>
          </p>
        </div>

        {/* FORGOT PASSWORD */}
        <div className="auth-card hidden" id="forgotCard" ref={forgotCardRef}>
          <h2>Forgot your password?</h2>
          <p className="auth-subtext">
            Enter your email and we’ll send you a reset link
          </p>

          <form id="forgotForm" ref={forgotFormRef} className="auth-form">
            <div className="input-group">
              <label>Email</label>
              <input type="email" id="email" required />
            </div>

            <button type="submit" className="auth-btn">
              Send reset link
            </button>
          </form>

          <p className="auth-footer">
            Remembered your password?{" "}
            <a href="#" className="link" data-auth="login">
              Back to login
            </a>
          </p>
        </div>
      </div>
    </>
  );
}
