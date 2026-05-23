/* =====================================================================
   MediCitas · Sprint 2 — Servidor backend
   ---------------------------------------------------------------------
   Prototipo FUNCIONAL. Toda la información se persiste en ARCHIVOS PLANOS
   (JSON) dentro de la carpeta /data. No requiere base de datos externa.
   ===================================================================== */

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
const PUBLIC_DIR = path.join(__dirname, 'public');

app.use(express.json());
app.use(express.static(PUBLIC_DIR));

/* ------------------------------------------------------------------ */
/*  Utilidades de lectura/escritura de archivos planos                 */
/* ------------------------------------------------------------------ */
function leer(archivo) {
  const ruta = path.join(DATA_DIR, archivo);
  try {
    return JSON.parse(fs.readFileSync(ruta, 'utf8'));
  } catch (e) {
    return [];
  }
}

function escribir(archivo, datos) {
  const ruta = path.join(DATA_DIR, archivo);
  fs.writeFileSync(ruta, JSON.stringify(datos, null, 2), 'utf8');
}

/* Genera código de reserva tipo MED-2026-XXXXX */
function generarCodigo() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `MED-${new Date().getFullYear()}-${s}`;
}

/* ================================================================== */
/*  CATÁLOGOS                                                          */
/* ================================================================== */

app.get('/api/especialidades', (req, res) => {
  res.json(leer('especialidades.json'));
});

app.get('/api/medicos', (req, res) => {
  let medicos = leer('medicos.json');
  const { especialidad } = req.query;
  if (especialidad) {
    medicos = medicos.filter(m => m.especialidadId === especialidad);
  }
  res.json(medicos);
});

app.get('/api/medicos/:id', (req, res) => {
  const medico = leer('medicos.json').find(m => m.id === req.params.id);
  if (!medico) return res.status(404).json({ error: 'Médico no encontrado' });
  res.json(medico);
});

/* ================================================================== */
/*  DISPONIBILIDAD                                                     */
/*  Genera dinámicamente cupos por médico+fecha y marca como ocupados  */
/*  los que ya tengan una cita en citas.json (persistencia real).      */
/* ================================================================== */

const HORARIOS_MANANA = ['8:00 AM', '8:30 AM', '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM'];
const HORARIOS_TARDE  = ['2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM', '5:00 PM', '5:30 PM'];

/* "Ocupados base" deterministas por médico para que el calendario no quede vacío */
function ocupadosBase(medicoId, fecha) {
  const semilla = (medicoId + fecha).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const todos = [...HORARIOS_MANANA, ...HORARIOS_TARDE];
  const ocupados = [];
  for (let i = 0; i < todos.length; i++) {
    if ((semilla + i * 7) % 3 === 0) ocupados.push(todos[i]);
  }
  return ocupados;
}

app.get('/api/disponibilidad', (req, res) => {
  const { medicoId, fecha } = req.query;
  if (!medicoId || !fecha) {
    return res.status(400).json({ error: 'medicoId y fecha son requeridos' });
  }

  const citas = leer('citas.json');
  const citasDia = citas.filter(c => c.medicoId === medicoId && c.fecha === fecha);

  /* Horarios ocupados por citas activas (confirmadas o reprogramadas) */
  const ocupadosPorCitas = citasDia.filter(c => c.estado !== 'cancelada').map(c => c.hora);

  /* Horarios que tuvieron una cita CANCELADA: se liberan explícitamente,
     incluso si pertenecían a los "ocupados base". Así cancelar SIEMPRE libera. */
  const liberados = new Set(citasDia.filter(c => c.estado === 'cancelada').map(c => c.hora));

  const ocupados = new Set([
    ...ocupadosBase(medicoId, fecha).filter(h => !liberados.has(h)),
    ...ocupadosPorCitas
  ]);

  /* HU-10: si el médico configuró su agenda, solo se ofrecen las franjas
     que él habilitó para ese día de la semana. */
  const agendas = leer('agendas.json');
  const agendaMed = (!Array.isArray(agendas) && agendas[medicoId]) ? agendas[medicoId] : null;
  let habilitadas = null;
  if (agendaMed) {
    const [y, m, d] = fecha.split('-').map(Number);
    const diaSemana = DIAS_SEMANA[new Date(y, m - 1, d).getDay()];
    habilitadas = new Set(agendaMed[diaSemana] || []);
  }

  const construir = (lista) => lista
    .filter(hora => habilitadas === null || habilitadas.has(hora))
    .map(hora => ({ hora, estado: ocupados.has(hora) ? 'ocupado' : 'disponible' }));

  const manana = construir(HORARIOS_MANANA);
  const tarde = construir(HORARIOS_TARDE);

  res.json({
    fecha,
    medicoId,
    agendaConfigurada: agendaMed !== null,
    manana,
    tarde
  });
});

