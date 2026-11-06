export function Barras({ titulo, datos, etiquetas }: { titulo: string; datos: Record<string, number>; etiquetas?: Record<string, string> }) {
  const filas = Object.entries(datos);
  const max = Math.max(1, ...filas.map(([, n]) => n));
  return (
    <figure className="barras">
      <figcaption className="etiqueta">{titulo}</figcaption>
      <table>
        <tbody>
          {filas.map(([clave, n]) => {
            const nombre = etiquetas?.[clave] ?? clave;
            return (
              <tr key={clave} title={`${nombre}: ${n} ${n === 1 ? "ticket" : "tickets"}`}>
                <th scope="row">{nombre}</th>
                <td className="barras-pista">
                  <span className="barras-relleno" style={{ width: `${(n / max) * 100}%` }} />
                </td>
                <td className="barras-valor tq-numeradora">{n}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </figure>
  );
}
