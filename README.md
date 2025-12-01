# 🅿️ Smart Parking

<p align="center">
  <img width="1913" height="674" alt="Banner SmartParking" src="https://github.com/P-E-N-T-E-S/smart-parking/blob/main/img/bannersp.png" />
  <a href="#-sobre-o-projeto">Sobre</a> •
  <a href="#-arquitetura">Arquitetura</a> •
  <a href="#-funcionalidades">Funcionalidades</a> •
  <a href="#-instalação-e-configuração">Instalação</a> •
  <a href="#-tecnologias">Tecnologias</a> •
  <a href="#-hardware">Hardware</a> •
  <a href="#-equipe">Equipe</a>
</p>

## 🚀 Sobre o Projeto

O **Smart Parking** é um sistema IoT completo de monitoramento de vagas de estacionamento que utiliza **sensores infravermelhos**, **ESP32** com **FreeRTOS** e **protocolo MQTT** para fornecer informações em tempo real sobre disponibilidade de vagas. O projeto combina hardware embarcado, backend em Python/Flask, e frontend moderno em React com visualizações avançadas usando ApexCharts.

### 🎯 Características Principais

- **Arquitetura Distribuída**: ESP32 (firmware) + Flask (backend) + React (frontend)
- **Comunicação em Tempo Real**: MQTT via HiveMQ broker público
- **Persistência de Dados**: SQLite com histórico completo de ocupação
- **Visualizações Avançadas**: ApexCharts para gráficos, heatmaps e gauges
- **Design Moderno**: Dark theme responsivo com sistema de tokens CSS
- **FreeRTOS Multi-Core**: Duas tasks concorrentes no ESP32 (leitura de sensor + monitoramento de mudanças)
- **Notificações por Email**: Alertas de duração de estacionamento via MailHog

---

## 🏗️ Arquitetura do Sistema

### Fluxo de Dados

```
┌─────────────┐      MQTT      ┌──────────────┐     REST API    ┌──────────────┐
│   ESP32     │────────────────▶│ Flask Backend│◀────────────────│ React Frontend│
│ (Sensor IR) │  /vaga1/status │  (SQLite DB) │  /api/spots     │  (Dashboard)  │
│  GPIO 34    │                 │   Port 5000  │                 │   Port 5174   │
└─────────────┘                 └──────┬───────┘                 └───────┬───────┘
                                       │                                  │
                                       │         MQTT WebSocket           │
                                       └──────────────────────────────────┘
                                         broker.hivemq.com:1883
```

### Componentes do Sistema

#### 🔹 ESP32 (Firmware - FreeRTOS)
- **Localização**: `esp32-esp8266/src/main.cpp`
- **Plataforma**: PlatformIO com framework Arduino
- **Arquitetura**:
  - **Task 1 (Core 0)**: `taskLerSensor` - Lê sensor IR GPIO 34 a cada 1s, controla LED RGB
  - **Task 2 (Core 1)**: `taskMonitorarMudanca` - Detecta mudanças drásticas (>200 unidades), publica MQTT
- **Threshold de Ocupação**: 3860 (valores abaixo = ocupada)
- **Sincronização**: NTP com `pool.ntp.org` (timezone UTC-3, Brasília)
- **Tópico MQTT**: `/vaga1/status`
- **Payload JSON**:
  ```json
  {
    "situacao": "ocupada" | "liberada",
    "distancia_atual": 3450,
    "diferenca": 210,
    "timestamp": "2024-01-15T14:23:45-03:00"
  }
  ```

#### 🔹 Flask Backend
- **Localização**: `raspberry-pi/backend/app.py`
- **Dependências**: Flask 3.1.2, paho-mqtt 2.1.0, SQLite3
- **Funcionalidades**:
  - Subscriber MQTT para `/vaga1/status`
  - Banco de dados SQLite com tabela `spots` (5 colunas: spot, occupied, updated, distancia, last_distance_update)
  - API REST com 4 endpoints (spots, toggle, status, simulator)
  - Serviço de email com MailHog (porta 1025)
  - Simulador para vaga 2 (thread daemon com intervalo aleatório 10-30s)
- **Migração de DB**: ALTER TABLE automático para compatibilidade com versões antigas
- **Tracking de Duração**: Dict `spot_entry_time` para calcular tempo de permanência

