import { useEffect, useState } from "react";
import { activarPush, desactivarPush, estadoPush, esIOS, esAppInstalada } from "../services/push";
import "../styles/BotonNotificaciones.css";

/*
  Botón para que el cliente active los avisos de sabores nuevos y promos.
  Se muestra debajo de la tarjeta. Solo aparece si el celular lo soporta.
  En iPhone solo funciona si la página se agregó a la pantalla de inicio (regla de Apple).
*/
export const BotonNotificaciones = ({ destacar = false }) => {
  const [estado, setEstado] = useState("cargando");
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const iphoneSinInstalar = esIOS() && !esAppInstalada();

  useEffect(() => {
    estadoPush().then(setEstado).catch(() => setEstado("no-soportado"));
  }, []);

  const activar = async () => {
    setError("");
    setOcupado(true);
    try {
      setEstado(await activarPush());
    } catch (e) {
      if (e.codigo_error === "BLOQUEADO") setEstado("bloqueado");
      else setError(e.message);
    } finally {
      setOcupado(false);
    }
  };

  const desactivar = async () => {
    setOcupado(true);
    await desactivarPush().catch(() => {});
    setEstado("inactivo");
    setOcupado(false);
  };

  if (estado === "cargando") return null;

  // iPhone: Apple solo permite notificaciones si la página está "instalada"
  if (iphoneSinInstalar) {
    return (
      <div className="df-avisos df-avisos--info">
        <span className="df-avisos__icono" aria-hidden="true"><i className="fa-solid fa-bell" /></span>
        <p>
          <strong>¿Quieres avisos de sabores nuevos?</strong> En iPhone toca{" "}
          <i className="fa-solid fa-arrow-up-from-bracket" aria-label="Compartir" /> <b>Compartir</b> →{" "}
          <b>Agregar a pantalla de inicio</b>. Abre Dulce Fresa desde ese ícono, recupera tu tarjeta y activa los avisos.
        </p>
      </div>
    );
  }

  if (estado === "no-soportado") return null;

  if (estado === "activo") {
    return (
      <div className="df-avisos df-avisos--activo">
        <span className="df-avisos__icono" aria-hidden="true"><i className="fa-solid fa-bell" /></span>
        <p><strong>Avisos activados</strong> Te contaremos cuando llegue un sabor nuevo 🍓</p>
        <button type="button" className="df-link" onClick={desactivar} disabled={ocupado}>Desactivar</button>
      </div>
    );
  }

  if (estado === "bloqueado") {
    return (
      <div className="df-avisos df-avisos--info">
        <span className="df-avisos__icono" aria-hidden="true"><i className="fa-solid fa-bell-slash" /></span>
        <p>
          Bloqueaste las notificaciones. Para activarlas, entra a la configuración del navegador → este sitio →{" "}
          <b>Notificaciones: Permitir</b>.
        </p>
      </div>
    );
  }

  return (
    <div className={`df-avisos ${destacar ? "df-avisos--destacar" : ""}`}>
      <button type="button" className="df-avisos__boton" onClick={activar} disabled={ocupado}>
        <span className="df-avisos__icono" aria-hidden="true">
          <i className={ocupado ? "fa-solid fa-spinner fa-spin" : "fa-solid fa-bell"} />
        </span>
        <span>
          <strong>Activa los avisos</strong>
          <small>Entérate primero de sabores nuevos y promos</small>
        </span>
        <i className="fa-solid fa-chevron-right" aria-hidden="true" />
      </button>
      {error && <p className="df-avisos__error" role="alert">{error}</p>}
    </div>
  );
};