import { Type, type FunctionDeclaration } from "@google/genai/node";

// Catalog of certifiable standards (backend `standardCertifications`, id = `estandares` value).
// las principales son 1,2,35,9,23
export const STANDARD_CATALOG = [
  { id: 1, name: "ISO 9001:2015", description: "Sistemas de gestión de la calidad" },
  { id: 2, name: "ISO 14001:2015", description: "Sistema de gestión ambiental" },
  { id: 3, name: "ISO 22000:2018", description: "Seguridad Alimentaria" },
  { id: 4, name: "ISO 26000:2010", description: "Guía de responsabilidad social" },
  { id: 6, name: "ISO 27001:2022", description: "Sistema de Gestión de la Seguridad de la Información" },
  { id: 7, name: "ISO 37001:2016", description: "Sistema de gestión antisoborno" },
  { id: 8, name: "ISO 39001:2016", description: "Sistema de Gestión de la Seguridad Vial" },
  { id: 9, name: "ISO 45001:2018", description: "Sistema de gestión de la seguridad y salud en el trabajo" },
  { id: 10, name: "ISO 50001:2018", description: "Sistemas de Gestión Energética" },
  { id: 11, name: "SA 8000:2014", description: "Responsabilidad Social" },
  { id: 20, name: "Incremento de CMC", description: "Incremento de la Capacidad Máxima de Contratación" },
  { id: 21, name: "ISO 22301:2019", description: "Sistema de Gestión de la Continuidad de Negocio" },
  { id: 22, name: "ISO 18788:2015", description: "Sistema de Gestión Para Las Operaciones De Seguridad Privada" },
  { id: 23, name: "Certificación BPL", description: "Buenas Prácticas Laborales" },
  { id: 24, name: "ISO 14567:1999", description: "Personal protective equipment for protection against falls from a height - single - point anchor devices" },
  { id: 25, name: "HOMOLOGACIÓN", description: "HOMOLOGACIÓN" },
  { id: 26, name: "Licencia I.T.", description: "Licencia de innovación tecnológica - Segurito - ISO 45001 / ISO 9001 / Ley 29783" },
  { id: 27, name: "ISO 28001", description: "Gestión de la Seguridad en la Cadena de Suministro" },
  { id: 28, name: "Certificación BPM", description: "Buenas Prácticas de Manipulación" },
  { id: 29, name: "G. de la Procura", description: "" },
  { id: 30, name: "ISO 13485:2016", description: "Sistemas de Gestión de la Calidad en Productos Sanitarios" },
  { id: 31, name: "ISO 30415:2021", description: "Gestión de Recursos Humanos" },
  { id: 32, name: "Gestión de Riesgos", description: "" },
  { id: 33, name: "Certificación PMI", description: "" },
  { id: 34, name: "ISO 20000-1:2018", description: "Calidad de Servicios TI" },
  { id: 35, name: "ISO 37001:2025", description: "Sistema de gestión antisoborno" },
  { id: 36, name: "ISO 3834:2021", description: "Requisitos de calidad para el soldeo por fusión de materiales metálicos" },
  { id: 37, name: "Certificación PPD", description: "PRÁCTICAS DE PROMOCIÓN DE LA DIVERSIDAD (PPD)" },
  { id: 38, name: "Protocolo ICO 9001", description: "Protocolo ICO - Estándar de Calidad" },
  { id: 39, name: "Protocolo ICO 14001", description: "Protocolo ICO - Estándar Ambiental" },
  { id: 40, name: "Protocolo ICO 45001", description: "Protocolo ICO - Estándar de Seguridad y Salud en el Trabajo" },
  { id: 41, name: "Protocolo ICO 37001", description: "Protocolo ICO - Estándar de gestión antisoborno" },
  { id: 42, name: "ISO 37301:2021", description: "Sistema de gestión de compliance" },
  { id: 43, name: "Certificación Huella de Carbono", description: "Huella de Carbono de Producto" },
  { id: 44, name: "ISO 7396-1", description: "Sistemas de Tuberías de Gases Medicinales" },
  { id: 45, name: "FUNCIÓN DE CUMPLIMIENTO", description: "FUNCIÓN DE CUMPLIMIENTO" },
];

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export const searchStandardsDeclaration: FunctionDeclaration = {
  name: "consultar_estandares",
  description:
    "Consulta los estándares disponibles para certificar. Usar cuando el usuario pregunte " +
    "qué estándares o normas hay, o por un tema concreto (calidad, ambiental, seguridad, etc.).",
  parameters: {
    type: Type.OBJECT,
    properties: {
      busqueda: {
        type: Type.STRING,
        description: "Texto a buscar en nombre o descripción. Omitir para listar todos.",
      },
    },
  },
};

export function searchStandards(args: { busqueda?: string }): Record<string, unknown> {
  const query = normalize(args.busqueda ?? "").trim();
  const matches = STANDARD_CATALOG.filter(
    (s) => !query || normalize(`${s.name} ${s.description}`).includes(query),
  );
  return { estandares: matches.map(({ name, description }) => ({ nombre: name, descripcion: description })) };
}
