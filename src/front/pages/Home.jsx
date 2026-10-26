import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { TarjetaFidelizacion, TarjetaCargando, FormularioTarjeta, usePrograma } from "../components/Tarjetafidelizacion";
import { SelloFresa } from "../components/Sellofresa";
import { FavoritoCard } from "../components/Favoritocard";
import { HojaInferior } from "../components/HojaInferior";
import { PanelPromos } from "../components/PanelPromos";
import { useMenu } from "../components/Menudigital";
import { useTarjeta } from "../hooks/useTarjeta";
import { NEGOCIO } from "../data/Negociodulcefresa";
import "../styles/Home.css";

/*
  HOME tipo linktree, 100% pensado para celular:
    1. Logo + "Dulce Fresa" animado + botón "¿Cómo funciona?"
    2. Tarjeta de fidelización (o el botón para crearla)
    3. Links: Menú digital (/menu) y Videos (/videos)
    4. Favoritos en cards
    5. Instagram y Dónde estamos
*/
export const Home = () => {
  const t = useTarjeta();
  const programa = usePrograma();
  const { productos, categorias } = useMenu();
  const [hoja, setHoja] = useState(null); // "registro" | "recuperar" | "como" | null
  const cerrar = useCallback(() => setHoja(null), []);

  const favoritos = productos.filter((p) => p.destacado).slice(0, 6);
  const nombreCategoria = (id) => categorias.find((c) => c.id === id)?.nombre;
  const horarios = NEGOCIO.horarios.filter((h) => h.horas && h.horas !== "...");

  return (
    <main className="df-lt">
      <div className="df-lt__col">
        {/* ======================================================= PERFIL */}
        <header className="df-lt__perfil">
          <LogoAnimado />
          <TituloAnimado texto={NEGOCIO.nombre} />
          <p className="df-lt__sub">
            {NEGOCIO.subtitulo} · {NEGOCIO.barrio}, {NEGOCIO.ciudad}
          </p>
          <button type="button" className="df-lt__como" onClick={() => setHoja("como")}>
            <i className="fa-solid fa-circle-question" aria-hidden="true" /> ¿Cómo funciona mi tarjeta?
          </button>
        </header>

        {/* ======================================================= TARJETA */}
        <section className="df-lt__tarjeta" aria-label="Tarjeta de fidelización">
          {t.cargando ? (
            <TarjetaCargando />
          ) : t.datos ? (
            <TarjetaFidelizacion t={t} />
          ) : (
            <div className="df-tarjeta">
              <div className="df-tarjeta__cara df-lt__cta">
                <div className="df-tarjeta__marca">
                  <span className="df-tarjeta__logo">Dulce Fresa</span>
                  <span className="df-tarjeta__tipo">Tarjeta de fidelidad</span>
                </div>
                <p className="df-lt__cta-titulo">Tu tarjeta de fresas</p>
                <div className="df-lt__cta-sellos" aria-hidden="true">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <SelloFresa key={n} numero={n} lleno={n === 1} esPremio={n === 5} />
                  ))}
                </div>
                <p className="df-lt__cta-texto">
                  Junta <strong>{programa.requeridos} fresas</strong> y gana <strong>{programa.premio}</strong>
                </p>
                <button type="button" className="df-btn df-btn--blanco df-btn--bloque df-lt__cta-btn"
                  onClick={() => setHoja("registro")}>
                  <i className="fa-solid fa-pen" aria-hidden="true" /> Llena tus datos y crea tu tarjeta
                </button>
              </div>
              <p className="df-lt__cta-alterno">
                ¿Ya tienes tarjeta?{" "}
                <button type="button" className="df-link" onClick={() => setHoja("recuperar")}>
                  Recupérala aquí
                </button>
              </p>
            </div>
          )}
        </section>

        {/* ======================================================= LINKS */}
        {/*
  <nav className="df-lt__links" aria-label="Enlaces">
    <LinkCard to="/menu" icono="fa-solid fa-utensils" color="rosa" etiqueta="Menú digital"
      titulo="¿Qué se te antoja hoy?" detalle="Precios, sabores y adiciones" />
    <LinkCard to="/videos" icono="fa-solid fa-play" color="turquesa" etiqueta="Videos"
      titulo="Antojos en video" detalle="Mira cómo preparamos tus favoritos" />
  </nav>
*/}

        {/* ======================================================= FAVORITOS */}
        {favoritos.length > 0 && (
          <section className="df-lt__favoritos" aria-labelledby="titulo-favoritos">
            <div className="df-lt__seccion-cab">
              <h2 id="titulo-favoritos">Los favoritos</h2>
              <span className="df-lt__toca">
                click it <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" />
              </span>
            </div>
            <div className="df-lt__fav-grid">
              {favoritos.map((p, i) => (
                <FavoritoCard key={p.id} producto={p} categoria={nombreCategoria(p.categoria)} indice={i} />
              ))}
            </div>
          </section>
        )}

        {/* ======================================================= REDES Y UBICACIÓN */}
        <div className="df-lt__links">
          <LinkCard href={NEGOCIO.instagramUrl} icono="fa-brands fa-instagram" color="instagram"
            etiqueta="Instagram" titulo={`@${NEGOCIO.instagram}`} detalle="Promos, sabores nuevos y ganadores" />
          {NEGOCIO.whatsapp && (
            <LinkCard href={`https://wa.me/${NEGOCIO.whatsapp}?text=${encodeURIComponent(NEGOCIO.mensajeWhatsapp)}`}
              icono="fa-brands fa-whatsapp" color="whatsapp" etiqueta="WhatsApp" titulo="Escríbenos"
              detalle="Pedidos y preguntas" />
          )}

          <div className="df-lt__ubicacion">
            <div className="df-lt__ubi-info">
              <span className="df-lt__link-icono df-lt__link-icono--amarillo" aria-hidden="true">
                <i className="fa-solid fa-location-dot" />
              </span>
              <span className="df-lt__link-texto">
                <span className="df-lt__link-etiqueta">Dónde estamos</span>
                <strong>{NEGOCIO.direccion}</strong>
                <span className="df-lt__link-detalle">
                  {NEGOCIO.barrio}, {NEGOCIO.ciudad}
                </span>
              </span>
            </div>

            {horarios.length > 0 && (
              <ul className="df-lt__horarios">
                {horarios.map((h) => (
                  <li key={h.dias}>
                    <span>{h.dias}</span>
                    <strong>{h.horas}</strong>
                  </li>
                ))}
              </ul>
            )}

            <a className="df-radar" href={NEGOCIO.mapsUrl} target="_blank" rel="noreferrer"
              aria-label="Abrir la ubicación de Dulce Fresa en Google Maps">
              <span className="df-radar__pantalla" aria-hidden="true">
                <span className="df-radar__anillo df-radar__anillo--1" />
                <span className="df-radar__anillo df-radar__anillo--2" />
                <span className="df-radar__cruz" />
                <span className="df-radar__barrido" />
                <span className="df-radar__punto df-radar__punto--1" />
                <span className="df-radar__punto df-radar__punto--2" />
                <span className="df-radar__punto df-radar__punto--3" />
                <span className="df-radar__onda" />
                <span className="df-radar__pin"><i className="fa-solid fa-ice-cream" /></span>
              </span>
              <span className="df-radar__texto">
                <span className="df-radar__estado">
                  <span className="df-radar__led" /> Señal encontrada
                </span>
                <strong>¡Hay un antojo cerca de ti!</strong>
                <span className="df-radar__ayuda">
                  Toca el radar para ver la ruta <i className="fa-solid fa-arrow-right df-flecha" />
                </span>
              </span>
            </a>

            <a className="df-btn df-btn--bloque df-lt__llegar" href={NEGOCIO.mapsUrl} target="_blank" rel="noreferrer">
              <i className="fa-solid fa-diamond-turn-right" aria-hidden="true" /> Cómo llegar
            </a>
          </div>
        </div>

        <footer className="df-lt__pie">
          Hecho con <i className="fa-solid fa-heart" aria-hidden="true" /> en {NEGOCIO.ciudad} · ©{" "}
          {new Date().getFullYear()} {NEGOCIO.nombre}
          <button type="button" className="df-lt__candado" onClick={() => setHoja("promos")} aria-label="Panel del equipo">
            <i className="fa-solid fa-lock" aria-hidden="true" />
          </button>
        </footer>
      </div>

      {/* ======================================================= HOJAS */}
      <HojaInferior
        abierta={hoja === "registro" || hoja === "recuperar"}
        onCerrar={cerrar}
        titulo={hoja === "recuperar" ? "Recupera tu tarjeta" : "Crea tu tarjeta"}
      >
        <FormularioTarjeta key={hoja} t={t} modoInicial={hoja || "registro"} onListo={cerrar} />
      </HojaInferior>

      <HojaInferior abierta={hoja === "como"} onCerrar={cerrar} titulo="¿Cómo funciona?">
        <ComoFunciona programa={programa} tieneTarjeta={Boolean(t.datos)} onCrear={() => setHoja("registro")} />
      </HojaInferior>

      <HojaInferior abierta={hoja === "promos"} onCerrar={cerrar} titulo="Panel del equipo">
        <PanelPromos />
      </HojaInferior>
    </main>
  );
};

