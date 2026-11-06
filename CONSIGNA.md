# Consigna — Ticketera Web con Active Directory

Desarrollar una aplicación web en Python que integre autenticación contra Active Directory (AD). Una vez autenticado, el usuario accederá a una ticketera web para la gestión de solicitudes de soporte.

## Funcionalidad

La aplicación deberá permitir:

- Crear, consultar y actualizar tickets.
- Gestionar estados (Abierto, En Progreso, Resuelto, Cerrado).
- Asignar prioridades y responsables.
- Mantener historial y comentarios de seguimiento.
- Persistir la información (puede ser el mismo csv, json).
- Exportar datos y reportes en formato CSV.

## Roles y permisos basados en grupos de AD

Ejemplo:

- **Admin:** acceso completo al sistema.
- **Operador:** gestión y actualización de tickets.
- **Usuario:** creación y consulta de sus propios tickets.
- **Consulta:** acceso solo lectura.

## Restricción de acceso por horario

La aplicación deberá permitir el inicio de sesión únicamente dentro de una franja horaria definida (por ejemplo, de 08:00 a 18:00 hs).

## Seguridad

Implementar buenas prácticas de seguridad, incluyendo autenticación mediante AD, control de acceso basado en roles, validación de entradas y protección frente a inyecciones SQL.

## Evaluación

Durante la clase se verificará el correcto funcionamiento de:

- Autenticación contra Active Directory.
- Restricción horaria de acceso.
- Gestión de tickets.
- Aplicación de roles y permisos.
- Persistencia de datos.
- Exportación de información en formato CSV.

## Entrega del Trabajo Práctico

La entrega deberá incluir:

- Código fuente completo de la aplicación, incluyendo archivos de configuración, scripts de base de datos y documentación necesaria para su ejecución.
- Documento de evidencias (PDF o Word) con capturas de pantalla que demuestren el funcionamiento de la solución. Como mínimo, deberá contener:
  - Pantalla de inicio de sesión.
  - Restricción de acceso fuera del horario permitido.
  - Vista de creación de tickets.
  - Gestión y actualización de tickets.
  - Aplicación de permisos según cada rol (Admin, Operador, Usuario y Consulta).
  - Consultas y reportes.
  - Exportación de datos a formato CSV.
- Breve documentación técnica que describa:
  - Tecnologías utilizadas.

---

## Requisitos agregados para esta implementación

- Diseño basado en principios SOLID.
- Frontend en React; backend en FastAPI.
- Entorno de Python gestionado con pipenv.
- Persistencia en un archivo local.
- Autenticación por LDAP contra un Active Directory montado en una VM de VirtualBox, con guía de setup del servidor (`docs/AD_SETUP.md`).
- Identidad visual propia y no genérica (`docs/DISENO.md`).
- Archivos `.env.example` para backend y frontend.
- Un único comando para levantar backend y frontend juntos (`npm run dev`).
- Sin comentarios multilínea en el código.
