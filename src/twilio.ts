export function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Twilio signature: base64(HMAC-SHA1(authToken, url + sorted(key+value)))
export async function isValidTwilioSignature(
  authToken: string,
  url: string,
  params: URLSearchParams,
  signature: string | undefined,
): Promise<boolean> {
  if (!signature) return false;
  try {
    const data = [...params.keys()]
      .sort()
      .reduce((acc, k) => acc + k + params.get(k), url);
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(authToken),
      { name: "HMAC", hash: "SHA-1" },
      false,
      ["verify"],
    );
    const sigBytes = Uint8Array.from(atob(signature), (c) => c.charCodeAt(0));
    return await crypto.subtle.verify("HMAC", key, sigBytes, new TextEncoder().encode(data));
  } catch {
    return false; // malformed signature
  }
}

// Returns true if Twilio accepted the message and, for media, it didn't fail afterwards.
export async function sendWhatsApp(
  env: Env,
  from: string,
  to: string,
  body: string,
  mediaUrl?: string,
): Promise<boolean> {
  const auth = `Basic ${btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`)}`;
  const form = new URLSearchParams({ From: from, To: to, Body: body });
  if (mediaUrl) form.set("MediaUrl", mediaUrl);
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    },
  );
  const text = await res.text();
  console.log(`twilio send status=${res.status} body=${text}`);
  if (!res.ok) return false;
  if (!mediaUrl) return true;

  // Media failures (unreachable URL, wrong type, too big) are reported asynchronously:
  // poll the message briefly to find out whether it really went out.
  const { sid } = JSON.parse(text) as { sid: string };
  for (let attempt = 0; attempt < 3; attempt++) {
    await new Promise((r) => setTimeout(r, 2500));
    const check = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages/${sid}.json`,
      { headers: { Authorization: auth } },
    );
    const m = (await check.json()) as { status: string; error_code: number | null; error_message: string | null };
    console.log(`twilio media check url=${mediaUrl} status=${m.status} error=${m.error_code} ${m.error_message ?? ""}`);
    if (m.status === "failed" || m.status === "undelivered") return false;
    if (["sent", "delivered", "read"].includes(m.status)) return true;
  }
  return true; // still in flight; don't send the link twice
}

export async function isAllowedNumber(db: D1Database, from: string): Promise<boolean> {
  const phone = from.replace(/^whatsapp:/, "").replace(/\s+/g, "");
  const row = await db
    .prepare("SELECT 1 FROM allowed_numbers WHERE phone = ?")
    .bind(phone)
    .first();
  return row !== null;
}
