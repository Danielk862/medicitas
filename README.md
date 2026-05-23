# MediCitas — Prototipo Funcional (Sprint 2)

Plataforma de reservas de citas médicas en línea. Este es el **producto final
del Sprint 2**: una evolución del mockup no funcional del Sprint 1 a una
aplicación **completamente funcional**, con persistencia real de datos en
**archivos planos JSON** (sin base de datos).

---

## ✅ ¿Qué hace?

Cubre las historias de usuario de los **Sprints 1 y 2**:

**Sprint 1 — Flujo del paciente**
- **HU-01 Registro** e **HU-02 Inicio de sesión** con validación.
- **HU-03 Especialidades** e **HU-04 Médicos** por especialidad.
- **HU-05 Agendamiento** con calendario y disponibilidad real.
- **HU-06 Confirmación** con código de reserva único (`MED-2026-XXXXX`).

**Sprint 2 — Gestión completa de citas**
- **HU-07 Cancelación**: cancela una cita y libera el cupo del médico.
- **HU-05B Revisión previa**: pantalla de resumen editable antes de confirmar.
- **HU-08 Reprogramación**: cambia fecha/hora de una cita sin perder la reserva.
- **HU-09 Historial**: vista "Mis citas" con pestañas Próximas / Pasadas / Canceladas.
- **HU-10 Gestión de agenda médica**: el médico configura las franjas que atiende por día; el calendario del paciente solo muestra esas horas.
- **HU-11 Panel del médico**: agenda del día y configuración de disponibilidad.
- **HU-18 Búsqueda**: buscador de especialidades por nombre (insensible a tildes).

Toda la información se guarda en **archivos planos JSON** dentro de `/data`.
Se conserva íntegramente el sistema de diseño del Sprint 1.


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

### 👤 Cuentas de prueba

Contraseña para todas las cuentas: **`Medicitas2026`**

**Paciente**

| Correo                   |
|--------------------------|
| maria.gomez@correo.com   |

**Médicos** (13 cuentas)

| Nombre                  | Especialidad       | Correo                              |
|-------------------------|--------------------|-------------------------------------|
| Dra. Laura Restrepo     | Cardiología        | laura.restrepo@medicitas.com        |
| Dr. Carlos Mejía        | Cardiología        | carlos.mejia@medicitas.com          |
| Dra. Ana Salazar        | Cardiología        | ana.salazar@medicitas.com           |
| Dr. Julián Bedoya       | Cardiología        | julian.bedoya@medicitas.com         |
| Dra. Marcela Patiño     | Oftalmología       | marcela.patino@medicitas.com        |
| Dr. Ricardo Henao       | Oftalmología       | ricardo.henao@medicitas.com         |
| Dra. Valentina Torres   | Dermatología       | valentina.torres@medicitas.com      |
| Dr. Daniel Ospina       | Dermatología       | daniel.ospina@medicitas.com         |
| Dr. Luis Gaviria        | Neurología         | luis.gaviria@medicitas.com          |
| Dra. Sara Cardona       | Pediatría          | sara.cardona@medicitas.com          |
| Dr. Felipe Arango       | Medicina interna   | felipe.arango@medicitas.com         |
| Dra. Carolina Gil       | Ginecología        | carolina.gil@medicitas.com          |
| Dr. Andrés Vélez        | Ortopedia          | andres.velez@medicitas.com          |

Al iniciar sesión debes elegir el **tipo de perfil**:
- **Paciente**: agenda, reprograma, cancela y consulta el historial de sus citas.
- **Médico**: solo ve y configura **su propia** disponibilidad y su agenda del día.

También puedes crear una cuenta nueva desde la pantalla de **Registro** eligiendo el tipo de perfil.

---

## 📁 Estructura del proyecto

```
medicitas/
├── server.js              # Servidor Express + API REST
├── package.json
├── data/                  # ARCHIVOS PLANOS (la "base de datos")
│   ├── usuarios.json
│   ├── citas.json
│   ├── agendas.json       # HU-10: franjas configuradas por médico
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
| PATCH  | `/api/citas/:id/cancelar`           | Cancelar una cita (HU-07)           |
| PATCH  | `/api/citas/:id/reprogramar`        | Reprogramar una cita (HU-08)        |
| GET    | `/api/medicos/:id/citas?fecha=`     | Citas de un médico (HU-11)          |
| GET    | `/api/agenda/:medicoId`             | Leer agenda del médico (HU-10)      |
| PUT    | `/api/agenda/:medicoId`             | Guardar agenda del médico (HU-10)   |

Todos los cambios se escriben directamente en los archivos `.json` de `/data`,
de modo que **los datos sobreviven al reinicio del servidor**.

---

## 🧪 Navegación del prototipo

La barra superior negra permite saltar entre las 10 pantallas para revisión.
También puedes navegar con las flechas ← → del teclado.
En uso real, el flujo natural es: Landing → Registro/Login → Dashboard →
Especialidades → Médicos → Calendario → Resumen → Confirmación → Mis citas.
