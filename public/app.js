/* =====================================================================
   MediCitas · Sprint 2 — Lógica del frontend (app.js)
   Prototipo FUNCIONAL: consume la API REST del servidor, que persiste
   todo en archivos planos JSON (/data).
   ===================================================================== */

/* ------------------------------------------------------------------ */
/*  Estado global de la aplicación                                     */
/* ------------------------------------------------------------------ */
const App = {
  usuario: null,            // usuario en sesión
  especialidadActual: null, // {id, nombre}
  medicoActual: null,       // objeto médico
  seleccion: {              // selección de agendamiento en curso
    fecha: null,
    fechaTexto: null,
    hora: null
  }
};

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DIAS_LARGO = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_CORTO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/* ------------------------------------------------------------------ */
/*  Utilidades                                                         */
/* ------------------------------------------------------------------ */
async function api(url, opciones = {}) {
  const resp = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...opciones
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const err = new Error(data.error || 'Error de servidor');
    err.code = data.code;
    err.data = data;
    throw err;
  }
  return data;
}

function fmtPrecio(n) {
  return '$' + n.toLocaleString('es-CO') + ' COP';
}

function fmtFechaLarga(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const fecha = new Date(y, m - 1, d);
  return `${DIAS_LARGO[fecha.getDay()].charAt(0).toUpperCase() + DIAS_LARGO[fecha.getDay()].slice(1)}, ${d} de ${MESES[m - 1]} de ${y}`;
}

function fmtFechaCorta(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const fecha = new Date(y, m - 1, d);
  return `${DIAS[fecha.getDay()]}, ${d} ${MESES_CORTO[m - 1]} ${y}`;
}

function toast(titulo, texto, tipo = 'info') {
  const stack = document.getElementById('toast-stack');
  const el = document.createElement('div');
  el.className = `toast toast--${tipo}`;
  const iconos = {
    ok: '<svg width="20" height="20" fill="none" stroke="var(--green-600)" stroke-width="2.5"><polyline points="17 5 8 15 3 10"/></svg>',
    err: '<svg width="20" height="20" fill="none" stroke="var(--red-600)" stroke-width="2.5"><circle cx="10" cy="10" r="8"/><line x1="10" y1="6" x2="10" y2="11"/><line x1="10" y1="14" x2="10" y2="14"/></svg>',
    info: '<svg width="20" height="20" fill="none" stroke="var(--teal-600)" stroke-width="2.5"><circle cx="10" cy="10" r="8"/><line x1="10" y1="9" x2="10" y2="14"/><line x1="10" y1="6" x2="10" y2="6"/></svg>'
  };
  el.innerHTML = `<div class="toast__icon">${iconos[tipo] || iconos.info}</div>
    <div><div class="toast__title">${titulo}</div><div class="toast__text">${texto}</div></div>`;
  stack.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(40px)'; }, 4000);
  setTimeout(() => el.remove(), 4400);
}

function mostrarMensaje(id, texto, tipo) {
  const el = document.getElementById(id);
  el.textContent = texto;
  el.className = `form-msg show form-msg--${tipo}`;
}
function ocultarMensaje(id) {
  document.getElementById(id).className = 'form-msg';
}

function setLoadingBtn(btn, cargando, textoOriginal) {
  if (cargando) {
    btn.dataset.original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';
  } else {
    btn.disabled = false;
    btn.innerHTML = textoOriginal || btn.dataset.original;
  }
}

/* Confirmación con modal (devuelve Promise<boolean>) */
function confirmar(titulo, texto) {
  return new Promise(resolve => {
    const modal = document.getElementById('modal');
    document.getElementById('modal-title').textContent = titulo;
    document.getElementById('modal-text').textContent = texto;
    modal.classList.add('show');
    const ok = document.getElementById('modal-ok');
    const cancel = document.getElementById('modal-cancel');
    const cerrar = (val) => {
      modal.classList.remove('show');
      ok.onclick = null; cancel.onclick = null;
      resolve(val);
    };
    ok.onclick = () => cerrar(true);
    cancel.onclick = () => cerrar(false);
  });
}

