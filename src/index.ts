import { Hono } from "hono";
import { isValidTwilioSignature, sendWhatsApp } from "./twilio";

const DEFAULT_REPLY = "Gracias por comunicarte, en un momento estaremos listos";

const app = new Hono<{ Bindings: Env }>();

app.post("/whatsapp", async (c) => {
  const params = new URLSearchParams(await c.req.text());

  const valid = await isValidTwilioSignature(
    c.env.TWILIO_AUTH_TOKEN,
    c.req.url,
    params,
    c.req.header("X-Twilio-Signature"),
  );
  if (!valid) return c.text("Forbidden", 403);

  console.log(`msg from=${params.get("From")} body=${params.get("Body")}`);
  await sendWhatsApp(c.env, params.get("To") ?? "", params.get("From") ?? "", DEFAULT_REPLY);
  return c.body('<?xml version="1.0" encoding="UTF-8"?><Response/>', 200, {
    "Content-Type": "text/xml; charset=utf-8",
  });
});

export default app;
