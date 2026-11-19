import { describe, expect, it } from "vitest";
import { horarioDe } from "../test/fabricas";
import {
  MINUTO_RESPALDO,
  MUESTRAS_DEGRADADO,
  PUNTOS_CIELO,
  cieloDe,
  colorEnMinuto,
  contraste,
  contrasteEnDegradado,
  puntosParaFranja,
  tintaSobre,
} from "./cielo";
import type { Jornada } from "./jornada";

const OSCURA = "#14233c";
const BLANCA = "#ffffff";

const hm = (h: number, m = 0) => h * 60 + m;

function jornadaEn(minuto: number, diaHabil = true): Jornada {
  const reloj = `${String(Math.floor(minuto / 60)).padStart(2, "0")}:${String(minuto % 60).padStart(2, "0")}`;
  return {
    estado: "cerrada",
    hoy: "2026-11-17",
    reloj,
    segundosDelDia: minuto * 60,
    minutoDelDia: minuto,
    diaHabil,
    minutosRestantes: 0,
  };
}

const FRANJAS = [
  { nombre: "08:00 a 18:00", inicio: "08:00:00", fin: "18:00:00" },
  { nombre: "09:30 a 13:00", inicio: "09:30:00", fin: "13:00:00" },
  { nombre: "06:00 a 23:00", inicio: "06:00:00", fin: "23:00:00" },
];

function mezclaEnDegradado(arriba: string, abajo: string, s: number): [number, number, number] {
  const canal = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  return [0, 1, 2].map((i) => canal(arriba, i) + (canal(abajo, i) - canal(arriba, i)) * s) as [number, number, number];
}

describe("cielo, RF-7: la tabla", () => {
  it("tiene los 12 puntos finales, con los dobles de las 08:00 y las 18:00", () => {
    expect(PUNTOS_CIELO.map((p) => [p.minuto, p.arriba, p.abajo])).toEqual([
      [hm(6), "#0f1330", "#1f2550"],
      [hm(7, 30), "#27305e", "#6b5b8c"],
      [hm(8), "#4c659f", "#89706c"],
      [hm(8), "#6788d6", "#c6a39d"],
      [hm(8, 15), "#678acf", "#f3c7a5"],
      [hm(10), "#6fa8ef", "#d9ebff"],
      [hm(13), "#4f98f0", "#e3f0ff"],
      [hm(15, 30), "#79a9e6", "#fbe2c2"],
      [hm(17, 15), "#8682ca", "#f7ad7c"],
      [hm(18), "#7980f8", "#c37781"],
      [hm(18), "#36396f", "#a3646c"],
      [hm(19), "#12162f", "#242a4f"],
    ]);
    expect(MINUTO_RESPALDO).toBe(780);
    expect(MUESTRAS_DEGRADADO).toBe(101);
  });

  it("en cada punto simple da su color y en los dobles vale el desde", () => {
    expect(colorEnMinuto(PUNTOS_CIELO, hm(6))).toEqual({ arriba: "#0f1330", abajo: "#1f2550" });
    expect(colorEnMinuto(PUNTOS_CIELO, hm(7, 30))).toEqual({ arriba: "#27305e", abajo: "#6b5b8c" });
    expect(colorEnMinuto(PUNTOS_CIELO, hm(8))).toEqual({ arriba: "#6788d6", abajo: "#c6a39d" });
    expect(colorEnMinuto(PUNTOS_CIELO, hm(8, 15))).toEqual({ arriba: "#678acf", abajo: "#f3c7a5" });
    expect(colorEnMinuto(PUNTOS_CIELO, hm(10))).toEqual({ arriba: "#6fa8ef", abajo: "#d9ebff" });
    expect(colorEnMinuto(PUNTOS_CIELO, hm(13))).toEqual({ arriba: "#4f98f0", abajo: "#e3f0ff" });
    expect(colorEnMinuto(PUNTOS_CIELO, hm(15, 30))).toEqual({ arriba: "#79a9e6", abajo: "#fbe2c2" });
    expect(colorEnMinuto(PUNTOS_CIELO, hm(17, 15))).toEqual({ arriba: "#8682ca", abajo: "#f7ad7c" });
    expect(colorEnMinuto(PUNTOS_CIELO, hm(18))).toEqual({ arriba: "#36396f", abajo: "#a3646c" });
    expect(colorEnMinuto(PUNTOS_CIELO, hm(19))).toEqual({ arriba: "#12162f", abajo: "#242a4f" });
  });

  it("las muestras de la interpolación por canal", () => {
    const esperados: Array<[number, string, string]> = [
      [hm(7), "#1f264f", "#524978"],
      [hm(7, 59), "#4b639d", "#886f6d"],
      [hm(8), "#6788d6", "#c6a39d"],
      [hm(11, 30), "#5fa0f0", "#deeeff"],
      [hm(17, 30), "#8281d9", "#e69b7e"],
      [hm(17, 59), "#7980f7", "#c47881"],
      [hm(18), "#36396f", "#a3646c"],
      [hm(18, 20), "#2a2d5a", "#795162"],
    ];
    for (const [minuto, arriba, abajo] of esperados) {
      expect(colorEnMinuto(PUNTOS_CIELO, minuto), `minuto ${minuto}`).toEqual({ arriba, abajo });
    }
  });

  it("antes de las 06:00 usa el primer punto y desde las 19:00 el último", () => {
    expect(colorEnMinuto(PUNTOS_CIELO, 0)).toEqual({ arriba: "#0f1330", abajo: "#1f2550" });
    expect(colorEnMinuto(PUNTOS_CIELO, hm(5, 59))).toEqual({ arriba: "#0f1330", abajo: "#1f2550" });
    expect(colorEnMinuto(PUNTOS_CIELO, hm(19, 1))).toEqual({ arriba: "#12162f", abajo: "#242a4f" });
    expect(colorEnMinuto(PUNTOS_CIELO, 1439)).toEqual({ arriba: "#12162f", abajo: "#242a4f" });
  });

  it("el cielo salta entre las 07:59 y las 08:00", () => {
    const antes = colorEnMinuto(PUNTOS_CIELO, hm(7, 59));
    const desde = colorEnMinuto(PUNTOS_CIELO, hm(8));
    expect(antes).not.toEqual(desde);
    expect(contraste(antes.arriba, desde.arriba)).toBeGreaterThan(1.3);
  });
});

