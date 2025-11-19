from flask import Flask, jsonify, request
from flask_cors import CORS
import sqlite3
import json
import random
import threading
import time
from datetime import datetime

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

# Configurações MQTT (baseadas no ESP32)
MQTT_BROKER = '172.26.67.41'  # IP do broker MQTT (mesmo do ESP32)
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
    cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='spots'")
    table_exists = cursor.fetchone() is not None
    
    if table_exists:
        # Verifica se as novas colunas existem
        cursor = conn.execute("PRAGMA table_info(spots)")
        columns = [row[1] for row in cursor.fetchall()]
        
        # Adiciona colunas se não existirem
        if 'distancia' not in columns:
            conn.execute('ALTER TABLE spots ADD COLUMN distancia INTEGER DEFAULT NULL')
            print("➕ Adicionada coluna 'distancia' ao banco")
            
        if 'last_distance_update' not in columns:
            conn.execute('ALTER TABLE spots ADD COLUMN last_distance_update TEXT DEFAULT NULL')
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
        conn.execute('INSERT OR IGNORE INTO spots (spot, occupied) VALUES (?, 0)', (i,))
    
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
        cursor = conn.execute('SELECT spot, occupied, updated, distancia, last_distance_update FROM spots ORDER BY spot')
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
        cursor = conn.execute('SELECT spot, occupied, updated FROM spots ORDER BY spot')
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
    cursor = conn.execute('SELECT occupied FROM spots WHERE spot = ?', (spot_num,))
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
    """Atualiza status da vaga com dados vindos do ESP32"""
    if timestamp is None:
        timestamp = datetime.now().isoformat()
    
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.execute('SELECT occupied FROM spots WHERE spot = ?', (spot_num,))
    current = cursor.fetchone()
    
    if current and current[0] != occupied:
        # Só atualiza se houve mudança real
        conn.execute(
            'UPDATE spots SET occupied = ?, updated = ? WHERE spot = ?',
            (occupied, timestamp, spot_num)
        )
        conn.commit()
        print(f"📡 ESP32: Vaga {spot_num} -> {'OCUPADA' if occupied else 'LIVRE'}")
    
    conn.close()

def update_spot_status(spot, distance):
    """Atualiza status da vaga baseado na distância"""
    occupied = 1 if distance < 20 else 0
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
    print(f"📏 Sensor: Vaga {spot}, Distância {distance}cm -> {'OCUPADA' if occupied else 'LIVRE'}")
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
        # O ESP32 envia: {"situacao": X, "distancia_atual": Y, "diferenca": Z, "timestamp": "..."}
        diferenca = payload.get('diferenca', 0)
        timestamp = payload.get('timestamp', datetime.now().isoformat())
        
        # Lógica: diferença POSITIVA grande = vaga foi LIBERADA
        # Lógica: diferença NEGATIVA grande = vaga foi OCUPADA
        if diferenca > 2000:  # Threshold do ESP32
            # Vaga foi LIBERADA (objeto se afastou)
            update_spot_from_esp32(1, False, timestamp)
        elif diferenca < -2000:
            # Vaga foi OCUPADA (objeto se aproximou)
            update_spot_from_esp32(1, True, timestamp)
            
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
        """Simula mudanças aleatórias nas vagas (exceto vaga 1 que é do ESP32)"""
        while self.running:
            time.sleep(random.randint(5, 10))  # Espera 5-10 segundos
            
            if random.random() < 0.5:  # 50% chance de mudança
                # Apenas simula vaga 2 (vaga 1 é controlada pelo ESP32)
                spot_num = 2
                new_status = toggle_spot(spot_num)
                if new_status is not None:
                    status_text = "🚗 OCUPADA" if new_status else "🅿️ LIVRE"
                    print(f"🔄 Simulador: Vaga {spot_num} -> {status_text}")

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
            'distancia': None,  # Será preenchido via MQTT se disponível
            'esp32_controlled': spot['spot'] == 1  # Indica se é controlada pelo ESP32
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