#### 🔹 React Frontend
- **Localização**: `raspberry-pi/frontend/`
- **Build Tool**: Vite 5.0.0
- **Bibliotecas Principais**:
  - **ApexCharts 5.3.6**: Gauge, heatmap, sparklines, area charts
  - **Lucide React 0.555.0**: Sistema de ícones (substituiu emojis)
  - **MQTT.js 4.3.7**: Cliente WebSocket para broker HiveMQ
- **Componentes**:
  - `App.jsx`: Gerenciamento de estado global, conexão MQTT + API polling (30s)
  - `FreeSpotGauge.jsx`: Gauge radial com porcentagem de vagas livres
  - `OccupancyHeatmap.jsx`: Heatmap 7x24 (ocupação média por hora/dia da semana)
  - `VagaCard.jsx`: Card de vaga com ícone top-down de carro, sparkline, timer
  - `TotalFreeChart.jsx`: Gráfico de área com histórico de vagas livres (até 360 pontos)
  - `DashboardStats.jsx`: Grid de 4 KPI cards (total, livres, ocupadas, última atualização)
---

## ⭐ Funcionalidades

### 🔍 Monitoramento em Tempo Real
- ✅ Detecção de ocupação via sensor IR com threshold configurável
- ✅ Publicação MQTT somente em mudanças drásticas (economia de bandwidth)
- ✅ Dual-channel de atualização (MQTT WebSocket + API polling)
- ✅ Visualização de distância em tempo real com ícone Ruler (Lucide)
- ✅ Status normalizado (free/occupied/unknown) com cores semânticas

### 📊 Visualizações Avançadas
- ✅ **Gauge de Vagas Livres**: Radial progressivo com gradiente #1E88E5 → #6FFFA3
- ✅ **Heatmap de Ocupação**: Análise 7x24 com escala verde-amarelo-vermelho
- ✅ **Gráfico de Área**: Série temporal de vagas livres com gradiente animado
- ✅ **Sparklines**: Mini-gráficos de 50 pontos em cada VagaCard

### 🔧 Gestão e Controle
- ✅ Toggle manual de vagas (desabilitado para vagas ESP32-controlled)
- ✅ Simulador de vaga 2 com controle START/STOP via API
- ✅ Log de eventos com max 200 entradas
- ✅ Timer de duração em estado atual (formato "há Xh Ym Zs")

### 📧 Notificações
- ✅ Email automático ao final de cada permanência
- ✅ Integração com MailHog para desenvolvimento (teste@mailhog.local)
- ✅ Payload com vaga, duração, horário entrada/saída

### 🎨 Interface do Usuário
- ✅ Dark theme completo com contraste AA compliant
- ✅ Responsive design com breakpoints 768px/480px
- ✅ Logo responsivo com `clamp(48px, 5vw, 80px)`
- ✅ Animações suaves (slideInUp, borderGlow, fadeIn)
- ✅ Glassmorphism no header (backdrop-filter: blur)
- ✅ Indicadores de conexão (MQTT + API) no SystemStatus

---

## 🔌 Hardware

### Componentes Necessários

| Componente          | Quantidade | Especificações                           |
|---------------------|------------|------------------------------------------|
| **ESP32 DevKit**    | 1x         | Dual-core 240MHz, WiFi, 34 GPIOs         |
| **Sensor IR**       | 1x         | Sensor infravermelho analógico           |
| **LED RGB**         | 1x         | Catodo comum ou ânodo comum              |
| **Resistores**      | 3x         | 220Ω para LEDs (opcional)                |
| **Protoboard**      | 1x         | 830 pontos                               |
| **Jumpers**         | 10x+       | Macho-macho e macho-fêmea                |
| **Fonte 5V**        | 1x         | Micro USB ou adaptador                   |

### Pinagem ESP32

```
GPIO 34 (ADC1_CH6)  ────▶  Sensor IR (Saída Analógica)
GPIO 14 (INPUT)     ────▶  Entrada Digital (opcional)
GPIO 27 (OUTPUT)    ────▶  LED RGB - Vermelho
GPIO 26 (OUTPUT)    ────▶  LED RGB - Verde
GPIO 25 (OUTPUT)    ────▶  LED RGB - Azul
GND                 ────▶  LED RGB - Catodo Comum
```

### Diagrama de Conexão

