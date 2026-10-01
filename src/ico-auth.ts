// Bearer token for the certificates backend, obtained via POST /api/admin/auth/login.
// Cached per isolate; call with `force` after a 401 to log in again.
let cachedToken: string | undefined;

// The login response shape isn't documented: accept the usual token locations.
function extractToken(json: any): string | undefined {
  return [json?.token, json?.access_token, json?.data?.token, json?.data?.access_token].find(
    (t) => typeof t === "string" && t,
  );
}

export async function getToken(env: Env, force = false): Promise<string> {
  if (cachedToken && !force) return cachedToken;

  const res = await fetch(`${env.CERT_API_URL}/api/admin/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ usuario: env.ICO_USUARIO, password: env.ICO_PASSWORD }),
  });
  const json: any = await res.json().catch(() => null);
  const token = extractToken(json);
  if (!res.ok || !token) {
    // Log keys only, never values: the response may contain credentials.
    console.error(
      `ico login failed status=${res.status} keys=${json ? Object.keys(json) : "none"} dataKeys=${
        json?.data && typeof json.data === "object" ? Object.keys(json.data) : "none"
      }`,
    );
    throw new Error("No se pudo iniciar sesión en el servicio de certificados.");
  }
  cachedToken = token;
  return token;
}