/* ================================================================== */
/*  AUTENTICACIÓN (registro / login)                                   */
/* ================================================================== */

app.post('/api/registro', (req, res) => {
  const { nombre, apellido, identificacion, telefono, email, password, tipo, medicoId, especialidad } = req.body;

  if (!nombre || !apellido || !email || !password) {
    return res.status(400).json({ error: 'Faltan campos obligatorios.' });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ error: 'El correo electrónico no es válido.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
  }

  const perfil = tipo === 'medico' ? 'medico' : 'paciente';

  const usuarios = leer('usuarios.json');
  if (usuarios.some(u => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(409).json({ error: 'Ya existe una cuenta con este correo.' });
  }

  const nuevo = {
    id: 'u-' + Date.now(),
    nombre, apellido,
    identificacion: identificacion || '',
    telefono: telefono || '',
    email,
    password,
    tipo: perfil,
    medicoId: perfil === 'medico' ? (medicoId || null) : null,
    especialidad: perfil === 'medico' ? (especialidad || null) : null,
    creadoEn: new Date().toISOString()
  };
  usuarios.push(nuevo);
  escribir('usuarios.json', usuarios);

  const { password: _, ...sinPass } = nuevo;
  res.status(201).json({ usuario: sinPass });
});

app.post('/api/login', (req, res) => {
  const { email, password, tipo } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Ingresa tu correo y contraseña.' });
  }

  const usuarios = leer('usuarios.json');
  const usuario = usuarios.find(u => u.email.toLowerCase() === email.toLowerCase());

  if (!usuario || usuario.password !== password) {
    return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
  }

  /* El tipo de perfil elegido debe coincidir con el de la cuenta */
  const perfilUsuario = usuario.tipo || 'paciente';
  if (tipo && tipo !== perfilUsuario) {
    const otro = perfilUsuario === 'medico' ? 'médico' : 'paciente';
    return res.status(403).json({ error: `Esta cuenta es de tipo ${otro}. Selecciona el perfil correcto.` });
  }

  const { password: _, ...sinPass } = usuario;
  res.json({ usuario: sinPass });
});

/* ================================================================== */
/*  CITAS (crear, listar, cancelar)                                    */
/* ================================================================== */

app.get('/api/citas', (req, res) => {
  const { usuarioId } = req.query;
  let citas = leer('citas.json');
  if (usuarioId) citas = citas.filter(c => c.usuarioId === usuarioId);
  /* Orden por fecha ascendente */
  citas.sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
  res.json(citas);
});

app.post('/api/citas', (req, res) => {
  const { usuarioId, medicoId, fecha, hora, modalidad } = req.body;

  if (!usuarioId || !medicoId || !fecha || !hora) {
    return res.status(400).json({ error: 'Faltan datos de la cita.' });
  }

  const medico = leer('medicos.json').find(m => m.id === medicoId);
  if (!medico) return res.status(404).json({ error: 'Médico no encontrado.' });

  const citas = leer('citas.json');

  /* Evita doble reserva del mismo cupo del médico */
  const ocupado = citas.some(c =>
    c.medicoId === medicoId && c.fecha === fecha && c.hora === hora && c.estado !== 'cancelada'
  );
  if (ocupado) {
    return res.status(409).json({ error: 'Ese horario ya fue reservado. Elige otro.' });
  }

  /* Avisa si el USUARIO ya tiene otra cita el mismo día a la misma hora
     (choque en su propia agenda, aunque sea con otro médico). */
  const choque = citas.find(c =>
    c.usuarioId === usuarioId && c.fecha === fecha && c.hora === hora && c.estado !== 'cancelada'
  );
  if (choque) {
    return res.status(409).json({
      code: 'conflicto-agenda',
      error: `Ya tienes una cita ese día a las ${hora} con ${choque.medicoNombre} (${choque.especialidad}). Elige otro horario.`,
      conflicto: {
        id: choque.id,
        medicoNombre: choque.medicoNombre,
        especialidad: choque.especialidad,
        fecha: choque.fecha,
        hora: choque.hora
      }
    });
  }

  const nueva = {
    id: generarCodigo(),
    usuarioId,
    medicoId,
    medicoNombre: medico.nombre,
    medicoIniciales: medico.iniciales,
    especialidad: medico.especialidad,
    universidad: medico.universidad,
    experiencia: medico.experiencia,
    fecha,
    hora,
    duracion: 30,
    modalidad: modalidad || 'Presencial',
    sede: medico.sede,
    direccion: medico.direccion,
    precio: medico.precio,
    estado: 'confirmada',
    creadoEn: new Date().toISOString()
  };

  citas.push(nueva);
  escribir('citas.json', citas);

  res.status(201).json({ cita: nueva });
});

