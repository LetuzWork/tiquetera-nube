import { describe, expect, it } from "vitest";
import {
  ZONA_RESPALDO,
  fechaCorta,
  fechaCortaDeDia,
  fechaHoraCorta,
  fechaHoraLarga,
  hhmm,
  horaMinuto,
  horaOFecha,
  instanteDe,
  partesEnZona,
  segundosDe,
} from "./zona";

const BUENOS_AIRES = "America/Argentina/Buenos_Aires";

describe("zona", () => {
  it("la prueba testigo: el dispositivo corre en Tokio", () => {
    expect(new Date(Date.UTC(2026, 10, 17, 17, 20)).getHours()).toBe(2);
  });

  it("la zona de respaldo es la del backend por omisión", () => {
    expect(ZONA_RESPALDO).toBe(BUENOS_AIRES);
  });

  it("instanteDe recorta los microsegundos", () => {
    expect(instanteDe("2026-11-17T17:20:00.123456Z")).toBe(Date.UTC(2026, 10, 17, 17, 20, 0, 123));
    expect(instanteDe("2026-11-17T17:20:00Z")).toBe(Date.UTC(2026, 10, 17, 17, 20));
    expect(instanteDe("2026-11-17T17:20:00.5+00:00")).toBe(Date.UTC(2026, 10, 17, 17, 20, 0, 500));
  });

  it("partesEnZona: 17:20Z es martes 14:20 en Buenos Aires", () => {
    const partes = partesEnZona(Date.UTC(2026, 10, 17, 17, 20, 45), BUENOS_AIRES);
    expect(partes).toEqual({ fecha: "2026-11-17", hora: 14, minuto: 20, segundo: 45, diaSemana: 2 });
  });

  it("partesEnZona: 02:30Z es lunes 16 a las 23:30 en Buenos Aires", () => {
    const partes = partesEnZona(Date.UTC(2026, 10, 17, 2, 30), BUENOS_AIRES);
    expect(partes).toMatchObject({ fecha: "2026-11-16", hora: 23, minuto: 30, diaSemana: 1 });
  });

  it("partesEnZona: medianoche es hora 0 y el domingo es 7", () => {
    const partes = partesEnZona(Date.UTC(2026, 10, 22, 3, 0), BUENOS_AIRES);
    expect(partes).toMatchObject({ fecha: "2026-11-22", hora: 0, minuto: 0, diaSemana: 7 });
  });

  it("horaMinuto da HH:MM con cero a la izquierda", () => {
    expect(horaMinuto(Date.UTC(2026, 10, 17, 17, 20), BUENOS_AIRES)).toBe("14:20");
    expect(horaMinuto(Date.UTC(2026, 10, 17, 11, 5), BUENOS_AIRES)).toBe("08:05");
    expect(horaMinuto(Date.UTC(2026, 10, 17, 3, 0), BUENOS_AIRES)).toBe("00:00");
  });

  it("fechaHoraLarga arma el día, la fecha y la hora en la zona", () => {
    expect(fechaHoraLarga(Date.UTC(2026, 10, 16, 11, 0), BUENOS_AIRES)).toBe("lunes 16 de noviembre, 08:00");
    expect(fechaHoraLarga(Date.UTC(2026, 10, 17, 2, 30), BUENOS_AIRES)).toBe("lunes 16 de noviembre, 23:30");
  });

  it("hhmm recorta los segundos", () => {
    expect(hhmm("08:00:00")).toBe("08:00");
    expect(hhmm("18:00")).toBe("18:00");
  });

  it("segundosDe convierte la hora en segundos del día", () => {
    expect(segundosDe("08:00")).toBe(28800);
    expect(segundosDe("18:00:00")).toBe(64800);
    expect(segundosDe("09:30")).toBe(34200);
  });
});

describe("zona: fechas cortas de la 002", () => {
  it.each([
    ["2026-01-05", "5 ene"],
    ["2026-02-28", "28 feb"],
    ["2026-03-01", "1 mar"],
    ["2026-04-10", "10 abr"],
    ["2026-05-20", "20 may"],
    ["2026-06-30", "30 jun"],
    ["2026-07-04", "4 jul"],
    ["2026-08-15", "15 ago"],
    ["2026-09-03", "3 sep"],
    ["2026-10-12", "12 oct"],
    ["2026-11-07", "7 nov"],
    ["2026-12-31", "31 dic"],
  ])("RF-30: fechaCortaDeDia(%s) da %s, sin cero ni punto", (dia, esperado) => {
    expect(fechaCortaDeDia(dia)).toBe(esperado);
  });

  it("RF-4: fechaCorta da el día en la zona del servidor y no en la del dispositivo", () => {
    expect(fechaCorta(Date.UTC(2026, 10, 17, 19, 6), BUENOS_AIRES)).toBe("17 nov");
    expect(fechaCorta(Date.UTC(2026, 10, 17, 2, 30), BUENOS_AIRES)).toBe("16 nov");
    expect(fechaCorta(Date.UTC(2026, 10, 17, 15, 30), BUENOS_AIRES)).toBe("17 nov");
    expect(fechaCorta(Date.UTC(2027, 0, 1, 2, 0), BUENOS_AIRES)).toBe("31 dic");
  });

  it("fechaCorta usa la zona que recibe", () => {
    const instante = Date.UTC(2026, 10, 17, 15, 30);
    expect(fechaCorta(instante, BUENOS_AIRES)).toBe("17 nov");
    expect(fechaCorta(instante, "Asia/Tokyo")).toBe("18 nov");
    expect(fechaCorta(instante, "UTC")).toBe("17 nov");
  });

  it("RF-22: fechaHoraCorta da '17 nov, 10:42' en la zona del servidor", () => {
    expect(fechaHoraCorta(Date.UTC(2026, 10, 17, 13, 42), BUENOS_AIRES)).toBe("17 nov, 10:42");
    expect(fechaHoraCorta(Date.UTC(2026, 10, 17, 2, 30), BUENOS_AIRES)).toBe("16 nov, 23:30");
    expect(fechaHoraCorta(Date.UTC(2026, 10, 17, 3, 6), BUENOS_AIRES)).toBe("17 nov, 00:06");
  });

  it("RF-4 y RF-20: horaOFecha da la hora si es de hoy en la zona del servidor", () => {
    const hoy = "2026-11-17";
    expect(horaOFecha(Date.UTC(2026, 10, 17, 19, 6), BUENOS_AIRES, hoy)).toBe("16:06");
    expect(horaOFecha(Date.UTC(2026, 10, 17, 3, 6), BUENOS_AIRES, hoy)).toBe("00:06");
    expect(horaOFecha(Date.UTC(2026, 10, 18, 2, 59), BUENOS_AIRES, hoy)).toBe("23:59");
  });

  it("RF-4 y RF-20: horaOFecha da la fecha corta si es de otro día en la zona del servidor", () => {
    const hoy = "2026-11-17";
    expect(horaOFecha(Date.UTC(2026, 10, 17, 2, 59), BUENOS_AIRES, hoy)).toBe("16 nov");
    expect(horaOFecha(Date.UTC(2026, 10, 18, 3, 0), BUENOS_AIRES, hoy)).toBe("18 nov");
    expect(horaOFecha(Date.UTC(2025, 10, 17, 19, 6), BUENOS_AIRES, hoy)).toBe("17 nov");
  });
});
