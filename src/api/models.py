"""
Modelos de DULCEFRESA — Tarjeta de fidelización NFC + menú digital.

Tablas:
  user                      -> personal/administradores (login con email + contraseña)
  programa_fidelizacion     -> reglas de la tarjeta (sellos requeridos, premio, cooldown)
  cliente                   -> clientes registrados (nombre, correo, teléfono, id único)
  nfc_tag                   -> cada tag/pegatina NFC física que hay en la heladería
  sello                     -> cada compra registrada (un sello = una compra)
  canje                     -> cada vez que un cliente reclama su premio
  categoria_menu            -> categorías del menú (Helados, Malteadas, Toppings...)
  producto_menu             -> productos del menú digital
  contenido                 -> imágenes y videos de la landing (galería / hero)
"""
import hashlib
import secrets
import uuid
from datetime import datetime, timezone

from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import String, Boolean, Integer, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()


def ahora():
    return datetime.now(timezone.utc)


def iso(fecha):
    return fecha.isoformat() if fecha else None


# ---------------------------------------------------------------------------
# Personal / administradores
# ---------------------------------------------------------------------------
class User(db.Model):
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    password: Mapped[str] = mapped_column(String(256), nullable=False)
    nombre: Mapped[str | None] = mapped_column(String(120))
    is_active: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=True)

    def set_password(self, raw):
        self.password = generate_password_hash(raw)

    def check_password(self, raw):
        return check_password_hash(self.password, raw)

    def serialize(self):
        return {"id": self.id, "email": self.email, "nombre": self.nombre}


# ---------------------------------------------------------------------------
# Reglas del programa (una sola fila)
# ---------------------------------------------------------------------------
class ProgramaFidelizacion(db.Model):
    __tablename__ = "programa_fidelizacion"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(120), default="Tarjeta DulceFresa")
    sellos_requeridos: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    premio: Mapped[str] = mapped_column(String(255), default="¡Un helado gratis de 2 bolas!", nullable=False)
    # Minutos mínimos entre dos sellos del mismo cliente (evita taps repetidos)
    cooldown_minutos: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    actualizado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=ahora, onupdate=ahora)

    @classmethod
    def actual(cls):
        """Devuelve la configuración vigente; la crea con valores por defecto si no existe."""
        programa = db.session.execute(db.select(cls).order_by(cls.id)).scalars().first()
        if programa is None:
            programa = cls()
            db.session.add(programa)
            db.session.commit()
        return programa

    def serialize(self):
        return {
            "nombre": self.nombre,
            "sellos_requeridos": self.sellos_requeridos,
            "premio": self.premio,
            "cooldown_minutos": self.cooldown_minutos,
            "activo": self.activo,
        }


