import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ProveedorAuth } from "./auth/AuthContext";
import { RutaProtegida } from "./auth/guards";
import { Marco } from "./components/Marco";
import { RelojDemo } from "./components/RelojDemo";
import { ProveedorJornada } from "./jornada/JornadaContext";
import { Bandeja } from "./pages/Bandeja";
import { DetalleTicket } from "./pages/DetalleTicket";
import { IniciarSesion } from "./pages/IniciarSesion";
import { NoEncontrado } from "./pages/NoEncontrado";
import { Reportes } from "./pages/Reportes";

export function App({ relojMonotono }: { relojMonotono?: () => number }) {
  return (
    <ProveedorAuth relojMonotono={relojMonotono}>
      <ProveedorJornada relojMonotono={relojMonotono}>
        <BrowserRouter>
          <Routes>
            <Route path="/ventanilla" element={<IniciarSesion />} />
            <Route
              element={
                <RutaProtegida>
                  <Marco />
                </RutaProtegida>
              }
            >
              <Route index element={<Navigate to="/bandeja" replace />} />
              <Route path="/bandeja" element={<Bandeja />} />
              <Route path="/tickets/nuevo" element={<Bandeja nuevo />} />
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
        <RelojDemo />
      </ProveedorJornada>
    </ProveedorAuth>
  );
}
