"use client";

import { useContext } from "react";
import { AuthContext } from "./AuthProvider";

// Small convenience hook so pages/components can do:
//   const { user, loading, signOut } = useAuth();
// instead of importing AuthContext + useContext directly everywhere.
export function useAuth() {
  return useContext(AuthContext);
}
