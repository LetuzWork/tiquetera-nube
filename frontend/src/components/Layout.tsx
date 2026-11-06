import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Can } from "../auth/guards";
import { useTema } from "../theme/ThemeContext";
import { RelojTurno } from "./RelojTurno";

const NOMBRE_ROL = { admin: "Admin", operador: "Operador", usuario: "Usuario", consulta: "Consulta" } as const;

export function Layout() {
  const { me, cerrarSesion } = useAuth();
  const { turno, alternarTurno } = useTema();
  return (
    <div className="marco">
      <header className="barra">
        <div className="barra-int">
          <NavLink to="/bandeja" className="marca">
            <span className="marca-agujero" aria-hidden="true" />
            Tiquetera Nube
          </NavLink>
          <nav className="nav" aria-label="Principal">
            <NavLink to="/bandeja">Bandeja</NavLink>
            <Can permiso="ticket:crear">
              <NavLink to="/tickets/nuevo">Sacar número</NavLink>
            </Can>
            <Can permiso="reporte:ver">
              <NavLink to="/reportes">Reportes</NavLink>
            </Can>
          </nav>
          <div className="barra-der">
            <RelojTurno />
            {me && (
              <span className="credencial tq-numeradora" title={me.nombre}>
                {me.usuario} · {NOMBRE_ROL[me.rol]}
              </span>
            )}
            <button type="button" className="opcion" onClick={alternarTurno} aria-pressed={turno === "noche"}>
              {turno === "dia" ? "Turno noche" : "Turno día"}
            </button>
            <button type="button" className="opcion" onClick={() => void cerrarSesion()}>
              Salir
            </button>
          </div>
        </div>
      </header>
      <main className="contenido">
        <Outlet />
      </main>
    </div>
  );
}
