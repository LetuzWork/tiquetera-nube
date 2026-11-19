# Identidad visual — "Cielo"

## Intención

La restricción horaria es lo que distingue a esta ticketera: solo se ingresa dentro de la franja de acceso (por omisión, de lunes a viernes de 08:00 a 18:00). Cielo la hace visible: **la jornada de acceso es la luz de la app**. Un cielo cambia de color con la hora del servidor, un horizonte muestra la jornada de hoy con los tickets que entraron y la app avisa con claridad cuando la sesión o la jornada terminan. Todo lo demás (listas, formularios, detalle) queda quieto, sobrio y legible.

Un solo tema claro: la variación de luz la da el cielo.

## Reglas de seguridad

1. **La hora es la del servidor.** El frontend toma la hora, la franja y la zona de `GET /api/auth/horario` y avanza con un reloj monotónico, que no cambia si se ajusta la hora del dispositivo. Toda fecha y hora se muestra en la zona del servidor. La hora no se puede arrastrar ni simular desde la interfaz.
2. **El servidor decide el acceso.** Sesión, rol y horario se controlan en cada pedido; el frontend solo muestra. El formulario de inicio de sesión nunca se deshabilita por la hora: si es fuera de horario, lo rechaza el servidor.
3. **Datos filtrados por rol en el servidor.** Las marcas del horizonte salen de `GET /api/tickets` con la fecha de hoy, que la API ya filtra por rol.
4. **Sin recursos externos.** La fuente viaja empaquetada con la app (`@fontsource-variable/albert-sans`) y los íconos con `lucide-react`. No se carga nada de Google ni de otro CDN.

## Firma: el cielo de la jornada

### Color del cielo

El cielo es un degradado vertical de dos colores, `arriba` y `abajo`, que depende del minuto del día en la zona del servidor. Entre dos puntos se interpola en sRGB, canal por canal, redondeando al entero. En el inicio y el fin de la franja hay **puntos dobles**: dos colores en el mismo minuto. El "antes" cierra el tramo anterior y el "desde" vale en ese minuto y después. Así la luz se prende con la jornada y se apaga con ella.

| Punto (franja de 08:00 a 18:00) | Arriba | Abajo | Texto |
|---|---|---|---|
| 06:00 | `#0f1330` | `#1f2550` | `#ffffff` |
| 07:30 | `#27305e` | `#6b5b8c` | `#ffffff` |
| 08:00 antes | `#4c659f` | `#89706c` | `#ffffff` |
| 08:00 desde | `#6788d6` | `#c6a39d` | `#14233c` |
| 08:15 | `#678acf` | `#f3c7a5` | `#14233c` |
| 10:00 | `#6fa8ef` | `#d9ebff` | `#14233c` |
| 13:00 | `#4f98f0` | `#e3f0ff` | `#14233c` |
| 15:30 | `#79a9e6` | `#fbe2c2` | `#14233c` |
| 17:15 | `#8682ca` | `#f7ad7c` | `#14233c` |
| 18:00 antes | `#7980f8` | `#c37781` | `#14233c` |
| 18:00 desde | `#36396f` | `#a3646c` | `#ffffff` |
| 19:00 | `#12162f` | `#242a4f` | `#ffffff` |

- Antes de las 06:00 vale el primer punto; desde las 19:00, el último.
- Con otra franja, los puntos de 08:00 a 18:00 se reparten en proporción dentro de ella, y los de antes y después se corren junto con el inicio y el fin.
- Un día fuera de la franja usa el cielo de noche (19:00).
- Mientras la franja no llegó, el encabezado es el fondo liso `--tq-fondo`, sin reloj. Si la franja no se pudo consultar, se usa el cielo de las 13:00, sin reloj ni horizonte.

### Tinta sobre el cielo