describe("cielo, RF-7: escalado a otra franja", () => {
  it("con 09:30 a 13:00 las horas se escalan: 07:30 va a 09:00, 08:00 a 09:30, 18:00 a 13:00 y 19:00 a 14:00", () => {
    const puntos = puntosParaFranja(PUNTOS_CIELO, hm(9, 30), hm(13));
    const minutos = puntos.map((p) => p.minuto);
    expect(minutos[0]).toBeCloseTo(hm(7, 30));
    expect(minutos[1]).toBeCloseTo(hm(9));
    expect(minutos[2]).toBeCloseTo(hm(9, 30));
    expect(minutos[3]).toBeCloseTo(hm(9, 30));
    expect(minutos[9]).toBeCloseTo(hm(13));
    expect(minutos[10]).toBeCloseTo(hm(13));
    expect(minutos[11]).toBeCloseTo(hm(14));
    expect(puntos.map((p) => p.arriba)).toEqual(PUNTOS_CIELO.map((p) => p.arriba));
  });

  it("con la franja de la tabla los puntos quedan como están", () => {
    expect(puntosParaFranja(PUNTOS_CIELO, hm(8), hm(18))).toEqual(PUNTOS_CIELO);
  });

  it("el cielo de las 09:30 con esa franja es el de las 08:00 de la tabla", () => {
    const horario = horarioDe("2026-11-17T09:30:00-03:00", { inicio: "09:30:00", fin: "13:00:00" });
    const c = cieloDe(horario, jornadaEn(hm(9, 30)), false);
    expect(c).toMatchObject({ arriba: "#6788d6", abajo: "#c6a39d", tinta: OSCURA });
  });
});

