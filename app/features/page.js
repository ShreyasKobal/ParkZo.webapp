"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { supabaseClient } from "../../lib/supabaseClient";
import Navbar from "../../components/Navbar";
import "./features.css";

export default function FeaturesPage() {
  // Chatbot refs — ported from js/chatbot.js, unchanged and out of scope
  // for this auth/navigation refactor.
  const chatbotToggleRef = useRef(null);
  const chatbotRef = useRef(null);
  const closeChatRef = useRef(null);
  const sendBtnRef = useRef(null);
  const chatInputRef = useRef(null);
  const chatMessagesRef = useRef(null);
  const resizeHandleRef = useRef(null);

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

      <Navbar />

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
            <Link href="/contact" className="footer-link">
              Contact
            </Link>
          </div>
        </div>

        <div className="footer-bottom">© 2026 ParkZo. All rights reserved.</div>
      </footer>

      <div className="chatbot-toggle" id="chatbotToggle" ref={chatbotToggleRef}>
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
