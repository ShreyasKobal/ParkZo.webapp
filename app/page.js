"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import Navbar from "../components/Navbar";

export default function Home() {
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
    <div id="app">
      <Navbar />

      <main>
        {/* hero */}
        <section className="hero">
          <div className="hero-container">
            <div className="hero-text">
              <h1 className="hero-title">Smart Parking for Smarter Cities</h1>
              <p className="hero-subtitle">
                Find parking faster, reduce congestion, and save fuel using{" "}
                <br />
                AI-powered smart parking solutions.
              </p>
              <div className="hero-actions">
                <Link href="/dashboard" className="btn btn-primary">
                  Get Started
                </Link>
                <Link href="/booking" className="btn btn-secondary">
                  Instant Book
                </Link>
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

        {/* value section */}
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
                <p>Reduce fuel waste and congestion with efficient parking.</p>
              </div>
            </div>

            <Link href="/features" className="value-btn">
              View all features
            </Link>
          </div>
        </section>

        {/* how it works */}
        <section className="how-it-works">
          <div className="hiw-container">
            <h2 className="hiw-title">How ParkZo Works</h2>
            <p className="hiw-subtitle">
              Find and book parking in just three simple steps
            </p>

            <div className="hiw-steps">
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
                  <p>Reach the location, park smoothly, and go stress-free.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* impact */}
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

        <div className="chatbot-messages" id="chatMessages" ref={chatMessagesRef}>
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
  );
}
