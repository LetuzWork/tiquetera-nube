import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import { tickets } from "../api/endpoints";
import { CATEGORIAS, PRIORIDADES, type Categoria, type NuevoTicket as Datos, type Prioridad } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { prioridades } from "../theme/theme";

type Errores = Partial<Record<keyof Datos | "general", string>>;

function validar(d: Datos): Errores {
  const e: Errores = {};
  if (d.titulo.trim().length < 5) e.titulo = "El título necesita al menos 5 caracteres.";
  if (d.titulo.trim().length > 120) e.titulo = "El título admite hasta 120 caracteres.";
  if (d.descripcion.trim().length < 10) e.descripcion = "Contá el problema en al menos 10 caracteres.";
  if (d.descripcion.trim().length > 5000) e.descripcion = "La descripción admite hasta 5000 caracteres.";
  return e;
}

export function NuevoTicket() {
  const { me } = useAuth();
  const navegar = useNavigate();
  const [datos, setDatos] = useState<Datos>({ titulo: "", descripcion: "", categoria: "Hardware", prioridad: "MEDIA" });
  const [errores, setErrores] = useState<Errores>({});
  const [enviando, setEnviando] = useState(false);

  const enviar = async (ev: FormEvent) => {
    ev.preventDefault();
    const locales = validar(datos);
    setErrores(locales);
    if (Object.keys(locales).length) return;
    setEnviando(true);
    try {
      const t = await tickets.crear({ ...datos, titulo: datos.titulo.trim(), descripcion: datos.descripcion.trim() });
      navegar(`/tickets/${t.numero}`, { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.errores.length) {
        setErrores(Object.fromEntries(err.errores.map((x) => [x.campo || "general", x.mensaje])));
      } else {
        setErrores({ general: err instanceof ApiError ? err.message : "No se pudo crear el ticket." });
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section className="pagina">
      <form className="tq-talon quieto form-nuevo" onSubmit={enviar} noValidate>
        <span className="etiqueta">Nuevo talón · solicitante {me?.usuario}</span>
        <h1>Sacar número</h1>
        <hr className="tq-perforado" />
        <div className="campo-g">
          <label htmlFor="n-titulo">Título</label>
          <input
            id="n-titulo"
            className="tq-campo"
            maxLength={120}
            value={datos.titulo}
            onChange={(e) => setDatos({ ...datos, titulo: e.target.value })}
            aria-invalid={Boolean(errores.titulo)}
            autoFocus
          />
          <span className="error">{errores.titulo}</span>
        </div>
        <div className="form-fila">
          <div className="campo-g">
            <label htmlFor="n-categoria">Categoría</label>
            <select
              id="n-categoria"
              className="tq-campo"
              value={datos.categoria}
              onChange={(e) => setDatos({ ...datos, categoria: e.target.value as Categoria })}
            >
              {CATEGORIAS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="campo-g">
            <label htmlFor="n-prioridad">Prioridad</label>
            <select
              id="n-prioridad"
              className="tq-campo"
              value={datos.prioridad}
              onChange={(e) => setDatos({ ...datos, prioridad: e.target.value as Prioridad })}
            >
              {PRIORIDADES.map((p) => (
                <option key={p} value={p}>
                  {prioridades[p].etiqueta}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="campo-g">
          <label htmlFor="n-descripcion">Descripción</label>
          <textarea
            id="n-descripcion"
            className="tq-campo"
            maxLength={5000}
            rows={6}
            value={datos.descripcion}
            onChange={(e) => setDatos({ ...datos, descripcion: e.target.value })}
            aria-invalid={Boolean(errores.descripcion)}
          />
          <span className="error">{errores.descripcion}</span>
        </div>
        {errores.general && <p className="error">{errores.general}</p>}
        <div className="botonera">
          <button className="tq-boton" type="submit" disabled={enviando}>
            {enviando ? "Sellando…" : "Sellar y enviar"}
          </button>
          <button className="tq-boton" data-variante="papel" type="button" onClick={() => navegar("/bandeja")}>
            Cancelar
          </button>
        </div>
      </form>
    </section>
  );
}
