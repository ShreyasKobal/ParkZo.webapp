"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/auth/useAuth";

const DEFAULT_AVATAR = "/images/userlogo.png";

// If an external avatar URL (e.g. a Google profile photo) fails to load,
// fall back to the local default instead of showing a broken image icon.
// Guarded so it only ever swaps once, even if the fallback image itself
// were somehow also unavailable.
function handleAvatarError(e) {
  if (e.currentTarget.src.endsWith(DEFAULT_AVATAR)) return;
  e.currentTarget.src = DEFAULT_AVATAR;
}

// Shared navbar: same DOM structure/classes as the original navbar across
// index.html / dashboard.html / booking.html / features.html / contact.html,
// but driven by the centralized AuthProvider instead of each page calling
// supabaseClient.auth.getUser() itself.
//
// The chatbot widget (toggle button + panel) is intentionally NOT part of
// this component — it's unrelated to auth/navigation, position: fixed (so
// its DOM parent doesn't affect layout), and stays page-owned exactly as
// before. Out of scope for this refactor.
export default function Navbar() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    function handleDocumentClick() {
      setDropdownOpen(false);
    }
    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
  }, []);

  function handleUserMenuClick(e) {
    e.stopPropagation();
    setDropdownOpen((open) => !open);
  }

  async function handleLogoutClick() {
    await signOut();
    setDropdownOpen(false);
  }

  const fullName =
    user?.user_metadata?.full_name || user?.user_metadata?.name || "User";
  const avatarUrl = user?.user_metadata?.avatar_url || DEFAULT_AVATAR;

  return (
    <header className="navbar">
      <nav className="nav-container">
        {/* LEFT SECTION */}
        <div className="nav-left">
          <button className="menu-btn">☰</button>

          <div className="brand" onClick={() => router.push("/")}>
            <button className="brand-btn">
              <h1 className="brand-name">ParkZo</h1>
              <span className="brand-dots">...</span>
              <div className="car-anim-wrapper">
                <img
                  src="/images/carlogo.png"
                  alt="Car Logo"
                  className="brand-logo car-anim"
                />
              </div>
            </button>
            <p className="brand-tagline">Find Park Go!</p>
          </div>
        </div>

        {/* CENTER SECTION */}
        <div className="nav-center">
          <div className="search-wrapper">
            <input
              type="text"
              placeholder="Search for the location..."
              className="search-input"
            />
            <button className="search-btn">
              <i className="fas fa-search"></i>
            </button>
          </div>
        </div>

        {/* RIGHT SECTION */}
        <div className="nav-right">
          <Link href="/contact" className="nav-link">
            Contact
          </Link>

          <button className="icon-btn notification-btn">🔔</button>

          <div className="user-menu-wrapper">
            <button
              className="icon-btn"
              id="userMenuBtn"
              onClick={handleUserMenuClick}
            >
              <div className="nav-avatar-ring">
                <div className="nav-avatar-inner">
                  <img
                    id="navUserAvatar"
                    src={avatarUrl}
                    alt="User"
                    onError={handleAvatarError}
                  />
                </div>
              </div>
            </button>

            {/* LOGGED IN: existing profile dropdown, unchanged.
                LOGGED OUT: same visual container, but log in / sign up
                instead of profile info + sign out — no authenticated-only
                info is shown. */}
            <div
              className={`user-dropdown${dropdownOpen ? "" : " hidden"}`}
              id="userDropdown"
            >
              {user ? (
                <>
                  <div className="user-dropdown-header">
                    <div className="dropdown-avatar-ring">
                      <div className="dropdown-avatar-inner">
                        <img
                          id="dropdownUserAvatar"
                          className="user-avatar"
                          src={avatarUrl}
                          alt=""
                          onError={handleAvatarError}
                        />
                      </div>
                    </div>
                    <div>
                      <strong id="userName">Hi, {fullName}</strong>
                      <br />
                      <span id="userEmail" className="user-email">
                        {user.email}
                      </span>
                    </div>
                  </div>

                  <ul className="user-dropdown-list">
                    <li>👤 Profile</li>
                    <li>💎 Membership</li>
                    <li>⚙️ Settings</li>
                    <li
                      id="logoutBtn"
                      className="logout"
                      onClick={handleLogoutClick}
                    >
                      🚪 Sign out
                    </li>
                  </ul>
                </>
              ) : (
                <ul className="user-dropdown-list">
                  <li onClick={() => router.push("/login")}>🔑 Log in</li>
                  <li onClick={() => router.push("/signup")}>📝 Sign up</li>
                </ul>
              )}
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
}
