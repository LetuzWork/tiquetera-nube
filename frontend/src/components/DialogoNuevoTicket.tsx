import { X } from "lucide-react";
import { useId, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent, type MouseEvent } from "react";
import { createPortal, flushSync } from "react-dom";
import { ApiError } from "../api/client";
import { tickets } from "../api/endpoints";
import { CATEGORIAS, PRIORIDADES, type Categoria, type Prioridad, type Ticket } from "../api/types";
import { DESCRIPCION_MAX, TITULO_MAX, validarTicket } from "../nuevo/validarTicket";
import { ETIQUETA_PRIORIDAD } from "../utils/presentacion";
import { AreaTexto } from "./AreaTexto";
import { Boton } from "./Boton";
import { Campo } from "./Campo";
import styles from "./DialogoNuevoTicket.module.css";
import { GrupoCampos } from "./GrupoCampos";
import { Segmentado, type OpcionSegmentado } from "./Segmentado";
import { Selector, type OpcionSelector } from "./Selector";

export interface PropsDialogoNuevoTicket {
  alCerrar: () => void;
  alCrear: (ticket: Ticket) => void;
}

type CampoTicket = "titulo" | "categoria" | "prioridad" | "descripcion";
type ErroresCampos = Partial<Record<CampoTicket, string>>;

interface Apagado {
  elemento: Element;
  inerte: boolean;
  oculto: string | null;
}

const ORDEN_CAMPOS: CampoTicket[] = ["titulo", "categoria", "prioridad", "descripcion"];

const ENFOCABLES = ["a[href]", "button:not(:disabled)", "input:not(:disabled)", "select:not(:disabled)", "textarea:not(:disabled)", "[tabindex]"]
  .map((selector) => `${selector}:not([tabindex="-1"])`)
  .join(", ");

const OPCIONES_CATEGORIA: OpcionSelector<Categoria>[] = CATEGORIAS.map((categoria) => ({ valor: categoria, etiqueta: categoria }));

const OPCIONES_PRIORIDAD: OpcionSegmentado<Prioridad>[] = PRIORIDADES.map((prioridad) => ({
  valor: prioridad,
  etiqueta: ETIQUETA_PRIORIDAD[prioridad],
}));

function erroresDelServidor(error: unknown): ErroresCampos {
  if (!(error instanceof ApiError)) return {};
  const errores: ErroresCampos = {};
  for (const { campo, mensaje } of error.errores) {
    const nombre = ORDEN_CAMPOS.find((candidato) => candidato === campo.split(".").pop());
    if (nombre !== undefined && errores[nombre] === undefined) errores[nombre] = mensaje;
  }
  return errores;
}

function apagarResto(propio: Element): Apagado[] {
  const apagados: Apagado[] = [];
  for (const elemento of Array.from(document.body.children)) {
    if (elemento === propio) continue;
    apagados.push({ elemento, inerte: elemento.hasAttribute("inert"), oculto: elemento.getAttribute("aria-hidden") });
    // React 18 no conoce inert: como prop booleana avisa en consola, así que va directo al DOM.
    elemento.setAttribute("inert", "");
    elemento.setAttribute("aria-hidden", "true");
  }
  return apagados;
}

function encenderResto(apagados: Apagado[]) {
  for (const { elemento, inerte, oculto } of apagados) {
    if (!inerte) elemento.removeAttribute("inert");
    if (oculto === null) elemento.removeAttribute("aria-hidden");
    else elemento.setAttribute("aria-hidden", oculto);
  }
}

