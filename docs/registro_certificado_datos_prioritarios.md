# Datos para crear un Certificado en ICO Cert (para integración externa)

> Fuente: código vigente de `ico-cert-web` (`centralCertificados/panel/registrar.php`, `editar.php`) y `ico-cert-backend` (`CertificateController`, `CertificateService`, Form Requests de `cert`/`cert_pro`), más `memoria_ia_local` de ambos repos. Catálogos consultados en vivo contra la base de datos local el 2026-09-30.
>
> Esto documenta el comportamiento actual del backend Laravel. Antes de integrar en producción, un desarrollador humano debe confirmar que el entorno de destino (BD, catálogos) coincide con lo aquí descrito, y que la ruta sigue vigente.

## 1. Endpoint principal para crear el certificado

```
POST /api/cert/create
Authorization: Bearer <token admin con sesión válida (Sanctum)>
Content-Type: application/json
```

Hay una variante para el estándar "HOMOLOGACIÓN" (id 25) que usa otro endpoint y otros campos adicionales — ver sección 6.

El backend corre dentro de una transacción: si cualquier validación falla, no se crea nada.

## 2. Campos obligatorios

| Campo (JSON) | Tipo / formato | Validación backend | Corresponde a (UI) |
|---|---|---|---|
| `txtNumeroCertificado` | string, único | no puede repetirse en `normas_iso.codigo` | Código de certificado armado como `ICO-<nomenclatura>-<fecha 6 dígitos>-<token 4 dígitos>-PE` (el token se pide al backend, ver 2.1) |
| `txtType` | string | requerido | Tipo de documento: `RUC` (Perú) o `RFC` (México) |
| `txtRuc` | string | requerido; si `txtType=RUC`, se valida formato y dígito verificador peruano (11 dígitos) | Nº Documento |
| `txtEstatus` | numérico, FK `normas_iso_status.id` | requerido, debe existir | Estatus de Certificación — **en el alta normal el frontend solo permite id `4` (INACTIVO)**; ver catálogo en sección 7 |
| `txtNombreCompania` | string | requerido | Nombre de la compañía |
| `txtDireccionFiscal` | string | requerido | Dirección Fiscal |
| `txtDireccionCertificada` | string | requerido | Dirección Certificada |
| `txtAlcance` | string | requerido; si el estándar es 1/2/9 (ISO 9001/14001/45001) y el ente es 1 o 5 (INACAL/INACAL*), se valida contra una lista de alcances prohibidos | Alcance |
| `txtEstandar` | numérico, FK `standard_certifications.id` | requerido, debe existir; **rechazado (422) si el estándar tiene `es_certificado=0`** (productos solo cotizables, ver 7.4) | Estándar Certificado |
| `txtEnte` | numérico, FK `accrediting_entities.id` | requerido, debe existir; ver regla de compatibilidad estándar↔ente en 5.3 | Ente Acreditador |
| `txtAuditType` | numérico, FK `audit_type.id` | requerido, debe existir | Tipo de auditoría |
| `txtFechaPrimera` | fecha `YYYY-MM-DD` | requerida | Fecha de emisión del certificado original |
| `txtUltima` | fecha `YYYY-MM-DD` | requerida | Fecha de emisión del certificado vigente |
| `txtCaducidadCiclo` | fecha `YYYY-MM-DD` | requerida | Fecha de validez del certificado vigente |
| `txtAuditoria` | fecha `YYYY-MM-DD` | requerida | Fecha de expiración (próxima auditoría de seguimiento) |
| `txtNumCiclo` | numérico | requerido (el formulario lo precarga en `1`) | Nº de Ciclo |
| `txtNumEmision` | numérico | requerido (el formulario lo precarga en `1`) | Nº de Emisión |

### 2.1 Código y token del certificado

`txtNumeroCertificado` se construye en el frontend concatenando `ICO-{nomenclatura}-{fecha6dig}-{token4dig}-PE`. El token de 4 dígitos no lo inventa el frontend: lo pide al backend con `GET /api/cert/random-number` (devuelve un número que no colisiona con los ya usados ese mes/año). Un sistema externo puede:
- replicar esa consulta antes de armar el código, o
- generar su propio código único, siempre que no choque con uno existente (el backend igual lo valida con `unique:normas_iso,codigo`).

## 3. Campos opcionales