El texto sobre el cielo es `#14233c` o `#ffffff`: el que da **mayor contraste mínimo en todo el degradado**, medido en 101 muestras de arriba abajo, con la mezcla sRGB por canal y sin redondear, como la dibuja `linear-gradient`. Con la tabla de arriba, el contraste queda en 4.5:1 o más en los 1440 minutos del día. El texto ocupa solo la caja de contenido del encabezado, entre `arriba` y `abajo`; el paso al fondo claro cae en el relleno inferior, detrás del vidrio.

### Horizonte

- Una línea con la franja de hoy: la hora de inicio a la izquierda y la de fin a la derecha.
- El tramo transcurrido es una línea de 2px con opacidad 0.75; el resto, de 1px con opacidad 0.3, en `currentColor`.
- **Sol:** un círculo en la hora actual, en `--tq-sol` (`#e8590c`), con anillo blanco de 2px y halo cálido. Antes del inicio o después del fin queda en el borde más cercano. Con la jornada cerrada se atenúa (opacidad 0.35) y pierde el halo. Es decorativo: el estado lo dice el texto.
- **Marcas:** un círculo de 0.5rem por cada ticket de hoy (hasta los 100 más recientes), en la hora de creación, con anillo blanco de 2px y el color de su estado. La zona de toque mide 1.5rem. Con el puntero o el foco muestra "TQ-000049 · 12:05 · Abierto", que es también su nombre accesible. Clic o Enter abren el ticket; en una pantalla táctil, el primer toque muestra la etiqueta y el segundo lo abre.
- Para lectores de pantalla es un grupo con nombre: "Jornada de 08:00 a 18:00. Son las 14:20. Hoy entraron 5 tickets.". Es un solo punto de tabulación; las flechas, Inicio y Fin recorren las marcas.
- Debajo va la cuenta de tickets de hoy.

### Estados de la jornada

| Estado | Condición | Encabezado | Barra compacta |
|---|---|---|---|
| `abierta` | dentro de la franja y faltan más de 15 min | "Quedan 3 h 40 min de jornada" | "Cierra 18:00 · quedan 3 h 40 min" |
| `por cerrar` | faltan 15 min o menos | píldora `#fff3e6` con texto `#b25000`: "Cierra en 12 min" | "Cierra en 12 min" |
| `cerrada` | fuera de la franja o en un día no hábil | "Fuera del horario de atención" | "Fuera del horario de atención" |

Los minutos restantes se redondean hacia arriba: "3 h 40 min", "1 h", "12 min". Debajo del estado va la franja: "Lunes a viernes, de 08:00 a 18:00". La barra compacta aparece fija arriba, con el mismo cielo, cuando el encabezado sale de la vista al desplazar.

### Logo

Anillo a tres cuartos (empieza arriba y sigue en sentido horario) en `currentColor`, con trazo 5 sobre radio 14.5 en un viewBox de 36. Al lado, "Tiquetera Nube" en 1.0625rem, peso 650 y tracking −0.01em. El favicon es el mismo anillo en `#1f63d1`.

## Base visual

### Tokens

Todos con prefijo `--tq-`, en `:root`, en `frontend/src/theme/tokens.css`.

| Token | Valor | Uso |
|---|---|---|
| `fondo` | `#f3f5f9` | fondo bajo el cielo |
| `superficie` | `#ffffff` | grupos, tarjetas, menús |
| `superficie-2` | `#eef1f6` | campos, hover, controles en reposo |
| `texto` | `#14233c` | texto principal |
| `texto-2` | `#5b6576` | secundario, metadatos |
| `texto-3` | `#a1a1a6` | deshabilitado y decorativo |
| `separador` | `rgba(20,35,60,0.1)` | líneas finas |
| `acento` | `#1f63d1` | enlaces, foco, seleccionado, botón primario |
| `acento-suave` | `rgba(31,99,209,0.12)` | fila resaltada, avatar sobre fondo claro |
| `peligro` | `#c42b1c` | errores, acción destructiva |
| `exito` | `#1e7b3c` | confirmaciones |
| `aviso` | `#b25000` | jornada por cerrar |
| `aviso-fondo` | `#fff3e6` | píldora de "Cierra en 12 min" |
| `estado-abierto` | `#1f63d1` | marca de ticket Abierto |
| `estado-progreso` | `#c96f00` | marca de ticket En progreso |
| `estado-resuelto` | `#2a9350` | marca de ticket Resuelto |
| `estado-cerrado` | `#87878c` | marca de ticket Cerrado |
| `sol` | `#e8590c` | sol del horizonte |
| `velo` | `rgba(20,35,60,0.3)` | detrás de los diálogos |
| `sombra-flotante` | `0 0 0 0.5px rgba(20,35,60,.08), 0 8px 28px rgba(20,35,60,.14)` | menús, avisos, diálogos |

