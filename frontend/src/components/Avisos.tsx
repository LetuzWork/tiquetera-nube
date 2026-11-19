import { X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type ReactNode,
} from "react";
import { Aviso } from "./Aviso";
import estilosAviso from "./Aviso.module.css";
import styles from "./Avisos.module.css";

export const MS_AVISO = 4000;
const TIC_MS = 100;

export interface ValorAvisos {
  confirmar: (texto: string) => void;
  fallar: (texto: string) => void;
  cerrar: () => void;
}

interface AvisoActual {
  tipo: "confirmacion" | "error";
  texto: string;
  id: number;
}

const ContextoAvisos = createContext<ValorAvisos | null>(null);

export interface PropsProveedorAvisos {
  children: ReactNode;
  avisoFijo?: ReactNode;
}

export function ProveedorAvisos({ children, avisoFijo }: PropsProveedorAvisos) {
  const [aviso, setAviso] = useState<AvisoActual | null>(null);
  const [regionLista, setRegionLista] = useState(false);
  const [puntero, setPuntero] = useState(false);
  const [foco, setFoco] = useState(false);
  const contador = useRef(0);
  const restante = useRef(MS_AVISO);
  const idContado = useRef<number | null>(null);
  const anterior = useRef<AvisoActual | null>(null);

  const confirmar = useCallback((texto: string) => {
    setAviso({ tipo: "confirmacion", texto, id: ++contador.current });
  }, []);
  const fallar = useCallback((texto: string) => {
    setAviso({ tipo: "error", texto, id: ++contador.current });
  }, []);
  const cerrar = useCallback(() => setAviso(null), []);
  const valor = useMemo(() => ({ confirmar, fallar, cerrar }), [confirmar, fallar, cerrar]);

  useEffect(() => {
    // La región role="status" entra vacía y el texto llega en el render siguiente: así los lectores lo anuncian.
    if (aviso !== null) setRegionLista(true);
  }, [aviso]);

  useEffect(() => {
    const previo = anterior.current;
    anterior.current = aviso;
    // Al cerrarse o cambiar de píldora, el elemento bajo el puntero o con el foco ya no está y no llega el "leave".
    if (aviso === null || (previo !== null && previo.tipo !== aviso.tipo)) {
      setPuntero(false);
      setFoco(false);
    }
  }, [aviso]);

  const confirmacionVisible = regionLista && aviso?.tipo === "confirmacion";
  const pausado = puntero || foco;

  useEffect(() => {
    if (!confirmacionVisible || aviso === null || pausado) return;
    if (idContado.current !== aviso.id) {
      idContado.current = aviso.id;
      restante.current = MS_AVISO;
    }
    const id = aviso.id;
    // Se descuenta de a tics y no con la hora, así la pausa conserva lo que faltaba sin leer ningún reloj.
    const tic = setInterval(() => {
      restante.current -= TIC_MS;
      if (restante.current <= 0) setAviso((actual) => (actual?.id === id ? null : actual));
    }, TIC_MS);
    return () => clearInterval(tic);
  }, [confirmacionVisible, aviso, pausado]);

  function alPerderFoco(evento: FocusEvent<HTMLDivElement>) {
    const destino = evento.relatedTarget;
    if (!(destino instanceof Node) || !evento.currentTarget.contains(destino)) setFoco(false);
  }

  return (
    <ContextoAvisos.Provider value={valor}>
      {children}
      <div className={styles.pila}>
        <div
          className={styles.avisos}
          onPointerEnter={() => setPuntero(true)}
          onPointerLeave={() => setPuntero(false)}
          onFocus={() => setFoco(true)}
          onBlur={alPerderFoco}
        >
          {(regionLista || aviso !== null) && (
            <Aviso abierto={confirmacionVisible} alCerrar={cerrar}>
              {aviso?.tipo === "confirmacion" ? <span key={aviso.id}>{aviso.texto}</span> : null}
            </Aviso>
          )}
          {aviso?.tipo === "error" && (
            <div className={estilosAviso.aviso} data-abierto="true" data-tono="error">
              <p role="alert" className={`${estilosAviso.texto} ${styles.textoError}`}>
                {aviso.texto}
              </p>
              <button type="button" className={estilosAviso.cerrar} aria-label="Cerrar aviso" onClick={cerrar}>
                <X className={estilosAviso.icono} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
        {avisoFijo}
      </div>
    </ContextoAvisos.Provider>
  );
}

export function useAvisos(): ValorAvisos {
  const valor = useContext(ContextoAvisos);
  if (!valor) throw new Error("useAvisos debe usarse dentro de <ProveedorAvisos>");
  return valor;
}
