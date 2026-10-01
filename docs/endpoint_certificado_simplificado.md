# Endpoint: Crear certificado (versión simplificada)

## Datos de la petición

```
POST /api/cert/create-simplificado
Authorization: Bearer <token admin>
Content-Type: application/json
Accept: application/json
```

## Atributos obligatorios

| Atributo | Tipo | Descripción |
|---|---|---|
| `txtRuc` | string | RUC del cliente (11 dígitos). |
| `txtAlcance` | string | Alcance del certificado. |
| `estandares` | array de números | Uno o más ids de estándar/ISO. Se crea **un certificado por cada id** enviado en el array. |
| `tipoEmision` | string | `"borrador"` u `"oficial"`. Aplica igual para **todos** los certificados del mismo request — no se puede mezclar borrador y oficial en una sola llamada. |

Ejemplo mínimo:

```json
{
  "txtRuc": "20123456789",
  "txtAlcance": "Servicios de consultoría en gestión de calidad.",
  "estandares": [1, 9],
  "tipoEmision": "oficial"
}
```

## Atributos opcionales

Si no se envían, el backend los completa automáticamente. Si se envían, el valor enviado tiene prioridad sobre lo que el backend hubiera completado solo.

| Atributo | Tipo | Notas |
|---|---|---|
| `txtType` | string | `"RUC"` o `"RFC"`. |
| `txtNombreCompania` | string | Nombre/razón social. |
| `txtDireccionFiscal` | string | Dirección fiscal. |
| `txtDireccionCertificada` | string | Dirección certificada. |
| `txtEnte` | número | Id de Ente Acreditador (catálogo `accrediting_entities`). |
| `txtAuditType` | número | Id de Tipo de auditoría (catálogo `audit_type`). |
| `txtFechaPrimera` | fecha `YYYY-MM-DD` | Fecha de emisión del certificado original. |
| `txtUltima` | fecha `YYYY-MM-DD` | Fecha de emisión del certificado vigente. |
| `txtCaducidadCiclo` | fecha `YYYY-MM-DD` | Fecha de validez del certificado vigente. |
| `txtAuditoria` | fecha `YYYY-MM-DD` | Fecha de próxima auditoría. |
| `txtSuspendido` | fecha `YYYY-MM-DD` | Fecha de suspensión, si aplica. |
| `txtCancelado` | fecha `YYYY-MM-DD` | Fecha de cancelación, si aplica. |
| `txtNumCiclo` | número | Nº de ciclo. |
| `txtNumEmision` | número | Nº de emisión. |

## Respuesta exitosa

```json
{
  "res": true,
  "msg": "Se agregaron los certificados.",
  "data": [
    {
      "id_iso": 1234,
      "codigo": "ICO-SGC-102026-7162-PE",
      "estandar": "ISO 9001:2015",
      "tipo_emision": "oficial",
      "url_certificado": "https://.../storage/certificados/20123456789/ICO-SGC-102026-7162-PE.pdf"
    },
    {
      "id_iso": 1235,
      "codigo": "ICO-SGSST-102026-4821-PE",
      "estandar": "ISO 45001:2018",
      "tipo_emision": "oficial",
      "url_certificado": "https://.../storage/certificados/20123456789/ICO-SGSST-102026-4821-PE.pdf"
    }
  ]
}
```

`data` siempre es un array, en el mismo orden que se enviaron los ids en `estandares`, con un objeto por cada certificado creado — ya incluye la URL del PDF generado (sea borrador u oficial, según `tipoEmision`).

## Respuestas de error

| Código | Cuándo ocurre |
|---|---|
| `401` | Token inválido o ausente. |
| `422` | Datos faltantes/incorrectos (`txtRuc`/`txtAlcance`/`estandares` obligatorios, RUC con formato inválido, algún estándar no existe o no es certificable, RUC con certificado activo de la misma norma, alcance no permitido, etc.). |
| `500` | Error inesperado del servidor. |

Formato de error:

```json
{
  "res": false,
  "msg": "Descripción del error.",
  "data": []
}
```

Si falla la validación de campos (422), además viene `errors` con el detalle por campo:

```json
{
  "res": false,
  "msg": "Los datos proporcionados no son válidos.",
  "errors": {
    "txtRuc": ["El RUC es obligatorio."]
  }
}
```

## Importante

- Si se envían varios ids en `estandares` y uno falla, **no se crea ninguno**: toda la petición se revierte (incluida la generación del PDF).
- Este endpoint ya genera el PDF (borrador u oficial) en la misma llamada — no hace falta llamar aparte a `POST /api/cert/generate` para esto.
