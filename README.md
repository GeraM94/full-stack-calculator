# Calculadora — Go + React + TypeScript

Calculadora web donde **toda la aritmética ocurre en el servidor**. El frontend
no suma nada: cada operación es una petición HTTP al backend en Go.

Es artificial a propósito — una calculadora real calcularía en el navegador.
El objetivo es ver los dos lenguajes hablando entre sí con un contrato tipado
en ambos extremos.

```
Navegador (React + TS)  ──POST /api/calcular {a, b, operacion}──▶  Go :8080
                        ◀──────── {resultado} | {error} ─────────
```

## Estructura

```
calculadora/
├── backend/
│   ├── go.mod
│   ├── main.go              API HTTP + servidor de archivos estáticos
│   └── calculadora_test.go  tests table-driven
└── frontend/
    ├── vite.config.ts       proxy /api → :8080 en desarrollo
    ├── tsconfig.json        strict activado
    └── src/
        ├── api.ts           contrato con Go (union discriminada + type guard)
        ├── useCalculadora.ts  hook con toda la máquina de estados
        ├── App.tsx          UI y teclado
        └── main.tsx         punto de entrada
```

## Requisitos

- Go 1.22 o superior (probado con 1.27)
- Node 18 o superior (probado con 22)

## Modo producción — un solo servidor

Go sirve la API **y** el frontend ya compilado en el mismo puerto.

```bash
cd frontend
npm install
npm run build          # genera frontend/dist

cd ../backend
go run .               # http://localhost:8080
```

Para generar el binario distribuible:

```bash
cd backend
go build -o calculadora.exe .
./calculadora.exe -puerto 9000
```

## Modo desarrollo — dos procesos

Con recarga en caliente del frontend. Necesitas **dos terminales**:

```bash
# Terminal 1 — backend
cd backend
go run .

# Terminal 2 — frontend
cd frontend
npm run dev            # http://localhost:5173
```

Vite reenvía `/api` al `:8080` de Go (ver `vite.config.ts`), así que el
navegador cree que todo viene del mismo origen y no hay que tocar CORS.

## API

`POST /api/calcular`

```jsonc
// petición
{ "a": 10, "b": 4, "operacion": "/" }   // operacion: "+" | "-" | "*" | "/"

// 200 OK
{ "resultado": 2.5 }

// 400 Bad Request
{ "error": "no se puede dividir entre cero" }
```

Casos que devuelven 400: división entre cero, operación no soportada, JSON
malformado y resultados fuera del rango de `float64` (`Infinity` y `NaN` no
son representables en JSON).

## Tests

```bash
cd backend
go test ./... -v
```

## Atajos de teclado

`0-9` `.` dígitos · `+` `-` `*` `/` operadores · `Enter` o `=` calcular ·
`Backspace` borrar · `Esc` limpiar
