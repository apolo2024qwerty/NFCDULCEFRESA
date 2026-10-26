import { useEffect } from "react";
import { createPortal } from "react-dom";
import "../styles/HojaInferior.css";

/*
  Hoja que sube desde abajo (bottom sheet), pensada para celular.
  <HojaInferior abierta={x} onCerrar={() => setX(false)} titulo="...">contenido</HojaInferior>
*/
export const HojaInferior = ({ abierta, onCerrar, titulo, children }) => {
  // Bloquea el scroll de la página de fondo y permite cerrar con Escape
  useEffect(() => {
    if (!abierta) return;
    const overflowAntes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const alTeclear = (e) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", alTeclear);
    return () => {
      document.body.style.overflow = overflowAntes;
      window.removeEventListener("keydown", alTeclear);
    };
  }, [abierta, onCerrar]);

  if (!abierta) return null;

  return createPortal(
    <div className="df-hoja" role="dialog" aria-modal="true" aria-label={titulo}>
      <button type="button" className="df-hoja__fondo" aria-label="Cerrar" onClick={onCerrar} />
      <div className="df-hoja__panel">
        <div className="df-hoja__agarre" aria-hidden="true" />
        <div className="df-hoja__cabecera">
          {titulo && <h2>{titulo}</h2>}
          <button type="button" className="df-hoja__cerrar" onClick={onCerrar} aria-label="Cerrar">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
        <div className="df-hoja__contenido">{children}</div>
      </div>
    </div>,
    document.body
  );
};