```
┌──────────────────┐
│      ESP32       │
│                  │
│  GPIO 34 ◀───────┼───── Sensor IR (OUT)
│  GPIO 27 ────────┼───── LED R (220Ω)
│  GPIO 26 ────────┼───── LED G (220Ω)
│  GPIO 25 ────────┼───── LED B (220Ω)
│  GND     ────────┼───── LED Common / Sensor GND
│  5V      ────────┼───── Sensor VCC
└──────────────────┘
```

### Lógica de Funcionamento

1. **Sensor IR** detecta distância analógica no GPIO 34
2. **Task 1 (taskLerSensor)** lê valor a cada 1s e atualiza LED:
   - Distância < 3860 → LED Vermelho (ocupada)
   - Distância ≥ 3860 → LED Verde (livre)
3. **Task 2 (taskMonitorarMudanca)** aguarda mudança drástica (>200):
   - Conecta WiFi e sincroniza NTP
   - Publica JSON no tópico `/vaga1/status`
4. **Backend Flask** recebe mensagem MQTT:
   - Atualiza tabela SQLite `spots`
   - Calcula duração se houver saída
   - Envia email via MailHog
5. **Frontend React** recebe atualização:
   - Via MQTT WebSocket (imediato)
   - Via API polling a cada 30s (fallback)
   - Atualiza gráficos e heatmap

---

## 📦 Instalação e Configuração

### Pré-requisitos

- **Python 3.12+** para backend
- **Node.js 18+** e npm para frontend
- **PlatformIO CLI** para firmware ESP32
- **Git** para clonar repositório
- **MailHog** (opcional, para testar emails)

### 1️⃣ Clonar Repositório

```powershell
git clone https://github.com/P-E-N-T-E-S/smart-parking.git
cd smart-parking
```

### 2️⃣ Configurar Backend (Flask)

```powershell
cd raspberry-pi\backend

# Criar ambiente virtual
python -m venv venv

# Ativar venv (Windows PowerShell)
.\venv\Scripts\Activate.ps1

# Instalar dependências
pip install -r requirements.txt

# Iniciar servidor (porta 5000)
python app.py
```

**Configurações importantes** em `app.py`:
- `MQTT_BROKER = "broker.hivemq.com"` - Broker público HiveMQ
- `MQTT_PORT = 1883` - Porta padrão MQTT
- `DATABASE = "parking.db"` - Banco SQLite local
- `SMTP_HOST = "localhost"` - MailHog para desenvolvimento

### 3️⃣ Configurar Frontend (React)

```powershell
cd raspberry-pi\frontend

# Instalar dependências
npm install

# Criar arquivo .env (opcional)
# VITE_MQTT_BROKER=ws://broker.hivemq.com:8000/mqtt
# VITE_API_URL=http://localhost:5000

# Iniciar dev server (porta 5174)
npm run dev
```

Acessar dashboard em: **http://localhost:5174**

### 4️⃣ Configurar Firmware ESP32

1. Abrir projeto no PlatformIO (VS Code com extensão PlatformIO)
2. Editar credenciais WiFi em `esp32-esp8266/src/main.cpp`:
   ```cpp
   const char* ssid = "SEU_WIFI_SSID";
   const char* password = "SUA_SENHA_WIFI";
   ```
3. Conectar ESP32 via USB
4. Compilar e enviar firmware:
   ```powershell
   cd esp32-esp8266
   pio run -t upload
   ```
5. Monitorar serial (opcional):
   ```powershell
   pio device monitor
   ```

### 5️⃣ Configurar MailHog (Opcional)

Para testar notificações por email durante desenvolvimento:

```powershell
# Usando Docker
docker run -d -p 1025:1025 -p 8025:8025 mailhog/mailhog

# Acessar interface web
# http://localhost:8025
```

---

## 🚀 Executando o Sistema Completo

### Ordem de Inicialização

1. **MailHog** (opcional):
   ```powershell
   docker start mailhog
   ```

2. **Backend Flask**:
   ```powershell
   cd raspberry-pi\backend
   .\venv\Scripts\Activate.ps1
   python app.py
   ```
   Output esperado:
   ```
   Conectado ao broker MQTT broker.hivemq.com:1883
   * Running on http://127.0.0.1:5000
   ```

3. **Frontend React**:
   ```powershell
   cd raspberry-pi\frontend
   npm run dev
   ```
   Output esperado:
   ```
   VITE ready in 212 ms
   ➜ Local: http://localhost:5174/
   ```

