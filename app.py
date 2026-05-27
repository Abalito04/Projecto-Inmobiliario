from flask import Flask, render_template, jsonify, request
from sqlalchemy import inspect
from models import db, Unidad, Movimiento, Devengado, SituacionUnidad
from datetime import datetime
import os

app = Flask(__name__)
database_url = os.environ.get('DATABASE_URL', 'sqlite:///alquileres.db')
if database_url.startswith('postgres://'):
    database_url = database_url.replace('postgres://', 'postgresql://', 1)
app.config['SQLALCHEMY_DATABASE_URI'] = database_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

def seed_db():
    # Eliminamos el precargado para permitir pruebas desde cero
    pass

def ensure_unidad_columns():
    columns = {column['name'] for column in inspect(db.engine).get_columns('unidad')}
    new_columns = {
        'nomenclatura_catastral': 'VARCHAR(120)',
        'suministro_gas': 'VARCHAR(120)',
        'suministro_luz': 'VARCHAR(120)',
        'suministro_agua': 'VARCHAR(120)',
        'tipo': "VARCHAR(30) DEFAULT 'Vivienda'",
        'contribucion_inmobiliaria': 'VARCHAR(120)',
        'contribucion_comercio': 'VARCHAR(120)',
    }
    with db.engine.begin() as conn:
        for name, definition in new_columns.items():
            if name not in columns:
                conn.exec_driver_sql(f'ALTER TABLE unidad ADD COLUMN {name} {definition}')

def ensure_situacion_columns():
    columns = {column['name'] for column in inspect(db.engine).get_columns('situacion_unidad')}
    new_columns = {
        'inquilino_nombre': 'VARCHAR(120)',
        'inquilino_dni': 'VARCHAR(30)',
        'garante1_nombre': 'VARCHAR(120)',
        'garante1_dni': 'VARCHAR(30)',
        'garante2_nombre': 'VARCHAR(120)',
        'garante2_dni': 'VARCHAR(30)',
    }
    with db.engine.begin() as conn:
        for name, definition in new_columns.items():
            if name not in columns:
                conn.exec_driver_sql(f'ALTER TABLE situacion_unidad ADD COLUMN {name} {definition}')

@app.route('/')
def index():
    return render_template('index.html')

# API Routes
@app.route('/api/unidades', methods=['GET', 'POST'])
def handle_unidades():
    if request.method == 'POST':
        data = request.json
        if data.get('id'): # Update
            u = Unidad.query.get(data['id'])
            u.nombre = data['nombre']
            u.descripcion = data.get('descripcion') # Guardar descripción
            u.nomenclatura_catastral = data.get('nomenclatura_catastral')
            u.suministro_gas = data.get('suministro_gas')
            u.suministro_luz = data.get('suministro_luz')
            u.suministro_agua = data.get('suministro_agua')
            u.tipo = data.get('tipo') or 'Vivienda'
            u.contribucion_inmobiliaria = data.get('contribucion_inmobiliaria') if u.tipo == 'Comercio' else None
            u.contribucion_comercio = data.get('contribucion_comercio') if u.tipo == 'Comercio' else None
            u.propietarios = data['propietarios']
        else: # Create
            tipo = data.get('tipo') or 'Vivienda'
            u = Unidad(
                nombre=data['nombre'], 
                descripcion=data.get('descripcion'), 
                nomenclatura_catastral=data.get('nomenclatura_catastral'),
                suministro_gas=data.get('suministro_gas'),
                suministro_luz=data.get('suministro_luz'),
                suministro_agua=data.get('suministro_agua'),
                tipo=tipo,
                contribucion_inmobiliaria=data.get('contribucion_inmobiliaria') if tipo == 'Comercio' else None,
                contribucion_comercio=data.get('contribucion_comercio') if tipo == 'Comercio' else None,
                propietarios=data['propietarios']
            )
            db.session.add(u)
        db.session.commit()
        return jsonify(u.to_dict()), 201
    
    unidades = Unidad.query.all()
    return jsonify([u.to_dict() for u in unidades])

@app.route('/api/unidades/<int:id>', methods=['DELETE'])
def delete_unidad(id):
    u = Unidad.query.get_or_404(id)
    # Also delete related data to maintain integrity
    Movimiento.query.filter_by(unidad_id=id).delete()
    Devengado.query.filter_by(unidad_id=id).delete()
    SituacionUnidad.query.filter_by(unidad_id=id).delete()
    db.session.delete(u)
    db.session.commit()
    return '', 204