Contraste (WCAG 2):
- `texto-2`, `acento`, `peligro`, `exito` y `aviso` dan 4.5:1 o más sobre `superficie`, `superficie-2` y `fondo`; el blanco sobre `acento`, 5.58:1; `aviso` sobre `aviso-fondo`, 4.76:1.
- Las marcas y el sol se miden contra su anillo blanco: 5.58, 3.65, 3.90 y 3.57:1 los estados, y 3.58:1 el sol.

### Materiales

- **Vidrio** (panel principal que flota sobre el cielo): `rgba(255,255,255,0.76)` con `backdrop-filter: blur(30px) saturate(160%)`, radio 1.5rem y sombra `inset 0 1px 0 rgba(255,255,255,.95), 0 0 0 1px rgba(20,35,60,.06), 0 28px 60px -24px rgba(20,35,60,.3)`. Ancho `min(72rem, 100% - 2rem)`, centrado, superpuesto 3.5rem sobre el cielo.
- **Vidrio angosto** (inicio de sesión): el mismo material con ancho `min(24rem, 100% - 2rem)`, centrado debajo del reloj y sin superponerse al cielo, que en esa pantalla ocupa todo el fondo.
- **Cápsula** (navegación sobre el cielo): `rgba(255,255,255,0.22)` con `backdrop-filter: blur(16px) saturate(180%)`, radio de píldora y borde interior claro. El ítem activo es una píldora blanca al 90 % con texto `#14233c`.
- Con "reducir transparencia" o sin soporte de `backdrop-filter`: el vidrio pasa a blanco sólido, la cápsula a blanco al 85 % con texto `#14233c` y el velo de los diálogos a `--tq-fondo` opaco.

### Tipografía

