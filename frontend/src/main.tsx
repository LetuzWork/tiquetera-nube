import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/albert-sans";
import "./theme/tokens.css";
import { App } from "./App";

const raiz = document.getElementById("raiz");
if (!raiz) throw new Error("Falta el contenedor #raiz");

createRoot(raiz).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
