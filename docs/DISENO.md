# Identidad visual — "Talonario"

## Concepto

La Tiquetera Nube no se ve como un SaaS. Se ve como **la ventanilla de una oficina de soporte**: talonarios numerados, papel carbónico, sellos de goma, perforadoras y el resaltador que alguien dejó sin tapa. Cada pedido es un **talón** que se arranca, se sella y se archiva.

Reglas que lo hacen irrepetible:

1. **Nada flota.** No hay sombras difusas ni vidrio esmerilado. Las piezas se apilan como papel: sombra dura desplazada (`3px 3px 0`).
2. **Las esquinas se muerden, no se redondean.** Los talones tienen muescas semicirculares laterales (como un ticket de colectivo) y radio de 2px en el resto.
3. **El estado es un sello**, rotado unos grados, con borde doble y tinta levemente gastada. Nunca un "pill" de color.
4. **La prioridad son perforaciones.** 1 a 4 agujeros ponchados en el margen del talón. Crítica suma una franja de resaltador.
5. **Los separadores son perforados**, no líneas: puntos espaciados que sugieren "arrancar por acá".
6. **Los números son de numeradora.** IDs y fechas en monoespaciada de máquina de escribir, con ceros a la izquierda (`TQ-000042`).
7. **Dos turnos, no "light/dark".** *Turno día* (papel crema bajo luz de oficina) y *Turno noche* (papel carbónico, tinta clara, luz de lámpara).

## Paleta

### Turno día

| Token | Hex | Uso |
|---|---|---|
| `--tq-papel` | `#F3ECDC` | fondo general |
| `--tq-papel-alto` | `#FBF7EE` | talones, tarjetas |
| `--tq-papel-hundido` | `#E8DEC8` | inputs, zonas inactivas |
| `--tq-tinta` | `#1E2629` | texto principal, sombra de pila |
| `--tq-tinta-suave` | `#4A5559` | texto secundario |
| `--tq-tinta-tenue` | `#7D8487` | metadatos, CERRADO |
| `--tq-linea` | `#CDBF9F` | bordes |
| `--tq-perforado` | `#BBAA86` | puntos de perforación |
| `--tq-carbonico` | `#24407A` | acción primaria, links, EN PROGRESO |
| `--tq-sello` | `#B83A24` | ABIERTO, errores, peligro |
| `--tq-contable` | `#36654A` | RESUELTO, éxito |
| `--tq-resaltador` | `#F0D04E` | foco, CRÍTICA, selección de texto |
| `--tq-oxido` | `#8C5631` | advertencias, horario próximo a cerrar |

### Turno noche

| Token | Hex |
|---|---|
| `--tq-papel` | `#14191B` |
| `--tq-papel-alto` | `#1D2427` |
| `--tq-papel-hundido` | `#0E1213` |
| `--tq-tinta` | `#EAE2CF` |
| `--tq-tinta-suave` | `#B9B1A0` |
| `--tq-tinta-tenue` | `#858072` |
| `--tq-linea` | `#2C3437` |
| `--tq-perforado` | `#3A4347` |
| `--tq-carbonico` | `#86A0E3` |
| `--tq-sello` | `#EE7A5F` |
| `--tq-contable` | `#7FB894` |
| `--tq-resaltador` | `#E8C547` |
| `--tq-oxido` | `#D39A6C` |

Contraste verificado contra `--tq-papel-alto`: tinta ≥ 13:1, carbónico/sello/contable ≥ 4.5:1 en ambos turnos.

## Tipografía

| Rol | Fuente | Por qué |
|---|---|---|
| Titulares, sellos, numeración grande | **Big Shoulders Display** 700/800 | condensada de cartelería ferroviaria |
| Texto de interfaz | **Atkinson Hyperlegible** 400/700 | diseñada para legibilidad, poco vista en apps |
| IDs, fechas, historial, CSV preview | **Courier Prime** 400/700 | máquina de escribir, cifras tabulares |

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Big+Shoulders+Display:wght@700;800&family=Courier+Prime:wght@400;700&display=swap" rel="stylesheet">
```

Escala (ratio 1.25): 12 · 14 · 16 · 20 · 25 · 31 · 39. Titulares en mayúsculas con `letter-spacing: 0.04em`.

## Piezas de interfaz

| Componente | Descripción |
|---|---|
| `Talon` | tarjeta de ticket con muescas laterales, sombra de pila, número de numeradora arriba a la derecha |
| `Sello` | estado: texto en Big Shoulders, borde doble, rotación `-4deg`, opacidad 0.88 y máscara de ruido para tinta gastada |
| `Ponchado` | prioridad: 1–4 círculos vacíos (agujeros) sobre el margen izquierdo |
| `Perforado` | separador `radial-gradient` de puntos cada 10px |
| `Libreta` | historial como hoja rayada con margen rojo; cada evento es un renglón en Courier |
| `Ventanilla` | pantalla de login: una ventanilla con persiana; fuera de horario la persiana baja y muestra "VENTANILLA CERRADA — abre 08:00" |
| `Reloj de turno` | en la barra superior, cuenta regresiva hasta el cierre de la franja; pasa a `--tq-oxido` en los últimos 15 min |

## Movimiento

| Nombre | Dónde | Curva |
|---|---|---|
| `timbrado` | aparece un sello: escala 1.25→1, rotación -10°→-4°, 160ms | `cubic-bezier(.2,.9,.3,1.4)` |
| `arranque` | cerrar ticket: el talón se desplaza 6px y rota 1°, 220ms | `cubic-bezier(.4,0,.2,1)` |
| `persiana` | login fuera de horario: baja en 420ms con 3 pasos | `steps(3, end)` |

`prefers-reduced-motion: reduce` desactiva rotaciones y desplazamientos.

## Qué evitar

- Gradientes violetas/índigo, glassmorphism, blobs, glow.
- Inter, Roboto, Poppins, Space Grotesk.
- Pills redondeadas para estados, `rounded-2xl`, sombras `0 10px 30px rgba(...)`.
- Íconos decorativos en cada botón; los botones dicen la acción en mayúsculas ("SELLAR", "ARRANCAR", "ASIGNAR").
- Emojis en la UI.

## Microcopy

| Lugar | Texto |
|---|---|
| Login | "Presentá tu credencial" |
| Botón login | "ENTRAR A VENTANILLA" |
| Fuera de horario | "Ventanilla cerrada. Atendemos de 08:00 a 18:00." |
| Crear ticket | "SACAR NÚMERO" |
| Cerrar ticket | "ARCHIVAR TALÓN" |
| Sin tickets | "No hay talones en esta pila." |
| 403 | "Este sello no es tuyo." |
