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

export async function sendWhatsApp(
  env: Env,
  from: string,
  to: string,
  body: string,
): Promise<void> {
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ From: from, To: to, Body: body }),
    },
  );
  const text = await res.text();
  console.log(`twilio send status=${res.status} body=${text}`);
}
