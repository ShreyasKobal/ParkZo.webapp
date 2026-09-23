"use client";

import { useEffect, useRef } from "react";
import { supabaseClient } from "../../lib/supabaseClient";

export default function LoginPage() {
  const loginFormRef = useRef(null);
  const googleBtnRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const loginForm = loginFormRef.current;
    const googleBtn = googleBtnRef.current;

    // Ported from js/auth.js's loadUserProfile(). On this page there are no
    // #userName/#userEmail/#navUserAvatar/#dropdownUserAvatar elements (no
    // navbar here — same as the original login.html), so this intentionally
    // has nothing to update. Kept as a faithful no-op rather than removed,
    // to mirror the original code path exactly.
    async function loadUserProfile() {
      const {
        data: { user },
      } = await supabaseClient.auth.getUser();
      if (!user) return;
    }

    // Ported from js/auth.js's updateAuthUI(). The original also had a
    // lockScreen()/showOnly(loginCard) branch for the logged-out case —
    // omitted here because #app/#authOverlay/#loginCard don't exist on this
    // page either, so that branch was always a no-op in the original too.
    // Preserved existing behavior: this does NOT redirect an already
    // logged-in visitor away from the login form.
    async function updateAuthUI() {
      const { data } = await supabaseClient.auth.getUser();
      if (cancelled) return;
      if (data.user) {
        await loadUserProfile();
      }
    }

    updateAuthUI();

    // LOGIN (ported from js/auth.js)
    async function handleLoginSubmit(e) {
      e.preventDefault();
      console.log("Login button clicked");

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

      // Preserved existing quirk: this fires on every successful login, not
      // just unconfirmed signups. Not fixed here — auth flow is out of scope.
      await supabaseClient.auth.resend({
        type: "signup",
        email,
      });

      // Preserved existing behavior: no redirect after a successful login on
      // this page (see updateAuthUI() above — it's a no-op here).
      updateAuthUI();
    }
    if (loginForm) loginForm.addEventListener("submit", handleLoginSubmit);

    // GOOGLE LOGIN (ported from js/auth.js) — no redirectTo override, exactly
    // as original, so OAuth redirect behavior is unchanged.
    async function handleGoogleClick() {
      const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: "google",
      });
      if (error) {
        console.error("Google login error:", error.message);
      }
    }
    if (googleBtn) googleBtn.addEventListener("click", handleGoogleClick);

    // Diagnostic call present in the original js/auth.js — preserved as-is.
    async function getCurrentUser() {
      const { data } = await supabaseClient.auth.getUser();
      return data.user;
    }
    getCurrentUser().then((user) => {
      console.log("Current user:", user);
    });

    return () => {
      cancelled = true;
      if (loginForm)
        loginForm.removeEventListener("submit", handleLoginSubmit);
      if (googleBtn) googleBtn.removeEventListener("click", handleGoogleClick);
    };
  }, []);

  return (
    <main className="auth-container">
      <div className="auth-card">
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
            <a href="forgot-password.html" className="link">
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
            ref={googleBtnRef}
            className="auth-btn google-btn"
          >
            <i className="fab fa-google"></i> Continue with Google
          </button>
        </form>

        <p className="auth-footer">
          Don’t have an account?{" "}
          <a href="signup.html" className="link">
            Create one
          </a>
        </p>
      </div>
    </main>
  );
}
