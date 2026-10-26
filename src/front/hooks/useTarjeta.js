import { useCallback, useEffect, useState } from "react";
import {
  getToken,
  olvidarTarjeta,
  obtenerTarjeta,
  registrarCliente,
  recuperarTarjeta,
  sumarSello,
  cerrarTarjeta,
} from "../services/fidelizacion";

/*
  Estado de la tarjeta de fidelización del celular actual.

  const t = useTarjeta();
  t.cargando     -> true mientras consulta la API
  t.datos        -> { cliente, tarjeta, historial? }  o null si no hay tarjeta en este celular
  t.selloNuevo   -> true justo después de sumar un sello (para animar)
  t.registrar(form) / t.recuperar(form) / t.sellar(tag) / t.salir()
*/
export function useTarjeta() {
  const [cargando, setCargando] = useState(true);
  const [datos, setDatos] = useState(null);
  const [selloNuevo, setSelloNuevo] = useState(false);

  const cargar = useCallback(async () => {
    // Siempre preguntamos al servidor: aunque Safari haya borrado el localStorage,
    // la cookie de 1 año del servidor sigue reconociendo la tarjeta.
    setCargando(true);
    try {
      setDatos(await obtenerTarjeta());
    } catch (e) {
      if (e.codigo_error === "SIN_TARJETA") olvidarTarjeta(); // token viejo (recuperó en otro celular)
      setDatos(null);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const registrar = useCallback(async (form) => {
    const data = await registrarCliente(form);
    setDatos(data);
    setSelloNuevo(Boolean(data.sello_nuevo));
    return data;
  }, []);

  const recuperar = useCallback(async (form) => {
    const data = await recuperarTarjeta(form);
    setDatos(data);
    return data;
  }, []);

  const sellar = useCallback(async (tag) => {
    const data = await sumarSello(tag);
    setDatos(data);
    setSelloNuevo(true);
    return data;
  }, []);

  const salir = useCallback(() => {
    cerrarTarjeta(); // borra la cookie del servidor
    olvidarTarjeta();
    setDatos(null);
    setSelloNuevo(false);
  }, []);

  return { cargando, datos, selloNuevo, tieneToken: Boolean(getToken()), cargar, registrar, recuperar, sellar, salir };
}