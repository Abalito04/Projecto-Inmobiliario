from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class Unidad(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), unique=True, nullable=False)
    descripcion = db.Column(db.Text) # Nuevo campo para ambientes, patio, etc.
    propietarios = db.Column(db.JSON) 
    
    def to_dict(self):
        return {
            "id": self.id,
            "nombre": self.nombre,
            "descripcion": self.descripcion,
            "propietarios": self.propietarios
        }

class Movimiento(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    fecha = db.Column(db.Date, nullable=False, default=datetime.utcnow)
    unidad_id = db.Column(db.Integer, db.ForeignKey('unidad.id'), nullable=False)
    periodo = db.Column(db.String(7), nullable=False) # YYYY-MM
    tipo = db.Column(db.String(10), nullable=False) # Ingreso / Egreso
    concepto = db.Column(db.String(100), nullable=False)
    forma_pago = db.Column(db.String(50))
    monto = db.Column(db.Float, nullable=False)
    observacion = db.Column(db.Text)

    unidad = db.relationship('Unidad', backref=db.backref('movimientos', lazy=True))

    def to_dict(self):
        return {
            "id": self.id,
            "fecha": self.fecha.isoformat(),
            "unidad": self.unidad.nombre,
            "periodo": self.periodo,
            "tipo": self.tipo,
            "concepto": self.concepto,
            "forma_pago": self.forma_pago,
            "monto": self.monto,
            "observacion": self.observacion
        }

class Devengado(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    unidad_id = db.Column(db.Integer, db.ForeignKey('unidad.id'), nullable=False)
    periodo = db.Column(db.String(7), nullable=False)
    estado = db.Column(db.String(20), nullable=False) # Alquilado / No alquilado
    monto = db.Column(db.Float, nullable=False)
    observacion = db.Column(db.Text)

    unidad = db.relationship('Unidad', backref=db.backref('devengados', lazy=True))

    def to_dict(self):
        return {
            "id": self.id,
            "unidad": self.unidad.nombre,
            "periodo": self.periodo,
            "estado": self.estado,
            "monto": self.monto,
            "observacion": self.observacion
        }

class SituacionUnidad(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    unidad_id = db.Column(db.Integer, db.ForeignKey('unidad.id'), unique=True, nullable=False)
    estado = db.Column(db.String(20), nullable=False) # Activa / Inactiva
    inicio_contrato = db.Column(db.String(7))
    duracion_meses = db.Column(db.Integer)
    actualizacion_meses = db.Column(db.Integer)
    importe_vigente = db.Column(db.Float)
    observacion = db.Column(db.Text)

    unidad = db.relationship('Unidad', backref=db.backref('situacion', uselist=False))

    def to_dict(self):
        return {
            "id": self.id,
            "unidad": self.unidad.nombre,
            "estado": self.estado,
            "inicio_contrato": self.inicio_contrato,
            "duracion_meses": self.duracion_meses,
            "actualizacion_meses": self.actualizacion_meses,
            "importe_vigente": self.importe_vigente,
            "observacion": self.observacion
        }
