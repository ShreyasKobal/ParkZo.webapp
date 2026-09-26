"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseClient } from "../../../lib/supabaseClient";

// Only ever redirect to a same-site relative path — never an absolute/
// external URL — so a crafted `next` value can't send someone off-site.
function isSafeNext(next) {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//");
}

function CallbackShell({ message }) {
  return (
    <main className="auth-container">
      <div className="auth-card">
        <h2>Signing you in…</h2>
        <p className="auth-subtext">{message}</p>
      </div>
    </main>
  );
}

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [errorMessage, setErrorMessage] = useState(null);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    async function completeSignIn() {
      const code = searchParams.get("code");
      const nextParam = searchParams.get("next");
      const destination = isSafeNext(nextParam) ? nextParam : "/";

      if (!code) {
        // Nothing to exchange (e.g. someone hit this URL directly) — just
        // move on rather than getting stuck.
        router.replace(destination);
        return;
      }

      const { error } = await supabaseClient.auth.exchangeCodeForSession(code);

      if (error) {
        console.error("OAuth callback error:", error.message);
        setErrorMessage(
          "Sign-in failed. Please go back and try logging in again."
        );
        return;
      }

      router.replace(destination);
    }

    completeSignIn();
  }, [router, searchParams]);

  return (
    <CallbackShell
      message={errorMessage || "Please wait while we finish signing you in."}
    />
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<CallbackShell message="Please wait…" />}>
      <AuthCallbackInner />
    </Suspense>
  );
}