@app.route('/api/movimientos', methods=['GET', 'POST'])
def handle_movimientos():
    if request.method == 'POST':
        data = request.json
        fecha = datetime.strptime(data['fecha'], '%Y-%m-%d').date()
        unidad = Unidad.query.filter_by(nombre=data['unidad']).first()
        monto = float(data['monto'])
        
        if data.get('id'): # Update
            mov = Movimiento.query.get(data['id'])
            mov.fecha = fecha
            mov.unidad_id = unidad.id
            mov.periodo = data['periodo']
            mov.tipo = data['tipo']
            mov.concepto = data['subtipo']
            mov.forma_pago = data.get('forma')
            mov.monto = monto
            mov.observacion = data.get('obs')
        else: # Create
            mov = Movimiento(
                fecha=fecha,
                unidad_id=unidad.id,
                periodo=data['periodo'],
                tipo=data['tipo'],
                concepto=data['subtipo'],
                forma_pago=data.get('forma'),
                monto=monto,
                observacion=data.get('obs')
            )
            db.session.add(mov)
        
        db.session.commit()
        return jsonify(mov.to_dict()), 201
    
    movimientos = Movimiento.query.order_by(Movimiento.fecha).all()
    return jsonify([m.to_dict() for m in movimientos])

@app.route('/api/movimientos/<int:id>', methods=['DELETE'])
def delete_movimiento(id):
    mov = Movimiento.query.get_or_404(id)
    db.session.delete(mov)
    db.session.commit()
    return '', 204

@app.route('/api/devengados', methods=['GET', 'POST'])
def handle_devengados():
    if request.method == 'POST':
        data = request.json
        unidad = Unidad.query.filter_by(nombre=data['unidad']).first()
        
        if data.get('id'): # Update
            dev = Devengado.query.get(data['id'])
            dev.unidad_id = unidad.id
            dev.periodo = data['periodo']
            dev.estado = data['estado']
            dev.monto = float(data.get('importe', 0))
            dev.observacion = data.get('obs')
        else: # Create
            dev = Devengado(
                unidad_id=unidad.id,
                periodo=data['periodo'],
                estado=data['estado'],
                monto=float(data.get('importe', 0)),
                observacion=data.get('obs')
            )
            db.session.add(dev)
            
        db.session.commit()
        return jsonify(dev.to_dict()), 201
    
    devengados = Devengado.query.all()
    return jsonify([d.to_dict() for d in devengados])

@app.route('/api/devengados/<int:id>', methods=['DELETE'])
def delete_devengado(id):
    dev = Devengado.query.get_or_404(id)
    db.session.delete(dev)
    db.session.commit()
    return '', 204

@app.route('/api/situacion', methods=['GET', 'POST'])
def handle_situacion():
    if request.method == 'POST':
        data = request.json
        unidad = Unidad.query.filter_by(nombre=data['unidad']).first()
        sit = SituacionUnidad.query.filter_by(unidad_id=unidad.id).first()
        
        if not sit:
            sit = SituacionUnidad(unidad_id=unidad.id)
            db.session.add(sit)
            
        sit.estado = data['estado']
        sit.inicio_contrato = data.get('inicio')
        sit.duracion_meses = int(data.get('duracion') or 0)
        sit.actualizacion_meses = int(data.get('actualizacion') or 0)
        sit.importe_vigente = float(data.get('importe') or 0)
        sit.inquilino_nombre = data.get('inquilino_nombre')
        sit.inquilino_dni = data.get('inquilino_dni')
        sit.garante1_nombre = data.get('garante1_nombre')
        sit.garante1_dni = data.get('garante1_dni')
        sit.garante2_nombre = data.get('garante2_nombre')
        sit.garante2_dni = data.get('garante2_dni')
        sit.observacion = data.get('obs')
        
        db.session.commit()
        return jsonify(sit.to_dict()), 201
        
    situaciones = SituacionUnidad.query.all()
    return jsonify([s.to_dict() for s in situaciones])

@app.route('/api/generar_devengados', methods=['POST'])
def generar_devengados():
    data = request.json
    periodo = data['periodo']
    situaciones = SituacionUnidad.query.filter_by(estado='Activa').all()
    count = 0
    for sit in situaciones:
        # Check if devengado already exists for this unit and period
        existing = Devengado.query.filter_by(unidad_id=sit.unidad_id, periodo=periodo).first()
        if not existing:
            dev = Devengado(
                unidad_id=sit.unidad_id,
                periodo=periodo,
                estado='Alquilado',
                monto=sit.importe_vigente,
                observacion='Generado automáticamente'
            )
            db.session.add(dev)
            count += 1
    db.session.commit()
    return jsonify({"count": count}), 201

def init_database():
    with app.app_context():
        db.create_all()
        ensure_unidad_columns()
        ensure_situacion_columns()
        seed_db()

init_database()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
