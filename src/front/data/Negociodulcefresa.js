/* ==========================================================================
   DATOS DEL NEGOCIO, FOTOS Y VIDEOS DE LA PÁGINA
   Todo lo que tenga "..." es para que lo llenes.

   📸 / 🎬 Fotos y videos:
     - Guárdalos en /public/img/... o /public/video/... y usa "/img/archivo.jpg"
     - O pega un link de Cloudinary / Supabase Storage.
     - Videos: formato .mp4, verticales (9:16), idealmente < 8 MB para que carguen rápido.
       Los reels de Instagram los puedes descargar y subir aquí.
   ========================================================================== */

// Nombre EXACTO como aparece en Google Maps + dirección: así Maps encuentra el negocio y no otra cosa
const DIRECCION_MAPA = "Dulce Fresa Heladería El Galán, Cra. 56 #4d-95, Puente Aranda, Bogotá";

export const NEGOCIO = {
  nombre: "Dulce Fresa",
  subtitulo: "Heladería",
  eslogan: "Helado de yogurt, fresas con crema y antojos que se vuelven costumbre.",

  logo: "", // ... aquí pega el link del logo (círculo turquesa). Si queda vacío se dibuja un logo animado.

  instagram: "dulcefresasheladeria",
  instagramUrl: "https://www.instagram.com/dulcefresasheladeria/",
  whatsapp: "", // ... aquí pega el número con indicativo, sin espacios. Ej: "573001234567"
  mensajeWhatsapp: "¡Hola Dulce Fresa! Quiero hacer un pedido 🍓",

  direccion: "Cra. 56 #4d-95",
  barrio: "Puente Aranda",
  ciudad: "Bogotá",
  // Link que abre Google Maps con la ruta (en celular abre la app de Maps)
  mapsUrl: `https://maps.app.goo.gl/nbjno8BEGXeaDxQ96?g_st=iw`,
  // Mapa pequeño que se ve dentro de la tarjeta "Dónde estamos" (no necesita API key)
  mapaEmbed: `https://www.google.com/maps?q=${encodeURIComponent(DIRECCION_MAPA)}&z=16&output=embed`,

  horarios: [
    // ... ajusta los horarios reales. Mientras diga "...", no se muestran.
    { dias: "Lunes a viernes", horas: "..." },
    { dias: "Sábados y domingos", horas: "..." },
  ],
};

/* Galería de la página /videos.
   tipo: "video" o "imagen". poster = imagen de portada del video (opcional). */
export const GALERIA = [
  { tipo: "video", url: "", poster: "", titulo: "Cono terror" }, // ... aquí pega el link del video
  { tipo: "imagen", url: "", titulo: "Fresas con crema" }, // ... aquí pega el link de la imagen
  { tipo: "imagen", url: "", titulo: "Malteada Chococrispy" }, // ... aquí pega el link de la imagen
  { tipo: "video", url: "", poster: "", titulo: "Bubble wafle" }, // ... aquí pega el link del video
  { tipo: "imagen", url: "", titulo: "Tarro Chocokrispy" }, // ... aquí pega el link de la imagen
  { tipo: "imagen", url: "", titulo: "Parfait de frutas" }, // ... aquí pega el link de la imagen
  { tipo: "video", url: "", poster: "", titulo: "Así preparamos tu helado" }, // ... aquí pega el link del video
  { tipo: "imagen", url: "", titulo: "Clientes felices" }, // ... aquí pega el link de la imagen
];