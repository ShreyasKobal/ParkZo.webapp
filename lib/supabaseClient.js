import { createClient } from "@supabase/supabase-js";

// Mirrors the existing js/supabase.js values exactly.
// TODO (future): move these into environment variables during Phase 2 cleanup.
const SUPABASE_URL = "https://wapnwkqyhvdkvbqtstwt.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhcG53a3F5aHZka3ZicXRzdHd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2MTk3MTUsImV4cCI6MjA4NjE5NTcxNX0.VBe9Lt_j6B74ZA2xvDQFGS1il2Tishb5OyM6IzHFmmY";

export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
