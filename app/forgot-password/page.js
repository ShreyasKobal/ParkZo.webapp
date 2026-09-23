"use client";

export default function ForgotPasswordPage() {
  // Ported from forgot-password.html's inline <script> exactly as-is.
  //
  // NOTE: the original does NOT call Supabase here — no
  // supabaseClient.auth.resetPasswordForEmail(). It's a static mock: show a
  // generic alert and clear the form. This differs from the combined
  // overlay's forgot-password form on the home page (app/page.js), which
  // does call Supabase. Preserved exactly as the current standalone page
  // behaves, per "don't invent functionality that isn't there" — not
  // wired to lib/supabaseClient.js because the page being migrated doesn't
  // use it today.
  function handleSubmit(e) {
    e.preventDefault();
    alert("If this email exists, a reset link will be sent.");
    e.target.reset();
  }

  return (
    <main className="auth-container">
      <div className="auth-card">
        <h2>Forgot your password?</h2>
        <p className="auth-subtext">
          Enter your email and we’ll send you a reset link
        </p>

        <form id="forgotForm" className="auth-form" onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Email</label>
            <input type="email" id="email" required />
          </div>

          <button type="submit" className="auth-btn">
            Send reset link
          </button>
        </form>

        <p className="auth-footer">
          Remembered your password?{" "}
          <a href="/" className="link">
            Back to login
          </a>
        </p>
      </div>
    </main>
  );
}