/* ------------------------------------------------------------------ */
/*  Sesión (persistida en sessionStorage solo como referencia de UI;  */
/*  los DATOS viven en los archivos planos del servidor)              */
/* ------------------------------------------------------------------ */
function guardarSesion(usuario) {
  App.usuario = usuario;
  try { sessionStorage.setItem('medicitas_user', JSON.stringify(usuario)); } catch (e) {}
}
function cargarSesion() {
  try {
    const u = sessionStorage.getItem('medicitas_user');
    if (u) App.usuario = JSON.parse(u);
  } catch (e) {}
}
function cerrarSesion() {
  App.usuario = null;
  try { sessionStorage.removeItem('medicitas_user'); } catch (e) {}
  showScreen(1);
  toast('Sesión cerrada', 'Has salido de tu cuenta correctamente.', 'info');
}

function iniciales(usuario) {
  return ((usuario.nombre || '?')[0] + (usuario.apellido || '')[0]).toUpperCase();
}

/* ------------------------------------------------------------------ */
/*  Cabecera de la app (se inyecta en todas las pantallas internas)   */
/* ------------------------------------------------------------------ */
function renderHeaders(activo) {
  const u = App.usuario || { nombre: 'Invitado', apellido: '' };
  const nav = [
    { label: 'Inicio', go: 4 },
    { label: 'Especialidades', go: 5 },
    { label: 'Mis citas', go: 10 },
    { label: 'Perfil', go: 4 }
  ];
  document.querySelectorAll('[data-app-header]').forEach(header => {
    header.innerHTML = `
      <div class="app-logo">
        <div class="app-logo__mark">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-5 8-12V5l-8-3-8 3v5c0 7 8 12 8 12z"/><path d="M12 8v8M8 12h8"/></svg>
        </div>
        Medi<em>Citas</em>
      </div>
      <div class="app-nav">
        ${nav.map(n => `<a class="app-nav__item ${n.label === activo ? 'active' : ''}" data-go="${n.go}">${n.label}</a>`).join('')}
      </div>
      <div class="app-user">
        <div class="app-user__avatar">${iniciales(u)}</div>
        <div class="app-user__name">${u.nombre} ${(u.apellido || '').charAt(0)}.</div>
        <button class="btn btn--ghost" style="margin-left:10px;padding:8px 12px" onclick="cerrarSesion()">Salir</button>
      </div>`;
  });
}

/* ------------------------------------------------------------------ */
/*  Navegación entre pantallas                                         */
/* ------------------------------------------------------------------ */
const SCREEN_TITLES = { 4: 'Inicio', 5: 'Especialidades', 6: 'Especialidades', 7: 'Especialidades', 8: 'Especialidades', 9: 'Inicio', 10: 'Mis citas' };

function requiereSesion(num) {
  return num >= 4 && !App.usuario;
}

function showScreen(num) {
  num = parseInt(num);

  if (requiereSesion(num)) {
    toast('Inicia sesión', 'Debes iniciar sesión para continuar.', 'info');
    num = 3;
  }

  document.querySelectorAll('.screen-wrap').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + num)?.classList.add('active');
  document.querySelectorAll('.proto-bar__btn').forEach(b => {
    b.classList.toggle('active', b.dataset.go === String(num));
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (num >= 4) renderHeaders(SCREEN_TITLES[num] || '');

  /* Cargar datos según la pantalla */
  if (num === 4) cargarDashboard();
  if (num === 5) cargarEspecialidades();
  if (num === 6) cargarMedicos();
  if (num === 7) cargarCalendario();
  if (num === 8) renderResumen();
  if (num === 10) cargarMisCitas();
}

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-go]');
  if (!t) return;
  e.preventDefault();
  showScreen(t.dataset.go);
});

document.addEventListener('keydown', (e) => {
  if (e.target.matches('input, textarea')) return;
  const active = document.querySelector('.screen-wrap.active');
  if (!active) return;
  const current = parseInt(active.id.replace('screen-', ''));
  if (e.key === 'ArrowRight' && current < 10) showScreen(current + 1);
  if (e.key === 'ArrowLeft' && current > 1) showScreen(current - 1);
});

/* ================================================================== */
/*  REGISTRO                                                           */
/* ================================================================== */
document.getElementById('reg-password').addEventListener('input', function () {
  const v = this.value;
  const fuerza = (v.length >= 8 ? 1 : 0) + (/[A-Z]/.test(v) ? 1 : 0) + (/[0-9]/.test(v) ? 1 : 0);
  const strength = document.getElementById('reg-strength');
  strength.className = 'password-strength ' + (fuerza >= 3 ? 'strong' : fuerza === 2 ? 'medium' : 'weak');
});