/* ------------------------------------------------------------------ piezas */

/* Botón grande tipo linktree. Usa `to` para páginas internas o `href` para links externos */
const LinkCard = ({ to, href, icono, color, etiqueta, titulo, detalle }) => {
  const contenido = (
    <>
      <span className={`df-lt__link-icono df-lt__link-icono--${color}`} aria-hidden="true">
        <i className={icono} />
      </span>
      <span className="df-lt__link-texto">
        <span className="df-lt__link-etiqueta">{etiqueta}</span>
        <strong>{titulo}</strong>
        {detalle && <span className="df-lt__link-detalle">{detalle}</span>}
      </span>
      <span className="df-lt__link-flecha" aria-hidden="true">
        <i className="fa-solid fa-arrow-right df-flecha" />
      </span>
    </>
  );
  return to ? (
    <Link to={to} className="df-lt__link">{contenido}</Link>
  ) : (
    <a href={href} className="df-lt__link" target="_blank" rel="noreferrer">{contenido}</a>
  );
};

/* Logo con anillo de chispitas girando. Si subes el logo en negocioDulceFresa.js se usa la imagen */
const LogoAnimado = () => (
  <div className="df-lt__logo">
    <span className="df-lt__logo-anillo" aria-hidden="true" />
    <span className="df-lt__logo-circulo">
      {NEGOCIO.logo ? (
        <img src={NEGOCIO.logo} alt={`${NEGOCIO.nombre} ${NEGOCIO.subtitulo}`} />
      ) : (
        <i className="fa-solid fa-ice-cream" aria-hidden="true" />
      )}
    </span>
    <Fresa className="df-lt__logo-fresa df-lt__logo-fresa--1" />
    <Fresa className="df-lt__logo-fresa df-lt__logo-fresa--2" />
  </div>
);

