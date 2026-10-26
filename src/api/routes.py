"""
API de DULCEFRESA (todas las rutas viven bajo /api)

PÚBLICAS (cliente)
  GET  /api/programa                 reglas de la tarjeta
  POST /api/clientes/registro        crea el cliente y devuelve su token "recordarme"
  POST /api/clientes/recuperar       recupera la tarjeta en otro celular (correo + teléfono)
  GET  /api/tarjeta                  estado de la tarjeta     [X-Cliente-Token]
  POST /api/sellos                   suma un sello con el tag  [X-Cliente-Token]
  GET  /api/menu                     menú digital agrupado por categoría
  GET  /api/contenido                imágenes y videos activos (?seccion=hero)

ADMIN (personal de la heladería)   [Authorization: Bearer <JWT>]
  POST   /api/admin/login
  GET    /api/admin/clientes                     ?q=busqueda
  GET    /api/admin/clientes/<codigo>
  POST   /api/admin/clientes/<codigo>/sellos     sello manual
  POST   /api/admin/clientes/<codigo>/canjear    entrega el premio
  PATCH  /api/admin/sellos/<id>/anular
  GET    /api/admin/estadisticas
  GET|PUT                 /api/admin/programa
  GET|POST|PUT|DELETE     /api/admin/tags, /api/admin/categorias, /api/admin/productos, /api/admin/contenido
"""
import re
from datetime import timedelta
from zoneinfo import ZoneInfo

from flask import request, jsonify, Blueprint
from flask_cors import CORS
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError

from api.models import (db, ahora, User, ProgramaFidelizacion, Cliente, NfcTag, Sello, Canje,
                        CategoriaMenu, ProductoMenu, Contenido)
from api.utils import APIException

api = Blueprint('api', __name__)
CORS(api)

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


# ===========================================================================
# Utilidades
# ===========================================================================
def body():
    return request.get_json(silent=True) or {}


def limpiar_correo(valor):
    correo = (valor or "").strip().lower()
    if not EMAIL_RE.match(correo):
        raise APIException("Correo inválido", 400)
    return correo


def limpiar_telefono(valor):
    """Deja solo dígitos. Acepta 3001234567 o +57 300 123 4567 (se guarda sin el 57)."""
    digitos = re.sub(r"\D", "", str(valor or ""))
    if len(digitos) == 12 and digitos.startswith("57"):
        digitos = digitos[2:]
    if not 7 <= len(digitos) <= 15:
        raise APIException("Teléfono inválido", 400)
    return digitos


COOKIE_TARJETA = "df_tarjeta"
COOKIE_DURACION = 60 * 60 * 24 * 365  # 1 año


def token_actual():
    """El token llega en la cabecera (localStorage) o en la cookie del servidor (respaldo para Safari)."""
    return request.headers.get("X-Cliente-Token") or request.cookies.get(COOKIE_TARJETA)


def cliente_actual():
    cliente = Cliente.por_token(token_actual())
    if cliente is None:
        raise APIException("Tarjeta no encontrada en este dispositivo", 401, {"codigo_error": "SIN_TARJETA"})
    return cliente


def con_cookie(respuesta, codigo, token=None):
    """
    Guarda (o renueva por 1 año) la cookie de la tarjeta.
    Safari borra el localStorage tras 7 días sin visitas, pero NO las cookies que pone el servidor.
    """
    respuesta = jsonify(respuesta)
    token = token or token_actual()
    if token:
        respuesta.set_cookie(COOKIE_TARJETA, token, max_age=COOKIE_DURACION, httponly=True,
                             secure=True, samesite="Lax", path="/api")
    return respuesta, codigo


def tag_valido(codigo):
    if not codigo:
        raise APIException("Falta el código del tag NFC", 400, {"codigo_error": "SIN_TAG"})
    tag = db.session.execute(db.select(NfcTag).where(NfcTag.codigo == codigo)).scalar_one_or_none()
    if tag is None or not tag.activo:
        raise APIException("Este tag NFC no es válido", 400, {"codigo_error": "TAG_INVALIDO"})
    return tag


