// Cloudflare Worker for RU↔VI Translator v4.2.2
// Set secret in Cloudflare: OPENAI_API_KEY
// Optional: set APP_PASSWORD and enter same password in app settings.
// Endpoint accepts POST JSON from index.html.

export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Accept",
      "Content-Type": "application/json; charset=utf-8"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: cors });
    }

    try {
      const body = await request.json();
      const text = String(body.text || body.q || "").trim();
      const source = String(body.source || body.sourceLang || body.from || "").toLowerCase();
      const target = String(body.target || body.targetLang || body.to || "").toLowerCase();
      const password = String(body.password || body.apiKey || body.key || "");

      if (!text) {
        return new Response(JSON.stringify({ error: "empty text" }), { status: 400, headers: cors });
      }

      if (env.APP_PASSWORD && password !== env.APP_PASSWORD) {
        return new Response(JSON.stringify({ error: "bad password" }), { status: 401, headers: cors });
      }

      if (!env.OPENAI_API_KEY) {
        return new Response(JSON.stringify({ error: "OPENAI_API_KEY missing in Worker secrets" }), { status: 500, headers: cors });
      }

      const system = `You are a fast live interpreter for Russian and Vietnamese.
Translate only between ru and vi.
Return only the translation, no comments.
Style: short, natural, conversational.
Context: live conversation, noisy environment, cinema/friends.`;

      const user = `Translate from ${source || "auto"} to ${target || "auto"}:\n${text}`;

      const ai = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.2,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user }
          ]
        })
      });

      const raw = await ai.text();
      if (!ai.ok) {
        return new Response(JSON.stringify({ error: "OpenAI error", detail: raw.slice(0, 500) }), { status: 502, headers: cors });
      }

      const data = JSON.parse(raw);
      const translation = data?.choices?.[0]?.message?.content?.trim() || "";

      return new Response(JSON.stringify({ translation }), { headers: cors });

    } catch (err) {
      return new Response(JSON.stringify({ error: String(err?.message || err) }), { status: 500, headers: cors });
    }
  }
};
