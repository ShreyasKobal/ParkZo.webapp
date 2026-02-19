document.addEventListener("DOMContentLoaded", () => {
  const app = document.getElementById("app");
  const authOverlay = document.getElementById("authOverlay");

  const loginCard = document.getElementById("loginCard");
  const signupCard = document.getElementById("signupCard");
  const forgotCard = document.getElementById("forgotCard");

  const loginForm = document.getElementById("loginForm");
  const signupForm = document.getElementById("signupForm");
  const forgotForm = document.getElementById("forgotForm");

  // ===== HELPER FUNCTIONS =====
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
    [loginCard, signupCard, forgotCard].forEach(c => {
      if (c) c.classList.add("hidden");
    });
    card.classList.remove("hidden");
  }

  // ==========
  async function updateAuthUI() {
  const { data } = await supabaseClient.auth.getUser();

  // Mark auth as resolved
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
  // ===== LOGIN =====
// LOGIN


if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    console.log("Login button clicked");
    const email = loginForm.querySelector('input[type="email"]').value;
    const password = loginForm.querySelector('#password').value;

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

await supabaseClient.auth.resend({
  type: "signup",
  email,
});

    // IMPORTANT: update UI instead of reload
    if (typeof updateAuthUI === "function") {
      updateAuthUI();
    }
  });
}

  // ===== SIGNUP =====
  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
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
    });
  }

  // ===== FORGOT PASSWORD =====
  if (forgotForm) {
    forgotForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = forgotForm.querySelector('input[type="email"]').value;

      const { error } = await supabaseClient.auth.resetPasswordForEmail(email);

      if (error) {
        alert(error.message);
        return;
      }

      alert("Password reset link sent! Check your email.");
      showOnly(loginCard);
    });
  }

  // ===== SWITCH LINKS =====
  document.querySelectorAll("[data-auth]").forEach(btn => {
    btn.addEventListener("click", e => {
      e.preventDefault();
      const target = btn.dataset.auth;

      if (target === "login") showOnly(loginCard);
      if (target === "signup") showOnly(signupCard);
      if (target === "forgot") showOnly(forgotCard);
    });
  });

  
/////////////////////////////////////////////////////////////////////////////
async function getCurrentUser() {
  const { data } = await supabaseClient.auth.getUser();
  return data.user;
}

getCurrentUser().then((user) => {
  console.log("Current user:", user);
});


////////////////////////////////////////////////////////////////////////
// async function loadUserProfile() {
//   const { data: { user } } = await supabaseClient.auth.getUser();
//   if (!user) return;

//   const nameEl = document.getElementById("userName");
//   const emailEl = document.getElementById("userEmail");
//   const avatarImg = document.querySelector(".user-avatar");
//   const navAvatar = document.getElementById("navUserAvatar");
//   const dropdownAvatar = document.getElementById("dropdownUserAvatar");

//   if (user.user_metadata?.avatar_url) {
//   if (navAvatar) navAvatar.src = user.user_metadata.avatar_url;
//   if (dropdownAvatar) dropdownAvatar.src = user.user_metadata.avatar_url;
// } else {
//   const fallback = getGravatarUrl(user.email);
//   if (navAvatar) navAvatar.src = fallback;
//   if (dropdownAvatar) dropdownAvatar.src = fallback;
// }
// }
////////////////////////////////////////////////////////////////////////
async function loadUserProfile() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;

  const nameEl = document.getElementById("userName");
  const emailEl = document.getElementById("userEmail");
  const navAvatar = document.getElementById("navUserAvatar");
  const dropdownAvatar = document.getElementById("dropdownUserAvatar");

  /* ---------- NAME ---------- */
  if (nameEl) {
    const fullName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      "User";

    nameEl.textContent = `Hi, ${fullName}`;
  }

  /* ---------- EMAIL ---------- */
  if (emailEl) {
    emailEl.textContent = user.email;
  }

  /* ---------- AVATAR ---------- */
  let avatarUrl;

  if (user.user_metadata?.avatar_url) {
    avatarUrl = user.user_metadata.avatar_url;
  } else {
    avatarUrl = getGravatarUrl(user.email);
  }

  if (navAvatar) navAvatar.src = avatarUrl;
  if (dropdownAvatar) dropdownAvatar.src = avatarUrl;
}



////////////////////////////////////////////////////////////////////////
// ===== USER DROPDOWN =====
const userMenuBtn = document.getElementById("userMenuBtn");
const userDropdown = document.getElementById("userDropdown");

if (userMenuBtn && userDropdown) {
  userMenuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    userDropdown.classList.toggle("hidden");
  });

  document.addEventListener("click", () => {
    userDropdown.classList.add("hidden");
  });
}




///////////////////////////////////////////////////////////////////////
function getGravatarUrl(email) {
  const trimmedEmail = email.trim().toLowerCase();
  const hash = md5(trimmedEmail);
  return `https://www.gravatar.com/avatar/${hash}?s=200&d=identicon`;
}

//////////////////////logout logic/////////////////////////////////
const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    updateAuthUI();
  });
}

// ===== GOOGLE LOGIN =====
const googleBtn = document.getElementById("googleLoginBtn");

if (googleBtn) {
  googleBtn.addEventListener("click", async () => {
    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider: "google",
    });

    if (error) {
      console.error("Google login error:", error.message);
    }
  });
}


});//////////////////////add everything above 

