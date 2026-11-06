import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";
import { ProveedorAuth } from "./auth/AuthContext";
import { RutaProtegida } from "./auth/guards";
import { Layout } from "./components/Layout";
import { Bandeja } from "./pages/Bandeja";
import { DetalleTicket } from "./pages/DetalleTicket";
import { NuevoTicket } from "./pages/NuevoTicket";
import { Reportes } from "./pages/Reportes";
import { Ventanilla } from "./pages/Ventanilla";
import { ProveedorTema } from "./theme/ThemeContext";

function NoEncontrado() {
  return (
    <section className="pagina">
      <p className="vacio">Esta ventanilla no existe.</p>
      <Link to="/bandeja" className="opcion">
        Volver a la bandeja
      </Link>
    </section>
  );
}

export function App() {
  return (
    <ProveedorTema>
      <ProveedorAuth>
        <BrowserRouter>
          <Routes>
            <Route path="/ventanilla" element={<Ventanilla />} />
            <Route
              element={
                <RutaProtegida>
                  <Layout />
                </RutaProtegida>
              }
            >
              <Route index element={<Navigate to="/bandeja" replace />} />
              <Route path="/bandeja" element={<Bandeja />} />
              <Route
                path="/tickets/nuevo"
                element={
                  <RutaProtegida permiso="ticket:crear">
                    <NuevoTicket />
                  </RutaProtegida>
                }
              />
              <Route path="/tickets/:numero" element={<DetalleTicket />} />
              <Route
                path="/reportes"
                element={
                  <RutaProtegida permiso="reporte:ver">
                    <Reportes />
                  </RutaProtegida>
                }
              />
              <Route path="*" element={<NoEncontrado />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ProveedorAuth>
    </ProveedorTema>
  );
}
