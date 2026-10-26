import { useEffect, useMemo, useState } from "react";
import { SelloFresa } from "../components/Sellofresa";
import { HojaInferior } from "../components/HojaInferior";
import { PoliticaDatos } from "../components/PoliticaDatos";
import { BotonNotificaciones } from "../components/BotonNotificaciones";
import { obtenerPrograma } from "../services/fidelizacion";
import "../styles/TarjetaFidelizacion.css";

/* Reglas del programa (premio y sellos) para mostrarlas antes de registrarse */
export function usePrograma() {
  const [programa, setPrograma] = useState(null);
  useEffect(() => {
    obtenerPrograma().then(setPrograma).catch(() => {});
  }, []);
  return {
    premio: programa?.premio || "¡un helado gratis!",
    requeridos: programa?.sellos_requeridos || 10,
  };
}

/* ==========================================================================
   TarjetaFidelizacion
   - Con tarjeta    -> la tarjeta con las fresas
   - Cargando       -> esqueleto
   - Sin tarjeta    -> formulario dentro de la tarjeta (se usa en /sello)
   Props: t = useTarjeta(), tag = código del NFC (opcional)
   ========================================================================== */
export const TarjetaFidelizacion = ({ t, tag = null }) => {
  const programa = usePrograma();

  if (t.cargando) return <TarjetaCargando />;
  if (t.datos) return <TarjetaActiva t={t} />;

  return (
    <div className="df-tarjeta df-tarjeta--form">
      <div className="df-tarjeta__cara df-tarjeta__cara--form">
        <div className="df-tarjeta__marca">
          <span className="df-tarjeta__logo">Dulce Fresa</span>
          <span className="df-tarjeta__tipo">Tarjeta de fidelidad</span>
        </div>
        <h2 className="df-tarjeta__form-titulo">Activa tu tarjeta</h2>
        <p className="df-tarjeta__form-texto">
          Junta <strong>{programa.requeridos} fresas</strong> y gana <strong>{programa.premio}</strong>
          {tag && <span className="df-tarjeta__bonus">Al activarla te sumamos tu primera fresa 🍓</span>}
        </p>
      </div>
      <div className="df-tarjeta__form-cuerpo">
        <FormularioTarjeta t={t} tag={tag} />
      </div>
    </div>
  );
};

/* ==========================================================================
   FormularioTarjeta: registro o recuperar. Se usa solo (dentro de la hoja
   inferior del Home) o dentro de TarjetaFidelizacion.
   Props: t, tag, modoInicial ("registro" | "recuperar"), onListo()
   ========================================================================== */
const FORM_VACIO = { nombre: "", correo: "", telefono: "", acepta_marketing: false, acepta_datos: false };

