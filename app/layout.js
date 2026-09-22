import Script from "next/script";

// Reusing the EXISTING css files directly (not copies) so styling stays
// byte-for-byte identical to the current site during Phase 1.
import "../css/styles.css";
import "../css/auth.css";

export const metadata = {
  title: "ParkZo",
  description: "Smart parking for smarter cities.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* Same Font Awesome version/CDN as the existing HTML pages */}
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css"
        />
      </head>
      <body>
        {children}

        {/*
          blueimp-md5 is loaded the same way the existing site loads it
          (CDN script, global `md5()` function) rather than adding a new
          npm dependency. Used for the Gravatar fallback avatar.
          beforeInteractive guarantees it's ready before our client
          components run, matching the original synchronous <script> order.
        */}
        <Script
          src="https://cdnjs.cloudflare.com/ajax/libs/blueimp-md5/2.19.0/js/md5.min.js"
          strategy="beforeInteractive"
        />
      </body>
    </html>
  );
}
