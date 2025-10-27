from flask import Flask, jsonify, request, render_template_string
import sqlite3
import json
import random
import threading
import time
from datetime import datetime

# ===============================
# CONFIGURAÇÃO
# ===============================
app = Flask(__name__)
DB_FILE = 'parking.db'
TOTAL_SPOTS = 2

# ===============================
# BANCO DE DADOS SUPER SIMPLES
# ===============================
def init_db():
    """Cria tabela básica"""
    conn = sqlite3.connect(DB_FILE)
    conn.execute('''
        CREATE TABLE IF NOT EXISTS spots (
            spot INTEGER PRIMARY KEY,
            occupied INTEGER DEFAULT 0,
            updated TEXT DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Insere vagas se não existirem
    for i in range(1, TOTAL_SPOTS + 1):
        conn.execute('INSERT OR IGNORE INTO spots (spot, occupied) VALUES (?, 0)', (i,))
    
    conn.commit()
    conn.close()

def get_spots():
    """Retorna todas as vagas"""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.execute('SELECT spot, occupied, updated FROM spots ORDER BY spot')
    spots = [{'spot': row[0], 'occupied': bool(row[1]), 'updated': row[2]} for row in cursor]
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
        """Simula mudanças aleatórias nas vagas"""
        while self.running:
            time.sleep(random.randint(3, 8))  # Espera 3-8 segundos
            
            if random.random() < 0.7:  # 70% chance de mudança
                spot_num = random.randint(1, TOTAL_SPOTS)
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
    """Página principal com interface visual"""
    spots = get_spots()
    total_spots = len(spots)
    occupied_spots = sum(1 for spot in spots if spot['occupied'])
    free_spots = total_spots - occupied_spots
    occupancy_rate = round((occupied_spots / total_spots) * 100, 1) if total_spots > 0 else 0
    
    return render_template_string(HTML_TEMPLATE, 
                                spots=spots,
                                total_spots=total_spots,
                                occupied_spots=occupied_spots,
                                free_spots=free_spots,
                                occupancy_rate=occupancy_rate)

@app.route('/api/spots')
def api_spots():
    """API: Lista todas as vagas"""
    return jsonify(get_spots())

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
    print("🚀 SMART PARKING - VERSÃO ULTRA SIMPLIFICADA")
    print("=" * 50)
    
    # Inicializa banco de dados
    init_db()
    print(f"✅ Banco de dados: {DB_FILE}")
    print(f"🅿️ Vagas configuradas: {TOTAL_SPOTS}")
    
    # Inicia simulador automaticamente
    simulator.start()
    
    print("🌐 Interface web: http://localhost:5000")
    print("📡 API endpoints: /api/spots, /api/status")
    print("💡 Pressione Ctrl+C para parar")
    print("=" * 50)
    
    # Inicia servidor Flask
    app.run(debug=True, host='0.0.0.0', port=5000)