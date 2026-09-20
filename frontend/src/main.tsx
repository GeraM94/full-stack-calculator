import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { createHttpClient } from "./api/client";
import "./styles.css";

const container = document.getElementById("root");
if (!container) {
  throw new Error("element #root not found in index.html");
}

const client = createHttpClient();

createRoot(container).render(
  <StrictMode>
    <App client={client} />
  </StrictMode>,
);
