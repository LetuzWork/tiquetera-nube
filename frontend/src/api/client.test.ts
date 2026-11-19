import { describe, expect, it, vi } from "vitest";
import { api, ApiError, EVENTO_SESION_CAIDA } from "./client";
import { auth } from "./endpoints";

function responder(estado: number, cuerpo?: unknown) {
  const texto = cuerpo === undefined ? "" : typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo);
  return vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(texto, { status: estado }));
}

function esperarAborto() {
  return vi.spyOn(globalThis, "fetch").mockImplementation(
    (_url, opciones) =>
      new Promise<Response>((_resolver, rechazar) => {
        const senal = opciones?.signal;
        if (!senal) {
          rechazar(new TypeError("Sin señal"));
          return;
        }
        senal.addEventListener("abort", () => rechazar(new DOMException("Abortado", "AbortError")));
      }),
  );
}

async function errorDe(promesa: Promise<unknown>): Promise<ApiError> {
  try {
    await promesa;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error("Se esperaba un ApiError");
}

function escucharCaidas() {
  const caidas: { codigo: string; detalle: string }[] = [];
  const alCaer = (e: Event) => caidas.push((e as CustomEvent<{ codigo: string; detalle: string }>).detail);
  window.addEventListener(EVENTO_SESION_CAIDA, alCaer);
  return { caidas, dejar: () => window.removeEventListener(EVENTO_SESION_CAIDA, alCaer) };
}

describe("api/client", () => {
  describe("RF-27: espera sin respuesta", () => {
    it("el aborto de la señal da SIN_RESPUESTA", async () => {
      esperarAborto();
      const control = new AbortController();
      const promesa = errorDe(api("/tickets", { senal: control.signal }));
      control.abort();
      const error = await promesa;
      expect(error.estado).toBe(0);
      expect(error.codigo).toBe("SIN_RESPUESTA");
      expect(error.message).toBe("El servidor no respondió. Probá de nuevo.");
    });

    it("auth.login pasa la señal y su aborto da SIN_RESPUESTA", async () => {
      const espia = esperarAborto();
      const control = new AbortController();
      const promesa = errorDe(auth.login("u.operador", "secreta", control.signal));
      control.abort();
      expect((await promesa).codigo).toBe("SIN_RESPUESTA");
      expect(espia.mock.calls[0]?.[1]?.signal).toBe(control.signal);
    });
  });

  describe("RF-29: sin conexión", () => {
    it("sin red da SIN_CONEXION", async () => {
      const error = await errorDe(api("/tickets"));
      expect(error.codigo).toBe("SIN_CONEXION");
      expect(error.message).toBe("No se pudo contactar al servidor.");
    });

    it("un 500 con el cuerpo vacío da SIN_CONEXION", async () => {
      responder(500);
      const error = await errorDe(api("/auth/horario"));
      expect(error.estado).toBe(0);
      expect(error.codigo).toBe("SIN_CONEXION");
      expect(error.message).toBe("No se pudo contactar al servidor.");
    });

    it.each([502, 503, 504])("un %i sin codigo da SIN_CONEXION", async (estado) => {
      responder(estado, "<html>Bad Gateway</html>");
      const error = await errorDe(api("/auth/horario"));
      expect(error.estado).toBe(0);
      expect(error.codigo).toBe("SIN_CONEXION");
    });

    it("un 500 con JSON sin codigo también da SIN_CONEXION", async () => {
      responder(500, { detail: "Internal Server Error" });
      expect((await errorDe(api("/tickets"))).codigo).toBe("SIN_CONEXION");
    });

    it("un 503 con codigo DIRECTORIO_NO_DISPONIBLE conserva el código y el detalle", async () => {
      responder(503, { codigo: "DIRECTORIO_NO_DISPONIBLE", detalle: "No se pudo contactar al directorio. Intentá nuevamente." });
      const error = await errorDe(auth.login("u.operador", "secreta"));
      expect(error.estado).toBe(503);
      expect(error.codigo).toBe("DIRECTORIO_NO_DISPONIBLE");
      expect(error.message).toBe("No se pudo contactar al directorio. Intentá nuevamente.");
    });
  });

  describe("RF-23: sesión caída", () => {
    const sesionInvalida = { codigo: "SESION_INVALIDA", detalle: "La sesión no es válida o expiró." };

    it("un 401 despacha EVENTO_SESION_CAIDA con codigo y detalle", async () => {
      const { caidas, dejar } = escucharCaidas();
      responder(401, sesionInvalida);
      const error = await errorDe(api("/tickets"));
      dejar();
      expect(error.codigo).toBe("SESION_INVALIDA");
      expect(caidas).toEqual([sesionInvalida]);
    });

    it("un 401 por horario lleva su propio código", async () => {
      const { caidas, dejar } = escucharCaidas();
      const fuera = { codigo: "SESION_FUERA_DE_HORARIO", detalle: "La franja horaria cerró y la sesión caducó." };
      responder(401, fuera);
      await errorDe(api("/tickets/45"));
      dejar();
      expect(caidas).toEqual([fuera]);
    });

    it.each(["/auth/login", "/auth/me"])("un 401 en %s no despacha nada", async (ruta) => {
      const { caidas, dejar } = escucharCaidas();
      responder(401, { codigo: "CREDENCIALES_INVALIDAS", detalle: "Usuario o contraseña incorrectos." });
      const error = await errorDe(api(ruta, { metodo: ruta === "/auth/login" ? "POST" : "GET" }));
      dejar();
      expect(error.estado).toBe(401);
      expect(caidas).toEqual([]);
    });
  });
});