4. **ESP32**: Liga automaticamente após upload do firmware

### Verificação de Funcionamento

✅ **Backend**: Acesse `http://localhost:5000/api/spots` (deve retornar JSON com 2 vagas)
✅ **Frontend**: Acesse `http://localhost:5174` (dashboard deve carregar sem erros)
✅ **MQTT**: Indicador "Conectado" em verde no canto superior direito
✅ **ESP32**: LED deve acender verde (livre) ou vermelho (ocupada)

---

## 🌐 Tecnologias

### Backend
| Tecnologia        | Versão  | Função                                      |
|-------------------|---------|---------------------------------------------|
| **Python**        | 3.12+   | Linguagem base                              |
| **Flask**         | 3.1.2   | Framework web para API REST                 |
| **paho-mqtt**     | 2.1.0   | Cliente MQTT para subscriber                |
| **SQLite3**       | builtin | Banco de dados relacional embutido          |
| **smtplib**       | builtin | Envio de emails (MailHog)                   |
| **Threading**     | builtin | Simulador em background                     |

### Frontend
| Tecnologia           | Versão  | Função                                   |
|----------------------|---------|------------------------------------------|
| **React**            | 18.2.0  | Biblioteca UI                            |
| **Vite**             | 5.0.0   | Build tool e dev server                  |
| **ApexCharts**       | 5.3.6   | Biblioteca de visualização (gauge, heatmap) |
| **Lucide React**     | 0.555.0 | Sistema de ícones                        |
| **MQTT.js**          | 4.3.7   | Cliente MQTT WebSocket                   |
| **React ApexCharts** | 1.9.0   | Wrapper React para ApexCharts            |

### Firmware
| Tecnologia        | Versão | Função                                      |
|-------------------|--------|---------------------------------------------|
| **PlatformIO**    | -      | Build system e gerenciador de libs          |
| **Arduino Framework** | - | Framework base para ESP32                   |
| **FreeRTOS**      | builtin | Sistema operacional em tempo real           |
| **PubSubClient**  | 2.8.0  | Cliente MQTT para ESP32                     |
| **WiFi.h**        | builtin | Conectividade WiFi                          |
| **time.h**        | builtin | Sincronização NTP                           |

### Infraestrutura
| Serviço           | Função                                      |
|-------------------|---------------------------------------------|
| **HiveMQ Broker** | Broker MQTT público (broker.hivemq.com)     |
| **MailHog**       | Servidor SMTP de desenvolvimento (porta 1025) |
| **NTP Pool**      | Sincronização de tempo (pool.ntp.org)       |

---
---

## 🗂️ Estrutura de Diretórios

```
smart-parking/
├── esp32-esp8266/              # Firmware ESP32
│   ├── src/
│   │   └── main.cpp           # Código FreeRTOS com tasks
│   ├── platformio.ini         # Configuração PlatformIO
│   └── .gitignore
│
├── raspberry-pi/
│   ├── backend/               # Flask API
│   │   ├── app.py            # Servidor Flask + MQTT subscriber
│   │   ├── requirements.txt  # Dependências Python
│   │   ├── email_service.py  # Serviço de notificações
│   │   ├── parking.db        # Banco SQLite (gerado em runtime)
│   │   └── venv/             # Ambiente virtual Python (gitignored)
│   │
│   └── frontend/             # React Dashboard
│       ├── src/
│       │   ├── App.jsx                      # Componente raiz
│       │   ├── index.jsx                    # Entry point
│       │   ├── components/
│       │   │   ├── DashboardStats.jsx       # Grid de KPIs
│       │   │   ├── FreeSpotGauge.jsx        # Gauge de vagas livres
│       │   │   ├── KPICard.jsx              # Card de métrica
│       │   │   ├── OccupancyHeatmap.jsx     # Heatmap 7x24
│       │   │   ├── SystemStatus.jsx         # Indicadores de conexão
│       │   │   ├── TotalFreeChart.jsx       # Gráfico de área temporal
│       │   │   ├── VagaCard.jsx             # Card de vaga individual
│       │   │   └── VagaSparkline.jsx        # Mini-gráfico 50 pontos
│       │   └── styles/
│       │       └── modern.css               # Dark theme completo
│       ├── public/
│       │   ├── SmartParkingLogo1.png        # Logo principal
│       │   └── logo.png                     # Logo legado
│       ├── index.html                       # HTML base
│       ├── package.json                     # Dependências npm
│       ├── vite.config.js                   # Configuração Vite
│       └── node_modules/                    # (gitignored)
│
├── img/
│   ├── bannersp.png                         # Banner do README
│   └── SmartParkingLogo1.png                # Logo original
│
├── README.md                                # Este arquivo
└── LICENSE                                  # Licença do projeto
```

