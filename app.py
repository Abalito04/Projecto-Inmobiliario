from flask import Flask, render_template, jsonify, request
from models import db, Unidad, Movimiento, Devengado, SituacionUnidad
from datetime import datetime
import os

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///alquileres.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

def seed_db():
    # Eliminamos el precargado para permitir pruebas desde cero
    pass

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
            u.propietarios = data['propietarios']
        else: # Create
            u = Unidad(
                nombre=data['nombre'], 
                descripcion=data.get('descripcion'), 
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

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        seed_db()
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