| Campo (JSON) | Tipo / formato | Efecto |
|---|---|---|
| `txttrackingCode` | string, formato `AB-NORMA-MONTO-L\|C\|N-C\|SN` (ver 3.1) | Se guarda en `normas_iso.tracking_code`. Si se envía, se valida estrictamente; si no se envía, se guarda `null` sin problema |
| `txtSuspendido` | fecha `YYYY-MM-DD` | Fecha de suspensión, si aplica |
| `txtCancelado` | fecha `YYYY-MM-DD` | Fecha de retiro/cancelación, si aplica |
| `logo` | objeto `{type, extension, base64}` | Solo tiene efecto real para el estándar BPL (id 23): sube el logo del cliente y lo guarda como `url_logo` |
| `confirmaCertificadoActivo` | `1` | Solo se usa cuando el backend respondió `409` por conflicto de ISO 37001 (ver 5.2); reenviando la misma solicitud con este flag en `1` se continúa el alta |
| `checks_emision` | array de 3 objetos `{key, label, checked}` | Checklist informativo (Informe de Auditoría Fase II, Decisión de Certificación, Certificado) que el frontend obliga a marcar antes de registrar; se guarda tal cual en `normas_iso.checks_emision`, no bloquea el alta si se omite |

### 3.1 Formato de `txttrackingCode`

Patrón: `ABREV-NORMA-MONTO-DIRIGIDO-FACTURA`, por ejemplo `GC-45001-2000-L-C`.

- `ABREV` (2 a 4 letras): debe coincidir con el `abbreviated` de un `AdminUser` activo con rol vendedor (3), gerente comercial (9) o subgerencia comercial (22).
- `NORMA`: debe matchear (por `LIKE`) la descripción de un `standard_certifications` activo, o su `codigo_estandar` si es uno de `Q, A, S, AS, STGM, HCP`.
- `MONTO`: numérico.
- `DIRIGIDO`: `L` (Ladislao), `C` (Certico) o `N` (No aplica).
- `FACTURA`: `C` (con factura) o `SN` (sin factura).

Si no se puede construir este dato (no hay comercial/monto/entidad/factura), se envía `null` — no es bloqueante.

## 4. Caso especial: estándar BPL (id 23)

Si `txtEstandar = 23`, la UI pide además un logo (`logo`, ver 3) y lo marca como obligatorio en pantalla, aunque a nivel de backend sigue siendo `nullable` (solo se exige internamente si se envía el objeto `logo`).

## 5. Reglas de negocio que pueden rechazar el alta (además de la validación de campos)

1. **Código duplicado**: `txtNumeroCertificado` ya existe en `normas_iso` (activo, no soft-deleted) → `400`.
2. **Certificado activo de la misma norma para el mismo RUC**: si el RUC ya tiene otro certificado `estatus=1` (ACTIVO) de la misma norma → `422` ("El cliente ya tiene un certificado activo de esta norma..."), **excepto**:
   - el par comercial ISO 37001:2016 (id 7) ↔ ISO 37001:2025 (id 35): ahí responde `409` pidiendo confirmación explícita (`confirmaCertificadoActivo=1`, ver 3) en vez de bloquear;
   - una lista fija de RUCs de "ampliación de muestra" autorizados a duplicar, definida en código (`CertificateService::RUCS_AMPLIACION_MUESTRA_CERTIFICADO_ACTIVO`).
3. **Estándar no certificable** (`es_certificado=0`): rechazo duro `422`. Ver catálogo, sección 7.4 — actualmente son los 4 "Implementación ISO X" y "AUDITORIA DE CERTIFICACION" (id 50).
4. **Alcance prohibido**: para estándares 1/2/9 (ISO 9001/14001/45001) acreditados por INACAL o INACAL* (ente 1 o 5), el texto de `txtAlcance` se valida contra una lista de alcances prohibidos (`CertificateScopeService`); si matchea, `422`.
5. **Compatibilidad estándar↔ente**: tal como está implementado hoy, si el estándar solicitado **no** es uno de `{1, 2, 7, 9, 35}` (ISO 9001, 14001, 37001:2016, 45001, 37001:2025) y el ente acreditador **no** es `3` (SIN ACREDITACION), el backend responde `422` ("No se puede acreditar {norma} con INACAL."). En la práctica: para cualquier estándar fuera de esos 5, el Ente Acreditador debe enviarse como `3`.

## 6. Caso aparte: estándar "HOMOLOGACIÓN" (id 25)

Si se selecciona el estándar 25, el frontend cambia de endpoint:

```
POST /api/cert-pro/create
```

Mismos campos de la sección 2, **más**:

| Campo | Tipo | Obligatorio |
|---|---|---|
| `txtTelf` | numérico | sí |
| `txtClient` | string | sí |
| `txtDetail` | array de `{area, puntos}` (13 áreas evaluadas, puntaje 0-100 cada una) | sí (el array en sí es obligatorio; el backend no valida cada score individualmente) |