Albert Sans Variable (pesos 200 a 700), empaquetada con `@fontsource-variable/albert-sans`. Respaldo: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`. Cifras tabulares en horas y contadores; sin monoespaciada.

| Estilo | Token | Tamaño | Peso | Interlineado | Tracking |
|---|---|---|---|---|---|
| reloj | `--tq-tipo-reloj` | 5.5rem (4rem bajo 768px) | 200 | 0.9 | −0.045em |
| título de panel | `--tq-tipo-titulo-panel` | 1.75rem | 700 | 1.15 | −0.022em |
| título 1 | `--tq-tipo-titulo-1` | 1.5rem | 700 | 1.2 | −0.019em |
| título 2 | `--tq-tipo-titulo-2` | 1.25rem | 600 | 1.25 | −0.012em |
| titular | `--tq-tipo-titular` | 0.9375rem | 600 | 1.4 | −0.004em |
| cuerpo | `--tq-tipo-cuerpo` | 0.9375rem | 400 | 1.5 | 0 |
| secundario | `--tq-tipo-secundario` | 0.8125rem | 400 | 1.45 | 0.002em |
| leyenda | `--tq-tipo-leyenda` | 0.75rem | 500 | 1.35 | 0.01em |

Cada `--tq-tipo-*` es un `font` abreviado; el tracking va aparte en `--tq-tracking-*`.

### Espaciado, tamaños y radios

- Espaciado en `rem` sobre una grilla de 4px.
- Alto de los controles: 2.25rem; 2.75rem con puntero grueso (`--tq-alto-control`).
- Radios: controles 999px (botones como píldoras), grupos y tarjetas 1rem, diálogos 1rem, vidrio 1.5rem.
- A 360px de ancho nada se desplaza en horizontal. Por debajo de 768px el reloj pasa a 4rem y la navegación se desplaza dentro de su cápsula.

### Movimiento

- `--tq-resorte`: una curva `linear()` de resorte, con respaldo `cubic-bezier(0.2, 0.9, 0.25, 1)`, en 500ms para entradas y salidas.
- Hover y color en 150ms; `:active` de los botones `scale(0.97)` en 100ms.
- Transiciones CSS. Hay dos animaciones con `@keyframes`: la sacudida del inicio de sesión (3 oscilaciones horizontales en 400ms) y el resaltado de la fila recién creada en la Bandeja (de `acento-suave` a transparente en 2s).
- El diálogo de nuevo ticket entra con el resorte: sube 0.75rem y crece desde 0.98 mientras aparece.
- Cuando la sesión termina, el contenido del vidrio se desenfoca (`blur(10px)`, opacidad 0.4) en 600ms, detrás del diálogo.
- Con "reducir movimiento" solo quedan fundidos de opacidad de 150ms: sin sacudidas, escalas ni desplazamientos. La fila recién creada queda resaltada y se apaga en los últimos 150ms.

### Foco e íconos

- Foco: `outline: 2px solid var(--tq-acento); outline-offset: 2px`. Sobre el cielo, contorno doble (`box-shadow: 0 0 0 2px #ffffff` y `outline: 2px solid #14233c`), que se ve con cualquier cielo.
- Todo se usa con teclado y el foco siempre se ve. El estado nunca se comunica solo con color.
- Íconos de `lucide-react` con trazo 1.75 y `aria-hidden`, solo en estados vacíos, menús, botones de solo ícono (con `aria-label`), dentro de los controles (lupa del buscador, chevron del selector, "‹ Tickets") y en los botones de acción de cada pantalla: "Nuevo ticket", "Filtros", "Exportar" y el "Reintentar" de Reportes.

## Componentes