document.getElementById('reg-submit').addEventListener('click', async function () {
  ocultarMensaje('reg-msg');
  const body = {
    nombre: document.getElementById('reg-nombre').value.trim(),
    apellido: document.getElementById('reg-apellido').value.trim(),
    identificacion: document.getElementById('reg-identificacion').value.trim(),
    telefono: document.getElementById('reg-telefono').value.trim(),
    email: document.getElementById('reg-email').value.trim(),
    password: document.getElementById('reg-password').value
  };

  if (!body.nombre || !body.apellido || !body.email || !body.password) {
    return mostrarMensaje('reg-msg', 'Completa todos los campos obligatorios.', 'err');
  }
  if (!document.getElementById('reg-terms').checked) {
    return mostrarMensaje('reg-msg', 'Debes aceptar los términos y la política de privacidad.', 'err');
  }
  if (body.password.length < 8) {
    return mostrarMensaje('reg-msg', 'La contraseña debe tener al menos 8 caracteres.', 'err');
  }

  setLoadingBtn(this, true);
  try {
    const { usuario } = await api('/api/registro', { method: 'POST', body: JSON.stringify(body) });
    guardarSesion(usuario);
    toast('¡Cuenta creada!', `Bienvenida, ${usuario.nombre}. Tu cuenta quedó guardada.`, 'ok');
    setLoadingBtn(this, false);
    showScreen(4);
  } catch (err) {
    setLoadingBtn(this, false);
    mostrarMensaje('reg-msg', err.message, 'err');
  }
});

/* ================================================================== */
/*  LOGIN                                                              */
/* ================================================================== */
document.getElementById('login-submit').addEventListener('click', async function () {
  ocultarMensaje('login-msg');
  const body = {
    email: document.getElementById('login-email').value.trim(),
    password: document.getElementById('login-password').value
  };
  if (!body.email || !body.password) {
    return mostrarMensaje('login-msg', 'Ingresa tu correo y contraseña.', 'err');
  }

  setLoadingBtn(this, true);
  try {
    const { usuario } = await api('/api/login', { method: 'POST', body: JSON.stringify(body) });
    guardarSesion(usuario);
    toast('Bienvenido', `Hola de nuevo, ${usuario.nombre}.`, 'ok');
    setLoadingBtn(this, false);
    showScreen(4);
  } catch (err) {
    setLoadingBtn(this, false);
    mostrarMensaje('login-msg', err.message, 'err');
  }
});

document.getElementById('login-google').addEventListener('click', () => {
  toast('No disponible', 'El inicio con Google es solo demostrativo en este prototipo.', 'info');
});

