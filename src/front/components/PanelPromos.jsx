import { useEffect, useState } from "react";
import { resumenPromos, enviarPromo, buscarClientes, entregarPremio, sumarFresaManual } from "../services/push";
import "../styles/PanelPromos.css";

/*
  Panel del equipo (se abre con el candado del pie del Home).
  Pestañas:
    Caja   -> buscar cliente, entregar premio (la tarjeta vuelve a 0) y sumar fresa manual
    Promos -> enviar notificación a los clientes que aceptaron
  La clave se valida en el BACKEND (src/api/routes.py → CLAVE_PROMOS), nunca queda escrita en la página.
*/
export const PanelPromos = () => {
  const [clave, setClave] = useState("");
  const [resumen, setResumen] = useState(null); // si existe, la clave fue correcta
  const [pestana, setPestana] = useState("caja");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");

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

  // ---------- paso 2: pestañas ----------
  return (
    <div className="df-promos">
      <div className="df-equipo__tabs" role="tablist">
        <button type="button" role="tab" aria-selected={pestana === "caja"}
          className={`df-chip ${pestana === "caja" ? "df-chip--activo" : ""}`} onClick={() => setPestana("caja")}>
          <i className="fa-solid fa-cash-register" /> Caja
        </button>
        <button type="button" role="tab" aria-selected={pestana === "promos"}
          className={`df-chip ${pestana === "promos" ? "df-chip--activo" : ""}`} onClick={() => setPestana("promos")}>
          <i className="fa-solid fa-bell" /> Promos
        </button>
      </div>

      {pestana === "caja" ? <Caja clave={clave} /> : <Promos clave={clave} resumen={resumen} />}
    </div>
  );
};

/* ==========================================================================
   CAJA: buscar cliente y entregar premio
   ========================================================================== */
const Caja = ({ clave }) => {
  const [q, setQ] = useState("");
  const [clientes, setClientes] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [trabajando, setTrabajando] = useState(null); // código del cliente en proceso
  const [confirmar, setConfirmar] = useState(null); // código del cliente a confirmar entrega

  const buscar = async (texto = q) => {
    setError("");
    setBuscando(true);
    try {
      setClientes(await buscarClientes(clave, texto));
    } catch (err) {
      setError(err.message);
    } finally {
      setBuscando(false);
    }
  };

  // Al abrir muestra los últimos clientes que han venido
  useEffect(() => {
    buscar("");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const actualizar = (ficha) => setClientes((lista) => lista.map((c) => (c.codigo === ficha.codigo ? ficha : c)));

  const entregar = async (c) => {
    setError("");
    setAviso("");
    setTrabajando(c.codigo);
    try {
      const r = await entregarPremio(clave, c.codigo);
      actualizar(r.cliente);
      setAviso(`✅ Premio entregado a ${c.nombre}. Su tarjeta volvió a 0.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setTrabajando(null);
      setConfirmar(null);
    }
  };

  const sumar = async (c) => {
    setError("");
    setAviso("");
    setTrabajando(c.codigo);
    try {
      const r = await sumarFresaManual(clave, c.codigo);
      actualizar(r.cliente);
      setAviso(`🍓 +1 fresa para ${c.nombre}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setTrabajando(null);
    }
  };

  return (
    <div className="df-caja">
      <form className="df-caja__buscar" onSubmit={(e) => { e.preventDefault(); buscar(); }}>
        <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Código, celular o nombre" aria-label="Buscar cliente" />
        <button type="submit" className="df-btn" disabled={buscando}>
          {buscando ? <i className="fa-solid fa-spinner fa-spin" /> : "Buscar"}
        </button>
      </form>

      {error && <p className="df-form__error" role="alert">{error}</p>}
      {aviso && <p className="df-promos__ok" role="status">{aviso}</p>}

      {!buscando && clientes.length === 0 && <p className="df-promos__intro">No encontramos clientes.</p>}

      <ul className="df-caja__lista">
        {clientes.map((c) => (
          <li key={c.codigo} className={`df-caja__cliente ${c.premio_disponible ? "df-caja__cliente--premio" : ""}`}>
            <div className="df-caja__datos">
              <strong>{c.nombre}</strong>
              <span>#{c.codigo_corto} · {c.telefono}</span>
            </div>

            <div className="df-caja__fresas" aria-label={`${c.sellos_actuales} de ${c.sellos_requeridos} fresas`}>
              <span className="df-caja__barra">
                <span style={{ width: `${(c.sellos_actuales / c.sellos_requeridos) * 100}%` }} />
              </span>
              <b>{c.sellos_actuales}/{c.sellos_requeridos}</b>
            </div>

            {c.premio_disponible ? (
              confirmar === c.codigo ? (
                <div className="df-caja__confirmar">
                  <p>¿Entregar <strong>{c.premio}</strong> a {c.nombre}?</p>
                  <div>
                    <button type="button" className="df-btn" disabled={trabajando === c.codigo} onClick={() => entregar(c)}>
                      {trabajando === c.codigo ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-check" />} Sí, entregar
                    </button>
                    <button type="button" className="df-link" onClick={() => setConfirmar(null)}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <button type="button" className="df-btn df-btn--bloque" onClick={() => setConfirmar(c.codigo)}>
                  <i className="fa-solid fa-gift" /> Entregar premio y reiniciar tarjeta
                </button>
              )
            ) : (
              <button type="button" className="df-btn df-btn--blanco df-caja__manual" disabled={trabajando === c.codigo}
                onClick={() => sumar(c)}>
                {trabajando === c.codigo ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-plus" />} Sumar fresa manual
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

/* ==========================================================================
   PROMOS: enviar notificación
   ========================================================================== */
const DESTINOS = [
  { url: "/menu", texto: "Menú" },
  { url: "/", texto: "Inicio" },
  { url: "/videos", texto: "Videos" },
];

const Promos = ({ clave, resumen }) => {
  const [titulo, setTitulo] = useState("¡Nuevo sabor en Dulce Fresa! 🍓");
  const [mensaje, setMensaje] = useState("");
  const [url, setUrl] = useState("/menu");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState(null);

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