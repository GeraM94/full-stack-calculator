import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

const contenedor = document.getElementById("root");

// getElementById devuelve HTMLElement | null. Con strict activado TypeScript
// no te deja usarlo hasta descartar el null.
if (!contenedor) {
  throw new Error("no existe el elemento #root en index.html");
}

createRoot(contenedor).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