# ---------------------------------------------------------------------------
# Clientes
# ---------------------------------------------------------------------------
class Cliente(db.Model):
    __tablename__ = "cliente"

    id: Mapped[int] = mapped_column(primary_key=True)
    # ID único público (el que ve el cliente y el que se puede poner en un QR)
    codigo: Mapped[str] = mapped_column(String(36), unique=True, nullable=False, index=True,
                                        default=lambda: str(uuid.uuid4()))
    nombre: Mapped[str] = mapped_column(String(120), nullable=False)
    correo: Mapped[str] = mapped_column(String(160), unique=True, nullable=False, index=True)
    telefono: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    # "Recordarme": el celular guarda un token secreto; aquí solo guardamos su hash
    token_hash: Mapped[str | None] = mapped_column(String(64), unique=True, index=True)
    acepta_marketing: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=ahora, nullable=False)
    ultima_visita: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    sellos: Mapped[list["Sello"]] = relationship(back_populates="cliente", cascade="all, delete-orphan",
                                                 order_by="Sello.fecha.desc()")
    canjes: Mapped[list["Canje"]] = relationship(back_populates="cliente", cascade="all, delete-orphan",
                                                 order_by="Canje.fecha.desc()")

    # --- token del dispositivo -------------------------------------------
    @staticmethod
    def hash_token(token):
        return hashlib.sha256(token.encode()).hexdigest()

    def generar_token(self):
        """Crea un token nuevo (invalida el anterior) y devuelve el valor en claro UNA sola vez."""
        token = secrets.token_urlsafe(32)
        self.token_hash = self.hash_token(token)
        return token

    @classmethod
    def por_token(cls, token):
        if not token:
            return None
        return db.session.execute(
            db.select(cls).where(cls.token_hash == cls.hash_token(token))
        ).scalar_one_or_none()

    # --- conteos -----------------------------------------------------------
    @property
    def sellos_activos(self):
        return [s for s in self.sellos if s.estado == "activo"]

    def resumen_tarjeta(self, programa):
        activos = len(self.sellos_activos)
        requeridos = programa.sellos_requeridos
        return {
            "sellos_actuales": min(activos, requeridos),
            "sellos_requeridos": requeridos,
            "faltan": max(requeridos - activos, 0),
            "premio": programa.premio,
            "premio_disponible": activos >= requeridos,
            "total_compras": len(self.sellos),
            "premios_canjeados": len(self.canjes),
        }

    def serialize(self):
        return {
            "codigo": self.codigo,
            "nombre": self.nombre,
            "correo": self.correo,
            "telefono": self.telefono,
            "acepta_marketing": self.acepta_marketing,
            "creado_en": iso(self.creado_en),
            "ultima_visita": iso(self.ultima_visita),
        }


# ---------------------------------------------------------------------------
# Tags NFC físicos
# ---------------------------------------------------------------------------
class NfcTag(db.Model):
    __tablename__ = "nfc_tag"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Va dentro de la URL grabada en el tag: https://tuweb.com/sello?t=<codigo>
    codigo: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True,
                                        default=lambda: secrets.token_urlsafe(12))
    nombre: Mapped[str] = mapped_column(String(120), default="Caja principal")
    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=ahora)

    def serialize(self):
        return {"id": self.id, "codigo": self.codigo, "nombre": self.nombre,
                "activo": self.activo, "creado_en": iso(self.creado_en)}


# ---------------------------------------------------------------------------
# Sellos (una compra = un sello)
# ---------------------------------------------------------------------------
class Sello(db.Model):
    __tablename__ = "sello"

    id: Mapped[int] = mapped_column(primary_key=True)
    cliente_id: Mapped[int] = mapped_column(ForeignKey("cliente.id", ondelete="CASCADE"), nullable=False, index=True)
    tag_id: Mapped[int | None] = mapped_column(ForeignKey("nfc_tag.id", ondelete="SET NULL"))
    canje_id: Mapped[int | None] = mapped_column(ForeignKey("canje.id", ondelete="SET NULL"))
    fecha: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=ahora, nullable=False, index=True)
    # 'activo' (cuenta para el premio) | 'canjeado' (ya se usó) | 'anulado' (lo quitó el admin)
    estado: Mapped[str] = mapped_column(String(20), default="activo", nullable=False, index=True)
    origen: Mapped[str] = mapped_column(String(20), default="nfc", nullable=False)  # 'nfc' | 'manual'

    cliente: Mapped["Cliente"] = relationship(back_populates="sellos")
    tag: Mapped["NfcTag | None"] = relationship()

    def serialize(self):
        return {"id": self.id, "fecha": iso(self.fecha), "estado": self.estado, "origen": self.origen,
                "tag": self.tag.nombre if self.tag else None}


