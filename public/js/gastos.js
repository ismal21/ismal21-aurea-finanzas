/**
 * ============================================================================
 * AUREA FINANZAS · Panel de gastos
 * ----------------------------------------------------------------------------
 * Qué hace este archivo:
 *   1. Comprueba la sesión y muestra el nombre del usuario.
 *   2. Carga los gastos y el resumen desde la API.
 *   3. Crea, edita y elimina gastos.
 *   4. Filtra por categoría y rango de fechas.
 *   5. Pinta las gráficas de gasto por mes y por categoría.
 *   6. Exporta el listado filtrado a CSV.
 *
 * Toda la seguridad real está en el backend: aquí solo damos buena experiencia.
 * ============================================================================
 */

"use strict";

/* --------------------------------------------------------------------------
   CONSTANTES Y ESTADO
   -------------------------------------------------------------------------- */

const MONEDA = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const FECHA_CORTA = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const MESES_CORTOS = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

const MESES_LARGOS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const estado = {
  gastos: [],
  resumen: null,
  filtros: { categoria: "", desde: "", hasta: "" },
  editandoId: null,
};

let peticionActual = 0;
let temporizadorToast = null;

/* --------------------------------------------------------------------------
   REFERENCIAS AL DOM
   -------------------------------------------------------------------------- */

const $ = (selector) => document.querySelector(selector);

const usuarioNombre = $("#usuario-nombre");
const usuarioAvatar = $("#usuario-avatar");
const botonLogout = $("#logout");
const botonExportar = $("#exportar");

const statTotal = $("#stat-total");
const statPeriodo = $("#stat-periodo");
const statCantidad = $("#stat-cantidad");
const statCantidadHint = $("#stat-cantidad-hint");
const statPromedio = $("#stat-promedio");
const statPromedioHint = $("#stat-promedio-hint");
const statCategoria = $("#stat-categoria");
const statCategoriaHint = $("#stat-categoria-hint");

const formGasto = $("#gasto-form");
const formPanel = $("#form-panel");
const formTitle = $("#form-title");
const formSubtitle = $("#form-subtitle");
const modoEdicion = $("#modo-edicion");
const gastoId = $("#gasto-id");
const gastoNombre = $("#gasto-nombre");
const gastoCategoria = $("#gasto-categoria");
const gastoFecha = $("#gasto-fecha");
const gastoMonto = $("#gasto-monto");
const gastoSubmit = $("#gasto-submit");
const gastoCancelar = $("#gasto-cancelar");
const gastoMensaje = $("#gasto-mensaje");

const formFiltros = $("#filtros-form");
const filtroCategoria = $("#filtro-categoria");
const filtroDesde = $("#filtro-desde");
const filtroHasta = $("#filtro-hasta");
const filtrosLimpiar = $("#filtros-limpiar");
const filtrosMensaje = $("#filtros-mensaje");

const tablaBody = $("#gastos-body");
const listaResumen = $("#lista-resumen");

const chartMeses = $("#chart-meses");
const chartSubtitle = $("#chart-subtitle");
const chartVacio = $("#chart-vacio");
const categoriasLista = $("#categorias-lista");
const categoriasVacio = $("#categorias-vacio");

const toast = $("#toast");

/* --------------------------------------------------------------------------
   UTILIDADES
   -------------------------------------------------------------------------- */

/**
 * Fecha de hoy en formato YYYY-MM-DD, sin depender de la zona horaria de UTC.
 * @returns {string}
 */
function hoyISO() {
  const hoy = new Date();
  const mes = String(hoy.getMonth() + 1).padStart(2, "0");
  const dia = String(hoy.getDate()).padStart(2, "0");
  return `${hoy.getFullYear()}-${mes}-${dia}`;
}

/**
 * Convierte YYYY-MM-DD en un Date local (evita el desfase de UTC).
 * @param {string} fecha
 * @returns {Date}
 */
function fechaLocal(fecha) {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  return new Date(anio, mes - 1, dia);
}

/**
 * @param {string} fecha
 * @returns {string}
 */
function formatearFecha(fecha) {
  return FECHA_CORTA.format(fechaLocal(fecha));
}

/**
 * @param {number} valor
 * @returns {string}
 */
function formatearMoneda(valor) {
  return MONEDA.format(Number(valor) || 0);
}