export function DialogoNuevoTicket({ alCerrar, alCrear }: PropsDialogoNuevoTicket) {
  const idTitulo = useId();
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoria, setCategoria] = useState<Categoria>("Hardware");
  const [prioridad, setPrioridad] = useState<Prioridad>("MEDIA");
  const [errores, setErrores] = useState<ErroresCampos>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const velo = useRef<HTMLDivElement>(null);
  const dialogo = useRef<HTMLDivElement>(null);
  const campoTitulo = useRef<HTMLInputElement>(null);
  const campoCategoria = useRef<HTMLSelectElement>(null);
  const campoPrioridad = useRef<HTMLDivElement>(null);
  const campoDescripcion = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const propio = velo.current;
    if (!propio) return;
    const previo = document.activeElement;
    const apagados = apagarResto(propio);
    campoTitulo.current?.focus();
    return () => {
      // Primero se quita inert: un elemento inerte no puede recibir el foco de vuelta.
      encenderResto(apagados);
      if (previo instanceof HTMLElement && previo !== document.body && previo.isConnected) previo.focus();
    };
  }, []);

  function enfocar(campo: CampoTicket) {
    if (campo === "titulo") campoTitulo.current?.focus();
    else if (campo === "categoria") campoCategoria.current?.focus();
    else if (campo === "prioridad") campoPrioridad.current?.querySelector<HTMLElement>('[role="radio"][tabindex="0"]')?.focus();
    else campoDescripcion.current?.focus();
  }

  function mostrarErrores(nuevos: ErroresCampos) {
    // El error tiene que estar en el DOM antes del foco, así el lector lo lee con el campo.
    flushSync(() => setErrores(nuevos));
    const primero = ORDEN_CAMPOS.find((campo) => nuevos[campo] !== undefined);
    if (primero !== undefined) enfocar(primero);
  }

  function limpiarError(campo: CampoTicket) {
    setErrores((actuales) => (actuales[campo] === undefined ? actuales : { ...actuales, [campo]: undefined }));
  }

  async function crear(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviando) return;
    setGeneral(null);
    const locales = validarTicket(titulo, descripcion);
    if (locales.titulo !== undefined || locales.descripcion !== undefined) {
      mostrarErrores(locales);
      return;
    }
    setErrores({});
    setEnviando(true);
    let creado: Ticket;
    try {
      creado = await tickets.crear({ titulo: titulo.trim(), descripcion: descripcion.trim(), categoria, prioridad });
    } catch (error) {
      setEnviando(false);
      const delServidor = erroresDelServidor(error);
      if (Object.keys(delServidor).length > 0) mostrarErrores(delServidor);
      else setGeneral("No se pudo crear el ticket.");
      return;
    }
    alCrear(creado);
  }

  function alTeclear(evento: KeyboardEvent<HTMLDivElement>) {
    if (evento.key === "Escape") {
      evento.preventDefault();
      alCerrar();
      return;
    }
    if (evento.key !== "Tab") return;
    const enfocables = Array.from(dialogo.current?.querySelectorAll<HTMLElement>(ENFOCABLES) ?? []);
    const primero = enfocables[0];
    const ultimo = enfocables[enfocables.length - 1];
    if (primero === undefined || ultimo === undefined) return;
    const actual = document.activeElement;
    if (evento.shiftKey && (actual === primero || !dialogo.current?.contains(actual))) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && (actual === ultimo || !dialogo.current?.contains(actual))) {
      evento.preventDefault();
      primero.focus();
    }
  }

  function alPresionarVelo(evento: MouseEvent<HTMLDivElement>) {
    // Un clic en el velo no cierra (se perdería lo escrito) ni le saca el foco al diálogo.
    if (evento.target === evento.currentTarget) evento.preventDefault();
  }

  return createPortal(
    <div ref={velo} className={styles.velo} onMouseDown={alPresionarVelo}>
      <div
        ref={dialogo}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        className={styles.dialogo}
        onKeyDown={alTeclear}
      >
        <div className={styles.cabecera}>
          <h2 id={idTitulo} className={styles.titulo}>
            Nuevo ticket
          </h2>
          <button type="button" className={styles.cerrar} aria-label="Cerrar" onClick={alCerrar}>
            <X className={styles.icono} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>

        <form className={styles.formulario} aria-labelledby={idTitulo} noValidate onSubmit={(evento) => void crear(evento)}>
          <div className={styles.seccion}>
            <p className={styles.encabezado} aria-hidden="true">
              Detalle
            </p>
            <GrupoCampos leyenda="Detalle" leyendaOculta>
              <Campo
                ref={campoTitulo}
                etiqueta="Título"
                value={titulo}
                maxLength={TITULO_MAX}
                contador
                autoComplete="off"
                error={errores.titulo}
                onChange={(evento) => {
                  setTitulo(evento.target.value);
                  limpiarError("titulo");
                }}
              />
              <Selector
                referencia={campoCategoria}
                etiqueta="Categoría"
                opciones={OPCIONES_CATEGORIA}
                valor={categoria}
                error={errores.categoria}
                alCambiar={(valor) => {
                  setCategoria(valor);
                  limpiarError("categoria");
                }}
              />
              <div ref={campoPrioridad} className={styles.prioridad}>
                <Segmentado
                  etiqueta="Prioridad"
                  etiquetaVisible
                  anchoCompleto
                  opciones={OPCIONES_PRIORIDAD}
                  valor={prioridad}
                  alCambiar={(valor) => {
                    setPrioridad(valor);
                    limpiarError("prioridad");
                  }}
                />
                {errores.prioridad !== undefined && <p className={styles.errorCampo}>{errores.prioridad}</p>}
              </div>
            </GrupoCampos>
          </div>

          <div className={styles.seccion}>
            <p className={styles.encabezado} aria-hidden="true">
              Descripción
            </p>
            <GrupoCampos leyenda="Descripción" leyendaOculta>
              <AreaTexto
                ref={campoDescripcion}
                etiqueta="Descripción"
                etiquetaOculta
                value={descripcion}
                maxLength={DESCRIPCION_MAX}
                contador
                rows={6}
                error={errores.descripcion}
                onChange={(evento) => {
                  setDescripcion(evento.target.value);
                  limpiarError("descripcion");
                }}
              />
            </GrupoCampos>
          </div>

          <div className={styles.envio}>
            {general !== null && (
              <p role="alert" className={styles.general}>
                {general}
              </p>
            )}
            <div className={styles.botones}>
              <Boton variante="secundario" onClick={alCerrar}>
                Cancelar
              </Boton>
              <Boton type="submit" cargando={enviando} textoCargando="Creando…">
                Crear
              </Boton>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