| Componente | Qué es | Comportamiento clave |
|---|---|---|
| `Logo` | anillo y "Tiquetera Nube" | el anillo es decorativo; el nombre es el texto |
| `Avatar` | iniciales | primera letra de la primera y la última palabra, sin "de", "del", "la", "las", "los" ni "y"; con una palabra, sus dos primeras letras. Variante `cielo` (blanco al 88 %, sobre el cielo) y `claro` (`acento-suave` sobre `superficie`, con texto `acento`, en las filas y el detalle) |
| `Boton` / `EnlaceBoton` | botón y enlace con forma de botón | píldoras `primario` (`acento`), `secundario` (`superficie-2`), `simple` (texto `acento`) y `peligro` (texto `peligro`); `cargando` deshabilita y muestra el texto de carga |
| `Campo` | campo con etiqueta | error debajo, con `aria-invalid` y `aria-describedby` |
| `AreaTexto` | `textarea` con etiqueta | error como `Campo`; contador "0/5000" opcional |
| `Selector` | `select` nativo con etiqueta | chevron propio; se usa con el teclado como cualquier `select` |
| `Segmentado` | control segmentado | `radiogroup` con nombre; un solo punto de tabulación y las flechas mueven y eligen |
| `Buscador` | campo de búsqueda con lupa | etiqueta oculta "Buscar tickets"; consulta 300ms después de la última tecla; Esc borra y "/" lo enfoca si el foco no está en un campo |
| `Desplegable` | botón con panel no modal | para paneles con campos (no es un `menu`): `aria-expanded`; Esc y clic afuera cierran y devuelven el foco |
| `GrupoCampos` | `fieldset` con leyenda | superficie blanca con radio 1rem; se sacude ante credenciales incorrectas |
| `IndicadorEstado` | punto y nombre del estado | el punto lleva el color del estado; el nombre siempre se lee |
| `MarcaPrioridad` | "!", "!!" o "!!!" | la marca es decorativa y el nombre ("Prioridad crítica") es accesible; con `conNombre` también se ve. Crítica en `peligro`; Baja sin marca |
| `GraficoBarras` / `GraficoColumnas` | barras horizontales y columnas por día | sin librerías; el valor escrito al lado; para lectores, una tabla oculta dentro de un bloque `tq-solo-lectores` (una tabla sola no se achica y estiraría la página) |
| `EstadoVacio` | ícono, título y acción | sin acceso (candado), página inexistente (lupa), sin tickets, falla de carga. Título `h1`; `nivel={2}` dentro de una pantalla que ya tiene su `h1` |
| `Aviso` | píldora flotante | `role="status"`; queda hasta que se cierra con su botón |
| `Avisos` | `ProveedorAvisos` y `useAvisos()` | `confirmar` muestra un aviso que se cierra a los 4s y pausa con el puntero o el foco; `fallar`, uno con `role="alert"` que no se cierra solo; uno nuevo reemplaza al anterior. Dibuja la pila de avisos abajo al centro: los de la app arriba y el de vencimiento de la sesión abajo, sin superponerse |
| `Confirmacion` | `alertdialog` | sin `alCancelar`: foco en "Aceptar", Esc no lo cierra y el foco no sale. Con `alCancelar`: "Cancelar" con el foco, Esc cancela y Tab circula entre los dos botones |
| `DialogoNuevoTicket` | diálogo modal sobre la Bandeja | `role="dialog"` con `aria-modal`; el resto queda inerte y el foco no sale; "Cancelar", Esc o "Cerrar" lo cierran sin preguntar y devuelven el foco |
| `Menu` | botón con menú | flechas, Inicio, Fin, Enter, Espacio; Esc devuelve el foco; Tab y clic afuera cierran. Variante `cielo` (transparente, en `currentColor`, con el foco doble) y `comun` (`superficie-2`, foco en `acento`), como "Exportar" |
| `Horizonte` | línea de la franja, sol y marcas | foco itinerante sobre las marcas; etiqueta con puntero, foco o primer toque |
| `CieloJornada` | encabezado con el cielo | logo, navegación, cuenta, reloj, estado, franja y horizonte; barra compacta al desplazar |
| `Vidrio` | panel principal | se desenfoca detrás del diálogo de fin de sesión; en el inicio de sesión, la variante angosta |
| `Navegacion` | cápsula de secciones | Tickets, Nuevo ticket y Reportes según permisos; la sección actual con `aria-current="page"` |
| `Cuenta` | avatar, nombre y rol | menú con "Sesión hasta las 10:00" y "Cerrar sesión" |
| `Marco` | estructura de las secciones con sesión | cielo, vidrio, pila de avisos (con el de vencimiento) y diálogo de fin |

## Pantallas

Todas viven en el vidrio, debajo del cielo, con el título de la pantalla en `--tq-tipo-titulo-panel`. A 360px nada se desplaza en horizontal.

### Bandeja (`/bandeja`)

- Arriba, "Tickets" con el resumen de hoy debajo ("2 entraron hoy y 2 siguen sin tomar."); a la derecha, el buscador y "Nuevo ticket". Debajo, el estado como control segmentado y "Filtros" (prioridad, categoría y "Solo los asignados a mí"), que suma la cantidad activa: "Filtros · 2".
- La lista se agrupa en "Hoy" y "Anteriores", cada grupo con su cantidad, en una superficie blanca de radio 1rem con separadores finos. Cada fila es un enlace: hora o fecha corta, marca de prioridad, título (recortado con puntos suspensivos) con "TQ-000005 Red, lo pidió u.usuario" debajo, estado y responsable con su avatar claro, o "Sin asignar".
- Pie con "1–25 de 132" y, con más de 25, "Anterior" y "Siguiente".
- La vista (búsqueda, estado, filtros y página) vive en la dirección: recargar o volver desde el detalle la conserva.
- Debajo de 768px la fila oculta el responsable y el estado baja debajo del título.

