import { Type, type FunctionDeclaration } from "@google/genai/node";
import { getToken } from "./ico-auth";
import { STANDARD_CATALOG } from "./standards";

const STANDARDS: Record<string, number> = Object.fromEntries(
  STANDARD_CATALOG.map((s) => [s.name, s.id]),
);

export const createCertificateDeclaration: FunctionDeclaration = {
  name: "crear_certificado",
  description:
    "Crea uno o más certificados y genera sus PDF. Llamar solo cuando el usuario haya dado " +
    "RUC, alcance, estándares y tipo de emisión; si falta alguno, pedírselo al usuario " +
    "antes de llamar y nunca inventar valores.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      txtRuc: { type: Type.STRING, description: "RUC del cliente, 11 dígitos." },
      txtAlcance: { type: Type.STRING, description: "Alcance del certificado." },
      estandares: {
        type: Type.ARRAY,
        description: "Estándares a certificar. Se crea un certificado por cada uno.",
        items: { type: Type.STRING, enum: Object.keys(STANDARDS) },
      },
      tipoEmision: {
        type: Type.STRING,
        enum: ["borrador", "oficial"],
        description: "Aplica a todos los certificados de la solicitud.",
      },
    },
    required: ["txtRuc", "txtAlcance", "estandares", "tipoEmision"],
  },
};

type CertificateArgs = {
  txtRuc?: string;
  txtAlcance?: string;
  estandares?: string[];
  tipoEmision?: string;
};

type SendMedia = (body: string, mediaUrl?: string) => Promise<boolean>;

type ApiCertificate = {
  codigo: string;
  estandar: string;
  tipo_emision: string;
  url_certificado: string;
};

// The returned object goes back to Gemini as the function response.
export async function createCertificate(
  env: Env,
  args: CertificateArgs,
  sendMedia: SendMedia,
): Promise<Record<string, unknown>> {
  const { txtRuc, txtAlcance, estandares, tipoEmision } = args;

  if (!txtRuc || !/^\d{11}$/.test(txtRuc)) return { error: "El RUC debe tener 11 dígitos." };
  if (!txtAlcance?.trim()) return { error: "Falta el alcance." };
  if (tipoEmision !== "borrador" && tipoEmision !== "oficial") {
    return { error: 'tipoEmision debe ser "borrador" u "oficial".' };
  }
  const ids = (estandares ?? []).map((name) => STANDARDS[name]);
  if (ids.length === 0 || ids.some((id) => id === undefined)) {
    return { error: `Estándares no válidos. Disponibles: ${Object.keys(STANDARDS).join(", ")}.` };
  }

  const payload = JSON.stringify({ txtRuc, txtAlcance, estandares: ids, tipoEmision });
  const post = async (token: string) =>
    fetch(`${env.CERT_API_URL}/api/cert/create-simplificado`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: payload,
    });

  let res: Response;
  try {
    res = await post(await getToken(env));
    if (res.status === 401) res = await post(await getToken(env, true)); // token expired
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error de autenticación." };
  }
  const json = (await res.json().catch(() => null)) as {
    res?: boolean;
    msg?: string;
    errors?: unknown;
    data?: ApiCertificate[];
  } | null;
  console.log(`cert api status=${res.status} res=${json?.res} msg=${json?.msg}`);

  if (!res.ok || !json?.res) {
    return { error: json?.msg ?? `Error ${res.status} del servicio de certificados.`, errors: json?.errors };
  }

  const certificates = json.data ?? [];
  for (const cert of certificates) {
    const label = `${cert.estandar} (${cert.tipo_emision}) - ${cert.codigo}`;
    // Fallback: if the PDF can't be delivered as a file, send the link as text.
    if (!(await sendMedia(label, cert.url_certificado))) {
      await sendMedia(`${label}\n${cert.url_certificado}`);
    }
  }
  return {
    ok: true,
    mensaje: "Certificados creados; los PDF ya fueron enviados al usuario por WhatsApp.",
    certificados: certificates.map(({ codigo, estandar, tipo_emision }) => ({ codigo, estandar, tipo_emision })),
  };
}
