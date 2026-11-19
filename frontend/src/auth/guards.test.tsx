import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/client";
import { auth } from "../api/endpoints";
import type { Me, Permiso } from "../api/types";
import { meDe } from "../test/fabricas";
import { renderizarApp, SondaRuta } from "../test/render";
import { ProveedorAuth } from "./AuthContext";
import { RutaProtegida } from "./guards";

async function montarEn(ruta: string, permiso?: Permiso) {
  await act(async () => {
    render(
      <ProveedorAuth>
        <MemoryRouter initialEntries={[ruta]}>
          <Routes>
            <Route path="/ventanilla" element={<SondaRuta />} />
            <Route path="/bandeja" element={<SondaRuta />} />
            <Route
              path="/reportes"
              element={
                <RutaProtegida permiso={permiso}>
                  <p>Sección de reportes</p>
                </RutaProtegida>
              }
            />
          </Routes>
        </MemoryRouter>
      </ProveedorAuth>,
    );
  });
}

describe("RutaProtegida", () => {
  it("RF-36: muestra 'Verificando tu sesión…' mientras comprueba la sesión", async () => {
    vi.spyOn(auth, "me").mockReturnValue(new Promise<Me>(() => undefined));
    await renderizarApp({ ruta: "/bandeja" });
    expect(screen.getByRole("status")).toHaveTextContent("Verificando tu sesión…");
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("RF-36: el contenido no se ve hasta que la sesión responde", async () => {
    vi.spyOn(auth, "me").mockReturnValue(new Promise<Me>(() => undefined));
    await montarEn("/reportes");
    expect(screen.getByRole("status")).toHaveTextContent("Verificando tu sesión…");
    expect(screen.queryByText("Sección de reportes")).not.toBeInTheDocument();
  });

  it("RF-33: sin sesión, lleva a /ventanilla con state.desde", async () => {
    vi.spyOn(auth, "me").mockRejectedValue(new ApiError(401, "SESION_INVALIDA", "La sesión no es válida o expiró.", {}));
    await montarEn("/reportes");
    const ruta = screen.getByRole("status", { name: "Ruta actual" });
    expect(ruta).toHaveAttribute("data-ruta", "/ventanilla");
    expect(ruta).toHaveAttribute("data-desde", "/reportes");
  });

  it("con sesión, muestra la sección", async () => {
    vi.spyOn(auth, "me").mockResolvedValue(meDe("operador"));
    await montarEn("/reportes");
    expect(screen.getByText("Sección de reportes")).toBeInTheDocument();
  });

  it("RF-24: sin permiso, 'No tenés acceso a esta sección' con 'Volver a Tickets'", async () => {
    vi.spyOn(auth, "me").mockResolvedValue(meDe("usuario"));
    await montarEn("/reportes", "reporte:ver");
    expect(screen.getByRole("heading", { level: 1, name: "No tenés acceso a esta sección" })).toBeInTheDocument();
    expect(screen.queryByText("Sección de reportes")).not.toBeInTheDocument();
    expect(screen.queryByText("Este sello no es tuyo")).not.toBeInTheDocument();
    const volver = screen.getByRole("link", { name: "Volver a Tickets" });
    expect(volver).toHaveAttribute("href", "/bandeja");
    await userEvent.setup().click(volver);
    expect(screen.getByRole("status", { name: "Ruta actual" })).toHaveAttribute("data-ruta", "/bandeja");
  });
});