### Nuevo ticket (diálogo modal)

- "Nuevo ticket" se abre como diálogo sobre la Bandeja, desde el botón, la navegación o `/tickets/nuevo`. Ancho `min(38rem, 100% - 2rem)`, superficie blanca, radio 1rem y el velo detrás.
- Dentro: el grupo "Detalle" (Título con contador, Categoría y Prioridad como control segmentado) y "Descripción" con contador; "Cancelar" y "Crear" abajo a la derecha.
- Los errores van debajo de cada campo y el foco va al primero. "Crear" nunca se deshabilita por validación; mientras crea dice "Creando…".
- Al crearse, el diálogo se cierra, la fila nueva se resalta con `acento-suave` y aparece el aviso "Ticket TQ-000054 creado".

### Detalle (`/tickets/:numero`)

- "‹ Tickets" vuelve a la bandeja con la vista que tenía. Debajo, el número en secundario, el título en `--tq-tipo-titulo-1` y dos insignias: el estado y la prioridad con su nombre.
- Desde 1024px las propiedades van a la derecha (20rem); más angosto, debajo del título, en una sola columna.
- Propiedades en un `GrupoCampos`: Estado (solo los de `acciones`), Responsable, Prioridad y Categoría como `Selector` si el rol puede cambiarlos, o como texto; Solicitante, Creado y Actualizado. Cada cambio se guarda al momento, con ese control deshabilitado mientras guarda.
- "Descripción" y "Actividad": una línea de tiempo con los comentarios (avatar claro, autor, hora y el texto en una burbuja blanca) y los eventos en una línea chica con un punto gris. Abajo, el campo "Comentario" con contador y "Comentar"; Ctrl+Enter también publica.
- Elegir "Cerrado" pide confirmación con "Cancelar" y "Cerrar ticket".

### Reportes (`/reportes`)

- "Reportes" con el período ("7 días", "30 días", "90 días", "Todo") como control segmentado y, con permiso, el menú "Exportar" en su variante común.
- Cuatro tarjetas con la cifra grande arriba y el nombre debajo: "Pendientes", "Críticos activos", "Total" y "Tiempo medio de resolución" ("Sin datos" en `texto-2` cuando no hay resueltos). Dos por fila; cuatro desde 768px.
- "Por estado", "Por prioridad", "Por categoría" y "Por responsable" como barras horizontales con el valor al final; "Por día" como columnas con la fecha corta debajo, a todo el ancho. Con más de 10 columnas el valor queda solo en la tabla para lectores.
- Sin tickets en el período, un bloque con "Sin tickets en el período."; si el resumen falla, "No se pudo cargar el resumen." con "Reintentar".

## Qué evitar

- Degradados, brillos o animaciones decorativas fuera del cielo.
- Tema oscuro manual o "turno día/noche": la luz la da el cielo.
- Que el frontend parezca decidir el acceso, o que use la hora del dispositivo.
- Comunicar un estado solo con color.
- Fuentes, íconos o imágenes cargados desde servicios externos.
- Íconos decorativos en cada botón y emojis en la interfaz.
- Mayúsculas sostenidas: mayúscula solo inicial.

## Microcopy

Voseo, verbos concretos y mayúscula solo inicial.

