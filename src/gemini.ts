import { GoogleGenAI, type Content } from "@google/genai/node";
import { createCertificate, createCertificateDeclaration } from "./certificates";
import { SYSTEM_PROMPT } from "./prompt";
import { searchStandards, searchStandardsDeclaration } from "./standards";

export type ChatMessage = { role: "user" | "model"; content: string };

const HISTORY_LIMIT = 20;
const MAX_TOOL_ROUNDS = 3;

export type SendFn = (body: string, mediaUrl?: string) => Promise<boolean>;

export async function loadHistory(db: D1Database, phone: string): Promise<ChatMessage[]> {
  const { results } = await db
    .prepare("SELECT role, content FROM messages WHERE phone = ? ORDER BY id DESC LIMIT ?")
    .bind(phone, HISTORY_LIMIT)
    .all<ChatMessage>();
  return results.reverse();
}

export async function saveMessage(
  db: D1Database,
  phone: string,
  role: ChatMessage["role"],
  content: string,
): Promise<void> {
  await db
    .prepare("INSERT INTO messages (phone, role, content) VALUES (?, ?, ?)")
    .bind(phone, role, content)
    .run();
}

export async function generateReply(
  env: Env,
  history: ChatMessage[],
  send: SendFn,
): Promise<string> {
  const credentials = JSON.parse(env.GOOGLE_CREDENTIALS);
  const ai = new GoogleGenAI({
    vertexai: true,
    project: credentials.project_id,
    location: env.GOOGLE_LOCATION,
    googleAuthOptions: { credentials },
  });

  const contents: Content[] = history.map((m) => ({ role: m.role, parts: [{ text: m.content }] }));

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const response = await ai.models.generateContent({
      model: env.GEMINI_MODEL,
      contents,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        tools: [{ functionDeclarations: [createCertificateDeclaration, searchStandardsDeclaration] }],
      },
    });

    const calls = response.functionCalls;
    if (!calls?.length) return response.text ?? "";

    // Keep the model turn as-is (preserves thought signatures), then answer each call.
    const modelContent = response.candidates?.[0]?.content;
    if (modelContent) contents.push(modelContent);

    const parts = [];
    for (const call of calls) {
      let result: Record<string, unknown>;
      switch (call.name) {
        case createCertificateDeclaration.name:
          result = await createCertificate(env, call.args ?? {}, send);
          break;
        case searchStandardsDeclaration.name:
          result = searchStandards(call.args ?? {});
          break;
        default:
          result = { error: `Función desconocida: ${call.name}` };
      }
      parts.push({ functionResponse: { name: call.name, response: result } });
    }
    contents.push({ role: "user", parts });
  }
  return "";
}