/**
 * @param {string} iso
 * @returns {boolean}
 */
function esFechaISO(iso) {
  return typeof iso === "string" && /^\d{4}-\d{2}-\d{2}$/.test(iso);
}

/**
 * Describe el periodo activo a partir de los filtros aplicados.
 * @returns {string}
 */
function describirPeriodo() {
  const { desde, hasta } = estado.filtros;

  if (desde && hasta) return `${formatearFecha(desde)} – ${formatearFecha(hasta)}`;
  if (desde) return `Desde ${formatearFecha(desde)}`;
  if (hasta) return `Hasta ${formatearFecha(hasta)}`;
  return "Todo el historial";
}

/**
 * Lista las claves YYYY-MM entre dos fechas (ambas incluidas).
 * @param {string} desde
 * @param {string} hasta
 * @returns {string[]}
 */
function mesesEntre(desde, hasta) {
  let [anio, mes] = desde.split("-").map(Number);
  const [anioFinal, mesFinal] = hasta.split("-").map(Number);
  const meses = [];

  while (
    (anio < anioFinal || (anio === anioFinal && mes <= mesFinal)) &&
    meses.length < 36
  ) {
    meses.push(`${anio}-${String(mes).padStart(2, "0")}`);
    mes += 1;

    if (mes > 12) {
      mes = 1;
      anio += 1;
    }
  }

  return meses;
}

/**
 * @param {string} clave YYYY-MM
 * @param {boolean} conAnio
 * @returns {string}
 */
function etiquetaMes(clave, conAnio) {
  const [anio, mes] = clave.split("-").map(Number);
  const nombre = MESES_CORTOS[mes - 1] ?? clave;
  return conAnio ? `${nombre} ${String(anio).slice(-2)}` : nombre;
}

/**
 * @param {string} clave YYYY-MM
 * @returns {string}
 */
function nombreMesLargo(clave) {
  const [anio, mes] = clave.split("-").map(Number);
  return `${MESES_LARGOS[mes - 1] ?? clave} ${anio}`;
}

/* --------------------------------------------------------------------------
   API
   -------------------------------------------------------------------------- */

/**
 * fetch con manejo común de errores y sesión expirada.
 * @param {string} url
 * @param {RequestInit} [opciones]
 * @returns {Promise<any>}
 */
