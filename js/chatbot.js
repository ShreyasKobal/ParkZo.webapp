
const toggleBtn = document.getElementById("chatbotToggle");
const chatbot = document.getElementById("chatbot");
const closeChat = document.getElementById("closeChat");
const sendBtn = document.getElementById("sendBtn");
const chatInput = document.getElementById("chatInput");
const chatMessages = document.getElementById("chatMessages");

toggleBtn.onclick = () => chatbot.classList.remove("hidden");
closeChat.onclick = () => chatbot.classList.add("hidden");

sendBtn.onclick = sendMessage;
chatInput.addEventListener("keypress", e => {
  if (e.key === "Enter") sendMessage();
});
/////////////////////////////////////////////////////
function sendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;

  const userMsg = document.createElement("div");
  userMsg.className = "user-msg";
  userMsg.textContent = text;
  chatMessages.appendChild(userMsg);

  chatInput.value = "";
  chatMessages.scrollTop = chatMessages.scrollHeight;

  // Temporary typing message
  const typingMsg = document.createElement("div");
  typingMsg.className = "bot-msg";
  typingMsg.textContent = "Thinking...";
  chatMessages.appendChild(typingMsg);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  fetch("https://wapnwkqyhvdkvbqtstwt.supabase.co/functions/v1/chat-ai", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhcG53a3F5aHZka3ZicXRzdHd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2MTk3MTUsImV4cCI6MjA4NjE5NTcxNX0.VBe9Lt_j6B74ZA2xvDQFGS1il2Tishb5OyM6IzHFmmY"
    },
    body: JSON.stringify({ message: text })
  })
    .then(res => res.json())
    .then(data => {
      typingMsg.remove();

      const botMsg = document.createElement("div");
      botMsg.className = "bot-msg";
      botMsg.textContent = data.reply;
      chatMessages.appendChild(botMsg);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    })
    .catch(err => {
      typingMsg.textContent = "Something went wrong.";
      console.error(err);
    });
}

const resizeHandle = document.querySelector(".resize-handle");
let isResizing = false;

resizeHandle.addEventListener("mousedown", () => {
  isResizing = true;
});

document.addEventListener("mousemove", (e) => {
  if (!isResizing) return;

  const newWidth = window.innerWidth - e.clientX - 24; 
  const minWidth = 280;
  const maxWidth = 500;

  if (newWidth >= minWidth && newWidth <= maxWidth) {
    chatbot.style.width = newWidth + "px";
  }
});

document.addEventListener("mouseup", () => {
  isResizing = false;
});

/////////////////////////////////////////////////////

