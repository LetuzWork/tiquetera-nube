import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/client";
import { auth, demo, type AjusteRelojDemo } from "../api/endpoints";
import type { Horario } from "../api/types";
import { ProveedorJornada, useJornada } from "../jornada/JornadaContext";
import { textoEstado } from "../jornada/jornada";
import { horarioDe, meDe } from "../test/fabricas";
import { renderizarApp } from "../test/render";
import { relojFalso } from "../test/tiempo";
import { RelojDemo } from "./RelojDemo";

const HORA_REAL = "21:40";

// Miércoles 18 de noviembre de 2026 en Buenos Aires (UTC-3).
function horarioALas(hora: string): Horario {
  const [h = 0, m = 0] = hora.split(":").map(Number);
  return horarioDe(new Date(Date.UTC(2026, 10, 18, h + 3, m)).toISOString());
}

function servidor({ falla = false }: { falla?: boolean } = {}) {
  let actual = horarioALas(HORA_REAL);
  const horario = vi.spyOn(auth, "horario").mockImplementation(async () => actual);
  const reloj = vi.spyOn(demo, "reloj").mockResolvedValue({ simulado: false, ahora: actual.ahora });
  const ajustar = vi.spyOn(demo, "ajustar").mockImplementation(async (cuerpo: AjusteRelojDemo) => {
    if (falla) throw new ApiError(0, "SIN_CONEXION", "No se pudo contactar al servidor.", {});
    actual = horarioALas("hora" in cuerpo ? cuerpo.hora : HORA_REAL);
    return actual;
  });
  return { horario, reloj, ajustar };
}

function SondaJornada() {
  const { jornada } = useJornada();
  return <output aria-label="Estado de la jornada">{jornada ? textoEstado(jornada) : ""}</output>;
}

async function montar() {
  const reloj = relojFalso();
  await act(async () => {
    render(
      <ProveedorJornada relojMonotono={reloj.ahora}>
        <RelojDemo />
        <SondaJornada />
      </ProveedorJornada>,
    );
  });
}

const region = () => screen.queryByRole("complementary", { name: "Reloj de demostración" });
const estado = () => screen.getByRole("status", { name: "Estado de la jornada" });

async function abrir() {
  const user = userEvent.setup();
  const boton = await screen.findByRole("button", { name: `Demo · ${HORA_REAL}` });
  await user.click(boton);
  return { user, boton, panel: screen.getByRole("group", { name: `Demo · ${HORA_REAL}` }) };
}