app.patch('/api/citas/:id/cancelar', (req, res) => {
  const citas = leer('citas.json');
  const cita = citas.find(c => c.id === req.params.id);
  if (!cita) return res.status(404).json({ error: 'Cita no encontrada.' });

  cita.estado = 'cancelada';
  cita.canceladoEn = new Date().toISOString();
  escribir('citas.json', citas);

  res.json({ cita });
});

/* HU-08 — Reprogramación de cita: cambia fecha/hora sin perder la reserva */
app.patch('/api/citas/:id/reprogramar', (req, res) => {
  const { fecha, hora } = req.body;
  if (!fecha || !hora) {
    return res.status(400).json({ error: 'Debes indicar la nueva fecha y hora.' });
  }

  const citas = leer('citas.json');
  const cita = citas.find(c => c.id === req.params.id);
  if (!cita) return res.status(404).json({ error: 'Cita no encontrada.' });
  if (cita.estado === 'cancelada') {
    return res.status(409).json({ error: 'No se puede reprogramar una cita cancelada.' });
  }

  /* El cupo destino del médico no puede estar ocupado por otra cita */
  const ocupado = citas.some(c =>
    c.id !== cita.id && c.medicoId === cita.medicoId && c.fecha === fecha &&
    c.hora === hora && c.estado !== 'cancelada'
  );
  if (ocupado) {
    return res.status(409).json({ error: 'Ese horario ya fue reservado. Elige otro.' });
  }

  /* El paciente no puede tener otra cita el mismo día y hora */
  const choque = citas.find(c =>
    c.id !== cita.id && c.usuarioId === cita.usuarioId && c.fecha === fecha &&
    c.hora === hora && c.estado !== 'cancelada'
  );
  if (choque) {
    return res.status(409).json({
      code: 'conflicto-agenda',
      error: `Ya tienes otra cita ese día a las ${hora} con ${choque.medicoNombre}. Elige otro horario.`
    });
  }

  cita.fechaAnterior = cita.fecha;
  cita.horaAnterior = cita.hora;
  cita.fecha = fecha;
  cita.hora = hora;
  cita.estado = 'reprogramada';
  cita.reprogramadoEn = new Date().toISOString();
  escribir('citas.json', citas);

  res.json({ cita });
});

/* ================================================================== */
/*  HU-11 — Citas de un médico (panel del médico)                      */
/* ================================================================== */
app.get('/api/medicos/:id/citas', (req, res) => {
  const { fecha } = req.query;
  let citas = leer('citas.json').filter(c => c.medicoId === req.params.id && c.estado !== 'cancelada');
  if (fecha) citas = citas.filter(c => c.fecha === fecha);
  citas.sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
  res.json(citas);
});

/* ================================================================== */
/*  HU-10 — Gestión de agenda médica                                   */
/*  Cada médico configura qué franjas atiende por día de la semana.    */
/*  Se persiste en agendas.json: { medicoId: { dia: [horas] } }        */
/* ================================================================== */
const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

app.get('/api/agenda/:medicoId', (req, res) => {
  const agendas = leer('agendas.json');
  const agenda = (Array.isArray(agendas) ? {} : agendas)[req.params.medicoId];
  res.json({ medicoId: req.params.medicoId, agenda: agenda || null });
});

app.put('/api/agenda/:medicoId', (req, res) => {
  const { agenda } = req.body;
  if (!agenda || typeof agenda !== 'object') {
    return res.status(400).json({ error: 'Agenda inválida.' });
  }
  let agendas = leer('agendas.json');
  if (Array.isArray(agendas)) agendas = {};
  agendas[req.params.medicoId] = agenda;
  escribir('agendas.json', agendas);
  res.json({ medicoId: req.params.medicoId, agenda });
});

/* ================================================================== */
/*  Fallback al index para rutas del frontend                          */
/* ================================================================== */
app.get('*', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n  🩺  MediCitas Sprint 2 corriendo en  http://localhost:${PORT}\n`);
  console.log('  Datos persistidos en archivos planos: ./data/*.json');
  console.log('  Usuario de prueba:  maria.gomez@correo.com  /  Medicitas2026\n');
});
