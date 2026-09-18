import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { store } from "./store/store";
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
    {/* Provider pone la store en el contexto de React: a partir de aquí
        cualquier componente del árbol puede usar los hooks de react-redux. */}
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>,
);