---

## 🛠️ Desenvolvimento

### Estrutura do Código Backend

**`app.py`** - Servidor Flask principal
- `init_db()`: Cria tabela `spots` com migrações ALTER TABLE
- `update_spot_from_esp32()`: Processa mensagens MQTT, calcula durações, envia emails
- `on_mqtt_message()`: Callback MQTT, parseia JSON, prioritiza campo `situacao`
- `toggle_spot()`: Endpoint para alternar status manual
- `SimpleSimulator`: Thread daemon que alterna vaga 2 aleatoriamente

**`email_service.py`** - Serviço de notificações
- Envia emails via SMTP (MailHog porta 1025)
- Payload: vaga, duração, horário entrada/saída

### Estrutura do Código Frontend

**`App.jsx`** - Componente raiz
- `normalizeStatus()`: Converte variações de status para `free|occupied|unknown`
- `fetchVagasFromAPI()`: Polling API a cada 30s
- `handleMessage()`: Processa mensagens MQTT dual-topic (/vaga1/status + legado)
- `updateHistory()`: Mantém histórico de 1000 pontos para gráficos

**Componentes de Visualização**:
- `FreeSpotGauge`: ApexCharts radial gauge com gradiente
- `OccupancyHeatmap`: Processa `historyRef`, agrega em buckets [weekday][hour]
- `TotalFreeChart`: Área chart com últimos 360 pontos
- `VagaSparkline`: Mini-chart 30px altura com 50 pontos

**Sistema de Design**:
- `modern.css`: 800+ linhas com tokens CSS
- Variáveis: `--bg-main`, `--bg-card`, `--bg-elevated`, `--text-primary/secondary/tertiary`
- Spacing: `--spacing-xs` (4px) a `--spacing-3xl` (64px)
- Shadows: `--shadow-sm/md/lg` com valores elevados para dark mode

### Estrutura do Firmware ESP32

**`main.cpp`** - Firmware FreeRTOS
- `taskLerSensor(void*)`: Task em core 0, loop infinito com delay(1000)
- `taskMonitorarMudanca(void*)`: Task em core 1, aguarda mudança >200
- `ensureWifi()`: Conecta WiFi, tenta até sucesso
- `ensureMqtt()`: Conecta MQTT, client ID = "ESP32-{MAC}"
- `xSemaphore`: Mutex protege variáveis compartilhadas

**Configurações importantes**:
```cpp
#define THRESHOLD_OCUPADO 3860  // Abaixo = ocupada
#define THRESHOLD_CHANGE 200    // Mudança drástica
const char* mqtt_server = "broker.hivemq.com";
const char* mqtt_topic = "/vaga1/status";
```

### Fluxo de

## 👥 Nossa Equipe

<div align="center">

| [<img src="https://avatars.githubusercontent.com/Thomazrlima" width="100" style="border-radius:50%"><br>Thomaz Lima](https://github.com/Thomazrlima) | [<img src="https://avatars.githubusercontent.com/evaldocunhaf" width="100" style="border-radius:50%"><br>Evaldo Filho](https://github.com/evaldocunhaf) | [<img src="https://avatars.githubusercontent.com/hsspedro " width="100" style="border-radius:50%"><br>Pedro Silva](https://github.com/hsspedro) | [<img src="https://avatars.githubusercontent.com/Sofia-Saraiva" width="100" style="border-radius:50%"><br>Sofia Saraiva](https://github.com/Sofia-Saraiva) |
| :--------------------------------------------------------------------------------------------------------------------------------------------------: | :-----------------------------------------------------------------------------------------------------------------------------------------------------: | :---------------------------------------------------------------------------------------------------------------------------------------------: | :--------------------------------------------------------------------------------------------------------------------------------------------------------: |
|                                                                  Frontend Developer                                                                   |                                                                Especialista em Hardware                                                                 |                                                                Desenvolvedor IoT                                                                |                                                                     Backend Developer                                                                     |

</div>