/* ================================================================== */
/*  DASHBOARD                                                          */
/* ================================================================== */
async function cargarDashboard() {
  const cont = document.getElementById('dash-content');
  const u = App.usuario;
  try {
    const citas = await api(`/api/citas?usuarioId=${encodeURIComponent(u.id)}`);
    const activas = citas.filter(c => c.estado === 'confirmada');
    const proxima = activas[0];

    const hora = new Date().getHours();
    const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';

    let proximaHTML;
    if (proxima) {
      const [y, m, d] = proxima.fecha.split('-').map(Number);
      proximaHTML = `
        <div class="next-appt">
          <div class="next-appt__date">
            <div class="next-appt__day">${d}</div>
            <div class="next-appt__month">${MESES_CORTO[m - 1]}</div>
          </div>
          <div class="next-appt__info">
            <div class="next-appt__doctor">${proxima.medicoNombre}</div>
            <div class="next-appt__spec">${proxima.especialidad} · Consulta general</div>
            <div class="next-appt__meta">
              <div><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="7" cy="7" r="6"/><path d="M7 3v4l3 2"/></svg> ${proxima.hora}</div>
              <div><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s-8-7-8-13a8 8 0 1116 0c0 6-8 13-8 13z"/><circle cx="12" cy="9" r="3"/></svg> Sede ${proxima.sede}</div>
              <div><span class="badge badge--green">Confirmada</span></div>
            </div>
          </div>
        </div>`;
    } else {
      proximaHTML = `<div class="empty-state" style="padding:30px 10px">
        <div class="empty-state__icon"><svg width="32" height="32" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="6" width="24" height="22" rx="3"/><line x1="22" y1="3" x2="22" y2="9"/><line x1="10" y1="3" x2="10" y2="9"/></svg></div>
        <h3>No tienes citas próximas</h3>
        <p>Agenda tu primera cita para empezar a cuidar tu salud.</p>
        <button class="btn btn--coral btn--lg" data-go="5">Agendar cita</button>
      </div>`;
    }

    cont.innerHTML = `
      <div class="dash-hero">
        <div>
          <div class="dash-hero__greeting">${saludo}</div>
          <h1 class="dash-hero__title">Hola, <em>${u.nombre}</em>. ¿Cómo te sientes hoy?</h1>
          <p class="dash-hero__sub">${proxima ? 'Tienes una cita próxima. Aprovecha para preparar tus preguntas para el especialista.' : 'Agenda una cita con nuestros especialistas en pocos pasos.'}</p>
        </div>
        <div class="dash-hero__action">
          <button class="btn btn--coral btn--lg" data-go="5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Agendar nueva cita
          </button>
        </div>
      </div>
      <div class="dash-grid">
        <div>
          <div class="panel">
            <div class="panel__head">
              <h2 class="panel__title">Próxima cita</h2>
              <a class="panel__link" data-go="10">Ver todas →</a>
            </div>
            ${proximaHTML}
            <div class="quick-actions">
              <button class="quick-action" data-go="5">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 2"/></svg>
                <h5>Agendar cita</h5><p>Encuentra tu próximo especialista</p>
              </button>
              <button class="quick-action" data-go="10">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                <h5>Mis citas</h5><p>Revisa o cancela</p>
              </button>
              <button class="quick-action" data-go="10">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                <h5>Historial</h5><p>Documentos y resultados</p>
              </button>
            </div>
          </div>
        </div>
        <div>
          <div class="panel">
            <div class="panel__head"><h2 class="panel__title">Resumen</h2></div>
            <div class="stat-card stat-card--teal">
              <div class="stat-card__icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--teal-700)" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/></svg></div>
              <div><div class="stat-card__num">${activas.length}</div><div class="stat-card__label">${activas.length === 1 ? 'Cita programada' : 'Citas programadas'}</div></div>
            </div>
            <div class="stat-card stat-card--coral">
              <div class="stat-card__icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--coral-600)" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>
              <div><div class="stat-card__num">${citas.length}</div><div class="stat-card__label">Consultas en total</div></div>
            </div>
            <div class="stat-card stat-card--amber">
              <div class="stat-card__icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--amber-500)" stroke-width="2"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg></div>
              <div><div class="stat-card__num">100%</div><div class="stat-card__label">Tasa de asistencia</div></div>
            </div>
          </div>
        </div>
      </div>`;
  } catch (err) {
    cont.innerHTML = `<div class="empty-state"><h3>Error al cargar</h3><p>${err.message}</p></div>`;
  }
}

/* ================================================================== */
/*  ESPECIALIDADES                                                     */
/* ================================================================== */
let _especialidadesCache = [];

async function cargarEspecialidades() {
  const grid = document.getElementById('specs-grid');
  try {
    if (!_especialidadesCache.length) {
      _especialidadesCache = await api('/api/especialidades');
    }
    renderEspecialidades(_especialidadesCache);
  } catch (err) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><h3>Error</h3><p>${err.message}</p></div>`;
  }
}

function renderEspecialidades(lista) {
  const grid = document.getElementById('specs-grid');
  if (!lista.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><h3>Sin resultados</h3><p>No encontramos especialidades con ese nombre.</p></div>`;
    return;
  }
  grid.innerHTML = lista.map(e => `
    <div class="spec-card" data-spec="${e.id}" data-spec-nombre="${e.nombre}">
      <div class="spec-card__icon spec-card__icon--${e.icono}">
        <svg width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
      </div>
      <h3>${e.nombre}</h3>
      <p>${e.descripcion}</p>
      <div class="spec-card__foot">
        <span class="spec-card__count"><strong>${e.medicos}</strong> médicos</span>
        <div class="spec-card__arrow"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg></div>
      </div>
    </div>`).join('');

  grid.querySelectorAll('.spec-card').forEach(card => {
    card.addEventListener('click', () => {
      App.especialidadActual = { id: card.dataset.spec, nombre: card.dataset.specNombre };
      showScreen(6);
    });
  });
}

