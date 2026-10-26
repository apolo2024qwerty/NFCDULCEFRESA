// Notificaciones push: suscribir el celular y enviar promos desde el panel.
import { getToken } from "./fidelizacion";

const API = `${(import.meta.env.VITE_BACKEND_URL || "").replace(/\/$/, "")}/api`;

export const soportaPush = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

export const esIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

// ¿Está abierta como app instalada (desde la pantalla de inicio)?
export const esAppInstalada = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;

function base64AUint8(base64) {
  const relleno = "=".repeat((4 - (base64.length % 4)) % 4);
  const crudo = atob((base64 + relleno).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...crudo].map((c) => c.charCodeAt(0)));
}

async function pedir(path, { method = "GET", body, headers = {} } = {}) {
  let res;
  try {
    res = await fetch(`${API}${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("No hay conexión. Revisa tu internet e inténtalo de nuevo.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.message || "Algo salió mal, inténtalo de nuevo.");
    Object.assign(error, data, { status: res.status });
    throw error;
  }
  return data;
}

/* "no-soportado" | "bloqueado" | "activo" | "inactivo" */
export async function estadoPush() {
  if (!soportaPush()) return "no-soportado";
  if (Notification.permission === "denied") return "bloqueado";
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg && (await reg.pushManager.getSubscription());
  return sub && Notification.permission === "granted" ? "activo" : "inactivo";
}

/* Pide permiso, suscribe el celular y lo guarda en el backend. Llamar desde un toque del usuario. */
export async function activarPush() {
  // El permiso se pide PRIMERO (algunos celulares solo lo permiten justo después del toque)
  const permiso = await Notification.requestPermission();
  if (permiso !== "granted") {
    const error = new Error("No diste permiso para las notificaciones.");
    error.codigo_error = permiso === "denied" ? "BLOQUEADO" : "SIN_PERMISO";
    throw error;
  }

  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  const { clave } = await pedir("/push/clave-publica");
  if (!clave) throw new Error("Las notificaciones aún no están configuradas en el servidor.");

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64AUint8(clave) });
  }

  await pedir("/push/suscribir", {
    method: "POST",
    body: sub.toJSON(),
    headers: { "X-Cliente-Token": getToken() || "" },
  });
  return "activo";
}

export async function desactivarPush() {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg && (await reg.pushManager.getSubscription());
  if (!sub) return;
  await pedir("/push/cancelar", {
    method: "POST",
    body: { endpoint: sub.endpoint },
    headers: { "X-Cliente-Token": getToken() || "" },
  }).catch(() => {});
  await sub.unsubscribe();
}

// ---------- panel de promos ----------
export const resumenPromos = (clave) => pedir("/promos/resumen", { headers: { "X-Clave-Promos": clave } });

export const enviarPromo = (clave, { titulo, mensaje, url }) =>
  pedir("/promos/enviar", { method: "POST", body: { titulo, mensaje, url }, headers: { "X-Clave-Promos": clave } });