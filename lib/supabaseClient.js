import { createClient } from "@supabase/supabase-js";

// Values now come from environment variables instead of being hardcoded.
// See .env.local (not committed — see .gitignore) for local development.
// For Vercel, set these under Project Settings > Environment Variables for
// both the Production and Preview (develop) environments.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
      "Add them to .env.local (see .env.local.example)."
  );
}

export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
