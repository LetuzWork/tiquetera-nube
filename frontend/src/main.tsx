import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles/app.css";

const raiz = document.getElementById("raiz");
if (!raiz) throw new Error("Falta el contenedor #raiz");

createRoot(raiz).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
