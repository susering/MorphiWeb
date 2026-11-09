'use strict';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtPrecio = n => '$ ' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const pad = n => String(n).padStart(2, '0');
const minutosDesde = ts => Math.max(0, Math.floor((Date.now() - ts) / 60000));
const hace = ts => (minutosDesde(ts) < 1 ? 'Ahora' : `Hace ${minutosDesde(ts)} min`);
const hhmm = ts => { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

/* ================= Sesión y cabecera ================= */
const ROLES = {
  mozo:   { pagina: 'mozo.html',   pestana: 'Salón',                vista: 'Vista de mozo',   sub: 'Atención del salón' },
  cocina: { pagina: 'cocina.html', pestana: 'Cocina',               vista: 'Vista de cocina', sub: 'Preparación y despacho' },
  caja:   { pagina: 'caja.html',   pestana: 'Caja',                 vista: 'Vista de caja',   sub: 'Facturación y cobro' }
};
const CLAVE_SESION = 'morphi_sesion';

function sesionActual() {
  try { return JSON.parse(sessionStorage.getItem(CLAVE_SESION)); } catch { return null; }
}
function guardarSesion(datos) { sessionStorage.setItem(CLAVE_SESION, JSON.stringify(datos)); }
function cerrarSesion() { sessionStorage.removeItem(CLAVE_SESION); location.replace('login.html'); }

/* Protege cada pantalla: si no hay sesión del rol correcto, vuelve al login. */
function exigirRol(rol) {
  const s = sesionActual();
  if (!s || s.rol !== rol) { location.replace('login.html'); return null; }
  return s;
}

function montarCabecera(rol, { reloj = false } = {}) {
  const r = ROLES[rol];
  const turno = new Date().getHours() < 16 ? 'almuerzo' : 'cena';
  document.getElementById('cabecera').innerHTML = `
    <div class="marca"><strong>LA ESQUINA</strong><span>RESTAURANTE DE SIEMPRE</span></div>
    <span class="pestana">${r.pestana}</span>
    <div class="cab-der">
      ${reloj ? '<span class="reloj" id="reloj"></span>' : ''}
      <span class="turno"><i class="punto"></i>Turno ${turno}</span>
      <div class="usuario"><strong>${r.vista}</strong><span>${r.sub}</span></div>
      <button class="btn-salir" id="btn-salir" type="button">Salir</button>
    </div>`;
  document.getElementById('btn-salir').addEventListener('click', cerrarSesion);
  if (reloj) {
    const pintar = () => { document.getElementById('reloj').textContent = hhmm(Date.now()); };
    pintar();
    setInterval(pintar, 15000);
  }
}

/* Vuelve a ejecutar `fn` cada pocos segundos y cuando otra pestaña cambia los datos. */
function sincronizar(fn, ms = 4000) {
  setInterval(fn, ms);
  window.addEventListener('storage', e => { if (e.key === CLAVE_DB) fn(); });
}

/* ================= Mapa de mesas (usado por mozo y caja) ================= */
/* opciones: puedeElegir(mesa) -> bool · detalle(mesa) -> texto · elegida -> id · alElegir(mesa) */
function pintarMesas(contenedor, mesas, { puedeElegir, detalle, elegida = null, alElegir }) {
  contenedor.innerHTML = mesas.map(m => {
    const libre = m.estado === 'libre';
    return `
      <button type="button" class="mesa ${libre ? 'libre' : 'ocupada'}${m.id === elegida ? ' elegida' : ''}"
              data-id="${m.id}" ${puedeElegir(m) ? '' : 'disabled'}
              aria-label="Mesa ${pad(m.numero)}, ${libre ? 'libre' : 'ocupada'}">
        <span class="sillas"><i></i><i></i></span>
        <span class="tablero"><b>${pad(m.numero)}</b><span><i class="punto"></i>${libre ? 'Libre' : 'Ocupada'}</span></span>
        <span class="sillas"><i></i><i></i></span>
        <small>${esc(m.id === elegida ? detalle(m, true) : detalle(m, false))}</small>
      </button>`;
  }).join('');
  contenedor.onclick = e => {
    const boton = e.target.closest('.mesa');
    if (!boton || boton.disabled) return;
    alElegir(mesas.find(m => m.id === Number(boton.dataset.id)));
  };
}

/* ================= API SIMULADA (reemplazar por fetch a PHP) ================= */
const CLAVE_DB = 'morphi_db_simulada';
const USUARIOS_SIMULADOS = [
  { usuario: 'mozo',   clave: 'mozo123',   rol: 'mozo',   nombre: 'Mozo' },
  { usuario: 'cocina', clave: 'cocina123', rol: 'cocina', nombre: 'Cocina' },
  { usuario: 'caja',   clave: 'caja123',   rol: 'caja',   nombre: 'Caja' }
];

function semillaDB() {
  const antes = m => Date.now() - m * 60000;
  const prod = (id, nombre, precio, categoria) => ({ id, nombre, precio, categoria });
  return {
    productos: [
      prod(1, 'Milanesa con fritas', 12000, 'cocina'), prod(2, 'Gaseosa', 3000, 'bebida'),
      prod(3, 'Agua mineral', 2500, 'bebida'),         prod(4, 'Empanada de carne', 2000, 'cocina'),
      prod(5, 'Ravioles de verdura', 11000, 'cocina'), prod(6, 'Bife de chorizo', 18000, 'cocina'),
      prod(7, 'Tortilla de papas', 8000, 'cocina'),    prod(8, 'Flan casero', 5000, 'cocina')
    ],
    mesas: [1, 2, 3, 4, 5, 6, 7, 8].map(id => ({ id, estado: [2, 5, 7].includes(id) ? 'ocupada' : 'libre', personas: { 2: 4, 5: 2, 7: 4 }[id] ?? null })),
    pedidos: [
      { id: 1041, mesaId: 7, creado: antes(21), estado: 'abierto' },
      { id: 1042, mesaId: 2, creado: antes(12), estado: 'abierto' },
      { id: 1043, mesaId: 5, creado: antes(8),  estado: 'abierto' }
    ],
    detalles: [
      { id: 1, pedidoId: 1041, productoId: 1, cantidad: 1, nota: 'Sin sal en las papas', listo: false },
      { id: 2, pedidoId: 1041, productoId: 5, cantidad: 1, nota: 'Salsa fileto', listo: false },
      { id: 3, pedidoId: 1042, productoId: 6, cantidad: 1, nota: 'A punto · Con ensalada mixta', listo: false },
      { id: 4, pedidoId: 1042, productoId: 7, cantidad: 1, nota: 'Bien cocida', listo: false },
      { id: 5, pedidoId: 1043, productoId: 8, cantidad: 1, nota: 'Con dulce de leche', listo: false }
    ],
    sig: { pedido: 1044, detalle: 6 }
  };
}
function leerDB() {
  try { const db = JSON.parse(localStorage.getItem(CLAVE_DB)); if (db) return db; } catch { /* se recrea abajo */ }
  const db = semillaDB(); guardarDB(db); return db;
}
function guardarDB(db) { localStorage.setItem(CLAVE_DB, JSON.stringify(db)); }

/* SOLO SIMULACIÓN: en PHP este armado y el total salen de SQL (JOIN + SUM). */
function cuentaDe(db, pedidoId) {
  const items = db.detalles.filter(d => d.pedidoId === pedidoId).map(d => {
    const p = db.productos.find(p => p.id === d.productoId);
    return { nombre: p.nombre, cantidad: d.cantidad, precioUnitario: p.precio, subtotal: p.precio * d.cantidad };
  });
  return { pedidoId, items, total: items.reduce((t, i) => t + i.subtotal, 0) };
}
const pedidoAbierto = (db, mesaId) => db.pedidos.find(p => p.mesaId === mesaId && p.estado === 'abierto');

const api = {
  async login(usuario, clave) {
    const u = USUARIOS_SIMULADOS.find(u => u.usuario === usuario && u.clave === clave);
    if (!u) throw new Error('Usuario o contraseña incorrectos.');
    return { rol: u.rol, nombre: u.nombre };
  },
  async productos() { return leerDB().productos; },
  async mesas() {
    const db = leerDB();
    return db.mesas.map(m => {
      const p = pedidoAbierto(db, m.id);
      return { id: m.id, numero: m.id, estado: m.estado, personas: m.personas, desde: p ? p.creado : null };
    });
  },
  /* items: [{ productoId, cantidad }] */
  async crearPedido(mesaId, items, nota) {
    const db = leerDB();
    const lineas = items.filter(i => i.cantidad > 0);
    if (!lineas.length) throw new Error('Agregá al menos un producto antes de enviar.');
    const mesa = db.mesas.find(m => m.id === mesaId);
    if (!mesa || mesa.estado !== 'libre') throw new Error('Esa mesa ya está ocupada. Elegí otra.');
    const pedido = { id: db.sig.pedido++, mesaId, creado: Date.now(), estado: 'abierto' };
    db.pedidos.push(pedido);
    lineas.forEach(l => db.detalles.push({ id: db.sig.detalle++, pedidoId: pedido.id, productoId: l.productoId, cantidad: l.cantidad, nota: nota || '', listo: false }));
    mesa.estado = 'ocupada'; mesa.personas = null;
    guardarDB(db);
    return cuentaDe(db, pedido.id);
  },
  async cola() {
    const db = leerDB();
    return db.detalles
      .filter(d => !d.listo)
      .map(d => ({ d, p: db.pedidos.find(p => p.id === d.pedidoId), prod: db.productos.find(x => x.id === d.productoId) }))
      .filter(x => x.p.estado === 'abierto' && x.prod.categoria === 'cocina')
      .sort((a, b) => a.p.creado - b.p.creado || a.d.id - b.d.id)
      .map(({ d, p, prod }) => ({ detalleId: d.id, pedidoId: p.id, mesa: p.mesaId, creado: p.creado, nombre: prod.nombre, cantidad: d.cantidad, nota: d.nota }));
  },
  async marcarListo(detalleId) {
    const db = leerDB();
    const d = db.detalles.find(d => d.id === detalleId);
    if (!d) throw new Error('El plato ya no está en la cola.');
    d.listo = true; guardarDB(db);
  },
  async cuenta(mesaId) {
    const db = leerDB();
    const p = pedidoAbierto(db, mesaId);
    const cuenta = p ? cuentaDe(db, p.id) : null;
    if (!cuenta || !cuenta.items.length) throw new Error('La mesa no tiene consumos para cobrar.');
    return cuenta;
  },
  async cobrar(pedidoId) {
    const db = leerDB();
    const p = db.pedidos.find(p => p.id === pedidoId && p.estado === 'abierto');
    if (!p) throw new Error('Este pedido ya fue cobrado.');
    const cuenta = cuentaDe(db, pedidoId);
    if (!cuenta.items.length) throw new Error('No se puede cobrar una mesa sin consumos.');
    p.estado = 'cobrado';
    const mesa = db.mesas.find(m => m.id === p.mesaId);
    mesa.estado = 'libre'; mesa.personas = null;
    guardarDB(db);
    return { mesa: p.mesaId, total: cuenta.total };
  }
};
