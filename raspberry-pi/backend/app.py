from flask import Flask, jsonify, request
from flask_cors import CORS
import sqlite3
import json
from datetime import datetime
from email_service import send_email

# Importações condicionais para MQTT
try:
    import paho.mqtt.client as mqtt
    MQTT_AVAILABLE = True
except ImportError:
    print("⚠️ paho-mqtt não disponível. Instale com: pip install paho-mqtt")
    MQTT_AVAILABLE = False

# ===============================
# CONFIGURAÇÃO
# ===============================
app = Flask(__name__)
CORS(app)

DB_FILE = 'parking.db'
TOTAL_SPOTS = 2
spot_entry_time = {}
client_sessions = {}  # {client_id: {vaga: str, start_time: datetime, paid: bool}}

# Configurações MQTT (baseadas no ESP32)
MQTT_BROKER = 'broker.hivemq.com'
MQTT_PORT = 1883
MQTT_TOPIC_VAGA1 = '/vaga1/status'
MQTT_TOPIC_VAGA2 = '/vaga2/status'

# Variável global para cliente MQTT
mqtt_client = None

# ===============================
# BANCO DE DADOS SUPER SIMPLES
# ===============================


def init_db():
    """Cria tabela básica com campos extras para o frontend React"""
    conn = sqlite3.connect(DB_FILE)

    # Verifica se a tabela já existe
    cursor = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='spots'")
    table_exists = cursor.fetchone() is not None

    if table_exists:
        # Verifica se as novas colunas existem
        cursor = conn.execute("PRAGMA table_info(spots)")
        columns = [row[1] for row in cursor.fetchall()]

        # Adiciona colunas se não existirem
        if 'distancia' not in columns:
            conn.execute(
                'ALTER TABLE spots ADD COLUMN distancia INTEGER DEFAULT NULL')
            print("➕ Adicionada coluna 'distancia' ao banco")

        if 'last_distance_update' not in columns:
            conn.execute(
                'ALTER TABLE spots ADD COLUMN last_distance_update TEXT DEFAULT NULL')
            print("➕ Adicionada coluna 'last_distance_update' ao banco")
    else:
        # Cria tabela nova com todas as colunas
        conn.execute('''
            CREATE TABLE IF NOT EXISTS spots (
                spot INTEGER PRIMARY KEY,
                occupied INTEGER DEFAULT 0,
                updated TEXT DEFAULT CURRENT_TIMESTAMP,
                distancia INTEGER DEFAULT NULL,
                last_distance_update TEXT DEFAULT NULL
            )
        ''')
        print("📄 Criada nova tabela 'spots'")

    # Insere vagas se não existirem
    for i in range(1, TOTAL_SPOTS + 1):
        conn.execute(
            'INSERT OR IGNORE INTO spots (spot, occupied) VALUES (?, 0)', (i,))

    conn.commit()
    conn.close()


def get_spots():
    """Retorna todas as vagas com dados completos"""
    conn = sqlite3.connect(DB_FILE)

    # Verifica quais colunas existem na tabela
    cursor = conn.execute("PRAGMA table_info(spots)")
    columns = [row[1] for row in cursor.fetchall()]

    # Constrói query baseada nas colunas disponíveis
    if 'distancia' in columns and 'last_distance_update' in columns:
        # Tabela completa
        cursor = conn.execute(
            'SELECT spot, occupied, updated, distancia, last_distance_update FROM spots ORDER BY spot')
        spots = []
        for row in cursor:
            spots.append({
                'spot': row[0],
                'occupied': bool(row[1]),
                'updated': row[2],
                'distancia': row[3],
                'distance_updated': row[4]
            })
    else:
        # Tabela antiga - só colunas básicas
        cursor = conn.execute(
            'SELECT spot, occupied, updated FROM spots ORDER BY spot')
        spots = []
        for row in cursor:
            spots.append({
                'spot': row[0],
                'occupied': bool(row[1]),
                'updated': row[2],
                'distancia': None,
                'distance_updated': None
            })

    conn.close()
    return spots


