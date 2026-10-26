import { NEGOCIO } from "../data/Negociodulcefresa";
import "../styles/PoliticaDatos.css";

/*
  Política de tratamiento de datos personales (Ley 1581 de 2012 y Decreto 1377 de 2013).
  ⚠️ Es una PLANTILLA: llena los "..." con los datos reales del negocio y pídele a
     un abogado o contador que la revise antes de usarla en serio.
*/
const RESPONSABLE = {
  razonSocial: "...", // ... nombre o razón social del dueño del negocio
  nit: "...", // ... NIT o cédula
  correo: "...", // ... correo para que la gente pida borrar o corregir sus datos
  telefono: "...", // ... teléfono de contacto
};

export const PoliticaDatos = () => (
  <div className="df-politica">
    <p className="df-politica__fecha">Última actualización: octubre de 2026</p>

    <h3>1. ¿Quién es el responsable?</h3>
    <p>
      <strong>{NEGOCIO.nombre} {NEGOCIO.subtitulo}</strong> ({RESPONSABLE.razonSocial}, NIT {RESPONSABLE.nit}),
      ubicada en {NEGOCIO.direccion}, {NEGOCIO.barrio}, {NEGOCIO.ciudad}. Correo: {RESPONSABLE.correo}. Teléfono:{" "}
      {RESPONSABLE.telefono}.
    </p>

    <h3>2. ¿Qué datos recogemos?</h3>
    <ul>
      <li>Tu nombre, correo y número de celular.</li>
      <li>Las compras que registras con el NFC (fecha y hora) y los premios que reclamas.</li>
      <li>Si activas los avisos, un identificador técnico del navegador para enviarte notificaciones.</li>
    </ul>
    <p>No pedimos datos sensibles ni datos de pago.</p>

    <h3>3. ¿Para qué los usamos?</h3>
    <ul>
      <li>Crear y mantener tu tarjeta de fidelización y llevar la cuenta de tus fresas.</li>
      <li>Entregarte los premios que ganes y evitar fraudes.</li>
      <li>Ayudarte a recuperar tu tarjeta si cambias de celular.</li>
      <li>
        <strong>Solo si lo aceptas:</strong> enviarte promociones, sabores nuevos y novedades por notificaciones o
        correo.
      </li>
    </ul>

    <h3>4. Tus derechos</h3>
    <p>Como titular de tus datos puedes, en cualquier momento y sin costo:</p>
    <ul>
      <li>Conocer, actualizar y corregir tus datos.</li>
      <li>Pedir que borremos tus datos o que dejemos de usarlos (revocar la autorización).</li>
      <li>Pedir prueba de la autorización que nos diste.</li>
      <li>Saber cómo hemos usado tus datos.</li>
      <li>Presentar quejas ante la Superintendencia de Industria y Comercio (SIC).</li>
    </ul>

    <h3>5. ¿Cómo ejercer tus derechos?</h3>
    <p>
      Escríbenos a <strong>{RESPONSABLE.correo}</strong> o pregúntanos en la heladería. Respondemos consultas en máximo
      10 días hábiles y reclamos en máximo 15 días hábiles. Puedes dejar de recibir promociones cuando quieras
      desactivando los avisos desde tu tarjeta.
    </p>

    <h3>6. Seguridad y tiempo de conservación</h3>
    <p>
      Guardamos tus datos en servidores con acceso restringido. No los vendemos ni los compartimos con terceros para
      fines comerciales. Los conservamos mientras tengas tu tarjeta activa o hasta que pidas borrarlos.
    </p>

    <p className="df-politica__nota">
      Al marcar “Acepto el tratamiento de mis datos” autorizas a {NEGOCIO.nombre} a tratar tus datos según esta
      política, conforme a la Ley 1581 de 2012.
    </p>
  </div>
);