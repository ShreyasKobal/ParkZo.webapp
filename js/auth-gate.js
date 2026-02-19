// auth-gate.js
// Purpose: protect pages that require login

async function protectPage() {
  const { data } = await supabaseClient.auth.getUser();

  if (!data.user) {
    window.location.href = "index.html";
  }
}

protectPage();