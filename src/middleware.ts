import { createMiddleware } from "hono/factory";
import { isAllowedNumber, isValidTwilioSignature } from "./twilio";

export type AppEnv = {
  Bindings: Env;
  Variables: { params: URLSearchParams };
};

// Rejects requests not signed by Twilio and exposes the parsed form body as `params`.
export const twilioSignature = createMiddleware<AppEnv>(async (c, next) => {
  const params = new URLSearchParams(await c.req.text());

  const valid = await isValidTwilioSignature(
    c.env.TWILIO_AUTH_TOKEN,
    c.req.url,
    params,
    c.req.header("X-Twilio-Signature"),
  );
  if (!valid) return c.text("Forbidden", 403);

  c.set("params", params);
  await next();
});

// Silently ignores (200, no reply) senders that are not in the whitelist.
export const allowedNumber = createMiddleware<AppEnv>(async (c, next) => {
  const from = c.var.params.get("From") ?? "";
  if (!(await isAllowedNumber(c.env.DB, from))) {
    console.log(`ignored from=${from} (not in whitelist)`);
    return c.body(null, 200);
  }
  await next();
});