Este flujo corre en un controller/servicio distinto (`HomologationCertController`), fuera de `CertificateService`, así que **no** aplican las reglas de la sección 5 (ISO 37001, alcance prohibido, etc.) — son exclusivas del alta estándar.

## 7. Acciones existentes sobre un certificado (no solo "crear")

### 7.1 Guardar (actualizar) — `PUT /api/cert/update`

Misma forma que el alta, pero:
- agrega `txtID` (requerido, debe existir en `normas_iso.id_iso`);
- agrega opcionales `txtRetificacion` y `txtCaducidaCerti` (fechas);
- agrega `txtCheck` (numérico, opcional): si se envía, `txtNumCiclo`/`txtNumEmision` dejan de ser obligatorios (permite guardar sin tocar esos dos campos).

### 7.2 Emitir Borrador / Emitir Oficial — `POST /api/cert/generate`

```
POST /api/cert/generate
{ "id": <id_iso>, "draft": "1"   // presente y "1" = BORRADOR; ausente = OFICIAL
}
```

- **Emitir Borrador** (`draft=1`): genera el PDF con marca de agua "BORRADOR" y el número de certificado parcialmente oculto (`ICO-XXXX-************`). Se guarda en `normas_iso.url_file_pdf_daft`. Si ya existe un borrador generado, la segunda llamada devuelve la misma URL sin regenerar (no hay forma de "regenerar borrador" desde este mismo endpoint). No cambia el estatus del certificado.
- **Emitir Oficial** (sin `draft`, o `draft` distinto de `"1"`): genera el PDF definitivo, se guarda en `normas_iso.url_file_pdf`. **Si el certificado estaba en estatus `4` (INACTIVO), pasa automáticamente a `1` (ACTIVO)**. Si ya existe un PDF oficial generado y `APP_DEBUG` no está activo, devuelve la URL existente sin regenerar. Si el certificado viene de una cotización con expediente en Google Drive, además sube el PDF a la carpeta "015 Emisiones" y dispara un correo de certificado emitido.
- El tipo de estándar determina qué generador de PDF se usa internamente (`CertificatePdfService`, protegido: ningún texto estático de esos PDFs puede tocarse). No hay diferencia de campos de entrada entre estándares para este endpoint, solo `id` y `draft`.

### 7.3 Otras acciones ya existentes (para que el sistema externo sepa que están disponibles, aunque no sean el foco de esta integración)

| Acción | Endpoint | Notas |
|---|---|---|
| Listar certificados | `GET /api/cert` | paginado |
| Buscar por código | `GET /api/cert/byCode` | |
| Buscar por RUC | `GET /api/cert/byRuc` | usado para ver antecedentes antes de emitir |
| Autocompletar/lookup | `GET /api/cert/lookup` | |
| Auditorías del certificado | `GET /api/cert/audit`, `GET /api/cert/audit/one` | |
| Eliminar | `DELETE /api/cert/delete` | requiere `txtID`, `comment` (motivo, máx. 500 car.) y `file` (evidencia en base64 de la aprobación) — **no es un borrado simple**, exige justificación y adjunto |
| Subir archivo adicional | `POST /api/cert/upload-file` | |
| Generar en modo prueba | `POST /api/cert/generate-test` | genera PDF sin persistir como oficial, para pruebas |
| Actualizar certificados vencidos | `GET /api/cert/actualizarCertificadosVencidos` | job/rutina de mantenimiento de estatus |
| Certificado PBF | `POST /api/cert/certificate_pbf` | variante de producto distinta (BPM/PBF) |

### 7.4 Lo que **no** vio esta lectura

No se encontró en el código ningún concepto explícito llamado "Guardar como borrador de datos" (sin generar PDF) distinto de simplemente hacer `POST /api/cert/create` con estatus INACTIVO — es decir, **todo certificado nace en estatus INACTIVO y ahí ya "está guardado"**; "emitir borrador"/"emitir oficial" son, en este sistema, específicamente la generación del PDF (sección 7.2), no un segundo guardado de datos.

## 8. Catálogos de referencia (consultados en vivo, 2026-09-30 — revalidar antes de integrar, pueden cambiar)

### 8.1 `normas_iso_status` (`txtEstatus`)

| id | descripción |
|---|---|
| 1 | ACTIVO |
| 2 | SUSPENDIDO |
| 3 | RETIRADO |
| 4 | INACTIVO |
| 5 | EN REVISIÓN |

### 8.2 `audit_type` (`txtAuditType`)

| id | descripción |
|---|---|
| 1 | Certificacion inicial |
| 2 | Auditoria de seguimiento 1 |
| 3 | Auditoria de seguimiento 2 |
| 4 | Recertificacion |
| 5 | N/A |