document.getElementById('spec-search').addEventListener('input', function () {
  const q = this.value.toLowerCase().trim();
  renderEspecialidades(_especialidadesCache.filter(e => e.nombre.toLowerCase().includes(q)));
});

/* ================================================================== */
/*  MÉDICOS                                                            */
/* ================================================================== */
async function cargarMedicos() {
  const grid = document.getElementById('docs-grid');
  const esp = App.especialidadActual;
  if (!esp) { showScreen(5); return; }

  document.getElementById('docs-bc-spec').textContent = esp.nombre;
  document.getElementById('docs-title-spec').textContent = esp.nombre;
  document.getElementById('cal-bc-spec').textContent = esp.nombre;

  grid.innerHTML = `<div class="loading-block" style="grid-column:1/-1"><span class="spinner"></span><div style="margin-top:12px">Cargando médicos…</div></div>`;

  try {
    const medicos = await api(`/api/medicos?especialidad=${encodeURIComponent(esp.id)}`);
    document.getElementById('docs-subtitle').textContent =
      `${medicos.length} médico${medicos.length !== 1 ? 's' : ''} disponible${medicos.length !== 1 ? 's' : ''} · Filtrados por mejor calificación y cupos disponibles esta semana`;

    if (!medicos.length) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><h3>Sin médicos</h3><p>No hay especialistas registrados para esta especialidad todavía.</p></div>`;
      return;
    }

    grid.innerHTML = medicos.map(m => `
      <div class="doc-card">
        <div class="doc-card__head">
          <div class="doc-card__avatar doc-card__avatar--${m.avatar}">${m.iniciales}</div>
          <div>
            <div class="doc-card__name">${m.nombre}</div>
            <div class="doc-card__role">${m.especialidad} · ${m.universidad}</div>
            <div class="doc-card__rating">
              <svg width="14" height="14" fill="currentColor"><polygon points="7,0 9,5 14,5 10,8 12,13 7,10 2,13 4,8 0,5 5,5"/></svg>
              <strong>${m.rating}</strong> <span>(${m.resenas} reseñas)</span>
            </div>
          </div>
        </div>
        <div class="doc-card__stats">
          <div class="doc-card__stat"><strong>${m.experiencia} años</strong>Experiencia</div>
          <div class="doc-card__stat"><strong>${fmtPrecio(m.precio).replace(' COP','')}</strong>Por consulta</div>
          <div class="doc-card__stat"><strong>${m.sede}</strong>Sede</div>
        </div>
        <div class="doc-card__actions">
          <button class="btn btn--secondary" style="flex: 1;">Ver perfil</button>
          <button class="btn btn--primary" style="flex: 1;" data-medico="${m.id}">Agendar cita</button>
        </div>
      </div>`).join('');

    grid.querySelectorAll('[data-medico]').forEach(btn => {
      btn.addEventListener('click', () => {
        App.medicoActual = medicos.find(m => m.id === btn.dataset.medico);
        App.seleccion = { fecha: null, fechaTexto: null, hora: null };
        showScreen(7);
      });
    });
  } catch (err) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><h3>Error</h3><p>${err.message}</p></div>`;
  }
}

document.querySelectorAll('#screen-6 .filter-pill').forEach(pill => {
  pill.addEventListener('click', function () {
    this.parentElement.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
    this.classList.add('active');
  });
});

/* ================================================================== */
/*  CALENDARIO Y DISPONIBILIDAD                                        */
/* ================================================================== */
let _calBaseDate = null; // primer día de la semana mostrada

function proximosDias(desde, n) {
  const dias = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(desde);
    d.setDate(desde.getDate() + i);
    dias.push(d);
  }
  return dias;
}

function isoLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function cargarCalendario() {
  const m = App.medicoActual;
  if (!m) { showScreen(5); return; }

  document.getElementById('cal-doc-avatar').textContent = m.iniciales;
  document.getElementById('cal-doc-name').textContent = m.nombre;
  document.getElementById('cal-doc-spec').textContent = `${m.especialidad} · Sede ${m.sede}`;

  if (!_calBaseDate) {
    _calBaseDate = new Date();
    _calBaseDate.setHours(0, 0, 0, 0);
  }
  renderSemana();

  /* Selecciona el primer día por defecto */
  const dias = proximosDias(_calBaseDate, 7);
  seleccionarDia(isoLocal(dias[0]), dias[0]);
}

