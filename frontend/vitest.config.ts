import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Una zona distinta a la del servidor hace fallar cualquier uso de la zona del dispositivo.
process.env.TZ = "Asia/Tokyo";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/test/preparar.ts"],
    restoreMocks: true,
    env: { TZ: "Asia/Tokyo" },
    // Sin esto Vitest vacía los CSS, también los leídos con ?raw en estilos.test.ts.
    css: { include: [/\.css\?raw$/] },
  },
});
