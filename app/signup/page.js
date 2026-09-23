"use client";

import { useEffect, useRef } from "react";
import { supabaseClient } from "../../lib/supabaseClient";

export default function SignupPage() {
  const signupFormRef = useRef(null);

  useEffect(() => {
    const signupForm = signupFormRef.current;

    // Ported from js/auth.js's signup handler.
    //
    // Preserved existing bug: this reads the password via the first
    // input[type="password"] in the form, which is the "Password" field —
    // "Confirm Password" is never actually read or validated. Not fixed
    // here; that's an auth-flow behavior change, out of scope for this
    // migration.
    async function handleSignupSubmit(e) {
      e.preventDefault();

      const email = signupForm.querySelector('input[type="email"]').value;
      const password = signupForm.querySelector(
        'input[type="password"]'
      ).value;
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

      // The original js/auth.js calls showOnly(loginCard) here. This page
      // (like the real signup.html) has no #loginCard element, and
      // showOnly()'s last line calls .classList on it with no null-check —
      // on the current live site this actually throws an uncaught
      // TypeError in the console right after the alert above. The visible
      // end-user behavior (alert shown, then nothing else happens; no
      // redirect, no form reset) is preserved by simply not calling it,
      // rather than reproducing that console crash.
    }

    if (signupForm)
      signupForm.addEventListener("submit", handleSignupSubmit);

    return () => {
      if (signupForm)
        signupForm.removeEventListener("submit", handleSignupSubmit);
    };
  }, []);

  return (
    <main className="auth-container">
      <div className="auth-card">
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

          {/* SHOW PASSWORD (replaces Remember me) */}
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
          <a href="/" className="link">
            Log in
          </a>
        </p>
      </div>
    </main>
  );
}
