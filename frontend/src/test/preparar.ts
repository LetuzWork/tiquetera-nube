import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { IntersectionObserverFalso } from "./interseccion";

// Función común y no vi.fn, para que restoreMocks no la cambie entre pruebas.
vi.stubGlobal("fetch", () => Promise.reject(new TypeError("Sin red en las pruebas")));
vi.stubGlobal("IntersectionObserver", IntersectionObserverFalso);

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
