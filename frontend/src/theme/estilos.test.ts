import ts from "typescript";
import { describe, expect, it } from "vitest";
import html from "../../index.html?raw";
import principal from "../main.tsx?raw";
import { contraste } from "../jornada/cielo";
import hojaTokens from "./tokens.css?raw";
import hojaHorizonte from "../components/Horizonte.module.css?raw";

const hojas = import.meta.glob<string>("../**/*.css", { query: "?raw", import: "default", eager: true });

function bloque(css: string | undefined, encabezado: RegExp): string | undefined {
  if (css === undefined) return undefined;
  const inicio = css.search(encabezado);
  if (inicio < 0) return undefined;
  const apertura = css.indexOf("{", inicio);
  let profundidad = 0;
  for (let i = apertura; i < css.length; i++) {
    if (css[i] === "{") profundidad++;
    else if (css[i] === "}" && --profundidad === 0) return css.slice(apertura + 1, i);
  }
  return undefined;
}

function token(css: string | undefined, nombre: string): string | undefined {
  return css?.match(new RegExp(`--tq-${nombre}:\\s*([^;]+);`))?.[1]?.trim();
}

const HEX = /^#[0-9a-f]{6}$/;
const tokens: string | undefined = hojaTokens;
const raiz = bloque(tokens, /^:root\s*\{/m);

describe("estilos, parte de T1", () => {
  describe("RNF-2: sin recursos externos y con Albert Sans", () => {
    it("index.html no carga Google Fonts y ningún CSS pide algo de afuera", () => {
      expect(html).not.toMatch(/fonts\.googleapis/);
      expect(html).not.toMatch(/fonts\.gstatic/);
      expect(Object.keys(hojas).length).toBeGreaterThan(0);
      for (const [ruta, css] of Object.entries(hojas)) {
        expect(css, ruta).not.toMatch(/@import\s+url\(/);
        expect(css, ruta).not.toMatch(/url\(\s*["']?https?:/);
      }
    });

    it("main.tsx importa la fuente empaquetada", () => {
      expect(principal).toMatch(/import\s+["']@fontsource-variable\/albert-sans["']/);
    });
  });

  describe("RNF-3 y RF-12: colores de estado y del sol", () => {
    const esperados: Record<string, string> = {
      "estado-abierto": "#1f63d1",
      "estado-progreso": "#c96f00",
      "estado-resuelto": "#2a9350",
      "estado-cerrado": "#87878c",
      sol: "#e8590c",
    };

    it("tokens.css tiene los hex exactos", () => {
      for (const [nombre, valor] of Object.entries(esperados)) {
        expect(token(raiz, nombre), nombre).toBe(valor);
      }
    });

    it("cada indicador da 3:1 o más contra su anillo blanco", () => {
      for (const nombre of Object.keys(esperados)) {
        const valor = token(raiz, nombre);
        expect(valor, nombre).toEqual(expect.stringMatching(HEX));
        expect(contraste(valor ?? "", "#ffffff"), nombre).toBeGreaterThanOrEqual(3);
      }
    });

    it("el texto secundario, el acento, el peligro y el aviso dan 4.5:1 sobre superficie y fondo", () => {
      const fondos = ["superficie", "fondo"].map((nombre) => token(raiz, nombre));
      for (const fondo of fondos) expect(fondo).toEqual(expect.stringMatching(HEX));
      for (const nombre of ["texto-2", "acento", "peligro", "aviso"]) {
        const valor = token(raiz, nombre);
        expect(valor, nombre).toEqual(expect.stringMatching(HEX));
        for (const fondo of fondos) {
          expect(contraste(valor ?? "", fondo ?? ""), `${nombre} sobre ${fondo}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    });
  });

  describe("RF-16 y RNF-4: reloj grande", () => {
    it("mide 5.5rem y baja a 4rem por debajo de 768px", () => {
      expect(token(raiz, "tipo-reloj")).toBe("200 5.5rem/0.9 var(--tq-fuente)");
      const angosta = bloque(tokens, /@media\s*\(max-width:\s*767px\)/);
      expect(token(angosta, "tipo-reloj")).toBe("200 4rem/0.9 var(--tq-fuente)");
    });
  });
});

const horizonte: string | undefined = hojaHorizonte;

function declaracion(css: string | undefined, propiedad: string): string | undefined {
  return css?.match(new RegExp(`(?:^|[;{\\s])${propiedad}:\\s*([^;]+);`))?.[1]?.trim();
}

describe("estilos, parte de T8", () => {
  describe("RF-12: marcas del horizonte", () => {
    it.each([
      ["ABIERTO", "abierto"],
      ["EN_PROGRESO", "progreso"],
      ["RESUELTO", "resuelto"],
      ["CERRADO", "cerrado"],
    ])("data-estado %s usa --tq-estado-%s", (estado, nombre) => {
      const regla = bloque(horizonte, new RegExp(`^\\.marca\\[data-estado="${estado}"\\]\\s*\\{`, "m"));
      expect(regla, estado).toBeDefined();
      expect(declaracion(regla, "--tq-marca")).toBe(`var(--tq-estado-${nombre})`);
    });

    it("el punto lleva el color de su estado y un anillo blanco de 2px", () => {
      const punto = bloque(horizonte, /^\.punto\s*\{/m);
      expect(declaracion(punto, "background")).toBe("var(--tq-marca)");
      expect(declaracion(punto, "box-shadow")).toBe("0 0 0 2px #ffffff");
    });
  });

  describe("RF-10: líneas del horizonte", () => {
    it("el tramo transcurrido mide 2px con opacidad 0.75", () => {
      const transcurrido = bloque(horizonte, /^\.transcurrido\s*\{/m);
      expect(declaracion(transcurrido, "height")).toBe("2px");
      expect(declaracion(transcurrido, "opacity")).toBe("0.75");
    });

    it("el resto mide 1px con opacidad 0.3, en currentColor", () => {
      const resto = bloque(horizonte, /^\.resto\s*\{/m);
      expect(declaracion(resto, "height")).toBe("1px");
      expect(declaracion(resto, "opacity")).toBe("0.3");
      expect(declaracion(resto, "background")).toBe("currentColor");
    });
  });

  describe("RF-11: el sol", () => {
    it("de día es --tq-sol con anillo blanco de 2px y halo", () => {
      const sol = bloque(horizonte, /^\.sol\s*\{/m);
      expect(declaracion(sol, "background")).toBe("var(--tq-sol)");
      const sombra = declaracion(sol, "box-shadow");
      expect(sombra).toMatch(/^0 0 0 2px #ffffff,/);
      expect(sombra?.split(/,(?![^(]*\))/).length).toBeGreaterThan(1);
    });

    it("atenuado, tiene opacidad 0.35 y solo el anillo, sin halo", () => {
      const atenuado = bloque(horizonte, /^\.sol\[data-atenuado="true"\]\s*\{/m);
      expect(declaracion(atenuado, "opacity")).toBe("0.35");
      expect(declaracion(atenuado, "box-shadow")).toBe("0 0 0 2px #ffffff");
    });
  });
});

const codigo = import.meta.glob<string>("../**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true });
const modulos = import.meta.glob<string>("../**/*.module.css", { query: "?raw", import: "default", eager: true });

const esPrueba = (ruta: string) => /\.test\.tsx?$/.test(ruta) || /(^|\/)test\//.test(ruta);

function hallazgos(archivos: Record<string, string>, buscados: string[]): string[] {
  return Object.entries(archivos).flatMap(([ruta, texto]) =>
    buscados.filter((buscado) => texto.includes(buscado)).map((buscado) => `${ruta}: ${buscado}`),
  );
}

describe("estilos, parte de T10", () => {
  it("encuentra el código y los CSS Modules", () => {
    expect(Object.keys(codigo).length).toBeGreaterThan(0);
    expect(Object.keys(modulos).length).toBeGreaterThan(0);
    expect(Object.keys(codigo).some((ruta) => ruta.endsWith("/App.tsx"))).toBe(true);
  });

  describe("RNF-1: sin turno día/noche", () => {
    it("ningún archivo de src, salvo las pruebas que lo buscan, nombra el turno", () => {
      const fuentes = Object.fromEntries(
        Object.entries({ ...codigo, ...hojas }).filter(([ruta]) => !/\.test\.tsx?$/.test(ruta)),
      );
      expect(hallazgos(fuentes, ["Turno noche", "Turno día", "data-turno", "dataset.turno"])).toEqual([]);
    });
  });

  describe("RNF-5: movimiento y transparencia reducidos", () => {
    const entradas = Object.entries(modulos);

    it.each(entradas)("%s: con movimiento, tiene su bloque prefers-reduced-motion", (_ruta, css) => {
      if (!/\btransition\b|\banimation\b|@keyframes/.test(css)) return;
      expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    });

    it.each(entradas)("%s: con desenfoque, tiene prefers-reduced-transparency y @supports not", (_ruta, css) => {
      if (!/backdrop-filter|blur\(/.test(css)) return;
      expect(css).toMatch(/@media\s*\(prefers-reduced-transparency:\s*reduce\)/);
      expect(css).toMatch(/@supports\s+not\s*\(/);
    });
  });

  describe("RF-1 y RF-3: sin el reloj ni la zona del dispositivo", () => {
    it("ningún .ts/.tsx que no sea de prueba los usa", () => {
      const app = Object.fromEntries(Object.entries(codigo).filter(([ruta]) => !esPrueba(ruta)));
      expect(Object.keys(app).length).toBeGreaterThan(0);
      expect(
        hallazgos(app, ["Date.now(", "new Date()", "getHours", "getMinutes", "getDay(", "getDate(", "toLocale"]),
      ).toEqual([]);
    });
  });
});

const BORRADOS = [
  "styles/talonario.css",
  "styles/app.css",
  "theme/theme.ts",
  "components/Barras.tsx",
  "components/Libreta.tsx",
  "components/Ponchado.tsx",
  "components/Prohibido.tsx",
  "components/Sello.tsx",
  "utils/formato.ts",
];

const PROHIBIDOS = ["talón", "talones", "Sacar número", "Sellar", "Libreta", "Seguimiento", "Ventanilla"];

const plano = (texto: string) => texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

const patrones = PROHIBIDOS.map((termino) => [termino, new RegExp(`(?<!\\p{L})${plano(termino)}(?!\\p{L})`, "u")] as const);

const esDireccion = (texto: string) => /^\/\S*$/.test(texto);

// Texto visible: el texto JSX y las cadenas, salvo los módulos importados y las direcciones de la app ("/ventanilla").
function textosVisibles(ruta: string, fuente: string): string[] {
  if (ruta.endsWith(".css")) return [...fuente.matchAll(/content:\s*(["'])(.*?)\1/g)].map((hallado) => hallado[2] ?? "");
  const textos: string[] = [];
  const visitar = (nodo: ts.Node): void => {
    if (ts.isImportDeclaration(nodo) || ts.isExportDeclaration(nodo)) return;
    if (ts.isCallExpression(nodo) && nodo.expression.kind === ts.SyntaxKind.ImportKeyword) return;
    if (ts.isJsxText(nodo)) textos.push(nodo.text);
    else if ((ts.isStringLiteralLike(nodo) || ts.isTemplateLiteralToken(nodo)) && !esDireccion(nodo.text)) textos.push(nodo.text);
    ts.forEachChild(nodo, visitar);
  };
  const tipo = ruta.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  visitar(ts.createSourceFile(ruta, fuente, ts.ScriptTarget.Latest, false, tipo));
  return textos;
}

function terminosProhibidos(texto: string): string[] {
  return patrones.filter(([, patron]) => patron.test(plano(texto))).map(([termino]) => termino);
}

describe("estilos, parte de 002", () => {
  describe("RF-33: nada de Talonario", () => {
    const fuentes = Object.entries({ ...codigo, ...hojas }).filter(([ruta]) => !esPrueba(ruta));

    it("no quedan los módulos borrados", () => {
      // Las claves del glob son relativas a theme/: "./tokens.css" o "../styles/app.css".
      const rutas = Object.keys({ ...codigo, ...hojas }).map((ruta) => ruta.replace(/^\.\//, "theme/").replace(/^\.\.\//, ""));
      expect(rutas).toContain("theme/tokens.css");
      expect(rutas).toContain("components/Avatar.tsx");
      expect(rutas.filter((ruta) => BORRADOS.includes(ruta))).toEqual([]);
    });

    it("la regla mira el texto visible y deja pasar la ruta, los nombres de componentes y los imports", () => {
      const ejemplo = [
        'import { Ventanilla } from "./pages/Ventanilla";',
        'const destino = "/ventanilla";',
        'export const vista = <Ventanilla titulo="Sacar número">Tu talón</Ventanilla>;',
        "export const texto = `Sellar ${destino}`;",
      ].join("\n");
      expect(textosVisibles("ejemplo.tsx", ejemplo).flatMap(terminosProhibidos)).toEqual(["Sacar número", "talón", "Sellar"]);
      const hoja = '.libreta::after { content: "Libreta"; }';
      expect(textosVisibles("ejemplo.css", hoja).flatMap(terminosProhibidos)).toEqual(["Libreta"]);
    });

    it("encuentra el texto visible de las pantallas", () => {
      const textos = fuentes.flatMap(([ruta, fuente]) => textosVisibles(ruta, fuente).map((texto) => texto.trim()));
      expect(textos).toContain("Verificando tu sesión…");
      expect(textos).toContain("Volver a Tickets");
    });

    it("ningún .ts, .tsx ni .css de src, salvo las pruebas, muestra los textos de Talonario", () => {
      const hallados = fuentes.flatMap(([ruta, fuente]) =>
        textosVisibles(ruta, fuente).flatMap((texto) => terminosProhibidos(texto).map((termino) => `${ruta}: ${termino} en "${texto.trim()}"`)),
      );
      expect(hallados).toEqual([]);
    });

    it("la ruta /ventanilla se mantiene", () => {
      const app = Object.entries(codigo).find(([ruta]) => ruta.endsWith("/App.tsx"))?.[1];
      expect(app).toContain('path="/ventanilla"');
    });
  });
});
