// Capa de datos del front: todas las llamadas a la API de fidelización y menú.
// Los componentes .jsx solo importan estas funciones.

const API = `${(import.meta.env.VITE_BACKEND_URL || "").replace(/\/$/, "")}/api`;
const TOKEN_KEY = "dulcefresa_token"; // Solo guardamos la "llave"; los sellos viven en la base de datos

// ---------- token del celular ----------
// recordar = true  -> localStorage   (queda guardado aunque cierre el navegador)
// recordar = false -> sessionStorage (se borra al cerrar la pestaña)
export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

const setToken = (token, recordar = true) => {
  try {
    olvidarTarjeta();
    (recordar ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
  } catch {
    /* modo incógnito estricto: la tarjeta funciona mientras la página esté abierta */
  }
};

export const olvidarTarjeta = () => {
  try {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* nada */
  }
};

// ---------- fetch base ----------
async function request(path, { method = "GET", body, auth = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) headers["X-Cliente-Token"] = getToken() || "";

  let res;
  try {
    res = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    const error = new Error("No hay conexión. Revisa tu internet e inténtalo de nuevo.");
    error.codigo_error = "SIN_CONEXION";
    throw error;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // data.codigo_error: SIN_TARJETA | YA_REGISTRADO | COOLDOWN | TAG_INVALIDO | NO_ENCONTRADO ...
    const error = new Error(data.message || "Algo salió mal, inténtalo de nuevo.");
    Object.assign(error, data, { status: res.status });
    throw error;
  }
  return data;
}

// ---------- cliente ----------
export async function registrarCliente({ nombre, correo, telefono, acepta_marketing = false, tag = null, recordar = true }) {
  const data = await request("/clientes/registro", {
    method: "POST",
    body: { nombre, correo, telefono, acepta_marketing, tag },
  });
  setToken(data.token, recordar);
  return data; // { cliente, tarjeta, sello_nuevo }
}

export async function recuperarTarjeta({ correo, telefono, recordar = true }) {
  const data = await request("/clientes/recuperar", { method: "POST", body: { correo, telefono } });
  setToken(data.token, recordar);
  return data;
}

export const obtenerTarjeta = () => request("/tarjeta", { auth: true });

// "¿No eres tú?": desconecta este celular en el servidor (borra la cookie de 1 año)
export const cerrarTarjeta = () => request("/clientes/salir", { method: "POST", auth: true }).catch(() => {});

export const sumarSello = (tag) => request("/sellos", { method: "POST", body: { tag }, auth: true });

// ---------- contenido público ----------
export const obtenerPrograma = () => request("/programa");
export const obtenerMenu = () => request("/menu");
export const obtenerContenido = (seccion) => request(`/contenido${seccion ? `?seccion=${seccion}` : ""}`);