describe("RelojDemo", () => {
  describe("RF-6: sin el endpoint no hay nada", () => {
    it("si /demo/reloj da 404, no dibuja nada ni escribe en la consola", async () => {
      vi.spyOn(auth, "horario").mockResolvedValue(horarioALas(HORA_REAL));
      vi.spyOn(globalThis, "fetch").mockImplementation(
        async () => new Response(JSON.stringify({ detail: "Not Found" }), { status: 404 }),
      );
      const error = vi.spyOn(console, "error");
      const aviso = vi.spyOn(console, "warn");
      await montar();
      await act(async () => {});
      expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledWith("/api/demo/reloj", expect.anything());
      expect(region()).not.toBeInTheDocument();
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
      expect(error).not.toHaveBeenCalled();
      expect(aviso).not.toHaveBeenCalled();
    });

    it("si el servidor no responde, tampoco", async () => {
      vi.spyOn(auth, "horario").mockResolvedValue(horarioALas(HORA_REAL));
      const error = vi.spyOn(console, "error");
      await montar();
      await act(async () => {});
      expect(region()).not.toBeInTheDocument();
      expect(error).not.toHaveBeenCalled();
    });
  });

  describe("RF-5: el botón y el panel", () => {
    it("con el endpoint, muestra 'Demo · HH:MM' con la hora del servidor, cerrado", async () => {
      const { reloj } = servidor();
      await montar();
      const boton = await screen.findByRole("button", { name: `Demo · ${HORA_REAL}` });
      expect(region()).toContainElement(boton);
      expect(boton).toHaveAttribute("aria-expanded", "false");
      expect(reloj).toHaveBeenCalledTimes(1);
    });

    it("al abrirlo muestra los accesos, 'Otra hora' con 'Aplicar' y 'Hora real'", async () => {
      servidor();
      await montar();
      const { boton, panel } = await abrir();
      expect(boton).toHaveAttribute("aria-expanded", "true");
      for (const hora of ["08:00", "12:00", "17:55", "19:30"]) {
        expect(within(panel).getByRole("button", { name: hora })).toBeVisible();
      }
      expect(within(panel).getByLabelText("Otra hora")).toHaveAttribute("type", "time");
      expect(within(panel).getByRole("button", { name: "Aplicar" })).toBeVisible();
      expect(within(panel).getByRole("button", { name: "Hora real" })).toBeVisible();
    });

    it("aplicar '17:55' llama al PUT y a actualizar(): la jornada pasa a 'Cierra en 5 min'", async () => {
      const { horario, ajustar } = servidor();
      await montar();
      expect(estado()).toHaveTextContent("Fuera del horario de atención");
      const llamadasAntes = horario.mock.calls.length;
      const { user, panel } = await abrir();
      await user.click(within(panel).getByRole("button", { name: "17:55" }));
      expect(ajustar).toHaveBeenCalledTimes(1);
      expect(ajustar).toHaveBeenCalledWith({ hora: "17:55" });
      expect(horario.mock.calls.length).toBeGreaterThan(llamadasAntes);
      const boton = await screen.findByRole("button", { name: "Demo · 17:55" });
      expect(estado()).toHaveTextContent("Cierra en 5 min");
      expect(boton).toHaveAttribute("aria-expanded", "false");
      expect(boton).toHaveFocus();
    });

    it("'Otra hora' aplica la hora escrita, también con Enter", async () => {
      const { ajustar } = servidor();
      await montar();
      const { user, panel } = await abrir();
      await user.type(within(panel).getByLabelText("Otra hora"), "10:30");
      await user.click(within(panel).getByRole("button", { name: "Aplicar" }));
      expect(ajustar).toHaveBeenCalledWith({ hora: "10:30" });
      const boton = await screen.findByRole("button", { name: "Demo · 10:30" });
      expect(estado()).toHaveTextContent("Quedan 7 h 30 min de jornada");

      await user.click(boton);
      await user.type(screen.getByLabelText("Otra hora"), "19:45{Enter}");
      expect(ajustar).toHaveBeenLastCalledWith({ hora: "19:45" });
      expect(await screen.findByRole("button", { name: "Demo · 19:45" })).toBeInTheDocument();
      expect(estado()).toHaveTextContent("Fuera del horario de atención");
    });

    it("'Otra hora' vacía no llama al PUT", async () => {
      const { ajustar } = servidor();
      await montar();
      const { user, panel } = await abrir();
      await user.click(within(panel).getByRole("button", { name: "Aplicar" }));
      expect(ajustar).not.toHaveBeenCalled();
    });

    it("'Hora real' vuelve a la hora del servidor", async () => {
      const { ajustar } = servidor();
      await montar();
      const { user, panel } = await abrir();
      await user.click(within(panel).getByRole("button", { name: "12:00" }));
      await user.click(await screen.findByRole("button", { name: "Demo · 12:00" }));
      expect(estado()).toHaveTextContent("Quedan 6 h de jornada");
      await user.click(within(screen.getByRole("group", { name: "Demo · 12:00" })).getByRole("button", { name: "Hora real" }));
      expect(ajustar).toHaveBeenLastCalledWith({ real: true });
      expect(await screen.findByRole("button", { name: `Demo · ${HORA_REAL}` })).toBeInTheDocument();
      expect(estado()).toHaveTextContent("Fuera del horario de atención");
    });
  });

  describe("RF-7: si aplicar falla", () => {
    it("muestra 'No se pudo cambiar la hora.' dentro del panel, que sigue abierto", async () => {
      const { horario } = servidor({ falla: true });
      await montar();
      const llamadasAntes = horario.mock.calls.length;
      const { user, boton, panel } = await abrir();
      await user.click(within(panel).getByRole("button", { name: "08:00" }));
      expect(await within(panel).findByRole("alert")).toHaveTextContent("No se pudo cambiar la hora.");
      expect(boton).toHaveAttribute("aria-expanded", "true");
      expect(boton).toHaveAccessibleName(`Demo · ${HORA_REAL}`);
      expect(horario.mock.calls.length).toBe(llamadasAntes);
    });
  });

  describe("RNF-1: teclado", () => {
    it("Esc cierra el panel y devuelve el foco al botón", async () => {
      servidor();
      await montar();
      const { user, boton, panel } = await abrir();
      await user.click(within(panel).getByLabelText("Otra hora"));
      expect(within(panel).getByLabelText("Otra hora")).toHaveFocus();
      await user.keyboard("{Escape}");
      expect(boton).toHaveAttribute("aria-expanded", "false");
      expect(panel).not.toBeVisible();
      expect(boton).toHaveFocus();
    });
  });

  describe("montado en App", () => {
    const conEndpoint = () =>
      vi.spyOn(demo, "reloj").mockResolvedValue({ simulado: true, ahora: "2026-11-17T14:20:00-03:00" });

    it("aparece en el inicio de sesión", async () => {
      conEndpoint();
      await renderizarApp({ ruta: "/ventanilla" });
      expect(await screen.findByRole("button", { name: "Demo · 14:20" })).toBeInTheDocument();
    });

    it("aparece dentro de la app", async () => {
      conEndpoint();
      await renderizarApp({ ruta: "/bandeja", me: meDe("operador") });
      expect(await screen.findByRole("banner")).toBeInTheDocument();
      expect(await screen.findByRole("button", { name: "Demo · 14:20" })).toBeInTheDocument();
    });
  });
});
