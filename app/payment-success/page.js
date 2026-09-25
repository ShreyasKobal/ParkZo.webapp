// Static confirmation page, ported from payment-success.html exactly.
// No "use client" needed — no hooks, no browser APIs, no interactivity.
//
// The original links css/payment-success.css, but no file with that exact
// name exists in the project (there's an empty, differently-named
// css/pamentSuccessful.css). Per instructions, neither file is created,
// renamed, or copied — this page relies only on its own inline styles
// (below, ported verbatim) plus whatever global styling styles.css already
// provides site-wide via app/layout.js.
export default function PaymentSuccessPage() {
  return (
    <div
      style={{ maxWidth: "500px", margin: "100px auto", textAlign: "center" }}
    >
      <h2 style={{ margin: "20px" }}>✅ Payment Successful</h2>
      <p style={{ margin: "20px" }}>
        Your parking has been booked successfully.
      </p>
      <a href="/" style={{ margin: "20px" }}>
        Go to Home
      </a>
    </div>
  );
}