async function api(url, opciones = {}) {
  const { headers, ...resto } = opciones;

  const respuesta = await fetch(url, {
    ...resto,
    headers: {
      Accept: "application/json",
      ...(resto.body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
  });

  const datos = await respuesta.json().catch(() => ({}));

  if (respuesta.status === 401) {
    window.location.href = "login.html";
    throw new Error("Sesión expirada.");
  }

  if (!respuesta.ok) {
    const error = new Error(datos.message || "No se pudo completar la operación.");
    error.detalles = datos.errors;
    throw error;
  }

  return datos;
}

/* --------------------------------------------------------------------------
   MENSAJES
   -------------------------------------------------------------------------- */

function mostrarToast(texto, tipo = "success") {
  if (!toast) return;

  toast.textContent = texto;
  toast.classList.remove("is-error", "is-success");
  toast.classList.add(tipo === "error" ? "is-error" : "is-success");
  toast.hidden = false;

  window.clearTimeout(temporizadorToast);
  temporizadorToast = window.setTimeout(() => {
    toast.hidden = true;
  }, 4000);
}

function mostrarMensaje(elemento, texto, tipo) {
  if (!elemento) return;

  elemento.textContent = texto;
  elemento.classList.remove("is-error", "is-success");
  elemento.classList.add(tipo === "error" ? "is-error" : "is-success");
}

function limpiarMensaje(elemento) {
  if (!elemento) return;

  elemento.textContent = "";
  elemento.classList.remove("is-error", "is-success");
}

/* --------------------------------------------------------------------------
   CARGA DE DATOS
   -------------------------------------------------------------------------- */

async function cargarSesion() {
  try {
    const datos = await api("/api/auth/me");
    const nombre = datos.user?.nombre ?? "Usuario";

    usuarioNombre.textContent = nombre;
    usuarioAvatar.textContent = nombre.trim().charAt(0).toUpperCase() || "A";
  } catch (error) {
    if (error.message !== "Sesión expirada.") {
      mostrarToast(error.message, "error");
    }
  }
}

function construirQuery() {
  const params = new URLSearchParams();

  if (estado.filtros.categoria) params.set("categoria", estado.filtros.categoria);
  if (estado.filtros.desde) params.set("desde", estado.filtros.desde);
  if (estado.filtros.hasta) params.set("hasta", estado.filtros.hasta);

  const query = params.toString();
  return query ? `?${query}` : "";
}

async function cargarDatos() {
  const numeroPeticion = ++peticionActual;

  tablaBody.innerHTML = "";
  const filaCargando = document.createElement("tr");
  const celdaCargando = document.createElement("td");
  celdaCargando.colSpan = 5;
  celdaCargando.className = "table-empty";
  celdaCargando.textContent = "Cargando gastos…";
  filaCargando.append(celdaCargando);
  tablaBody.append(filaCargando);
  listaResumen.textContent = "Cargando…";

  try {
    const query = construirQuery();

    const [lista, resumen] = await Promise.all([
      api(`/api/gastos${query}`),
      api(`/api/gastos/resumen${query}`),
    ]);

    // Si llegó antes una respuesta de una petición antigua, la ignoramos.
    if (numeroPeticion !== peticionActual) return;

    estado.gastos = lista.gastos ?? [];
    estado.resumen = resumen.resumen ?? null;

    renderizarTodo();
  } catch (error) {
    if (numeroPeticion !== peticionActual) return;
    if (error.message === "Sesión expirada.") return;

    mostrarToast(error.message, "error");
    tablaBody.innerHTML = "";
    const filaError = document.createElement("tr");
    const celdaError = document.createElement("td");
    celdaError.colSpan = 5;
    celdaError.className = "table-empty";
    celdaError.textContent = "No se pudieron cargar los gastos.";
    filaError.append(celdaError);
    tablaBody.append(filaError);
    listaResumen.textContent = "Error al cargar";
  }
}

/* --------------------------------------------------------------------------
   RENDERIZADO
   -------------------------------------------------------------------------- */

function renderizarTodo() {
  renderizarResumen();
  renderizarTabla();
  renderizarGraficaMeses();
  renderizarCategorias();
}

function renderizarResumen() {
  const resumen = estado.resumen;

  if (!resumen) return;

  const total = Number(resumen.total) || 0;
  const cantidad = Number(resumen.cantidad) || 0;
  const promedio = cantidad > 0 ? total / cantidad : 0;
  const principal = resumen.porCategoria?.[0];

  statTotal.textContent = formatearMoneda(total);
  statPeriodo.textContent = describirPeriodo();

  statCantidad.textContent = String(cantidad);
  statCantidadHint.textContent = cantidad === 1 ? "Movimiento" : "Movimientos";

  statPromedio.textContent = formatearMoneda(promedio);
  statPromedioHint.textContent = "En el periodo";

  statCategoria.textContent = principal?.categoria ?? "—";
  statCategoriaHint.textContent = principal
    ? `${formatearMoneda(principal.total)} · ${(
        (Number(principal.total) / total) * 100
      ).toFixed(0)}% del total`
    : "Sin gastos";

  listaResumen.textContent = `${cantidad} ${
    cantidad === 1 ? "movimiento" : "movimientos"
  } · ${formatearMoneda(total)}`;
}

function crearFilaGasto(gasto) {
  const fila = document.createElement("tr");
  fila.dataset.id = String(gasto.id);

  const fecha = document.createElement("td");
  fecha.dataset.label = "Fecha";
  fecha.textContent = formatearFecha(gasto.fecha);

  const nombre = document.createElement("td");
  nombre.dataset.label = "Gasto";
  const nombreFuerte = document.createElement("strong");
  nombreFuerte.className = "expense-name";
  nombreFuerte.textContent = gasto.nombre;
  nombre.appendChild(nombreFuerte);

  const categoria = document.createElement("td");
  categoria.dataset.label = "Categoría";
  const pildora = document.createElement("span");
  pildora.className = "category-pill";
  pildora.textContent = gasto.categoria;
  categoria.appendChild(pildora);

  const monto = document.createElement("td");
  monto.dataset.label = "Monto";
  monto.className = "is-right amount-cell";
  monto.textContent = formatearMoneda(gasto.monto);

  const acciones = document.createElement("td");
  acciones.dataset.label = "Acciones";
  acciones.className = "is-right actions-cell";

  const botonEditar = document.createElement("button");
  botonEditar.type = "button";
  botonEditar.className = "row-action";
  botonEditar.dataset.accion = "editar";
  botonEditar.textContent = "Editar";
  botonEditar.setAttribute("aria-label", `Editar ${gasto.nombre}`);

  const botonEliminar = document.createElement("button");
  botonEliminar.type = "button";
  botonEliminar.className = "row-action row-action--danger";
  botonEliminar.dataset.accion = "eliminar";
  botonEliminar.textContent = "Eliminar";
  botonEliminar.setAttribute("aria-label", `Eliminar ${gasto.nombre}`);

  acciones.append(botonEditar, botonEliminar);

  fila.append(fecha, nombre, categoria, monto, acciones);
  return fila;
}

function renderizarTabla() {
  tablaBody.innerHTML = "";

  if (estado.gastos.length === 0) {
    const fila = document.createElement("tr");
    const celda = document.createElement("td");
    celda.colSpan = 5;
    celda.className = "table-empty";
    celda.textContent =
      "No hay gastos con estos filtros. Anota el primero en el formulario de arriba.";
    fila.appendChild(celda);
    tablaBody.appendChild(fila);
    return;
  }

  const fragmento = document.createDocumentFragment();

  estado.gastos.forEach((gasto) => {
    fragmento.appendChild(crearFilaGasto(gasto));
  });

  tablaBody.appendChild(fragmento);
}

function renderizarGraficaMeses() {
  chartMeses.replaceChildren();

  const resumen = estado.resumen;

  if (!resumen || !Array.isArray(resumen.porMes)) {
    chartVacio.hidden = false;
    return;
  }

  const mapa = new Map(
    resumen.porMes.map((fila) => [fila.mes, Number(fila.total) || 0])
  );

  const { desde, hasta } = estado.filtros;
  let claves = [];

  if (esFechaISO(desde) && esFechaISO(hasta)) {
    claves = mesesEntre(desde, hasta);

    // Si el rango es enorme, mostramos solo los meses que tienen gastos.
    if (claves.length > 24) {
      claves = [...mapa.keys()].sort();
    }
  } else if (esFechaISO(desde)) {
    claves = [...mapa.keys()].filter((mes) => mes >= desde.slice(0, 7)).sort();
  } else if (esFechaISO(hasta)) {
    claves = [...mapa.keys()].filter((mes) => mes <= hasta.slice(0, 7)).sort();
  } else {
    claves = [...mapa.keys()].sort();
  }

  if (claves.length > 24) {
    claves = claves.slice(-24);
  }

  const valores = claves.map((mes) => mapa.get(mes) ?? 0);
  const maximo = Math.max(...valores, 0);
  const total = valores.reduce((suma, valor) => suma + valor, 0);

  const anios = new Set(claves.map((mes) => mes.slice(0, 4)));
  const mostrarAnio = anios.size > 1;

  if (total === 0) {
    chartVacio.hidden = false;
    chartSubtitle.textContent = describirPeriodo();
    return;
  }

  chartVacio.hidden = true;
  chartSubtitle.textContent = `${describirPeriodo()} · Máximo ${formatearMoneda(maximo)}`;
  chartMeses.setAttribute(
    "aria-label",
    `Gasto por mes. ${describirPeriodo()}. Total ${formatearMoneda(total)}.`
  );

  claves.forEach((clave, indice) => {
    const valor = valores[indice];
    const altura = maximo > 0 && valor > 0 ? Math.max(3, (valor / maximo) * 100) : 0;

    const columna = document.createElement("li");
    columna.className = "month-col";
    columna.tabIndex = 0;
    columna.title = `${nombreMesLargo(clave)}: ${formatearMoneda(valor)}`;
    columna.setAttribute(
      "aria-label",
      `${nombreMesLargo(clave)}: ${formatearMoneda(valor)}`
    );

    const pista = document.createElement("div");
    pista.className = "month-track";

    const barra = document.createElement("span");
    barra.className = "month-fill";
    barra.style.height = `${altura}%`;

    pista.appendChild(barra);

    const etiqueta = document.createElement("span");
    etiqueta.className = "month-label";
    etiqueta.textContent = etiquetaMes(clave, mostrarAnio);

    columna.append(pista, etiqueta);
    chartMeses.appendChild(columna);
  });
}

function renderizarCategorias() {
  categoriasLista.replaceChildren();

  const resumen = estado.resumen;
  const filas = resumen?.porCategoria ?? [];

  if (filas.length === 0) {
    categoriasVacio.hidden = false;
    return;
  }

  categoriasVacio.hidden = true;

  const total = Number(resumen.total) || 0;
  const maximo = Math.max(...filas.map((fila) => Number(fila.total)), 0);

  filas.forEach((fila) => {
    const valor = Number(fila.total) || 0;
    const cantidad = Number(fila.cantidad) || 0;
    const porcentaje = total > 0 ? (valor / total) * 100 : 0;
    const ancho = maximo > 0 ? (valor / maximo) * 100 : 0;

    const item = document.createElement("li");
    item.className = "category-row";

    const cabecera = document.createElement("div");
    cabecera.className = "category-row-head";

    const nombre = document.createElement("span");
    nombre.textContent = fila.categoria;

    const monto = document.createElement("strong");
    monto.textContent = formatearMoneda(valor);

    cabecera.append(nombre, monto);

    const pista = document.createElement("div");
    pista.className = "category-track";

    const barra = document.createElement("span");
    barra.style.width = `${ancho}%`;
    pista.appendChild(barra);

    const detalle = document.createElement("small");
    detalle.textContent = `${cantidad} ${
      cantidad === 1 ? "gasto" : "gastos"
    } · ${porcentaje.toFixed(0)}% del total`;

    item.append(cabecera, pista, detalle);
    categoriasLista.appendChild(item);
  });
}

/* --------------------------------------------------------------------------
   FORMULARIO: CREAR Y EDITAR
   -------------------------------------------------------------------------- */

function entrarModoEdicion(gasto) {
  estado.editandoId = String(gasto.id);

  gastoId.value = String(gasto.id);
  gastoNombre.value = gasto.nombre;
  gastoCategoria.value = gasto.categoria;
  gastoFecha.value = gasto.fecha;
  gastoMonto.value = gasto.monto;

  formTitle.textContent = "Editar gasto";
  formSubtitle.textContent = "Modifica los campos y guarda los cambios.";
  modoEdicion.hidden = false;
  gastoSubmit.textContent = "Guardar cambios";
  gastoCancelar.hidden = false;

  limpiarMensaje(gastoMensaje);

  formPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  gastoNombre.focus({ preventScroll: true });
}

function salirModoEdicion() {
  estado.editandoId = null;

  formGasto.reset();
  gastoId.value = "";
  gastoFecha.value = hoyISO();

  formTitle.textContent = "Nuevo gasto";
  formSubtitle.textContent = "Anota un gasto y quedará asociado a tu cuenta.";
  modoEdicion.hidden = true;
  gastoSubmit.textContent = "Guardar gasto";
  gastoCancelar.hidden = true;

  limpiarMensaje(gastoMensaje);
}

async function guardarGasto(event) {
  event.preventDefault();

  limpiarMensaje(gastoMensaje);

  const editando = estado.editandoId !== null;
  const url = editando ? `/api/gastos/${estado.editandoId}` : "/api/gastos";
  const metodo = editando ? "PUT" : "POST";

  const datos = {
    nombre: gastoNombre.value.trim(),
    categoria: gastoCategoria.value,
    fecha: gastoFecha.value,
    monto: Number(gastoMonto.value),
  };

  gastoSubmit.disabled = true;
  gastoSubmit.textContent = editando ? "Guardando cambios…" : "Guardando…";

  try {
    const respuesta = await api(url, {
      method: metodo,
      body: JSON.stringify(datos),
    });

    mostrarToast(respuesta.message || "Gasto guardado correctamente.", "success");
    salirModoEdicion();
    await cargarDatos();
  } catch (error) {
    if (error.message === "Sesión expirada.") return;

    const detalles = error.detalles
      ? Object.values(error.detalles).join(" ")
      : "";
    mostrarMensaje(
      gastoMensaje,
      [error.message, detalles].filter(Boolean).join(" "),
      "error"
    );
  } finally {
    gastoSubmit.disabled = false;
    gastoSubmit.textContent = estado.editandoId ? "Guardar cambios" : "Guardar gasto";
  }
}

async function eliminarGasto(id) {
  const gasto = estado.gastos.find((item) => String(item.id) === String(id));

  if (!gasto) return;

  const confirmado = window.confirm(
    `¿Eliminar "${gasto.nombre}"? Esta acción no se puede deshacer.`
  );

  if (!confirmado) return;

  try {
    const respuesta = await api(`/api/gastos/${id}`, { method: "DELETE" });

    if (estado.editandoId === String(id)) {
      salirModoEdicion();
    }

    mostrarToast(respuesta.message || "Gasto eliminado.", "success");
    await cargarDatos();
  } catch (error) {
    if (error.message !== "Sesión expirada.") {
      mostrarToast(error.message, "error");
    }
  }
}

/* --------------------------------------------------------------------------
   FILTROS Y EXPORTACIÓN
   -------------------------------------------------------------------------- */

function aplicarFiltros(event) {
  event.preventDefault();

  const desde = filtroDesde.value;
  const hasta = filtroHasta.value;

  if (desde && hasta && desde > hasta) {
    mostrarMensaje(
      filtrosMensaje,
      "La fecha inicial no puede ser posterior a la final.",
      "error"
    );
    return;
  }

  estado.filtros = {
    categoria: filtroCategoria.value,
    desde,
    hasta,
  };

  limpiarMensaje(filtrosMensaje);
  cargarDatos();
}

function limpiarFiltros() {
  filtroCategoria.value = "";
  filtroDesde.value = "";
  filtroHasta.value = "";

  estado.filtros = { categoria: "", desde: "", hasta: "" };

  limpiarMensaje(filtrosMensaje);
  cargarDatos();
}

function exportarCSV() {
  if (estado.gastos.length === 0) {
    mostrarToast("No hay gastos para exportar con estos filtros.", "error");
    return;
  }

  const filas = [
    ["Fecha", "Gasto", "Categoría", "Monto"],
    ...estado.gastos.map((gasto) => [
      gasto.fecha,
      gasto.nombre,
      gasto.categoria,
      Number(gasto.monto).toFixed(2),
    ]),
  ];

  const csv = filas
    .map((fila) =>
      fila
        .map((celda) => `"${String(celda).replaceAll('"', '""')}"`)
        .join(",")
    )
    .join("\r\n");

  const blob = new Blob([`\uFEFF${csv}`], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = `gastos-${hoyISO()}.csv`;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);

  mostrarToast("CSV exportado correctamente.", "success");
}

/* --------------------------------------------------------------------------
   INICIALIZACIÓN Y EVENTOS
   -------------------------------------------------------------------------- */

function configurarFechasIniciales() {
  gastoFecha.value = hoyISO();

  // Por defecto mostramos el año actual para que la gráfica tenga 12 meses.
  const anio = new Date().getFullYear();
  const desde = `${anio}-01-01`;
  const hasta = `${anio}-12-31`;

  filtroDesde.value = desde;
  filtroHasta.value = hasta;
  estado.filtros = { categoria: "", desde, hasta };
}

function conectarEventos() {
  formGasto.addEventListener("submit", guardarGasto);
  gastoCancelar.addEventListener("click", salirModoEdicion);

  formFiltros.addEventListener("submit", aplicarFiltros);
  filtrosLimpiar.addEventListener("click", limpiarFiltros);

  botonExportar.addEventListener("click", exportarCSV);

  botonLogout.addEventListener("click", async () => {
    botonLogout.disabled = true;

    try {
      await api("/api/auth/logout", { method: "POST" });
      window.location.href = "login.html";
    } catch (error) {
      if (error.message !== "Sesión expirada.") {
        mostrarToast(error.message, "error");
      }
      botonLogout.disabled = false;
    }
  });

  // Delegación: un solo listener para los botones de todas las filas.
  tablaBody.addEventListener("click", (event) => {
    const boton = event.target.closest("button[data-accion]");

    if (!boton) return;

    const fila = boton.closest("tr");
    const id = fila?.dataset.id;

    if (!id) return;

    if (boton.dataset.accion === "editar") {
      const gasto = estado.gastos.find((item) => String(item.id) === id);
      if (gasto) entrarModoEdicion(gasto);
    }

    if (boton.dataset.accion === "eliminar") {
      eliminarGasto(id);
    }
  });
}

async function iniciar() {
  configurarFechasIniciales();
  conectarEventos();
  await cargarSesion();
  await cargarDatos();
}

iniciar();
