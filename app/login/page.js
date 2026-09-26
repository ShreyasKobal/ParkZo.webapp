"use client";

import { Suspense, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseClient } from "../../lib/supabaseClient";

function isSafeNext(next) {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//");
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const loginFormRef = useRef(null);

  const nextParam = searchParams.get("next");
  const destination = isSafeNext(nextParam) ? nextParam : "/";

  async function handleLoginSubmit(e) {
    e.preventDefault();
    const loginForm = loginFormRef.current;

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

    // Successful login now actually leaves this page — either back to
    // wherever the visitor was headed (?next=...) or to the homepage.
    router.push(destination);
  }

  // Google OAuth now explicitly returns to this Next.js app's own callback
  // route (carrying `next` through the round trip), instead of falling
  // back to Supabase's default Site URL, which was pointing at the old
  // static site.
  async function handleGoogleClick() {
    const redirectTo =
      `${window.location.origin}/auth/callback` +
      (nextParam ? `?next=${encodeURIComponent(destination)}` : "");

    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });

    if (error) {
      console.error("Google login error:", error.message);
    }
  }

  return (
    <main className="auth-container">
      <div className="auth-card">
        <h2>Welcome back !</h2>
        <p className="auth-subtext">Log in to manage your parking easily</p>

        <form
          id="loginForm"
          ref={loginFormRef}
          className="auth-form"
          onSubmit={handleLoginSubmit}
        >
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
            <Link href="/forgot-password" className="link">
              Forgot password?
            </Link>
          </div>

          <button type="submit" className="auth-btn">
            Log in
          </button>

          <div className="divider">OR</div>

          <button
            type="button"
            id="googleLoginBtn"
            onClick={handleGoogleClick}
            className="auth-btn google-btn"
          >
            <i className="fab fa-google"></i> Continue with Google
          </button>
        </form>

        <p className="auth-footer">
          Don’t have an account?{" "}
          <Link href="/signup" className="link">
            Create one
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
