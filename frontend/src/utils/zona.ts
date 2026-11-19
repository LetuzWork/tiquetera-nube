export const ZONA_RESPALDO = "America/Argentina/Buenos_Aires";

export interface PartesZona {
  fecha: string;
  hora: number;
  minuto: number;
  segundo: number;
  diaSemana: number;
}

const DIAS_ISO: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

const formateadoresNumericos = new Map<string, Intl.DateTimeFormat>();
const formateadoresEspanol = new Map<string, Intl.DateTimeFormat>();

function formateadorNumerico(zona: string): Intl.DateTimeFormat {
  let formateador = formateadoresNumericos.get(zona);
  if (!formateador) {
    formateador = new Intl.DateTimeFormat("en-US", {
      timeZone: zona,
      hourCycle: "h23",
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formateadoresNumericos.set(zona, formateador);
  }
  return formateador;
}

function formateadorEspanol(zona: string): Intl.DateTimeFormat {
  let formateador = formateadoresEspanol.get(zona);
  if (!formateador) {
    formateador = new Intl.DateTimeFormat("es-AR", { timeZone: zona, weekday: "long", day: "numeric", month: "long" });
    formateadoresEspanol.set(zona, formateador);
  }
  return formateador;
}

const dosDigitos = (n: number) => String(n).padStart(2, "0");

export function instanteDe(iso: string): number {
  // Pydantic manda microsegundos y el motor solo entiende 3 dígitos de fracción.
  return Date.parse(iso.replace(/(\.\d{3})\d+/, "$1"));
}

export function partesEnZona(instante: number, zona: string): PartesZona {
  const valores: Record<string, string> = {};
  for (const parte of formateadorNumerico(zona).formatToParts(instante)) valores[parte.type] = parte.value;
  return {
    fecha: `${valores.year}-${valores.month}-${valores.day}`,
    hora: Number(valores.hour),
    minuto: Number(valores.minute),
    segundo: Number(valores.second),
    diaSemana: DIAS_ISO[valores.weekday ?? ""] ?? 0,
  };
}

export function horaMinuto(instante: number, zona: string): string {
  const { hora, minuto } = partesEnZona(instante, zona);
  return `${dosDigitos(hora)}:${dosDigitos(minuto)}`;
}

export function fechaHoraLarga(instante: number, zona: string): string {
  const valores: Record<string, string> = {};
  for (const parte of formateadorEspanol(zona).formatToParts(instante)) valores[parte.type] = parte.value;
  return `${valores.weekday} ${valores.day} de ${valores.month}, ${horaMinuto(instante, zona)}`;
}

// Meses propios y no los de Intl: la abreviatura de ICU cambia entre versiones ("sep", "sept", "nov.").
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function fechaCortaDeDia(dia: string): string {
  const [, mes = 0, numero = 0] = dia.split("-").map(Number);
  return `${numero} ${MESES_CORTOS[mes - 1] ?? ""}`;
}

export function fechaCorta(instante: number, zona: string): string {
  return fechaCortaDeDia(partesEnZona(instante, zona).fecha);
}

export function fechaHoraCorta(instante: number, zona: string): string {
  return `${fechaCorta(instante, zona)}, ${horaMinuto(instante, zona)}`;
}

export function horaOFecha(instante: number, zona: string, hoy: string): string {
  const { fecha, hora, minuto } = partesEnZona(instante, zona);
  return fecha === hoy ? `${dosDigitos(hora)}:${dosDigitos(minuto)}` : fechaCortaDeDia(fecha);
}

export const hhmm = (hora: string): string => hora.slice(0, 5);

export function segundosDe(hora: string): number {
  const [h = 0, m = 0, s = 0] = hora.split(":").map(Number);
  return h * 3600 + m * 60 + s;
}
