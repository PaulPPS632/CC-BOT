import { Hono } from "hono";
import { generateReply, loadHistory, saveMessage } from "./gemini";
import { allowedNumber, twilioSignature, type AppEnv } from "./middleware";
import { sendWhatsApp } from "./twilio";

const MAX_WHATSAPP_LENGTH = 1600;

const app = new Hono<AppEnv>();

app.post("/whatsapp", twilioSignature, allowedNumber, async (c) => {
  const params = c.var.params;
  const from = params.get("From") ?? "";
  const to = params.get("To") ?? "";
  const body = params.get("Body") ?? "";
  console.log(`msg from=${from} body=${body}`);

  // Reply after the webhook returns: Gemini can exceed Twilio's 15s webhook timeout.
  c.executionCtx.waitUntil(
    (async () => {
      try {
        const phone = from.replace(/^whatsapp:/, "");
        await saveMessage(c.env.DB, phone, "user", body);
        const reply = await generateReply(
          c.env,
          await loadHistory(c.env.DB, phone),
          (text, mediaUrl) => sendWhatsApp(c.env, to, from, text, mediaUrl),
        );
        if (!reply) return;
        await saveMessage(c.env.DB, phone, "model", reply);
        await sendWhatsApp(c.env, to, from, reply.slice(0, MAX_WHATSAPP_LENGTH));
      } catch (err) {
        console.error("reply failed", err);
      }
    })(),
  );
  return c.body(null, 200);
});

export default app;
