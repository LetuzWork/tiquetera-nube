export function medirDesfase(ahoraServidor: number, antes: number, despues: number): number {
  return ahoraServidor - (antes + despues) / 2;
}

export function horaDelServidor(desfase: number, marca: number): number {
  return marca + desfase;
}