| Lugar | Texto |
|---|---|
| Inicio de sesión | "Iniciar sesión" · "Usá tu cuenta de dominio" · "Usuario" · "Contraseña" · "Iniciando sesión…" |
| Franja | "Podés ingresar de lunes a viernes, de 08:00 a 18:00." |
| Fuera de horario | "Fuera del horario de atención" · "Próxima apertura: lunes 16 de noviembre, 08:00." |
| Errores del ingreso | "Escribí solo tu usuario, sin el dominio." · "Ingresá la contraseña." · "Usuario o contraseña incorrectos." · "No se pudo contactar al servidor." · "El servidor no respondió. Probá de nuevo." |
| Sin franja | "No se pudo consultar el horario." |
| Comprobación de la sesión | "Verificando tu sesión…" |
| Encabezado | "Quedan 3 h 40 min de jornada" · "Cierra en 12 min" · "Fuera del horario de atención" |
| Cuenta de tickets | "Hoy entraron 5 tickets." · "Hoy entró 1 ticket." · "Hoy no entró ningún ticket." · "Hoy entraron 2 tickets tuyos." · "No se pudieron cargar los tickets de hoy." |
| Cuenta | "Sesión hasta las 10:00" · "Cerrar sesión" |
| Aviso de sesión | "Tu sesión vence a las 10:00." |
| Fin de la jornada | "La jornada terminó" · "El acceso está disponible de lunes a viernes, de 08:00 a 18:00. Tu sesión se cerró." · "Aceptar" |
| Fin de la sesión | "Tu sesión venció" · "Iniciá sesión de nuevo para seguir." · "Aceptar" |
| Sin acceso | "No tenés acceso a esta sección" · "Volver a Tickets" |
| Página inexistente | "Esta página no existe." · "Volver a Tickets" |
| Bandeja | "Tickets" · "Hoy no entró ningún ticket." · "5 entraron hoy y 3 siguen sin tomar." · "1 entró hoy y ninguno sigue sin tomar." · "Buscar por número o título" · "Todos" · "Abiertos" · "En progreso" · "Resueltos" · "Cerrados" · "Filtros · 2" · "Solo los asignados a mí" · "Sin asignar" · "1–25 de 132" · "Anterior" · "Siguiente" |
| Bandeja sin filas | "No hay tickets" · "Ningún ticket coincide con los filtros" · "Limpiar filtros" · "No se pudo cargar la bandeja." · "Reintentar" |
| Nuevo ticket | "Nuevo ticket" · "Detalle" · "Título" · "Categoría" · "Prioridad" · "Descripción" · "Cancelar" · "Crear" · "Creando…" · "Ticket TQ-000054 creado" |
| Errores del ticket nuevo | "El título necesita al menos 5 caracteres." · "El título admite hasta 120 caracteres." · "Contá el problema en al menos 10 caracteres." · "La descripción admite hasta 5000 caracteres." · "No se pudo crear el ticket." |
| Detalle | "Tickets" · "Descripción" · "Actividad" · "Todavía no hay actividad." · "u.operador cambió el estado de Abierto a En progreso · 10:42" · "Comentario" · "Comentar" · "Escribí un comentario." · "No se pudo publicar el comentario." |
| Cambios en el detalle | "Estado actualizado" · "Responsable actualizado" · "Prioridad actualizada" · "Categoría actualizada" · "No se pudo aplicar el cambio." |
| Cierre de un ticket | "¿Cerrar TQ-000045?" · "Solo un administrador puede reabrirlo." · "Cancelar" · "Cerrar ticket" |
| Detalle sin ticket | "Este ticket no existe." · "No tenés acceso a este ticket." · "No se pudo cargar el ticket." · "Volver a Tickets" |
| Reportes | "Reportes" · "7 días" · "30 días" · "90 días" · "Todo" · "Pendientes" · "Críticos activos" · "Total" · "Tiempo medio de resolución" · "5.2 h" · "Sin datos" · "Sin tickets en el período." · "No se pudo cargar el resumen." |
| Exportar | "Exportar" · "Tickets (CSV)" · "Historial (CSV)" |