function renderSemana() {
  const dias = proximosDias(_calBaseDate, 7);
  document.getElementById('cal-month').textContent =
    `${MESES[dias[0].getMonth()].charAt(0).toUpperCase() + MESES[dias[0].getMonth()].slice(1)} ${dias[0].getFullYear()}`;

  const week = document.getElementById('cal-week');
  week.innerHTML = dias.map(d => {
    const iso = isoLocal(d);
    const finde = d.getDay() === 0 || d.getDay() === 6;
    return `<div class="cal-day ${finde ? 'disabled' : ''} ${iso === App.seleccion.fecha ? 'selected' : ''}" data-iso="${iso}" data-dn="${d.getDate()}" data-dia="${DIAS[d.getDay()]}">
      <div class="cal-day__name">${DIAS[d.getDay()]}</div>
      <div class="cal-day__num">${d.getDate()}</div>
    </div>`;
  }).join('');

  week.querySelectorAll('.cal-day:not(.disabled)').forEach(el => {
    el.addEventListener('click', () => {
      const [y, mo, da] = el.dataset.iso.split('-').map(Number);
      seleccionarDia(el.dataset.iso, new Date(y, mo - 1, da));
    });
  });
}

document.getElementById('cal-prev').addEventListener('click', () => {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const prev = new Date(_calBaseDate); prev.setDate(prev.getDate() - 7);
  if (prev < hoy) { toast('No disponible', 'No puedes agendar en fechas pasadas.', 'info'); return; }
  _calBaseDate = prev; renderSemana();
  const dias = proximosDias(_calBaseDate, 7); seleccionarDia(isoLocal(dias[0]), dias[0]);
});
document.getElementById('cal-next').addEventListener('click', () => {
  _calBaseDate = new Date(_calBaseDate); _calBaseDate.setDate(_calBaseDate.getDate() + 7);
  renderSemana();
  const dias = proximosDias(_calBaseDate, 7); seleccionarDia(isoLocal(dias[0]), dias[0]);
});

async function seleccionarDia(iso, dateObj) {
  App.seleccion.fecha = iso;
  App.seleccion.fechaTexto = `${DIAS[dateObj.getDay()]} ${dateObj.getDate()} ${MESES_CORTO[dateObj.getMonth()]}`;
  App.seleccion.hora = null;

  document.querySelectorAll('#cal-week .cal-day').forEach(d => d.classList.toggle('selected', d.dataset.iso === iso));

  const am = document.getElementById('time-grid-am');
  const pm = document.getElementById('time-grid-pm');
  am.innerHTML = pm.innerHTML = '<span class="spinner" style="border-color:var(--ink-200);border-top-color:var(--teal-500)"></span>';

  try {
    const disp = await api(`/api/disponibilidad?medicoId=${encodeURIComponent(App.medicoActual.id)}&fecha=${iso}`);
    am.innerHTML = renderSlots(disp.manana);
    pm.innerHTML = renderSlots(disp.tarde);
    bindSlots();
    renderResumenLateral();
  } catch (err) {
    am.innerHTML = pm.innerHTML = `<div style="color:var(--red-600)">${err.message}</div>`;
  }
}

function renderSlots(slots) {
  return slots.map(s => {
    if (s.estado === 'ocupado') {
      return `<div class="time-slot time-slot--busy">${s.hora}</div>`;
    }
    return `<div class="time-slot time-slot--free" data-hora="${s.hora}">${s.hora}</div>`;
  }).join('');
}

function bindSlots() {
  document.querySelectorAll('#screen-7 .time-slot--free, #screen-7 .time-slot--selected').forEach(slot => {
    slot.addEventListener('click', function () {
      document.querySelectorAll('#screen-7 .time-slot--selected').forEach(s => {
        s.classList.remove('time-slot--selected'); s.classList.add('time-slot--free');
      });
      this.classList.remove('time-slot--free'); this.classList.add('time-slot--selected');
      App.seleccion.hora = this.dataset.hora;
      renderResumenLateral();
    });
  });
}

