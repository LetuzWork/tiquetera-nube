import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/client";
import { auth } from "../api/endpoints";
import type { Horario, Me } from "../api/types";
import { ProveedorAuth } from "../auth/AuthContext";
import { ProveedorJornada } from "../jornada/JornadaContext";
import { horarioDe, meDe } from "../test/fabricas";
import { Cuenta } from "./Cuenta";

const MARTES_1420 = "2026-11-17T17:20:00Z";
const OPERADOR = meDe("operador", { sesion_expira: "2026-11-17T10:00:00-03:00" });

async function montar(me: Me | null = OPERADOR, horario: Horario = horarioDe(MARTES_1420)) {
  const espiaMe = vi.spyOn(auth, "me");
  if (me) espiaMe.mockResolvedValue(me);
  else espiaMe.mockRejectedValue(new ApiError(401, "SESION_INVALIDA", "La sesión no es válida o expiró.", {}));
  vi.spyOn(auth, "horario").mockResolvedValue(horario);
  await act(async () => {
    render(
      <ProveedorAuth>
        <ProveedorJornada>
          <Cuenta />
        </ProveedorJornada>
      </ProveedorAuth>,
    );
  });
  return { persona: userEvent.setup() };
}

describe("Cuenta", () => {
  it("RF-19: es el botón 'Cuenta de Omar Operador' con las iniciales, el nombre y el rol", async () => {
    await montar();
    const boton = screen.getByRole("button", { name: "Cuenta de Omar Operador" });
    expect(boton).toHaveAttribute("aria-haspopup", "menu");
    expect(within(boton).getByText("OO")).toHaveAttribute("aria-hidden", "true");
    expect(within(boton).getByText("Omar Operador")).toBeInTheDocument();
    expect(within(boton).getByText("Operador")).toBeInTheDocument();
  });

  it("RF-19: las iniciales y el rol salen de la persona", async () => {
    await montar(meDe("admin", { nombre: "María José de la Fuente" }));
    const boton = screen.getByRole("button", { name: "Cuenta de María José de la Fuente" });
    expect(within(boton).getByText("MF")).toBeInTheDocument();
    expect(within(boton).getByText("Admin")).toBeInTheDocument();
  });

  it("RF-19: el menú dice hasta cuándo dura la sesión y ofrece 'Cerrar sesión'", async () => {
    const { persona } = await montar();
    await persona.click(screen.getByRole("button", { name: "Cuenta de Omar Operador" }));
    const menu = screen.getByRole("menu", { name: "Cuenta de Omar Operador" });
    expect(menu).toHaveAccessibleDescription("Sesión hasta las 10:00");
    expect(within(menu).getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["Cerrar sesión"]);
  });

  it("RF-19: se maneja con teclado", async () => {
    const { persona } = await montar();
    const boton = screen.getByRole("button", { name: "Cuenta de Omar Operador" });
    act(() => boton.focus());
    await persona.keyboard("{Enter}");
    expect(screen.getByRole("menuitem", { name: "Cerrar sesión" })).toHaveFocus();
    await persona.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(boton).toHaveFocus();
  });

  it("RF-3: la hora de la sesión sale en la zona del servidor", async () => {
    const { persona } = await montar(OPERADOR, horarioDe(MARTES_1420, { zona: "Europe/Madrid" }));
    await persona.click(screen.getByRole("button", { name: "Cuenta de Omar Operador" }));
    expect(screen.getByRole("menu", { name: "Cuenta de Omar Operador" })).toHaveAccessibleDescription("Sesión hasta las 14:00");
  });

  it("RF-19: 'Cerrar sesión' cierra la sesión", async () => {
    const logout = vi.spyOn(auth, "logout").mockResolvedValue(undefined);
    const { persona } = await montar();
    await persona.click(screen.getByRole("button", { name: "Cuenta de Omar Operador" }));
    await persona.click(screen.getByRole("menuitem", { name: "Cerrar sesión" }));
    expect(logout).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("button", { name: "Cuenta de Omar Operador" })).not.toBeInTheDocument());
  });

  it("sin sesión no muestra nada", async () => {
    await montar(null);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
