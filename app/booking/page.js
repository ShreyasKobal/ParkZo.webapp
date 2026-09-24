"use client";

import { useEffect, useRef } from "react";
import { supabaseClient } from "../../lib/supabaseClient";
import "../../css/booking.css";

const PRICE_PER_HOUR = {
  "2_wheeler": 20,
  "4_wheeler": 30,
};

function calculateAmount(startTime, endTime, vehicleType) {
  const start = new Date(`1970-01-01T${startTime}:00`);
  const end = new Date(`1970-01-01T${endTime}:00`);

  const diffMs = end - start;
  const hours = diffMs / (1000 * 60 * 60);

  return Math.max(1, hours) * PRICE_PER_HOUR[vehicleType];
}

export default function Booking() {
  // Refs mirror the getElementById() calls in the original js/auth.js and
  // js/chatbot.js (navbar profile / dropdown / logout / chatbot widget)
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

  const bookingFormRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    // ===================== NAVBAR PROFILE (ported from js/auth.js) =====================
    // Note: js/auth-gate.js is commented out in the original booking.html,
    // so this page does NOT redirect unauthenticated visitors away — the
    // form stays publicly viewable. Preserved exactly, not added here.
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
      // No #app/#authOverlay/#loginCard on this page — same as dashboard,
      // that branch was always a no-op here in the original too.
    }

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

    // ===================== BOOKING FORM (ported from booking.html's inline script) =====================
    const bookingForm = bookingFormRef.current;

    async function handleBookingSubmit(e) {
      e.preventDefault();

      // 1) Get authenticated user first (checked only at submit time —
      // the page itself stays publicly viewable, matching the original
      // with js/auth-gate.js commented out)
      const {
        data: { user },
        error: userError,
      } = await supabaseClient.auth.getUser();

      if (userError || !user) {
        alert("User not authenticated");
        return;
      }

      // 2) Read form values
      const customerName = document.getElementById("customerName").value;
      const vehicleNumber = document.getElementById("vehicleNumber").value;
      const bookingDate = document.getElementById("bookingDate").value;
      const startTime = document.getElementById("startTime").value;
      const endTime = document.getElementById("endTime").value;
      const vehicleType = document.querySelector(
        'input[name="vehicleType"]:checked'
      ).value;
      const bookingLocation = document.getElementById("location").value;

      if (endTime <= startTime) {
        alert("End time must be after start time");
        return;
      }

      const amountPaid = calculateAmount(startTime, endTime, vehicleType);

      // 3) Insert with user_id (RLS safe)
      const { data, error } = await supabaseClient
        .from("parking_bookings")
        .insert([
          {
            user_id: user.id,
            customer_name: customerName,
            vehicle_number: vehicleNumber,
            booking_date: bookingDate,
            start_time: startTime,
            end_time: endTime,
            vehicle_type: vehicleType,
            location: bookingLocation,
            amount_paid: amountPaid,
            payment_status: "pending",
          },
        ])
        .select()
        .single();

      if (error) {
        console.error(error);
        alert("Booking failed");
        return;
      }

      // 4) Store for the receipt page
      sessionStorage.setItem("bookingId", data.id);
      sessionStorage.setItem("amountPaid", amountPaid);
      sessionStorage.setItem("bookingLocation", bookingLocation);
      sessionStorage.setItem("timeRange", `${startTime} - ${endTime}`);
      sessionStorage.setItem("bookingDate", bookingDate);
      sessionStorage.setItem("receiptBookingId", data.id);

      // 5) Redirect — the original went to receipt.html; per approved
      // decision this now points to the migrated /receipt route instead.
      window.location.href = "/receipt";
    }

    if (bookingForm)
      bookingForm.addEventListener("submit", handleBookingSubmit);

    // ===================== CLEANUP =====================
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
      if (bookingForm)
        bookingForm.removeEventListener("submit", handleBookingSubmit);
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
        <div className="booking-page">
          <div className="booking-card">
            <h2>Book Your Parking</h2>
            <p className="subtitle">Fill the details below</p>

            <form
              className="booking-form"
              id="bookingForm"
              ref={bookingFormRef}
            >
              {/* Name */}
              <div className="form-group">
                <label>Name of Customer</label>
                <input
                  type="text"
                  id="customerName"
                  placeholder="Enter your name"
                  required
                />
              </div>

              {/* Vehicle Number */}
              <div className="form-group">
                <label>Vehicle Number</label>
                <input
                  type="text"
                  id="vehicleNumber"
                  placeholder="KA 01 AB 1234"
                  required
                />
              </div>

              {/* Time */}
              <div className="form-group time-group">
                <div>
                  <label>From</label>
                  <input type="time" id="startTime" required />
                </div>

                <div>
                  <label>To</label>
                  <input type="time" id="endTime" required />
                </div>
              </div>

              {/* Date */}
              <div className="form-group">
                <label>Date</label>
                <input type="date" id="bookingDate" required />
              </div>

              {/* Vehicle Type */}
              <div className="form-group">
                <label>Vehicle Type</label>
                <div className="radio-group">
                  <label>
                    <input
                      type="radio"
                      name="vehicleType"
                      value="2_wheeler"
                      required
                    />
                    2 Wheeler
                  </label>

                  <label>
                    <input type="radio" name="vehicleType" value="4_wheeler" />
                    4 Wheeler
                  </label>
                </div>
              </div>

              {/* Location */}
              <div className="form-group">
                <label>Choose Location</label>
                <select id="location" required>
                  <option value="">Select parking location</option>
                  <option>Mall Plaza Parking</option>
                  <option>City Center Garage</option>
                  <option>Metro Station Parking</option>
                </select>
              </div>

              {/* Submit */}
              <button type="submit" className="submit-btn">
                Next
              </button>
            </form>
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
    </>
  );
}
