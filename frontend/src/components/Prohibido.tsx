import { useAuth } from "../auth/AuthContext";

export function Prohibido({ detalle, titulo = "Este sello no es tuyo" }: { detalle: string; titulo?: string }) {
  const { me } = useAuth();
  return (
    <div className="prohibido" role="alert">
      <b>{titulo}</b>
      <span>{detalle}</span>
      {me && <span className="tq-numeradora">403 · rol {me.rol}</span>}
    </div>
  );
}