describe("cielo, RF-7 y RF-9: cieloDe", () => {
  const horario = horarioDe("2026-11-17T12:00:00-03:00");

  it("un día no hábil usa el último punto todo el día", () => {
    for (const minuto of [0, hm(8), hm(13), hm(17, 59)]) {
      expect(cieloDe(horario, jornadaEn(minuto, false), false)).toEqual({
        arriba: "#12162f",
        abajo: "#242a4f",
        tinta: BLANCA,
      });
    }
  });

  it("con sinFranja usa el cielo de las 13:00 con tinta #14233c, aunque haya horario o jornada", () => {
    const esperado = { arriba: "#4f98f0", abajo: "#e3f0ff", tinta: OSCURA };
    expect(cieloDe(null, null, true)).toEqual(esperado);
    expect(cieloDe(horario, jornadaEn(hm(3)), true)).toEqual(esperado);
  });

  it("mientras carga da null", () => {
    expect(cieloDe(null, null, false)).toBeNull();
    expect(cieloDe(horario, null, false)).toBeNull();
    expect(cieloDe(null, jornadaEn(hm(12)), false)).toBeNull();
  });

  it("un día hábil toma el color del minuto del día", () => {
    expect(cieloDe(horario, jornadaEn(hm(7, 59)), false)).toMatchObject({ arriba: "#4b639d", abajo: "#886f6d" });
    expect(cieloDe(horario, jornadaEn(hm(18)), false)).toMatchObject({ arriba: "#36396f", tinta: BLANCA });
  });
});

describe("cielo, RF-8: contraste y tinta", () => {
  it("contraste da 21 entre negro y blanco y 1 entre iguales", () => {
    expect(contraste("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contraste("#336699", "#336699")).toBeCloseTo(1, 5);
  });

  it("el cielo de las 13:00 da 5.3:1 con la tinta oscura y la noche 13.8:1 con la blanca", () => {
    expect(contrasteEnDegradado("#4f98f0", "#e3f0ff", OSCURA)).toBeGreaterThan(5.29);
    expect(contrasteEnDegradado("#4f98f0", "#e3f0ff", OSCURA)).toBeLessThan(5.31);
    expect(contrasteEnDegradado("#12162f", "#242a4f", BLANCA)).toBeGreaterThan(13.8);
  });

  it("contrasteEnDegradado es el mínimo de las 101 muestras sin redondear", () => {
    const arriba = "#7980f8";
    const abajo = "#c37781";
    let minimo = Infinity;
    for (let i = 0; i < MUESTRAS_DEGRADADO; i++) {
      minimo = Math.min(minimo, contraste(OSCURA, mezclaEnDegradado(arriba, abajo, i / 100)));
    }
    expect(contrasteEnDegradado(arriba, abajo, OSCURA)).toBeCloseTo(minimo, 10);
  });

  it("tintaSobre elige la de mayor contraste mínimo", () => {
    expect(tintaSobre("#4f98f0", "#e3f0ff")).toBe(OSCURA);
    expect(tintaSobre("#12162f", "#242a4f")).toBe(BLANCA);
    expect(tintaSobre("#7980f8", "#c37781")).toBe(OSCURA);
    expect(tintaSobre("#36396f", "#a3646c")).toBe(BLANCA);
  });

  for (const franja of FRANJAS) {
    it(`los 1440 minutos con la franja ${franja.nombre} llegan a 4.5:1 en las 101 muestras del degradado`, () => {
      const horario = horarioDe("2026-11-17T12:00:00-03:00", { inicio: franja.inicio, fin: franja.fin });
      let minimo = Infinity;
      for (let minuto = 0; minuto < 1440; minuto++) {
        const c = cieloDe(horario, jornadaEn(minuto), false);
        expect(c, `minuto ${minuto}`).not.toBeNull();
        if (c === null) continue;
        const otra = c.tinta === OSCURA ? BLANCA : OSCURA;
        let propio = Infinity;
        let ajeno = Infinity;
        for (let i = 0; i < MUESTRAS_DEGRADADO; i++) {
          const color = mezclaEnDegradado(c.arriba, c.abajo, i / 100);
          propio = Math.min(propio, contraste(c.tinta, color));
          ajeno = Math.min(ajeno, contraste(otra, color));
        }
        expect(propio, `minuto ${minuto}`).toBeGreaterThanOrEqual(4.5);
        expect(propio, `minuto ${minuto}: la tinta no es la mejor`).toBeGreaterThanOrEqual(ajeno);
        minimo = Math.min(minimo, propio);
      }
      expect(minimo).toBeGreaterThanOrEqual(4.5);
      // Son 1440 × 101 muestras: con la máquina cargada pasan los 5 s del plazo por omisión.
    }, 20_000);
  }
});