def toggle_spot(spot_num):
    """Alterna status de uma vaga"""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.execute(
        'SELECT occupied FROM spots WHERE spot = ?', (spot_num,))
    current = cursor.fetchone()

    if current:
        new_status = 0 if current[0] else 1
        conn.execute(
            'UPDATE spots SET occupied = ?, updated = ? WHERE spot = ?',
            (new_status, datetime.now().isoformat(), spot_num)
        )
        conn.commit()
        conn.close()
        return bool(new_status)

    conn.close()
    return None


def update_spot_from_esp32(spot_num, occupied, timestamp=None):
    if timestamp is None:
        timestamp = datetime.now().isoformat()

    now = datetime.fromisoformat(timestamp)
    previous = None

    conn = sqlite3.connect(DB_FILE)
    cursor = conn.execute(
        'SELECT occupied FROM spots WHERE spot = ?', (spot_num,))
    current = cursor.fetchone()

    if current:
        previous = bool(current[0])

    if previous is not None and previous != occupied:
        conn.execute(
            'UPDATE spots SET occupied = ?, updated = ? WHERE spot = ?',
            (int(occupied), timestamp, spot_num)
        )
        conn.commit()

        if not previous and occupied:
            spot_entry_time[spot_num] = now
            print(f"Entrada vaga {spot_num}")

        elif previous and not occupied:
            entrada = spot_entry_time.pop(spot_num, None)
            if entrada:
                tempo = now - entrada
                minutos = max(1, int(tempo.total_seconds() / 60))

                send_email(
                    "teste@mailhog.local",
                    f"Tempo de permanência - Vaga {spot_num}",
                    f"O veículo ficou {minutos} minutos estacionado na vaga {spot_num}."
                )

                print(f"Email enviado Vaga {spot_num}: {minutos} minutos")

        print(
            f" ESP32: Vaga {spot_num} -> {'OCUPADA' if occupied else 'LIVRE'}")

    conn.close()


def update_spot_status(spot, distance):
    """Atualiza status da vaga baseado na distância"""
    THRESHOLD_OCUPADO = 1500
    occupied = 1 if distance < THRESHOLD_OCUPADO else 0

    conn = sqlite3.connect(DB_FILE)

    # Verifica se as colunas de distância existem
    cursor = conn.execute("PRAGMA table_info(spots)")
    columns = [row[1] for row in cursor.fetchall()]

    if 'distancia' in columns and 'last_distance_update' in columns:
        # Atualiza com dados de distância
        conn.execute('''
            UPDATE spots 
            SET occupied = ?, updated = CURRENT_TIMESTAMP, distancia = ?, last_distance_update = CURRENT_TIMESTAMP
            WHERE spot = ?
        ''', (occupied, distance, spot))
    else:
        # Atualização básica sem distância
        conn.execute('''
            UPDATE spots 
            SET occupied = ?, updated = CURRENT_TIMESTAMP
            WHERE spot = ?
        ''', (occupied, spot))

    conn.commit()
    conn.close()
    print(
        f"📏 Sensor: Vaga {spot}, Distância {distance}cm (threshold {THRESHOLD_OCUPADO}) -> {'OCUPADA' if occupied else 'LIVRE'}")
    return occupied

# ===============================
# MQTT CLIENT PARA ESP32
# ===============================


def on_mqtt_connect(client, userdata, flags, rc):
    """Callback quando conecta ao broker MQTT"""
    if rc == 0:
        print("✅ Conectado ao broker MQTT")
        # Subscreve nos tópicos específicos dos ESP32
        client.subscribe(MQTT_TOPIC_VAGA1)
        client.subscribe(MQTT_TOPIC_VAGA2)
        # Subscreve nos tópicos padrão para compatibilidade
        client.subscribe('vaga/+/status')
        client.subscribe('vaga/+/distancia')
        print(f"📡 Inscrito nos tópicos:")
        print(f"   - {MQTT_TOPIC_VAGA1}")
        print(f"   - {MQTT_TOPIC_VAGA2}")
        print(f"   - vaga/+/status")
        print(f"   - vaga/+/distancia")
    else:
        print(f"❌ Falha na conexão MQTT. Código: {rc}")


