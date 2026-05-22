# MediCitas — Prototipo Funcional (Sprint 2)

Plataforma de reservas de citas médicas en línea. Este es el **producto final
del Sprint 2**: una evolución del mockup no funcional del Sprint 1 a una
aplicación **completamente funcional**, con persistencia real de datos en
**archivos planos JSON** (sin base de datos).

---

## ✅ ¿Qué hace?

- **Registro e inicio de sesión** de usuarios con validación.
- **Catálogo de especialidades** y **médicos** por especialidad.
- **Calendario con disponibilidad real**: los cupos ya reservados se muestran ocupados.
- **Agendamiento de citas** con código de reserva único (`MED-2026-XXXXX`).
- **Mis citas**: ver, filtrar y **cancelar** citas (el cupo se libera al cancelar).
- **Toda la información se guarda en archivos planos** dentro de `/data`.

Se conserva íntegramente el sistema de diseño del Sprint 1 (colores teal/coral,
tipografías Fraunces + Manrope y todos los componentes).

---

## 🚀 Cómo ejecutarlo

Requisito: tener **Node.js 18 o superior** instalado.

```bash
# 1. Entrar a la carpeta del proyecto
cd medicitas

# 2. Instalar dependencias (solo la primera vez)
npm install

# 3. Iniciar el servidor
npm start
```

Luego abre en tu navegador:

```
http://localhost:3000
```

### 👤 Cuenta de prueba

| Correo                     | Contraseña      |
|----------------------------|-----------------|
| maria.gomez@correo.com     | Medicitas2026   |

También puedes crear una cuenta nueva desde la pantalla de **Registro**.

---

## 📁 Estructura del proyecto

```
medicitas/
├── server.js              # Servidor Express + API REST
├── package.json
├── data/                  # ARCHIVOS PLANOS (la "base de datos")
│   ├── usuarios.json
│   ├── citas.json
│   ├── medicos.json
│   └── especialidades.json
└── public/                # Frontend
    ├── index.html         # Las 10 pantallas
    ├── styles.css         # Sistema de diseño (conservado del Sprint 1)
    └── app.js             # Lógica funcional (consume la API)
```

---

## 🔌 API REST (resumen)

| Método | Ruta                                | Descripción                         |
|--------|-------------------------------------|-------------------------------------|
| GET    | `/api/especialidades`               | Lista de especialidades             |
| GET    | `/api/medicos?especialidad=ID`      | Médicos por especialidad            |
| GET    | `/api/disponibilidad?medicoId&fecha`| Cupos libres/ocupados de un día     |
| POST   | `/api/registro`                     | Crear cuenta                        |
| POST   | `/api/login`                        | Iniciar sesión                      |
| GET    | `/api/citas?usuarioId=ID`           | Citas de un usuario                 |
| POST   | `/api/citas`                        | Agendar una cita                    |
| PATCH  | `/api/citas/:id/cancelar`           | Cancelar una cita                   |

Todos los cambios se escriben directamente en los archivos `.json` de `/data`,
de modo que **los datos sobreviven al reinicio del servidor**.

---

## 🧪 Navegación del prototipo

La barra superior negra permite saltar entre las 10 pantallas para revisión.
También puedes navegar con las flechas ← → del teclado.
En uso real, el flujo natural es: Landing → Registro/Login → Dashboard →
Especialidades → Médicos → Calendario → Resumen → Confirmación → Mis citas.