### 8.3 `accrediting_entities` (`txtEnte`)

| id | descripción |
|---|---|
| 1 | INACAL |
| 2 | ONAC |
| 3 | SIN ACREDITACION |
| 4 | N/A |
| 5 | INACAL* |
| 6 | PROTOCOLO ICO |

### 8.4 `standard_certifications` (`txtEstandar`) — solo activos (`estatus=1`) y relevantes

`es_certificado=0` significa que **no se puede usar en `/api/cert/create`** (rechazo 422); están marcados abajo.

| id | descripción | código | es_certificado | solo cotizable con formato |
|---|---|---|---|---|
| 1 | ISO 9001:2015 | SGC | sí | — |
| 2 | ISO 14001:2015 | SGA | sí | — |
| 3 | ISO 22000:2018 | SGIA | sí | — |
| 4 | ISO 26000:2010 | RS | sí | — |
| 6 | ISO 27001:2022 | SGSI | sí | — |
| 7 | ISO 37001:2016 | SGAS | sí | — |
| 8 | ISO 39001:2016 | SGSV | sí | — |
| 9 | ISO 45001:2018 | SGSST | sí | — |
| 10 | ISO 50001:2018 | SGEn | sí | — |
| 11 | SA 8000:2014 | SA8000 | sí | — |
| 20 | Incremento de CMC | CMC | sí | — |
| 21 | ISO 22301:2019 | SGCN | sí | — |
| 22 | ISO 18788:2015 | SGOSP | sí | — |
| 23 | Certificación BPL | BPL | sí (pide logo) | — |
| 24 | ISO 14567:1999 | ISO14567 | sí | — |
| 25 | HOMOLOGACIÓN | HOM | sí, **pero usa `/api/cert-pro/create`** (sección 6) | — |
| 26 | Licencia I.T. | LIT | sí | — |
| 27 | ISO 28001 | SGSCS | sí | — |
| 28 | Certificación BPM | BPM | sí | — |
| 29 | G. de la Procura | LIC-SW | sí | — |
| 30 | ISO 13485:2016 | SGC-PS | sí | — |
| 31 | ISO 30415:2021 | D&I | sí | — |
| 32 | Gestión de Riesgos | N/A | sí | — |
| 33 | Certificación PMI | N/A | sí | — |
| 34 | ISO 20000-1:2018 | ITSMS | sí | — |
| 35 | ISO 37001:2025 | SGAS | sí | — |
| 36 | ISO 3834:2021 | SGCS | sí | — |
| 37 | Certificación PPD | PPD | sí | — |
| 38 | Protocolo ICO 9001 | Q | sí | — |
| 39 | Protocolo ICO 14001 | A | sí | — |
| 40 | Protocolo ICO 45001 | S | sí | — |
| 41 | Protocolo ICO 37001 | AS | sí | — |
| 42 | ISO 37301:2021 | SGCO | sí | — |
| 43 | Certificación Huella de Carbono | HCP | sí | — |
| 44 | ISO 7396-1 | STGM | sí | — |
| 45 | FUNCIÓN DE CUMPLIMIENTO | FC | sí | — |
| 46 | Implementación ISO 9001 | IMP-9001 | **no** | formato id 2 (CERTIN) |
| 47 | Implementación ISO 14001 | IMP-14001 | **no** | formato id 2 (CERTIN) |
| 48 | Implementación ISO 45001 | IMP-45001 | **no** | formato id 2 (CERTIN) |
| 49 | Implementación ISO 37001 | IMP-37001 | **no** | formato id 2 (CERTIN) |
| 50 | AUDITORIA DE CERTIFICACION | AUC | **no** | — |

(Se omitieron del listado los estándares con `estatus=0`, es decir, inactivos/no ofrecidos hoy: ids 5, 12-19.)

Recomendación para el sistema externo: no hardcodear este catálogo de forma permanente — consultar `GET /api/standardcertifications` (o la tabla) antes de cada alta, ya que puede cambiar sin previo aviso (ya ha cambiado varias veces este año, incluyendo altas de "Implementación ISO X").

## 9. Alcance de esta lectura y siguiente paso

Este documento es solo lectura: no se modificó ningún archivo de `ico-cert-web` ni `ico-cert-backend`, ni la `memoria_ia_local` de ningún repo. No se tocó `CertificatePdfService.php` ni ningún archivo protegido.

¿Corresponde dejar un enlace a este documento (o un resumen equivalente) dentro de `memoria_ia_local` de alguno de los dos repos, para que quede como referencia técnica reutilizable, o lo dejamos como un documento aparte para el equipo que construye la integración?