# ---------------------------------------------------------------------------
# Canjes de premio
# ---------------------------------------------------------------------------
class Canje(db.Model):
    __tablename__ = "canje"

    id: Mapped[int] = mapped_column(primary_key=True)
    cliente_id: Mapped[int] = mapped_column(ForeignKey("cliente.id", ondelete="CASCADE"), nullable=False, index=True)
    premio: Mapped[str] = mapped_column(String(255), nullable=False)
    sellos_usados: Mapped[int] = mapped_column(Integer, nullable=False)
    fecha: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=ahora, nullable=False)
    atendido_por: Mapped[int | None] = mapped_column(ForeignKey("user.id", ondelete="SET NULL"))

    cliente: Mapped["Cliente"] = relationship(back_populates="canjes")

    def serialize(self):
        return {"id": self.id, "premio": self.premio, "sellos_usados": self.sellos_usados,
                "fecha": iso(self.fecha)}


# ---------------------------------------------------------------------------
# Menú digital
# ---------------------------------------------------------------------------
class CategoriaMenu(db.Model):
    __tablename__ = "categoria_menu"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    orden: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    productos: Mapped[list["ProductoMenu"]] = relationship(back_populates="categoria",
                                                           order_by="ProductoMenu.orden")

    def serialize(self, con_productos=False):
        data = {"id": self.id, "nombre": self.nombre, "orden": self.orden, "activo": self.activo}
        if con_productos:
            data["productos"] = [p.serialize() for p in self.productos if p.disponible]
        return data


class ProductoMenu(db.Model):
    __tablename__ = "producto_menu"

    id: Mapped[int] = mapped_column(primary_key=True)
    categoria_id: Mapped[int | None] = mapped_column(ForeignKey("categoria_menu.id", ondelete="SET NULL"))
    nombre: Mapped[str] = mapped_column(String(120), nullable=False)
    descripcion: Mapped[str | None] = mapped_column(Text)
    precio: Mapped[int] = mapped_column(Integer, nullable=False, default=0)  # en pesos COP, sin decimales
    imagen_url: Mapped[str | None] = mapped_column(String(500))
    destacado: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)  # "sabor de temporada"
    disponible: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    orden: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    categoria: Mapped["CategoriaMenu | None"] = relationship(back_populates="productos")

    def serialize(self):
        return {
            "id": self.id,
            "categoria_id": self.categoria_id,
            "categoria": self.categoria.nombre if self.categoria else None,
            "nombre": self.nombre,
            "descripcion": self.descripcion,
            "precio": self.precio,
            "imagen_url": self.imagen_url,
            "destacado": self.destacado,
            "disponible": self.disponible,
            "orden": self.orden,
        }


# ---------------------------------------------------------------------------
# Imágenes y videos de la landing
# ---------------------------------------------------------------------------
class Contenido(db.Model):
    __tablename__ = "contenido"

    id: Mapped[int] = mapped_column(primary_key=True)
    tipo: Mapped[str] = mapped_column(String(10), nullable=False)  # 'imagen' | 'video'
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    titulo: Mapped[str | None] = mapped_column(String(120))
    seccion: Mapped[str] = mapped_column(String(30), default="galeria", nullable=False)  # 'hero' | 'galeria' | 'promo'
    orden: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    def serialize(self):
        return {"id": self.id, "tipo": self.tipo, "url": self.url, "titulo": self.titulo,
                "seccion": self.seccion, "orden": self.orden, "activo": self.activo}




# ---------------------------------------------------------------------------
# Notificaciones push (celulares que aceptaron recibir promos)
# ---------------------------------------------------------------------------
class SuscripcionPush(db.Model):
    __tablename__ = "suscripcion_push"

    id: Mapped[int] = mapped_column(primary_key=True)
    cliente_id: Mapped[int] = mapped_column(ForeignKey("cliente.id", ondelete="CASCADE"), nullable=False, index=True)
    endpoint: Mapped[str] = mapped_column(String(700), unique=True, nullable=False)
    p256dh: Mapped[str] = mapped_column(String(255), nullable=False)
    auth: Mapped[str] = mapped_column(String(255), nullable=False)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=ahora, nullable=False)

    cliente: Mapped["Cliente"] = relationship()

    def como_webpush(self):
        return {"endpoint": self.endpoint, "keys": {"p256dh": self.p256dh, "auth": self.auth}}