function renderResumenLateral() {
  const m = App.medicoActual;
  const s = App.seleccion;
  document.getElementById('cal-summary').innerHTML = `
    <div class="summary-row"><span>Médico</span><span>${m.nombre.replace('Dra. ', 'Dra. ').replace('Dr. ', 'Dr. ')}</span></div>
    <div class="summary-row"><span>Especialidad</span><span>${m.especialidad}</span></div>
    <div class="summary-row"><span>Fecha</span><span>${s.fechaTexto || '—'}</span></div>
    <div class="summary-row"><span>Hora</span><span>${s.hora || '—'}</span></div>
    <div class="summary-row"><span>Duración</span><span>30 minutos</span></div>
    <div class="summary-row"><span>Sede</span><span>${m.sede}</span></div>`;
}

document.getElementById('cal-continue').addEventListener('click', () => {
  if (!App.seleccion.fecha || !App.seleccion.hora) {
    toast('Selecciona un horario', 'Debes elegir un día y una hora disponibles.', 'info');
    return;
  }
  showScreen(8);
});

/* ================================================================== */
/*  RESUMEN PREVIO                                                     */
/* ================================================================== */
function renderResumen() {
  const m = App.medicoActual;
  const s = App.seleccion;
  const u = App.usuario;
  if (!m || !s.fecha || !s.hora) { showScreen(5); return; }

  document.getElementById('rev-avatar').textContent = m.iniciales;
  document.getElementById('rev-doctor').textContent = m.nombre;
  document.getElementById('rev-doctor-sub').textContent = `${m.especialidad} · ${m.experiencia} años de experiencia · ${m.universidad}`;
  document.getElementById('rev-fecha').textContent = fmtFechaLarga(s.fecha);
  document.getElementById('rev-hora').innerHTML = `${s.hora} <span style="font-size:12px;color:var(--ink-500);font-weight:500;margin-left:6px;">(30 minutos)</span>`;
  document.getElementById('rev-sede').textContent = `${m.sede} · ${m.direccion}`;
  document.getElementById('rev-paciente').textContent = `${u.nombre} ${u.apellido}${u.identificacion ? ' · CC ' + u.identificacion : ''}`;
  document.getElementById('rev-valor').textContent = fmtPrecio(m.precio);
}

document.getElementById('confirm-btn').addEventListener('click', async function () {
  const m = App.medicoActual;
  const s = App.seleccion;
  const u = App.usuario;

  setLoadingBtn(this, true);
  try {
    const { cita } = await api('/api/citas', {
      method: 'POST',
      body: JSON.stringify({
        usuarioId: u.id, medicoId: m.id, fecha: s.fecha, hora: s.hora, modalidad: 'Presencial'
      })
    });
    setLoadingBtn(this, false);
    renderConfirmacion(cita);
    toast('¡Cita confirmada!', `Tu reserva ${cita.id} quedó guardada.`, 'ok');
    showScreen(9);
  } catch (err) {
    setLoadingBtn(this, false);
    if (err.code === 'conflicto-agenda') {
      const c = err.data && err.data.conflicto;
      toast('Ya tienes una cita a esa hora',
        c ? `Tienes una cita a las ${c.hora} con ${c.medicoNombre} (${c.especialidad}) ese día. Elige otro horario.`
          : err.message,
        'err');
      showScreen(7);
      return;
    }
    toast('No se pudo agendar', err.message, 'err');
    if (err.message.includes('reservado')) showScreen(7);
  }
});

/* ================================================================== */
/*  CONFIRMACIÓN                                                       */
/* ================================================================== */
function renderConfirmacion(cita) {
  document.getElementById('conf-codigo').textContent = cita.id;
  document.getElementById('conf-avatar').textContent = cita.medicoIniciales;
  document.getElementById('conf-doctor').textContent = cita.medicoNombre;
  document.getElementById('conf-doctor-sub').textContent = `${cita.especialidad} · ${cita.experiencia} años de experiencia`;
  document.getElementById('conf-fecha').textContent = fmtFechaCorta(cita.fecha);
  document.getElementById('conf-hora').textContent = `${cita.hora} (${cita.duracion} min)`;
  document.getElementById('conf-sede').textContent = cita.sede;
  document.getElementById('conf-modalidad').textContent = cita.modalidad;
  document.getElementById('conf-mail').textContent = `Correo enviado a ${App.usuario.email}`;
}

