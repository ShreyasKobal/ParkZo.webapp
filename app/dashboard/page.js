"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "../../lib/supabaseClient";
import { useAuth } from "../../lib/auth/useAuth";
import Navbar from "../../components/Navbar";
import "../../css/dashboard.css";

export default function Dashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Chatbot refs — ported from js/chatbot.js, unchanged and out of scope
  // for this auth/navigation refactor.
  const chatbotToggleRef = useRef(null);
  const chatbotRef = useRef(null);
  const closeChatRef = useRef(null);
  const sendBtnRef = useRef(null);
  const chatInputRef = useRef(null);
  const chatMessagesRef = useRef(null);
  const resizeHandleRef = useRef(null);

  // Protected route: send logged-out visitors to /login, remembering where
  // they were headed so login can return them here afterwards.
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login?next=/dashboard");
    }
  }, [loading, user, router]);

  useEffect(() => {
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

      // Calls the same existing "chat-ai" Supabase Edge Function as before.
      // supabaseClient already carries the project URL and anon key
      // (from lib/supabaseClient.js), so nothing is hardcoded here.
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

  // While auth state is resolving, or while redirecting a logged-out
  // visitor away, show a minimal shell instead of the real dashboard
  // content — never flash it to someone who isn't logged in.
  if (loading || !user) {
    return (
      <>
        <Navbar />
        <main style={{ padding: "80px 40px", textAlign: "center" }}>
          <p>Loading…</p>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />

      {/* ================= QUICK ACTIONS ================= */}
      <section className="quick-actions">
        <div className="qa-container">
          <h2 className="qa-title">Quick Actions</h2>
          <p className="qa-subtitle">Book faster using your parking shortcuts</p>

          <div className="qa-grid">
            {/* AI Suggestions — no /ai-suggestions route exists yet.
                Deferred to Phase 2 per instructions; left as a plain,
                still-non-functional .html link rather than inventing a
                fake route. */}
            <a href="ai-suggestions.html" className="qa-card">
              <svg
                className="qa-ring"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                <rect
                  x="2"
                  y="2"
                  width="96"
                  height="96"
                  rx="18"
                  ry="18"
                  pathLength="1"
                />
              </svg>

              <div className="qa-icon">
                🤖
                <svg className="icon-ring" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="46" pathLength="1" />
                </svg>
              </div>
              <div className="qa-content">
                <h3>AI Suggestions</h3>
                <p>Best parking near you right now</p>
              </div>
            </a>

            {/* Instant Book */}
            <Link href="/booking" className="qa-card">
              <svg
                className="qa-ring"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                <rect
                  x="2"
                  y="2"
                  width="96"
                  height="96"
                  rx="18"
                  ry="18"
                  pathLength="1"
                />
              </svg>

              <div className="qa-icon">
                ⚡
                <svg className="icon-ring" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="46" pathLength="1" />
                </svg>
              </div>
              <div className="qa-content">
                <h3>Instant Book</h3>
                <p>Quickly reserve your last used spot</p>
              </div>
            </Link>

            {/* Book for Friend */}
            <Link href="/booking" className="qa-card">
              <svg
                className="qa-ring"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                <rect
                  x="2"
                  y="2"
                  width="96"
                  height="96"
                  rx="18"
                  ry="18"
                  pathLength="1"
                />
              </svg>

              <div className="qa-icon">
                🚗
                <svg className="icon-ring" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="46" pathLength="1" />
                </svg>
              </div>
              <div className="qa-content">
                <h3>Book for Friend</h3>
                <p>Reserve parking for someone else</p>
              </div>
            </Link>

            {/* Favorites — no /favorites route exists yet. Deferred to
                Phase 2 per instructions; left as a plain, still-non-
                functional .html link rather than inventing a fake route. */}
            <a href="favorites.html" className="qa-card">
              <svg
                className="qa-ring"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                <rect
                  x="2"
                  y="2"
                  width="96"
                  height="96"
                  rx="18"
                  ry="18"
                  pathLength="1"
                />
              </svg>

              <div className="qa-icon">
                ⭐
                <svg className="icon-ring" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="46" pathLength="1" />
                </svg>
              </div>
              <div className="qa-content">
                <h3>Favorites</h3>
                <p>Your frequently used locations</p>
              </div>
            </a>
          </div>
        </div>
      </section>

      {/* ================= PARKING GALLERY ================= */}
      <section className="parking-gallery">
        <div className="pg-container">
          <h2 className="pg-title">Popular Parking Locations</h2>
          <p className="pg-subtitle">
            Trusted parking spots used by ParkZo drivers
          </p>

          <div className="pg-grid">
            <div className="pg-card">
              <img src="/images/parking-mall.png" alt="Mall Parking" />
              <div className="pg-info">
                <h3>Mall Plaza Parking</h3>
                <span>₹30 / hr • Covered</span>
              </div>
            </div>

            <div className="pg-card">
              <img src="/images/parking-office.png" alt="Office Parking" />
              <div className="pg-info">
                <h3>City Center Garage</h3>
                <span>₹25 / hr • Multi-level</span>
              </div>
            </div>

            <div className="pg-card">
              <img src="/images/parking-metro.png" alt="Metro Parking" />
              <div className="pg-info">
                <h3>Metro Station Parking</h3>
                <span>₹20 / hr • Open</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= AROUND YOU ================= */}
      <section className="around-you">
        <div className="ay-container">
          <h2 className="ay-title">What’s Happening Around You</h2>
          <p className="ay-subtitle">Live parking activity from nearby zones</p>

          <div className="ay-grid">
            <div className="ay-card">
              <span className="ay-tag green">JUST UPDATED</span>
              <h3>Slots Freed Nearby</h3>
              <p>
                2 parking slots became available near{" "}
                <strong>Mall Plaza</strong>.
              </p>
            </div>

            <div className="ay-card">
              <span className="ay-tag yellow">HIGH ACTIVITY</span>
              <h3>Office Zone Busy</h3>
              <p>
                Parking demand increasing around <strong>City Center</strong>.
              </p>
            </div>

            <div className="ay-card">
              <span className="ay-tag blue">SUGGESTION</span>
              <h3>Better Option Found</h3>
              <p>
                Cheaper parking detected <strong>300m away</strong>.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= PARKZO HIGHLIGHTS ================= */}
      <section className="parkzo-highlights">
        <div className="ph-container">
          <h2 className="ph-title">Why People Use ParkZo</h2>
          <p className="ph-subtitle">Smarter parking decisions, every day</p>

          <div className="ph-grid">
            <div className="ph-card">
              <span className="ph-badge">LIVE</span>
              <h3>Real-Time Availability</h3>
              <p>
                See live parking status before you arrive and avoid
                unnecessary driving.
              </p>
            </div>

            <div className="ph-card">
              <span className="ph-badge">SMART</span>
              <h3>Faster Booking</h3>
              <p>
                Book parking in seconds using smart shortcuts and saved
                locations.
              </p>
            </div>

            <div className="ph-card">
              <span className="ph-badge">CITY</span>
              <h3>Smarter Cities</h3>
              <p>
                Reduced congestion and fuel waste through intelligent parking
                data.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= TRUST STRIP ================= */}
      <section className="trust-strip">
        <div className="ts-container">
          <div className="ts-item">🔒 Secure Payments</div>
          <div className="ts-item">📡 Live Availability</div>
          <div className="ts-item">⚡ Instant Booking</div>
          <div className="ts-item">🌱 Eco Friendly</div>
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
            <Link href="/contact" className="footer-link">
              Contact
            </Link>
          </div>
        </div>

        <div className="footer-bottom">© 2026 ParkZo. All rights reserved.</div>
      </footer>

      <div
        className="chatbot-toggle"
        id="chatbotToggle"
        ref={chatbotToggleRef}
      >
        💬
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
    </>
  );
}
