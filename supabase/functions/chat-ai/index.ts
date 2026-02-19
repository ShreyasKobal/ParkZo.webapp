import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  const geminiKey = Deno.env.get("GEMINI_API_KEY");

  if (!geminiKey) {
    return new Response(
      JSON.stringify({ error: "Missing API key" }),
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
      }
    );
  }

  const { message } = await req.json();

  const geminiResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
  contents: [
    {
      parts: [
        {
          text: `
You are ParkZo Assistant — a smart parking helper.

Response Style Rules:
- Keep answers short.
- Maximum 5 lines.
- Use clean structure with emojis.
- No long paragraphs.
- No generic explanations.
- Focus only on parking.
- Suggest using ParkZo features when relevant.

Response format example:

📍 Nearby Options:
• Mall Plaza – ₹30/hr – 21 slots
• City Garage – ₹25/hr – Limited

🚀 Tip:
Use Instant Book to reserve before arrival.

Now answer this:

${message}
          `
        }
      ],
    },
  ],
}),

    }
  );

  const geminiData = await geminiResponse.json();

  const reply =
    geminiData.candidates?.[0]?.content?.parts?.[0]?.text ||
    "No response from AI.";

  return new Response(JSON.stringify({ reply }), {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json",
    },
  });
});