export const FormularioTarjeta = ({ t, tag = null, modoInicial = "registro", onListo }) => {
  const [modo, setModo] = useState(modoInicial);
  const [form, setForm] = useState(FORM_VACIO);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [verPolitica, setVerPolitica] = useState(false);
  const esRegistro = modo === "registro";

  const cambiar = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
    if (error) setError("");
  };

  const enviar = async (e) => {
    e.preventDefault();
    if (esRegistro && !form.acepta_datos) {
      setError("Para guardar tus fresas necesitamos que aceptes el tratamiento de datos.");
      return;
    }
    setEnviando(true);
    try {
      // "Recordarme" ya no es opcional: la tarjeta SIEMPRE queda guardada en este celular
      if (esRegistro) await t.registrar({ ...form, tag, recordar: true });
      else await t.recuperar({ ...form, recordar: true });
      setForm(FORM_VACIO);
      onListo?.();
    } catch (err) {
      if (err.codigo_error === "YA_REGISTRADO") {
        setModo("recuperar");
        setError("Ya tienes una tarjeta 💕 Confirma tu correo y celular para recuperarla.");
      } else {
        setError(err.message);
      }
    } finally {
      setEnviando(false);
    }
  };

  const alternar = () => {
    setModo(esRegistro ? "recuperar" : "registro");
    setError("");
  };

  return (
    <form className="df-form" onSubmit={enviar} noValidate>
      {!esRegistro && (
        <p className="df-form__intro">
          ¿Cambiaste de celular o borraste el navegador? Tus fresas siguen guardadas. Escribe tus datos:
        </p>
      )}

      {esRegistro && (
        <label className="df-campo">
          <span>Nombre</span>
          <input name="nombre" value={form.nombre} onChange={cambiar} autoComplete="given-name"
            autoCapitalize="words" enterKeyHint="next" placeholder="¿Cómo te llamas?" required minLength={2} />
        </label>
      )}
      <label className="df-campo">
        <span>Correo</span>
        <input name="correo" type="email" inputMode="email" value={form.correo} onChange={cambiar}
          autoComplete="email" autoCapitalize="none" enterKeyHint="next" placeholder="tucorreo@gmail.com" required />
      </label>
      <label className="df-campo">
        <span>Celular</span>
        <input name="telefono" type="tel" inputMode="numeric" value={form.telefono} onChange={cambiar}
          autoComplete="tel-national" enterKeyHint={esRegistro ? "next" : "done"} placeholder="300 123 4567" required />
      </label>

      {esRegistro && (
        <>
          <Opcion name="acepta_datos" checked={form.acepta_datos} onChange={cambiar} obligatoria>
            Acepto el{" "}
            <button type="button" className="df-link"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setVerPolitica(true); }}>
              tratamiento de mis datos
            </button>
          </Opcion>
          <Opcion name="acepta_marketing" checked={form.acepta_marketing} onChange={cambiar}>
            Quiero enterarme de promos y sabores nuevos
          </Opcion>
        </>
      )}

      <p className="df-form__guardado">
        <i className="fa-solid fa-mobile-screen-button" aria-hidden="true" />
        Tu tarjeta quedará guardada en este celular para que no tengas que volver a escribir tus datos.
      </p>

      {error && (
        <p className="df-form__error" role="alert">
          <i className="fa-solid fa-circle-exclamation" aria-hidden="true" /> {error}
        </p>
      )}

      <button className="df-btn df-btn--bloque df-form__enviar" disabled={enviando}>
        {enviando ? (
          <><i className="fa-solid fa-spinner fa-spin" aria-hidden="true" /> Guardando...</>
        ) : esRegistro ? (
          <>Guardar mi tarjeta <i className="fa-solid fa-heart" aria-hidden="true" /></>
        ) : (
          <>Recuperar mis fresas <i className="fa-solid fa-rotate" aria-hidden="true" /></>
        )}
      </button>

      <p className="df-form__alterno">
        {esRegistro ? "¿Ya tienes tarjeta? " : "¿Primera vez? "}
        <button type="button" className="df-link" onClick={alternar}>
          {esRegistro ? "Recupérala aquí" : "Crea tu tarjeta"}
        </button>
      </p>

      <HojaInferior abierta={verPolitica} onCerrar={() => setVerPolitica(false)} titulo="Tratamiento de datos">
        <PoliticaDatos />
        <button type="button" className="df-btn df-btn--bloque" style={{ marginTop: 16 }}
          onClick={() => { setForm((f) => ({ ...f, acepta_datos: true })); setVerPolitica(false); setError(""); }}>
          Entendido, acepto <i className="fa-solid fa-check" aria-hidden="true" />
        </button>
      </HojaInferior>
    </form>
  );
};

/* Casilla grande, fácil de tocar con el dedo */
const Opcion = ({ name, checked, onChange, obligatoria = false, children }) => (
  <label className={`df-opcion ${checked ? "df-opcion--activa" : ""}`}>
    <input type="checkbox" name={name} checked={checked} onChange={onChange} />
    <span className="df-opcion__caja" aria-hidden="true">
      <i className="fa-solid fa-check" />
    </span>
    <span className="df-opcion__texto">
      {children}
      {obligatoria && <em> (obligatorio)</em>}
    </span>
  </label>
);

