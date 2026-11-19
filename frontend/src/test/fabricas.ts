import type { Horario, Me, Pagina, Permiso, Rol, TicketResumen } from "../api/types";

export const ZONA_PRUEBA = "America/Argentina/Buenos_Aires";

const TODOS_LOS_PERMISOS: Permiso[] = [
  "ticket:crear",
  "ticket:ver_propios",
  "ticket:ver_todos",
  "ticket:editar",
  "ticket:cambiar_estado",
  "ticket:asignar",
  "ticket:comentar",
  "ticket:reabrir_cerrado",
  "reporte:ver",
  "reporte:exportar",
];

const PERMISOS_POR_ROL: Record<Rol, Permiso[]> = {
  admin: TODOS_LOS_PERMISOS,
  operador: TODOS_LOS_PERMISOS.filter((permiso) => permiso !== "ticket:reabrir_cerrado"),
  usuario: ["ticket:crear", "ticket:ver_propios", "ticket:comentar"],
  consulta: ["ticket:ver_propios", "ticket:ver_todos", "reporte:ver", "reporte:exportar"],
};

const CUENTAS_POR_ROL: Record<Rol, { usuario: string; nombre: string }> = {
  admin: { usuario: "u.admin", nombre: "Ana Administradora" },
  operador: { usuario: "u.operador", nombre: "Omar Operador" },
  usuario: { usuario: "u.usuario", nombre: "Ursula Usuaria" },
  consulta: { usuario: "u.consulta", nombre: "Carlos Consulta" },
};

export function horarioDe(ahora: string, cambios: Partial<Horario> = {}): Horario {
  return {
    abierto: true,
    ahora,
    inicio: "08:00:00",
    fin: "18:00:00",
    dias: [1, 2, 3, 4, 5],
    zona: ZONA_PRUEBA,
    cierre: null,
    proxima_apertura: null,
    ...cambios,
  };
}

export function meDe(rol: Rol, cambios: Partial<Me> = {}): Me {
  return {
    ...CUENTAS_POR_ROL[rol],
    mail: null,
    rol,
    permisos: [...PERMISOS_POR_ROL[rol]].sort(),
    sesion_expira: "2026-11-17T18:00:00-03:00",
    segundos_restantes: 13200,
    ...cambios,
  };
}

export function ticketResumenDe(cambios: Partial<TicketResumen> = {}): TicketResumen {
  const numero = cambios.numero ?? 45;
  return {
    id: `TQ-${String(numero).padStart(6, "0")}`,
    numero,
    titulo: "La impresora del tercer piso no imprime",
    categoria: "Hardware",
    estado: "ABIERTO",
    prioridad: "ALTA",
    solicitante: "u.usuario",
    responsable: null,
    creado_en: "2026-11-17T17:05:00Z",
    actualizado_en: "2026-11-17T17:05:00Z",
    comentarios: 0,
    ...cambios,
  };
}

export function paginaDe(items: TicketResumen[], cambios: Partial<Pagina> = {}): Pagina {
  return { items, total: items.length, pagina: 1, por_pagina: 20, ...cambios };
}