def on_mqtt_message(client, userdata, msg):
    """Processa mensagens vindas do ESP32"""
    try:
        topic = msg.topic
        print(f"📨 MQTT recebido: {topic}")
        print(f"📦 Payload: {msg.payload.decode()}")

        # Processa dados do ESP32 vaga 1 (formato específico)
        if topic == '/vaga1/status':
            payload = json.loads(msg.payload.decode())
            
            distancia_atual = payload.get('distancia_atual', 0)
            situacao = payload.get('situacao', '')
            timestamp = payload.get('timestamp', datetime.now().isoformat())

            # Prioriza o campo 'situacao' se vier como string
            if isinstance(situacao, str):
                situacao_lower = situacao.lower().strip()
                if situacao_lower in ['ocupada', 'ocupado', 'occupied']:
                    ocupado = True
                    status_msg = "OCUPADA"
                elif situacao_lower in ['liberada', 'liberado', 'livre', 'free']:
                    ocupado = False
                    status_msg = "LIVRE"
                else:
                    # Fallback para lógica de distância se situacao não for reconhecida
                    THRESHOLD_OCUPADO = 1500  # cm
                    ocupado = distancia_atual < THRESHOLD_OCUPADO
                    status_msg = "OCUPADA" if ocupado else "LIVRE"
                    print(f"⚠️ Situacao '{situacao}' não reconhecida, usando distância")
            else:
                # Lógica baseada na distância (fallback)
                THRESHOLD_OCUPADO = 1500  # cm
                ocupado = distancia_atual < THRESHOLD_OCUPADO
                status_msg = "OCUPADA" if ocupado else "LIVRE"

            print(f"🎯 ESP32 Vaga 1: situacao='{situacao}', distância={distancia_atual}cm -> {status_msg}")
            update_spot_from_esp32(1, ocupado, timestamp)
            
            try:
                update_spot_status(1, distancia_atual)
            except Exception as e:
                print(f"⚠️ Erro ao atualizar distância vaga 1: {e}")
        
        # Processa dados do ESP32 vaga 2 (formato específico)
        elif topic == '/vaga2/status':
            payload = json.loads(msg.payload.decode())
            
            distancia_atual = payload.get('distancia_atual', 0)
            situacao = payload.get('situacao', '')
            timestamp = payload.get('timestamp', datetime.now().isoformat())

            # Prioriza o campo 'situacao' se vier como string
            if isinstance(situacao, str):
                situacao_lower = situacao.lower().strip()
                if situacao_lower in ['ocupada', 'ocupado', 'occupied']:
                    ocupado = True
                    status_msg = "OCUPADA"
                elif situacao_lower in ['liberada', 'liberado', 'livre', 'free']:
                    ocupado = False
                    status_msg = "LIVRE"
                else:
                    THRESHOLD_OCUPADO = 1500  # cm
                    ocupado = distancia_atual < THRESHOLD_OCUPADO
                    status_msg = "OCUPADA" if ocupado else "LIVRE"
                    print(f"⚠️ Situacao '{situacao}' não reconhecida, usando distância")
            else:
                THRESHOLD_OCUPADO = 1500  # cm
                ocupado = distancia_atual < THRESHOLD_OCUPADO
                status_msg = "OCUPADA" if ocupado else "LIVRE"

            print(f"🎯 ESP32 Vaga 2: situacao='{situacao}', distância={distancia_atual}cm -> {status_msg}")
            update_spot_from_esp32(2, ocupado, timestamp)
            
            try:
                update_spot_status(2, distancia_atual)
            except Exception as e:
                print(f"⚠️ Erro ao atualizar distância vaga 2: {e}")

        # Processa tópicos padrão MQTT: vaga/A1/status, vaga/A2/status, etc.
        elif topic.startswith('vaga/'):
            parts = topic.split('/')
            if len(parts) >= 3:
                vaga_nome = parts[1]  # A1, A2, etc.
                tipo = parts[2]       # status ou distancia
                
                # Mapeia nome da vaga para número
                vaga_num = None
                if vaga_nome == 'A1':
                    vaga_num = 1
                elif vaga_nome == 'A2':
                    vaga_num = 2
                
                if vaga_num and tipo == 'status':
                    payload_str = msg.payload.decode()
                    
                    # Normaliza o status recebido
                    payload_lower = payload_str.lower().strip()
                    if payload_lower in ['ocupada', 'ocupado', 'occupied', '1']:
                        ocupado = True
                        status_msg = "OCUPADA"
                    elif payload_lower in ['liberada', 'liberado', 'livre', 'free', '0']:
                        ocupado = False
                        status_msg = "LIVRE"
                    else:
                        print(f"⚠️ Status desconhecido para {vaga_nome}: {payload_str}")
                        return
                    
                    print(f"🎯 MQTT {vaga_nome}: {payload_str} -> {status_msg}")
                    update_spot_from_esp32(vaga_num, ocupado)
                
                elif vaga_num and tipo == 'distancia':
                    try:
                        distancia = float(msg.payload.decode())
                        update_spot_status(vaga_num, distancia)
                    except ValueError:
                        print(f"⚠️ Distância inválida para {vaga_nome}: {msg.payload.decode()}")

    except json.JSONDecodeError:
        print(f"❌ Erro ao decodificar JSON: {msg.payload.decode()}")
    except Exception as e:
        print(f"❌ Erro ao processar mensagem MQTT: {e}")


