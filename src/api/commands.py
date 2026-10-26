import click
from api.models import db, User, ProgramaFidelizacion, NfcTag, CategoriaMenu, ProductoMenu

"""
Comandos de consola (se ejecutan con `pipenv run flask <comando>`):

  flask crear-admin correo@x.com MiClave123 "Nombre"   -> usuario del personal para el panel
  flask crear-tag "Caja principal"                       -> genera un tag NFC y muestra la URL a grabar
  flask insert-test-data                                 -> programa + menú de ejemplo
"""


def setup_commands(app):

    @app.cli.command("crear-admin")
    @click.argument("email")
    @click.argument("password")
    @click.argument("nombre", required=False)
    def crear_admin(email, password, nombre=None):
        email = email.strip().lower()
        user = db.session.execute(db.select(User).where(User.email == email)).scalar_one_or_none()
        if user is None:
            user = User(email=email, is_active=True)
            db.session.add(user)
        user.nombre = nombre
        user.set_password(password)
        db.session.commit()
        print(f"Admin listo: {email}")

    @app.cli.command("generar-vapid")
    def generar_vapid():
        """Genera las llaves para las notificaciones push. Se hace UNA sola vez."""
        import base64
        from cryptography.hazmat.primitives import serialization
        from py_vapid import Vapid01

        b64 = lambda x: base64.urlsafe_b64encode(x).rstrip(b"=").decode()
        v = Vapid01()
        v.generate_keys()
        publica = v.public_key.public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
        privada = v.private_key.private_numbers().private_value.to_bytes(32, "big")
        print("Copia estas 3 líneas en tu .env y en Render > Environment:\n")
        print(f"VAPID_PUBLIC_KEY={b64(publica)}")
        print(f"VAPID_PRIVATE_KEY={b64(privada)}")
        print("VAPID_EMAIL=tu@correo.com")

    @app.cli.command("crear-tag")
    @click.argument("nombre", default="Caja principal")
    @click.option("--url-base", default="https://TU-DOMINIO.com", help="Dominio del front")
    def crear_tag(nombre, url_base):
        tag = NfcTag(nombre=nombre)
        db.session.add(tag)
        db.session.commit()
        print(f"Tag '{nombre}' creado.\nGraba esta URL en el NFC:\n  {url_base.rstrip('/')}/sello?t={tag.codigo}")

    @app.cli.command("insert-test-data")
    def insert_test_data():
        ProgramaFidelizacion.actual()

        if db.session.execute(db.select(CategoriaMenu)).first():
            print("Ya hay menú cargado, no se insertó nada.")
            return

        helados = CategoriaMenu(nombre="Helados", orden=1)
        malteadas = CategoriaMenu(nombre="Malteadas", orden=2)
        toppings = CategoriaMenu(nombre="Toppings", orden=3)
        db.session.add_all([helados, malteadas, toppings])
        db.session.add_all([
            ProductoMenu(categoria=helados, nombre="Fresa con crema", descripcion="El clásico de la casa",
                         precio=9000, destacado=True, orden=1),
            ProductoMenu(categoria=helados, nombre="Cono 2 bolas", descripcion="Elige dos sabores",
                         precio=12000, orden=2),
            ProductoMenu(categoria=malteadas, nombre="Malteada de fresa", precio=14000, orden=1),
            ProductoMenu(categoria=toppings, nombre="Chispas de chocolate", precio=2000, orden=1),
        ])
        db.session.commit()
        print("Datos de prueba insertados.")