/* ------------------------------------------------------------------------ */
const TarjetaActiva = ({ t }) => {
  const { cliente, tarjeta } = t.datos;
  const requeridos = tarjeta.sellos_requeridos;
  const actuales = tarjeta.sellos_actuales;
  const codigoCorto = cliente.codigo.slice(0, 8).toUpperCase();
  const primerNombre = cliente.nombre.split(" ")[0];
  const sellos = useMemo(() => Array.from({ length: requeridos }, (_, i) => i + 1), [requeridos]);

  return (
    <div className="df-tarjeta">
      {t.selloNuevo && <Confeti />}

      <div className={`df-tarjeta__cara ${tarjeta.premio_disponible ? "df-tarjeta__cara--premio" : ""}`}>
        <div className="df-tarjeta__marca">
          <span className="df-tarjeta__logo">Dulce Fresa</span>
          <span className="df-tarjeta__codigo" title="Tu código de cliente">#{codigoCorto}</span>
        </div>

        <p className="df-tarjeta__hola">¡Hola, {primerNombre}!</p>

        <div className="df-tarjeta__sellos" style={{ "--cols": requeridos > 8 ? 5 : 4 }}>
          {sellos.map((n) => (
            <SelloFresa key={n} numero={n} lleno={n <= actuales}
              nuevo={t.selloNuevo && n === actuales} esPremio={n === requeridos} />
          ))}
        </div>

        <div className="df-tarjeta__progreso" aria-hidden="true">
          <span style={{ width: `${(actuales / requeridos) * 100}%` }} />
        </div>

        <p className="df-tarjeta__estado">
          {tarjeta.premio_disponible ? (
            <>¡Completaste tu tarjeta! Ganaste <strong>{tarjeta.premio}</strong></>
          ) : (
            <>
              {tarjeta.faltan === 1 ? "¡Te falta 1 fresa" : `Te faltan ${tarjeta.faltan} fresas`} para{" "}
              <strong>{tarjeta.premio}</strong>
            </>
          )}
        </p>
      </div>

      {tarjeta.premio_disponible ? (
        <div className="df-tarjeta__aviso df-tarjeta__aviso--premio">
          <i className="fa-solid fa-gift" aria-hidden="true" />
          <p>
            <strong>Muestra esta pantalla en caja</strong> y reclama tu premio con el código{" "}
            <strong>#{codigoCorto}</strong>
          </p>
        </div>
      ) : (
        <div className="df-tarjeta__aviso">
          <span className="df-tarjeta__nfc" aria-hidden="true">
            <i className="fa-solid fa-mobile-screen" />
            <i className="fa-solid fa-wifi" />
          </span>
          <p>
            En cada compra, <strong>acerca tu celular al NFC</strong> de la caja y suma una fresa.
          </p>
        </div>
      )}

      <BotonNotificaciones destacar={cliente.acepta_marketing} />

      <div className="df-tarjeta__pie">
        <span>
          <i className="fa-solid fa-ice-cream" aria-hidden="true" /> {tarjeta.total_compras}{" "}
          {tarjeta.total_compras === 1 ? "compra" : "compras"}
        </span>
        <span>
          <i className="fa-solid fa-gift" aria-hidden="true" /> {tarjeta.premios_canjeados}{" "}
          {tarjeta.premios_canjeados === 1 ? "premio" : "premios"}
        </span>
        <button type="button" className="df-link" onClick={t.salir}>
          ¿No eres {primerNombre}?
        </button>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------------ */
export const TarjetaCargando = () => (
  <div className="df-tarjeta" aria-busy="true" aria-label="Cargando tu tarjeta">
    <div className="df-tarjeta__cara df-tarjeta__cara--cargando">
      <span className="df-tarjeta__logo">Dulce Fresa</span>
      <div className="df-tarjeta__sellos" style={{ "--cols": 5 }}>
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className="df-sello df-sello--esqueleto" />
        ))}
      </div>
    </div>
  </div>
);

/* Lluvia de chispitas cuando se suma un sello */
const COLORES_CONFETI = ["#ec3a8f", "#3dbfd0", "#ffcf4a", "#ffffff", "#5fb35f", "#b5157a"];
const Confeti = () => {
  const piezas = useMemo(
    () =>
      Array.from({ length: 34 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        dur: 1.6 + Math.random() * 1.2,
        rot: Math.random() * 360,
        color: COLORES_CONFETI[i % COLORES_CONFETI.length],
      })),
    []
  );
  return (
    <div className="df-confeti" aria-hidden="true">
      {piezas.map((p, i) => (
        <span key={i} style={{ left: `${p.left}%`, background: p.color, animationDelay: `${p.delay}s`,
          animationDuration: `${p.dur}s`, "--rot": `${p.rot}deg` }} />
      ))}
    </div>
  );
};