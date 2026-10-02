# BluePrints en Tiempo Real (Lab P4 / LAB06) — README del equipo

## Integrantes
- Jeyder Nicolay Leon Lancheros
- Juan Camilo Cristancho Velasquez

## Video

El video ejecutando el proyecto se encuentra en el directorio raiz, se llama `videoPrueba`.


## Setup

### Variables de entorno

Copia `.env.example` a `.env.local`:

| Variable | Para qué sirve |
|---|---|
| `VITE_API_BASE` | URL de la API REST (CRUD), p. ej. `http://localhost:8080` |
| `VITE_AUTH_BASE` | URL del servicio de login JWT |
| `VITE_IO_BASE` | Servidor Socket.IO, p. ej. `http://localhost:3001` |
| `VITE_STOMP_BASE` | Servidor STOMP (Spring), p. ej. `http://localhost:8080` |
| `VITE_STOMP_PATH` | Ruta del WebSocket STOMP, p. ej. `/ws-blueprints` |
| `VITE_USE_MOCK` | `true` = datos en memoria, `false` = API REST real |

### Cómo ejecutarlo

1. **Backend Socket.IO (repo guía):** `npm i && npm run dev` → puerto **3001**.
2. **Front:** `npm install`, `npm run dev` y abrir `http://localhost:5173/realtime`.
3. **backend STOMP:** `./mvnw spring-boot:run` → puerto **8080**.
   

## Endpoints usados

**REST**

- `GET /api/blueprints?author=:author`
- `GET /api/blueprints/:author/:name`
- `POST /api/blueprints`
- `PUT /api/blueprints/:author/:name`
- `DELETE /api/blueprints/:author/:name`

**Socket.IO**

- `join-room` (room)
- `draw-event` `{ room, author, name, point }`
- `blueprint-update` `{ author, name, points }`

**STOMP**

- Conexión: `ws://localhost:8080/ws-blueprints`
- Publicar en `/app/draw`
- Suscribirse a `/topic/blueprints.{author}.{name}`

## Decisiones de diseño

- **Sala/tópico por plano (`blueprints.{author}.{name}`):** cada plano es un canal aislado, así los puntos de un plano no llegan a quien dibuja otro.
- **Autor y nombre solo con letras, números, `-` y `_` (zod):** el punto separa las partes del nombre de sala; si se permitiera, `a.b/c` y `a/b.c` caerían en la misma sala.
- **Una conexión por plano:** al cambiar de plano se cierra el socket, porque el servidor guía no tiene `leave-room`.
- **`join-room` en cada reconexión:** el servidor olvida las salas cuando el socket se cae.
- **Coordenadas en píxeles del canvas (520×360):** son las mismas que usa el backend guía.
- **El punto propio se pinta localmente y luego se publica:** el usuario ve su trazo sin esperar al servidor.
- **Validación con zod de todo lo que entra y sale:** lo inválido se descarta y queda un aviso `[RT]` en la consola.
- **Panel de health check:** muestra Up/Down y la latencia de REST, Socket.IO y STOMP.


## Hallazgos

- **Latencia:** Socket.io = 9ms, Rest API = 46ms, STOMP = 46ms.
- **Reconexión:** al detener el backend con la app abierta, el indicador pasa a "Reconnecting"/"Disconnected"; al reiniciarlo vuelve a "Connected" y el dibujo sigue replicándose.
- **El estado no se persiste en tiempo real:** el backend guía solo reenvía mensajes. Una pestaña que entra tarde no ve los puntos anteriores hasta que alguien presiona Save/Update y ella vuelve a cargar el plano.

## Pruebas

`npm test` (51 pruebas). Destaca `tests/RealtimeBlueprintPage.test.jsx`, que cubre los 4 casos mínimos del laboratorio, incluido el de tres pestañas.
