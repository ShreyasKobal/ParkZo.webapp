export const metadata = {
  title: "ParkZo",
  description: "Smart parking for smarter cities.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