/* "Dulce Fresa" letra por letra: caen al entrar y luego hacen una ola suave */
const TituloAnimado = ({ texto }) => (
  <h1 className="df-lt__titulo" aria-label={texto}>
    {[...texto].map((letra, i) => (
      <span key={i} aria-hidden="true" className={letra === " " ? "df-lt__espacio" : "df-lt__letra"}
        style={{ "--i": i }}>
        {letra}
      </span>
    ))}
  </h1>
);

const ComoFunciona = ({ programa, tieneTarjeta, onCrear }) => (
  <div className="df-como">
    <ol className="df-como__pasos">
      <li>
        <span className="df-como__icono df-como__icono--turquesa"><i className="fa-solid fa-id-card" /></span>
        <div>
          <strong>Crea tu tarjeta</strong>
          <p>Solo tu nombre, correo y celular. Sin apps ni contraseñas: queda guardada en tu celular.</p>
        </div>
      </li>
      <li>
        <span className="df-como__icono df-como__icono--rosa"><i className="fa-solid fa-mobile-screen-button" /></span>
        <div>
          <strong>Acerca tu celular al NFC</strong>
          <p>En cada compra toca el sticker NFC de la caja y se suma una fresa a tu tarjeta.</p>
        </div>
      </li>
      <li>
        <span className="df-como__icono df-como__icono--amarillo"><i className="fa-solid fa-gift" /></span>
        <div>
          <strong>Gana tu premio</strong>
          <p>
            Al juntar {programa.requeridos} fresas ganas {programa.premio} Muestra tu tarjeta en caja.
          </p>
        </div>
      </li>
    </ol>
    <p className="df-como__nota">
      <i className="fa-solid fa-lightbulb" aria-hidden="true" /> ¿Cambiaste de celular? Recupera tu tarjeta con tu
      correo y celular; tus fresas no se pierden.
    </p>
    {!tieneTarjeta && (
      <button type="button" className="df-btn df-btn--bloque" onClick={onCrear}>
        Crear mi tarjeta <i className="fa-solid fa-arrow-right" aria-hidden="true" />
      </button>
    )}
  </div>
);

const Fresa = ({ className }) => (
  <svg className={className} viewBox="0 0 48 54" aria-hidden="true">
    <path fill="#ef2d55" d="M24 51C11 45 4 34 4 24C4 16 10 12 24 12C38 12 44 16 44 24C44 34 37 45 24 51Z" />
    <ellipse cx="14" cy="23" rx="3.5" ry="6" fill="#fff" opacity=".35" />
    {[[15, 30], [24, 25], [33, 30], [19, 38], [29, 38], [24, 45]].map(([x, y]) => (
      <ellipse key={`${x}${y}`} cx={x} cy={y} rx="1.3" ry="2" fill="#ffe7a3" />
    ))}
    <path fill="#5fb35f" d="M24 15C19 8 11 8 7 12C13 12 17 14 24 18C31 14 35 12 41 12C37 8 29 8 24 15Z" />
  </svg>
);