def setup_mqtt():
    """Configura cliente MQTT para receber dados do ESP32"""
    global mqtt_client

    if not MQTT_AVAILABLE:
        print("⚠️ MQTT não disponível - modo apenas simulador")
        return

    try:
        mqtt_client = mqtt.Client()
        mqtt_client.on_connect = on_mqtt_connect
        mqtt_client.on_message = on_mqtt_message

        print(f"🔗 Conectando ao broker MQTT: {MQTT_BROKER}:{MQTT_PORT}")
        mqtt_client.connect(MQTT_BROKER, MQTT_PORT, 60)
        mqtt_client.loop_start()

    except Exception as e:
        print(f"❌ Erro ao configurar MQTT: {e}")
        mqtt_client = None

# ===============================
# ROTAS DA API
# ===============================


@app.route('/')
def home():
    return jsonify({
        'message': 'Smart Parking System API - Backend para ESP32',
        'version': '1.0.0',
        'endpoints': {
            'GET /api/spots': 'Lista todas as vagas',
            'POST /api/spots/<int>/toggle': 'Alterna status de uma vaga',
            'GET /api/status': 'Estatísticas gerais'
        },
        'mqtt': {
            'broker': f"{MQTT_BROKER}:{MQTT_PORT}",
            'topics': {
                'vaga1': MQTT_TOPIC_VAGA1,
                'vaga2': MQTT_TOPIC_VAGA2,
                'standard': 'vaga/+/status, vaga/+/distancia'
            },
            'available': MQTT_AVAILABLE and mqtt_client is not None
        },
        'total_spots': TOTAL_SPOTS
    })


@app.route('/api/spots')
def api_spots():
    spots = get_spots()
    formatted_spots = []

    for spot in spots:
        formatted_spots.append({
            'id': spot['spot'],
            'nome': f"A{spot['spot']}",
            'status': 'occupied' if spot['occupied'] else 'free',
            'lastUpdate': spot['updated'],
            'distancia': spot['distancia'],
            'esp32_controlled': spot['spot'] in [1, 2]
        })

    return jsonify(formatted_spots)


