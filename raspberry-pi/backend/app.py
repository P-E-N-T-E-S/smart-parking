from flask import Flask, jsonify, request
from flask_cors import CORS
import sqlite3
import json
import random
import threading
import time
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
CORS(app)  # Habilita CORS para o frontend React

DB_FILE = 'parking.db'
TOTAL_SPOTS = 2
spot_entry_time = {}

# Configurações MQTT (baseadas no ESP32)
MQTT_BROKER = 'broker.hivemq.com'  # IP do broker MQTT (mesmo do ESP32)
MQTT_PORT = 1883
MQTT_TOPIC_VAGA1 = '/vaga1/status'  # Tópico que o ESP32 publica

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
    # Threshold ajustado para os valores reais do ESP32
    THRESHOLD_OCUPADO = 1500  # cm
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
        client.subscribe(MQTT_TOPIC_VAGA1)
        print(f"📡 Inscrito no tópico: {MQTT_TOPIC_VAGA1}")
    else:
        print(f"❌ Falha na conexão MQTT. Código: {rc}")


def on_mqtt_message(client, userdata, msg):
    """Processa mensagens vindas do ESP32"""
    try:
        topic = msg.topic
        payload = json.loads(msg.payload.decode())

        print(f"📨 MQTT recebido: {topic}")
        print(f"📦 Payload: {payload}")

        # Processa dados do ESP32
        # O ESP32 envia: {"situacao": "livre"/"ocupado", "distancia_atual": Y, "diferenca": Z, "timestamp": "..."}
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
                print(
                    f"⚠️ Situacao '{situacao}' não reconhecida, usando distância")
        else:
            # Lógica baseada na distância (fallback)
            THRESHOLD_OCUPADO = 1500  # cm
            ocupado = distancia_atual < THRESHOLD_OCUPADO
            status_msg = "OCUPADA" if ocupado else "LIVRE"

        print(
            f"🎯 ESP32 Analysis: situacao='{situacao}', distância={distancia_atual}cm -> {status_msg}")

        # Atualiza vaga 1 com o novo status
        update_spot_from_esp32(1, ocupado, timestamp)

        # Também atualiza com dados de distância se a função existir
        try:
            update_spot_status(1, distancia_atual)
        except Exception as e:
            print(f"⚠️ Erro ao atualizar distância: {e}")

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
# SIMULADOR DE SENSORES SIMPLES
# ===============================


class SimpleSimulator:
    def __init__(self):
        self.running = False

    def start(self):
        """Inicia simulação em background"""
        if not self.running:
            self.running = True
            thread = threading.Thread(target=self._simulate)
            thread.daemon = True
            thread.start()
            print("🤖 Simulador iniciado")

    def stop(self):
        """Para simulação"""
        self.running = False
        print("🛑 Simulador parado")

    def _simulate(self):
        while self.running:
            time.sleep(random.randint(5, 10))

            if random.random() < 0.5:
                spot_num = 2
                new_status = toggle_spot(spot_num)

                now = datetime.now()
                occupied = bool(new_status)

                # LIVRE -> OCUPADA
                if occupied:
                    spot_entry_time[spot_num] = now
                    print(f"⏱️ (Simulador) Entrada vaga {spot_num}")

                # OCUPADA -> LIVRE
                else:
                    entrada = spot_entry_time.pop(spot_num, None)
                    if entrada:
                        tempo = now - entrada
                        minutos = max(1, int(tempo.total_seconds() / 60))

                        send_email(
                            "teste@mailhog.local",
                            f"Tempo de permanência - Vaga {spot_num}",
                            f"O veículo ficou {minutos} minutos estacionado na vaga {spot_num}."
                        )

                        print(
                            f"📧 (Simulador) Email enviado – {minutos} minutos")

                print(
                    f"🔄 Simulador: Vaga {spot_num} -> {'OCUPADA' if occupied else 'LIVRE'}")


# ===============================
# ROTAS DA API
# ===============================

# Instância do simulador
simulator = SimpleSimulator()


@app.route('/')
def home():
    """API Info - Retorna informações sobre a API"""
    return jsonify({
        'message': 'Smart Parking System API - Backend para ESP32',
        'version': '1.0.0',
        'endpoints': {
            'GET /api/spots': 'Lista todas as vagas',
            'POST /api/spots/<int>/toggle': 'Alterna status de uma vaga',
            'GET /api/status': 'Estatísticas gerais',
            'POST /api/simulator/start': 'Inicia simulador',
            'POST /api/simulator/stop': 'Para simulador'
        },
        'mqtt': {
            'broker': f"{MQTT_BROKER}:{MQTT_PORT}",
            'topic': MQTT_TOPIC_VAGA1,
            'available': MQTT_AVAILABLE and mqtt_client is not None
        },
        'total_spots': TOTAL_SPOTS
    })


@app.route('/api/spots')
def api_spots():
    """API: Lista todas as vagas formatadas para o frontend React"""
    spots = get_spots()
    formatted_spots = []

    for spot in spots:
        formatted_spots.append({
            'id': spot['spot'],
            'nome': f"A{spot['spot']}",  # Formato esperado pelo frontend
            'status': 'occupied' if spot['occupied'] else 'free',
            'lastUpdate': spot['updated'],
            'distancia': spot['distancia'],  # Agora inclui distância real
            # Indica se é controlada pelo ESP32
            'esp32_controlled': spot['spot'] == 1
        })

    return jsonify(formatted_spots)


@app.route('/api/vagas')
def api_vagas():
    """API: Compatibilidade com frontend React - formato de vagas"""
    spots = get_spots()
    vagas = {}

    for spot in spots:
        vaga_name = f"A{spot['spot']}"
        vagas[vaga_name] = {
            'status': 'occupied' if spot['occupied'] else 'free',
            'lastUpdate': spot['updated'],
            'distancia': None  # Será atualizado via MQTT
        }

    return jsonify(vagas)


@app.route('/api/spots/<int:spot_num>/toggle', methods=['POST'])
def api_toggle_spot(spot_num):
    """API: Alterna status de uma vaga"""
    new_status = toggle_spot(spot_num)
    if new_status is not None:
        return jsonify({
            'spot': spot_num,
            'occupied': new_status,
            'message': f'Vaga {spot_num} {"ocupada" if new_status else "liberada"}'
        })
    return jsonify({'error': 'Vaga não encontrada'}), 404


@app.route('/api/status')
def api_status():
    """API: Estatísticas gerais"""
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


@app.route('/api/simulator/start', methods=['POST'])
def api_start_simulator():
    """API: Inicia simulador"""
    simulator.start()
    return jsonify({'message': 'Simulador iniciado'})


@app.route('/api/simulator/stop', methods=['POST'])
def api_stop_simulator():
    """API: Para simulador"""
    simulator.stop()
    return jsonify({'message': 'Simulador parado'})


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

    # Inicia simulador automaticamente (apenas para vaga 2)
    simulator.start()

    print("🌐 Interface web: http://localhost:5000")
    print("📡 API endpoints: /api/spots, /api/status")
    print("🔌 Aguardando dados do ESP32...")
    print("💡 Pressione Ctrl+C para parar")
    print("=" * 50)

    # Inicia servidor Flask
    app.run(debug=True, host='0.0.0.0', port=5000)