/* ================================================================== */
/*  MIS CITAS                                                          */
/* ================================================================== */
let _misCitas = [];
let _filtroCitas = 'todas';

async function cargarMisCitas() {
  const cont = document.getElementById('appts-list');
  cont.innerHTML = `<div class="loading-block"><span class="spinner"></span><div style="margin-top:12px">Cargando tus citas…</div></div>`;
  try {
    _misCitas = await api(`/api/citas?usuarioId=${encodeURIComponent(App.usuario.id)}`);
    renderMisCitas();
  } catch (err) {
    cont.innerHTML = `<div class="empty-state"><h3>Error</h3><p>${err.message}</p></div>`;
  }
}

function renderMisCitas() {
  const cont = document.getElementById('appts-list');
  let lista = _misCitas;
  if (_filtroCitas !== 'todas') lista = lista.filter(c => c.estado === _filtroCitas);

  if (!lista.length) {
    cont.innerHTML = `<div class="empty-state">
      <div class="empty-state__icon"><svg width="32" height="32" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="6" width="24" height="22" rx="3"/><line x1="22" y1="3" x2="22" y2="9"/><line x1="10" y1="3" x2="10" y2="9"/></svg></div>
      <h3>No tienes citas ${_filtroCitas === 'todas' ? '' : _filtroCitas + 's'}</h3>
      <p>Cuando agendes una cita aparecerá aquí.</p>
      <button class="btn btn--coral btn--lg" data-go="5">Agendar una cita</button>
    </div>`;
    return;
  }

  cont.innerHTML = lista.map(c => {
    const [y, m, d] = c.fecha.split('-').map(Number);
    const cancelada = c.estado === 'cancelada';
    return `<div class="appt-item" style="${cancelada ? 'opacity:.65' : ''}">
      <div class="appt-item__date" style="${cancelada ? 'background:var(--ink-100);color:var(--ink-400)' : ''}">
        <div class="appt-item__day">${d}</div>
        <div class="appt-item__month">${MESES_CORTO[m - 1]}</div>
      </div>
      <div class="appt-item__info">
        <div class="appt-item__doctor">${c.medicoNombre}</div>
        <div class="appt-item__spec">${c.especialidad} · ${c.universidad}</div>
        <div class="appt-item__meta">
          <div><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="7" cy="7" r="6"/><path d="M7 3v4l3 2"/></svg> ${c.hora}</div>
          <div><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s-8-7-8-13a8 8 0 1116 0c0 6-8 13-8 13z"/><circle cx="12" cy="9" r="3"/></svg> ${c.sede}</div>
          <div><span class="badge badge--${cancelada ? 'red' : 'green'}">${cancelada ? 'Cancelada' : 'Confirmada'}</span></div>
          <div style="color:var(--ink-400)">${c.id}</div>
        </div>
      </div>
      <div class="appt-item__actions">
        ${cancelada ? '' : `<button class="btn btn--secondary" data-cancelar="${c.id}">Cancelar</button>`}
      </div>
    </div>`;
  }).join('');

  cont.querySelectorAll('[data-cancelar]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ok = await confirmar('Cancelar cita', '¿Seguro que deseas cancelar esta cita? Esta acción no se puede deshacer.');
      if (!ok) return;
      try {
        await api(`/api/citas/${btn.dataset.cancelar}/cancelar`, { method: 'PATCH' });
        toast('Cita cancelada', 'Tu cita fue cancelada y el cupo quedó liberado.', 'ok');
        cargarMisCitas();
      } catch (err) {
        toast('Error', err.message, 'err');
      }
    });
  });
}

document.querySelectorAll('#screen-10 .appt-tabs .filter-pill').forEach(pill => {
  pill.addEventListener('click', function () {
    document.querySelectorAll('#screen-10 .appt-tabs .filter-pill').forEach(p => p.classList.remove('active'));
    this.classList.add('active');
    _filtroCitas = this.dataset.filtro;
    renderMisCitas();
  });
});

/* ================================================================== */
/*  INICIALIZACIÓN                                                     */
/* ================================================================== */
cargarSesion();
if (App.usuario) {
  document.getElementById('login-email').value = App.usuario.email || '';
}
