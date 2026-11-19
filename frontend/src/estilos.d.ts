import "react";

declare module "react" {
  interface CSSProperties {
    [propiedad: `--tq-${string}`]: string | number | undefined;
  }
}
