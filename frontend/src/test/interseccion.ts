import { act } from "@testing-library/react";

const activos = new Set<IntersectionObserverFalso>();

export class IntersectionObserverFalso implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin = "0px";
  readonly thresholds: ReadonlyArray<number>;
  readonly objetivos = new Set<Element>();
  readonly alCruzar: IntersectionObserverCallback;

  constructor(alCruzar: IntersectionObserverCallback, opciones?: IntersectionObserverInit) {
    this.alCruzar = alCruzar;
    const umbral = opciones?.threshold ?? 0;
    this.thresholds = Array.isArray(umbral) ? [...umbral] : [umbral];
  }

  observe(objetivo: Element): void {
    this.objetivos.add(objetivo);
    activos.add(this);
  }

  unobserve(objetivo: Element): void {
    this.objetivos.delete(objetivo);
    if (this.objetivos.size === 0) activos.delete(this);
  }

  disconnect(): void {
    this.objetivos.clear();
    activos.delete(this);
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

function entradaDe(objetivo: Element, visible: boolean): IntersectionObserverEntry {
  const caja = objetivo.getBoundingClientRect();
  return {
    target: objetivo,
    isIntersecting: visible,
    intersectionRatio: visible ? 1 : 0,
    boundingClientRect: caja,
    intersectionRect: caja,
    rootBounds: null,
    time: 0,
  };
}

export function simularInterseccion(visible: boolean): void {
  act(() => {
    for (const observador of [...activos]) {
      const entradas = [...observador.objetivos].map((objetivo) => entradaDe(objetivo, visible));
      observador.alCruzar(entradas, observador);
    }
  });
}

export function objetivosObservados(): { objetivo: Element; umbrales: ReadonlyArray<number> }[] {
  return [...activos].flatMap((observador) =>
    [...observador.objetivos].map((objetivo) => ({ objetivo, umbrales: observador.thresholds })),
  );
}