@app.route('/api/vagas')
def api_vagas():
    spots = get_spots()
    vagas = {}

    for spot in spots:
        vaga_name = f"A{spot['spot']}"
        vagas[vaga_name] = {
            'status': 'occupied' if spot['occupied'] else 'free',
            'lastUpdate': spot['updated'],
            'distancia': None
        }

    return jsonify(vagas)


@app.route('/api/client/occupy', methods=['POST'])
def client_occupy_spot():
    data = request.get_json()
    client_id = data.get('client_id', 'default')
    vaga_id = data.get('vaga_id')
    
    if not vaga_id:
        return jsonify({'error': 'vaga_id é obrigatório'}), 400
    
    # Registra sessão do cliente
    client_sessions[client_id] = {
        'vaga': vaga_id,
        'start_time': datetime.now(),
        'paid': False
    }
    
    # Atualiza banco para ocupada
    spot_num = 1 if vaga_id == 'A1' else 2
    update_spot_from_esp32(spot_num, True)
    
    return jsonify({
        'message': f'Vaga {vaga_id} ocupada com sucesso',
        'session': client_sessions[client_id]
    })


@app.route('/api/client/pay', methods=['POST'])
def client_pay_and_release():
    data = request.get_json()
    client_id = data.get('client_id', 'default')
    
    if client_id not in client_sessions:
        return jsonify({'error': 'Sessão não encontrada'}), 404
    
    session = client_sessions[client_id]
    
    # Calcula valor total
    tempo_decorrido = datetime.now() - session['start_time']
    horas = tempo_decorrido.total_seconds() / 3600
    valor_total = 10 + (int(horas) * 2)  # R$ 10 + R$ 2 por hora
    
    # Libera vaga
    spot_num = 1 if session['vaga'] == 'A1' else 2
    update_spot_from_esp32(spot_num, False)
    
    # Remove sessão
    session_info = client_sessions.pop(client_id)
    
    return jsonify({
        'message': 'Pagamento realizado e vaga liberada',
        'valor_total': valor_total,
        'tempo_permanencia': str(tempo_decorrido),
        'session_info': session_info
    })


@app.route('/api/client/session/<client_id>')
def get_client_session(client_id):
    if client_id in client_sessions:
        session = client_sessions[client_id]
        
        # Calcula valor atual
        tempo_decorrido = datetime.now() - session['start_time']
        horas = tempo_decorrido.total_seconds() / 3600
        valor_atual = 10 + (int(horas) * 2)
        
        return jsonify({
            'session': session,
            'valor_atual': valor_atual,
            'tempo_decorrido': str(tempo_decorrido)
        })
    else:
        return jsonify({'session': None})


@app.route('/api/status')
def api_status():
    spots = get_spots()
    total_spots = len(spots)
    occupied_spots = sum(1 for spot in spots if spot['occupied'])
    free_spots = total_spots - occupied_spots

    return jsonify({
        'total_spots': total_spots,
        'occupied_spots': occupied_spots,
        'free_spots': free_spots,
        'occupancy_rate': round((occupied_spots / total_spots) * 100, 1) if total_spots > 0 else 0,
        'timestamp': datetime.now().isoformat()
    })


# ===============================
# INICIALIZAÇÃO
# ===============================
if __name__ == '__main__':
    print("🚀 SMART PARKING - INTEGRAÇÃO ESP32")
    print("=" * 50)

    # Inicializa banco de dados
    init_db()
    print(f"✅ Banco de dados: {DB_FILE}")
    print(f"🅿️ Vagas configuradas: {TOTAL_SPOTS}")

    # Configura MQTT para ESP32
    setup_mqtt()

    print("🌐 Interface web: http://localhost:5000")
    print("📡 API endpoints: /api/spots, /api/status")
    print("🔌 Aguardando dados do ESP32...")
    print("💡 Pressione Ctrl+C para parar")
    print("=" * 50)

    # Inicia servidor Flask
    app.run(debug=True, host='0.0.0.0', port=5000)
