"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabaseClient } from "../../lib/supabaseClient";
import { useAuth } from "../../lib/auth/useAuth";
import Navbar from "../../components/Navbar";
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
  const { user } = useAuth();
  const router = useRouter();

  // Chatbot refs — ported from js/chatbot.js, unchanged and out of scope
  // for this auth/navigation refactor. Note: as in the original
  // booking.html, there is no chatbot-toggle button anywhere on this page,
  // so the chat window can never actually be opened here — preserved as
  // inert, not fixed.
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

  // ===================== BOOKING FORM =====================
  // The page itself stays publicly viewable (unchanged). Auth is only
  // required at submit time now, via the centralized auth state instead of
  // a fresh supabaseClient.auth.getUser() call — and instead of just
  // alerting "User not authenticated", a logged-out visitor is sent to log
  // in and returned here afterwards.
  async function handleBookingSubmit(e) {
    e.preventDefault();

    if (!user) {
      router.push("/login?next=/booking");
      return;
    }

    // Read form values
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

    // Insert with user_id (RLS safe)
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

    // Store for the receipt page
    sessionStorage.setItem("bookingId", data.id);
    sessionStorage.setItem("amountPaid", amountPaid);
    sessionStorage.setItem("bookingLocation", bookingLocation);
    sessionStorage.setItem("timeRange", `${startTime} - ${endTime}`);
    sessionStorage.setItem("bookingDate", bookingDate);
    sessionStorage.setItem("receiptBookingId", data.id);

    router.push("/receipt");
  }

  return (
    <>
      <Navbar />

      <main>
        <div className="booking-page">
          <div className="booking-card">
            <h2>Book Your Parking</h2>
            <p className="subtitle">Fill the details below</p>

            <form
              className="booking-form"
              id="bookingForm"
              onSubmit={handleBookingSubmit}
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
            <Link href="/contact" className="footer-link">
              Contact
            </Link>
          </div>
        </div>

        <div className="footer-bottom">© 2026 ParkZo. All rights reserved.</div>
      </footer>

      {/* Chatbot Window (no toggle button on this page — see note above) */}
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
