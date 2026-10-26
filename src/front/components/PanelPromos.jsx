import { useState } from "react";
import { resumenPromos, enviarPromo } from "../services/push";
import "../styles/PanelPromos.css";

/*
  Panel para enviar una notificación a todos los clientes que aceptaron promos.
  Se abre con el candado del pie del Home. La clave se valida en el BACKEND
  (src/api/routes.py → CLAVE_PROMOS), nunca queda escrita en la página.
*/
const DESTINOS = [
  { url: "/menu", texto: "Menú" },
  { url: "/", texto: "Inicio" },
  { url: "/videos", texto: "Videos" },
];

export const PanelPromos = () => {
  const [clave, setClave] = useState("");
  const [resumen, setResumen] = useState(null); // { celulares, clientes } cuando la clave es correcta
  const [titulo, setTitulo] = useState("¡Nuevo sabor en Dulce Fresa! 🍓");
  const [mensaje, setMensaje] = useState("");
  const [url, setUrl] = useState("/menu");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState(null);

  const entrar = async (e) => {
    e.preventDefault();
    setError("");
    setOcupado(true);
    try {
      setResumen(await resumenPromos(clave));
    } catch (err) {
      setError(err.codigo_error === "CLAVE_INCORRECTA" ? "Clave incorrecta" : err.message);
    } finally {
      setOcupado(false);
    }
  };

  const enviar = async (e) => {
    e.preventDefault();
    setError("");
    setResultado(null);
    setOcupado(true);
    try {
      setResultado(await enviarPromo(clave, { titulo, mensaje, url }));
      setMensaje("");
    } catch (err) {
      setError(err.message);
    } finally {
      setOcupado(false);
    }
  };

  // ---------- paso 1: clave ----------
  if (!resumen) {
    return (
      <form className="df-promos" onSubmit={entrar}>
        <p className="df-promos__intro">Solo para el equipo de Dulce Fresa.</p>
        <label className="df-campo">
          <span>Clave</span>
          <input type="password" value={clave} onChange={(e) => setClave(e.target.value)}
            autoComplete="current-password" placeholder="••••••••" required autoFocus />
        </label>
        {error && <p className="df-form__error" role="alert">{error}</p>}
        <button className="df-btn df-btn--bloque" disabled={ocupado || !clave}>
          {ocupado ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-lock-open" />} Entrar
        </button>
      </form>
    );
  }

  // ---------- paso 2: escribir y enviar ----------
  return (
    <form className="df-promos" onSubmit={enviar}>
      <p className="df-promos__alcance">
        <i className="fa-solid fa-users" aria-hidden="true" />
        <span>
          {resumen.celulares === 0 ? (
            "Aún ningún cliente ha activado los avisos. Cuando lo hagan, podrás enviarles promos desde aquí."
          ) : (
            <>
              Llegará a <strong>{resumen.celulares}</strong> {resumen.celulares === 1 ? "celular" : "celulares"} de
              clientes que aceptaron promos
            </>
          )}
        </span>
      </p>

      <label className="df-campo">
        <span>Título</span>
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={60} required />
      </label>

      <label className="df-campo">
        <span>Mensaje</span>
        <textarea value={mensaje} onChange={(e) => setMensaje(e.target.value)} maxLength={180} rows={3} required
          placeholder="Llegó el helado de pistacho 💚 Ven hoy y pruébalo" />
        <small className="df-promos__contador">{mensaje.length}/180</small>
      </label>

      <div className="df-campo">
        <span>Al tocar la notificación abre</span>
        <div className="df-promos__destinos">
          {DESTINOS.map((d) => (
            <button key={d.url} type="button" onClick={() => setUrl(d.url)}
              className={`df-chip ${url === d.url ? "df-chip--activo" : ""}`}>
              {d.texto}
            </button>
          ))}
        </div>
      </div>

      {/* vista previa de cómo se ve en el celular */}
      <div className="df-promos__preview" aria-label="Vista previa">
        <span className="df-promos__preview-icono"><i className="fa-solid fa-ice-cream" /></span>
        <span>
          <strong>{titulo || "Título"}</strong>
          <span>{mensaje || "Tu mensaje aparecerá aquí"}</span>
        </span>
      </div>

      {error && <p className="df-form__error" role="alert">{error}</p>}
      {resultado && (
        <p className="df-promos__ok" role="status">
          <i className="fa-solid fa-circle-check" /> Enviada a {resultado.enviados}{" "}
          {resultado.enviados === 1 ? "celular" : "celulares"}
          {resultado.fallidos > 0 && ` · ${resultado.fallidos} fallaron`}
        </p>
      )}

      <button className="df-btn df-btn--bloque" disabled={ocupado || !mensaje.trim() || resumen.celulares === 0}>
        {ocupado ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-paper-plane" />} Enviar notificación
      </button>
    </form>
  );
};