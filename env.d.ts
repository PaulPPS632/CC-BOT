interface Env {
  DB: D1Database;
  TWILIO_ACCOUNT_SID: string;
  TWILIO_AUTH_TOKEN: string;
  CERT_API_URL: string; // base URL of the certificates backend, no trailing slash
  ICO_USUARIO: string; // login of the certificates backend (/api/admin/auth/login)
  ICO_PASSWORD: string;
  GOOGLE_CREDENTIALS: string; // contents of credentials.json (service account)
  GOOGLE_LOCATION: string;
  GEMINI_MODEL: string;
}