def otorgar_sello(cliente, programa, tag=None, origen="nfc", respetar_cooldown=True):
    """Suma un sello si no está dentro del tiempo de espera. Devuelve el Sello creado."""
    if not programa.activo:
        raise APIException("El programa de fidelización está pausado", 403, {"codigo_error": "PROGRAMA_PAUSADO"})

    if respetar_cooldown and cliente.sellos:
        ultimo = max(s.fecha for s in cliente.sellos)
        if ultimo.tzinfo is None:  # SQLite devuelve fechas sin zona horaria
            ultimo = ultimo.replace(tzinfo=ahora().tzinfo)
        disponible_en = ultimo + timedelta(minutes=programa.cooldown_minutos)
        if ahora() < disponible_en:
            minutos = int((disponible_en - ahora()).total_seconds() // 60) + 1
            raise APIException(f"Ya registraste esta compra. Podrás sumar otro sello en {minutos} min.", 429,
                               {"codigo_error": "COOLDOWN", "minutos_restantes": minutos})

    sello = Sello(cliente=cliente, tag=tag, origen=origen)
    cliente.ultima_visita = ahora()
    db.session.add(sello)
    return sello


def respuesta_tarjeta(cliente, programa, **extra):
    data = {"cliente": cliente.serialize(), "tarjeta": cliente.resumen_tarjeta(programa)}
    data.update(extra)
    return data


def obtener_o_404(modelo, id_):
    obj = db.session.get(modelo, id_)
    if obj is None:
        raise APIException("No encontrado", 404)
    return obj


def cliente_por_codigo(codigo):
    cliente = db.session.execute(db.select(Cliente).where(Cliente.codigo == codigo)).scalar_one_or_none()
    if cliente is None:
        raise APIException("Cliente no encontrado", 404)
    return cliente


def aplicar_campos(obj, data, campos):
    for campo in campos:
        if campo in data:
            setattr(obj, campo, data[campo])


# ===========================================================================
# RUTAS PÚBLICAS
# ===========================================================================
@api.route('/programa', methods=['GET'])
def ver_programa():
    return jsonify(ProgramaFidelizacion.actual().serialize()), 200


@api.route('/clientes/registro', methods=['POST'])
def registrar_cliente():
    """
    Body: { nombre, correo, telefono, acepta_marketing?, tag? }
    Si viene `tag` (la persona llegó escaneando el NFC) se le da el primer sello.
    Devuelve `token`: el front lo guarda en el celular para "recordarme".
    """
    data = body()
    nombre = (data.get("nombre") or "").strip()
    if len(nombre) < 2:
        raise APIException("Escribe tu nombre", 400)
    correo = limpiar_correo(data.get("correo"))
    telefono = limpiar_telefono(data.get("telefono"))

    existente = db.session.execute(
        db.select(Cliente).where(or_(Cliente.correo == correo, Cliente.telefono == telefono))
    ).scalar_one_or_none()
    if existente:
        raise APIException("Ya tienes una tarjeta. Recupérala con tu correo y teléfono.", 409,
                           {"codigo_error": "YA_REGISTRADO"})

    programa = ProgramaFidelizacion.actual()
    cliente = Cliente(nombre=nombre, correo=correo, telefono=telefono,
                      acepta_marketing=bool(data.get("acepta_marketing", False)))
    token = cliente.generar_token()
    db.session.add(cliente)

    sello_nuevo = False
    if data.get("tag"):
        otorgar_sello(cliente, programa, tag=tag_valido(data["tag"]))
        sello_nuevo = True

    try:
        db.session.commit()
    except IntegrityError:  # doble clic o dos registros simultáneos con el mismo correo/teléfono
        db.session.rollback()
        raise APIException("Ya tienes una tarjeta. Recupérala con tu correo y teléfono.", 409,
                           {"codigo_error": "YA_REGISTRADO"})
    return con_cookie(respuesta_tarjeta(cliente, programa, token=token, sello_nuevo=sello_nuevo), 201, token)


@api.route('/clientes/recuperar', methods=['POST'])
def recuperar_tarjeta():
    """
    Body: { correo, telefono }  -> ambos deben coincidir.
    Genera un token nuevo para este celular (el celular anterior queda desvinculado).
    """
    data = body()
    correo = limpiar_correo(data.get("correo"))
    telefono = limpiar_telefono(data.get("telefono"))
    cliente = db.session.execute(
        db.select(Cliente).where(Cliente.correo == correo, Cliente.telefono == telefono)
    ).scalar_one_or_none()
    if cliente is None:
        raise APIException("No encontramos una tarjeta con esos datos", 404, {"codigo_error": "NO_ENCONTRADO"})

    token = cliente.generar_token()
    db.session.commit()
    return con_cookie(respuesta_tarjeta(cliente, ProgramaFidelizacion.actual(), token=token), 200, token)


@api.route('/clientes/salir', methods=['POST'])
def salir_tarjeta():
    """ "¿No eres tú?": desconecta solo este dispositivo y borra la cookie."""
    token = token_actual()
    cliente = Cliente.por_token(token)
    if cliente:
        cliente.cerrar_dispositivo(token)
        db.session.commit()
    respuesta = jsonify({"ok": True})
    respuesta.delete_cookie(COOKIE_TARJETA, path="/api", secure=True, samesite="Lax")
    return respuesta, 200


@api.route('/tarjeta', methods=['GET'])
def ver_tarjeta():
    cliente = cliente_actual()
    programa = ProgramaFidelizacion.actual()
    db.session.commit()  # guarda el "último uso" del dispositivo
    return con_cookie(respuesta_tarjeta(
        cliente, programa,
        historial=[s.serialize() for s in cliente.sellos[:20]],
        canjes=[c.serialize() for c in cliente.canjes[:10]],
    ), 200)


@api.route('/sellos', methods=['POST'])
def sumar_sello():
    """
    El celular toca el NFC -> abre /sello?t=<codigo_tag> -> el front llama aquí.
    Body: { tag }   Cabecera: X-Cliente-Token
    """
    cliente = cliente_actual()
    tag = tag_valido(body().get("tag"))
    programa = ProgramaFidelizacion.actual()
    otorgar_sello(cliente, programa, tag=tag)
    db.session.commit()
    return con_cookie(respuesta_tarjeta(cliente, programa, sello_nuevo=True), 201)


@api.route('/menu', methods=['GET'])
def ver_menu():
    categorias = db.session.execute(
        db.select(CategoriaMenu).where(CategoriaMenu.activo.is_(True)).order_by(CategoriaMenu.orden)
    ).scalars().all()
    sin_categoria = db.session.execute(
        db.select(ProductoMenu).where(ProductoMenu.categoria_id.is_(None), ProductoMenu.disponible.is_(True))
        .order_by(ProductoMenu.orden)
    ).scalars().all()
    destacados = db.session.execute(
        db.select(ProductoMenu).where(ProductoMenu.destacado.is_(True), ProductoMenu.disponible.is_(True))
        .order_by(ProductoMenu.orden)
    ).scalars().all()

    data = [c.serialize(con_productos=True) for c in categorias]
    if sin_categoria:
        data.append({"id": None, "nombre": "Otros", "productos": [p.serialize() for p in sin_categoria]})
    return jsonify({"destacados": [p.serialize() for p in destacados], "categorias": data}), 200


@api.route('/contenido', methods=['GET'])
def ver_contenido():
    consulta = db.select(Contenido).where(Contenido.activo.is_(True))
    if request.args.get("seccion"):
        consulta = consulta.where(Contenido.seccion == request.args["seccion"])
    items = db.session.execute(consulta.order_by(Contenido.seccion, Contenido.orden)).scalars().all()
    return jsonify([c.serialize() for c in items]), 200


# ===========================================================================
# RUTAS ADMIN
# ===========================================================================
@api.route('/admin/login', methods=['POST'])
def admin_login():
    data = body()
    user = db.session.execute(
        db.select(User).where(User.email == (data.get("email") or "").strip().lower())
    ).scalar_one_or_none()
    if user is None or not user.is_active or not user.check_password(data.get("password") or ""):
        raise APIException("Credenciales inválidas", 401)
    token = create_access_token(identity=str(user.id), expires_delta=timedelta(hours=12))
    return jsonify({"token": token, "user": user.serialize()}), 200


# ---- Clientes, sellos y canjes --------------------------------------------
@api.route('/admin/clientes', methods=['GET'])
@jwt_required()
def admin_clientes():
    programa = ProgramaFidelizacion.actual()
    consulta = db.select(Cliente).order_by(Cliente.ultima_visita.desc().nullslast(), Cliente.creado_en.desc())
    q = (request.args.get("q") or "").strip()
    if q:
        patron = f"%{q.lower()}%"
        consulta = consulta.where(or_(func.lower(Cliente.nombre).like(patron),
                                      Cliente.correo.like(patron), Cliente.telefono.like(patron)))
    clientes = db.session.execute(consulta).scalars().all()
    return jsonify([{**c.serialize(), **c.resumen_tarjeta(programa)} for c in clientes]), 200


@api.route('/admin/clientes/<codigo>', methods=['GET'])
@jwt_required()
def admin_detalle_cliente(codigo):
    cliente = cliente_por_codigo(codigo)
    return jsonify(respuesta_tarjeta(
        cliente, ProgramaFidelizacion.actual(),
        historial=[s.serialize() for s in cliente.sellos],
        canjes=[c.serialize() for c in cliente.canjes],
    )), 200


@api.route('/admin/clientes/<codigo>/sellos', methods=['POST'])
@jwt_required()
def admin_sello_manual(codigo):
    """Por si el cliente no tiene el celular a mano o el NFC falla. Ignora el cooldown."""
    cliente = cliente_por_codigo(codigo)
    programa = ProgramaFidelizacion.actual()
    cantidad = max(1, min(int(body().get("cantidad", 1)), 10))
    for _ in range(cantidad):
        otorgar_sello(cliente, programa, origen="manual", respetar_cooldown=False)
    db.session.commit()
    return jsonify(respuesta_tarjeta(cliente, programa)), 201


@api.route('/admin/clientes/<codigo>/canjear', methods=['POST'])
@jwt_required()
def admin_canjear(codigo):
    """Entrega el premio: marca como 'canjeado' los sellos más antiguos necesarios."""
    cliente = cliente_por_codigo(codigo)
    programa = ProgramaFidelizacion.actual()
    activos = sorted(cliente.sellos_activos, key=lambda s: s.fecha)
    if len(activos) < programa.sellos_requeridos:
        raise APIException(f"Le faltan {programa.sellos_requeridos - len(activos)} sellos para el premio", 400,
                           {"codigo_error": "SELLOS_INSUFICIENTES"})

    canje = Canje(cliente=cliente, premio=programa.premio, sellos_usados=programa.sellos_requeridos,
                  atendido_por=int(get_jwt_identity()))
    db.session.add(canje)
    db.session.flush()
    for sello in activos[:programa.sellos_requeridos]:
        sello.estado = "canjeado"
        sello.canje_id = canje.id
    db.session.commit()
    return jsonify(respuesta_tarjeta(cliente, programa, canje=canje.serialize())), 200


@api.route('/admin/sellos/<int:sello_id>/anular', methods=['PATCH'])
@jwt_required()
def admin_anular_sello(sello_id):
    sello = obtener_o_404(Sello, sello_id)
    if sello.estado != "activo":
        raise APIException("Solo se pueden anular sellos activos", 400)
    sello.estado = "anulado"
    db.session.commit()
    return jsonify(sello.serialize()), 200


@api.route('/admin/estadisticas', methods=['GET'])
@jwt_required()
def admin_estadisticas():
    hoy = ahora().astimezone(ZoneInfo("America/Bogota")).replace(hour=0, minute=0, second=0, microsecond=0)
    contar = lambda consulta: db.session.execute(consulta).scalar() or 0
    return jsonify({
        "clientes": contar(db.select(func.count(Cliente.id))),
        "compras_totales": contar(db.select(func.count(Sello.id)).where(Sello.estado != "anulado")),
        "compras_hoy": contar(db.select(func.count(Sello.id)).where(Sello.fecha >= hoy, Sello.estado != "anulado")),
        "premios_canjeados": contar(db.select(func.count(Canje.id))),
        "clientes_nuevos_30d": contar(db.select(func.count(Cliente.id))
                                      .where(Cliente.creado_en >= ahora() - timedelta(days=30))),
    }), 200


# ---- Programa ---------------------------------------------------------------
@api.route('/admin/programa', methods=['GET', 'PUT'])
@jwt_required()
def admin_programa():
    programa = ProgramaFidelizacion.actual()
    if request.method == 'PUT':
        data = body()
        aplicar_campos(programa, data, ["nombre", "premio", "activo"])
        for campo in ["sellos_requeridos", "cooldown_minutos"]:
            if campo in data:
                setattr(programa, campo, max(0 if campo == "cooldown_minutos" else 1, int(data[campo])))
        db.session.commit()
    return jsonify(programa.serialize()), 200


# ---- CRUD genérico: tags, categorías, productos, contenido -------------------
def registrar_crud(ruta, modelo, campos, requeridos):
    """Crea GET (lista), POST, PUT y DELETE para un modelo simple."""

    def listar():
        orden = getattr(modelo, "orden", modelo.id)
        items = db.session.execute(db.select(modelo).order_by(orden)).scalars().all()
        return jsonify([i.serialize() for i in items]), 200

    def crear():
        data = body()
        faltan = [c for c in requeridos if not data.get(c)]
        if faltan:
            raise APIException(f"Faltan campos: {', '.join(faltan)}", 400)
        obj = modelo()
        aplicar_campos(obj, data, campos)
        db.session.add(obj)
        db.session.commit()
        return jsonify(obj.serialize()), 201

    def editar(item_id):
        obj = obtener_o_404(modelo, item_id)
        aplicar_campos(obj, body(), campos)
        db.session.commit()
        return jsonify(obj.serialize()), 200

    def eliminar(item_id):
        obj = obtener_o_404(modelo, item_id)
        db.session.delete(obj)
        db.session.commit()
        return jsonify({"eliminado": item_id}), 200

    nombre = ruta.replace("/", "_")
    api.add_url_rule(f"/admin/{ruta}", f"listar_{nombre}", jwt_required()(listar), methods=["GET"])
    api.add_url_rule(f"/admin/{ruta}", f"crear_{nombre}", jwt_required()(crear), methods=["POST"])
    api.add_url_rule(f"/admin/{ruta}/<int:item_id>", f"editar_{nombre}", jwt_required()(editar), methods=["PUT"])
    api.add_url_rule(f"/admin/{ruta}/<int:item_id>", f"eliminar_{nombre}", jwt_required()(eliminar),
                     methods=["DELETE"])


registrar_crud("tags", NfcTag, ["nombre", "activo"], [])
registrar_crud("categorias", CategoriaMenu, ["nombre", "orden", "activo"], ["nombre"])
registrar_crud("productos", ProductoMenu,
               ["categoria_id", "nombre", "descripcion", "precio", "imagen_url", "destacado", "disponible", "orden"],
               ["nombre"])
registrar_crud("contenido", Contenido, ["tipo", "url", "titulo", "seccion", "orden", "activo"], ["tipo", "url"])



# ===========================================================================
# NOTIFICACIONES PUSH (promos a los clientes que aceptaron)
# ===========================================================================
import hmac
import json
import os

from pywebpush import webpush, WebPushException
from api.models import SuscripcionPush

# ⚠️ Clave del panel de promos. Está en el código SOLO PARA PROBAR.
#    Para producción ponla en Render como variable CLAVE_PROMOS y cámbiala.
CLAVE_PROMOS = os.getenv("CLAVE_PROMOS", "heladofresa")


def verificar_clave_promos():
    clave = request.headers.get("X-Clave-Promos", "")
    if not hmac.compare_digest(clave.encode(), CLAVE_PROMOS.encode()):
        raise APIException("Clave incorrecta", 401, {"codigo_error": "CLAVE_INCORRECTA"})


def suscripciones_activas():
    return db.session.execute(
        db.select(SuscripcionPush).join(Cliente).where(Cliente.acepta_marketing.is_(True))
    ).scalars().all()


@api.route('/push/clave-publica', methods=['GET'])
def push_clave_publica():
    return jsonify({"clave": os.getenv("VAPID_PUBLIC_KEY", "")}), 200


@api.route('/push/suscribir', methods=['POST'])
def push_suscribir():
    cliente = cliente_actual()
    data = body()
    endpoint = data.get("endpoint")
    llaves = data.get("keys") or {}
    if not endpoint or not llaves.get("p256dh") or not llaves.get("auth"):
        raise APIException("Suscripción inválida", 400)

    sub = db.session.execute(
        db.select(SuscripcionPush).where(SuscripcionPush.endpoint == endpoint)
    ).scalar_one_or_none()
    if sub is None:
        sub = SuscripcionPush(endpoint=endpoint)
        db.session.add(sub)
    sub.cliente = cliente
    sub.p256dh = llaves["p256dh"]
    sub.auth = llaves["auth"]
    cliente.acepta_marketing = True  # activar avisos = aceptar promos
    db.session.commit()
    return jsonify({"ok": True}), 201


@api.route('/push/cancelar', methods=['POST'])
def push_cancelar():
    cliente = cliente_actual()
    endpoint = body().get("endpoint")
    db.session.execute(
        db.delete(SuscripcionPush).where(SuscripcionPush.endpoint == endpoint,
                                         SuscripcionPush.cliente_id == cliente.id)
    )
    db.session.commit()
    return jsonify({"ok": True}), 200


@api.route('/promos/resumen', methods=['GET'])
def promos_resumen():
    verificar_clave_promos()
    subs = suscripciones_activas()
    return jsonify({"celulares": len(subs), "clientes": len({s.cliente_id for s in subs})}), 200


@api.route('/promos/enviar', methods=['POST'])
def promos_enviar():
    verificar_clave_promos()
    data = body()
    titulo = (data.get("titulo") or "").strip()[:60]
    mensaje = (data.get("mensaje") or "").strip()[:180]
    url = (data.get("url") or "/").strip() or "/"
    if not titulo or not mensaje:
        raise APIException("Escribe un título y un mensaje", 400)

    privada = os.getenv("VAPID_PRIVATE_KEY")
    if not privada or not os.getenv("VAPID_PUBLIC_KEY"):
        raise APIException("Faltan las llaves VAPID en el servidor (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY)", 500)
    reclamos = {"sub": "mailto:" + os.getenv("VAPID_EMAIL", "contacto@dulcefresa.com")}
    carga = json.dumps({"title": titulo, "body": mensaje, "url": url})

    enviados, fallidos, borrados = 0, 0, 0
    for sub in suscripciones_activas():
        try:
            webpush(sub.como_webpush(), carga, vapid_private_key=privada, vapid_claims=dict(reclamos),
                    ttl=60 * 60 * 24, timeout=10)
            enviados += 1
        except WebPushException as e:
            codigo = getattr(e.response, "status_code", None)
            if codigo in (404, 410):  # el celular canceló o desinstaló: se borra
                db.session.delete(sub)
                borrados += 1
            else:
                fallidos += 1
        except Exception:
            fallidos += 1
    db.session.commit()
    return jsonify({"enviados": enviados, "fallidos": fallidos, "eliminados": borrados}), 200