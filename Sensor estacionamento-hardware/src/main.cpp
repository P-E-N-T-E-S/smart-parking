#include <Arduino.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <freertos/semphr.h>
#include <WiFi.h>
#include <time.h>
#include <PubSubClient.h>

// Objetos para WiFi e MQTT
WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);

// Configurações WiFi
const char* ssid = "uaifai-tiradentes";           // Coloque o nome da sua rede WiFi
const char* password = "bemvindoaocesar";      // Coloque a senha da sua rede WiFi
const char* MQTT_BROKER = "172.26.67.41";   // IP do seu Mac na rede local
const uint16_t MQTT_PORT = 1883;         // Porta do broker MQTT
const char* TOPIC_EST = "/vaga1/status"; 

#define SENSOR_ANALOG 34  // Pino A0 ligado ao GPIO 34
#define SENSOR_D0 14
#define PERNA_VERMELHA 27 // Pino para LED vermelho
#define PERNA_VERDE 26  // Pino para LED verde
#define PERNA_AZUL 25   // Pino para LED azul
#define THRESHOLD_CHANGE 2000     // Limiar para considerar mudança drástica
#define THRESHOLD_OCUPADO 3500    // Valor abaixo disso = vaga ocupada (objeto próximo)

// Variável compartilhada para armazenar a distância
volatile int distancia = 0;
volatile int distanciaAnterior = 0;
volatile bool vagaOcupada = false;

// Semáforo para proteger o acesso à variável compartilhada
SemaphoreHandle_t xSemaphore;

void ensureWifi(){
    // Conecta ao WiFi
  Serial.print("Conectando ao WiFi");
  WiFi.begin(ssid, password);
  
  int tentativas = 0;
  while (WiFi.status() != WL_CONNECTED && tentativas < 20) {
    delay(500);
    Serial.print(".");
    tentativas++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi conectado!");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
    
    // Configura NTP para horário de Brasília (UTC-3)
    configTime(-3 * 3600, 0, "pool.ntp.org", "time.nist.gov");
    Serial.println("Sincronizando horário com NTP...");
    
    // Aguarda sincronização
    struct tm timeinfo;
    int tentativasNTP = 0;
    while (!getLocalTime(&timeinfo) && tentativasNTP < 10) {
      delay(500);
      Serial.print(".");
      tentativasNTP++;
    }
    
    if (getLocalTime(&timeinfo)) {
      Serial.println("\nHorário sincronizado!");
      Serial.println(&timeinfo, "Data/Hora: %d/%m/%Y %H:%M:%S");
    } else {
      Serial.println("\nFalha ao sincronizar horário.");
    }
  } else {
    Serial.println("\nFalha ao conectar WiFi. Continuando sem timestamp...");
  }
}

void ensureMqtt() {
  if (mqtt.connected()) return;
  mqtt.setServer(MQTT_BROKER, MQTT_PORT);
  String cid = "ESP32-" + String((uint32_t)ESP.getEfuseMac(), HEX);
  Serial.printf("[MQTT] Conectando em %s:%u ...\n", MQTT_BROKER, MQTT_PORT);
  while (!mqtt.connected()) {
  if (mqtt.connect(cid.c_str())) {
  Serial.println("[MQTT] Conectado.");
  } else {
    Serial.printf("[MQTT] Falhou (state=%d). Tentando de novo...\n",
    mqtt.state());
    delay(500);
    }
  }
}

// Função para obter timestamp formatado
String getTimestamp() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    return "N/A";
  }
  
  char buffer[30];
  strftime(buffer, sizeof(buffer), "%Y-%m-%d %H:%M:%S", &timeinfo);
  return String(buffer);
}

// Task 1: Lê o sensor infravermelho
void taskLerSensor(void *pvParameters) {
  (void) pvParameters;
  
  while (1) {
    // Lê o valor analógico do sensor
    int novaLeitura = analogRead(SENSOR_ANALOG);
    
    // Protege o acesso à variável compartilhada
    if (xSemaphoreTake(xSemaphore, pdMS_TO_TICKS(100)) == pdTRUE) {
      distancia = novaLeitura;
      
      // Controla LEDs: quanto MENOR o valor, mais PRÓXIMO o objeto
      // Valor baixo = vaga OCUPADA (vermelho)
      // Valor alto = vaga LIVRE (verde)
      if (distancia < THRESHOLD_OCUPADO) {
        // Vaga OCUPADA - LED Vermelho
        digitalWrite(PERNA_VERMELHA, HIGH);
        digitalWrite(PERNA_VERDE, LOW);
        vagaOcupada = true;
        Serial.printf("[SENSOR] Vaga OCUPADA - Distância: %d\n", distancia);
      } else {
        // Vaga LIVRE - LED Verde
        digitalWrite(PERNA_VERMELHA, LOW);
        digitalWrite(PERNA_VERDE, HIGH);
        vagaOcupada = false;
        Serial.printf("[SENSOR] Vaga LIVRE - Distância: %d\n", distancia);
      }
      
      xSemaphoreGive(xSemaphore);
    }

    vTaskDelay(pdMS_TO_TICKS(1000)); // Verifica a cada 1 segundo
  }
}

// Task 2: Monitora mudanças drásticas na distância
void taskMonitorarMudanca(void *pvParameters) {
  String payload;
  (void) pvParameters;
  
  // Aguarda um pouco para a primeira leitura do sensor
  vTaskDelay(pdMS_TO_TICKS(500));
  
  while (1) {
    int distanciaAtual = 0;
    int distanciaPrevia = 0;
    
    // Protege o acesso à variável compartilhada
    if (xSemaphoreTake(xSemaphore, pdMS_TO_TICKS(100)) == pdTRUE) {
      distanciaAtual = distancia;
      distanciaPrevia = distanciaAnterior;
      xSemaphoreGive(xSemaphore);
    } else {
      vTaskDelay(pdMS_TO_TICKS(50));
      continue;
    }
    
    int diferenca = distanciaAtual - distanciaPrevia;
    
    // SOMENTE publica se houver mudança drástica
    if ((diferenca > THRESHOLD_CHANGE || diferenca < -THRESHOLD_CHANGE) && distanciaPrevia != 0) {

      if(diferenca > THRESHOLD_CHANGE ){
        Serial.println("[MQTT] Detectada mudança: Vaga foi ocupada!");
      } else {
        Serial.println("[MQTT] Detectada mudança: Vaga foi liberada!");
      }

      // Obtém o timestamp atual
      String timestamp = getTimestamp();
      
      // Monta payload para enviar ao backend
      payload = "{ \"situacao\": " + String(distanciaPrevia) + 
                ", \"distancia_atual\": " + String(distanciaAtual) +
                ", \"diferenca\": " + String(diferenca) +
                ", \"timestamp\": \"" + timestamp + "\" }";
    
      // Verifica se WiFi e MQTT estão conectados antes de publicar
      if (WiFi.status() == WL_CONNECTED) {
        ensureMqtt();
        mqtt.loop();
        
        bool ok = mqtt.publish(TOPIC_EST, payload.c_str());
        if (ok) {
          Serial.println("Mensagem MQTT publicada com sucesso:");
          Serial.println(payload);
        } else {
          Serial.println("Falha ao publicar mensagem MQTT.");
        }
      } else {
        Serial.println("[AVISO] WiFi desconectado. Mensagem não enviada:");
        Serial.println(payload);
      }
    }

    if (xSemaphoreTake(xSemaphore, pdMS_TO_TICKS(100)) == pdTRUE) {
      distanciaAnterior = distanciaAtual;
      xSemaphoreGive(xSemaphore);
    }
    
    vTaskDelay(pdMS_TO_TICKS(200));
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(SENSOR_ANALOG, INPUT);
  pinMode(PERNA_VERMELHA, OUTPUT);
  pinMode(PERNA_VERDE, OUTPUT);
  pinMode(PERNA_AZUL, OUTPUT);
  
  // Inicia com LED verde (vaga livre)
  digitalWrite(PERNA_VERDE, HIGH);
  digitalWrite(PERNA_VERMELHA, LOW);
  digitalWrite(PERNA_AZUL, LOW);
  
  // Aguarda um pouco para o Serial inicializar
  delay(1000);
  
  Serial.println("Iniciando sistema de monitoramento de distância...");

  // IMPORTANTE: WiFi ANTES de MQTT!
  ensureWifi();
  
  // Só tenta conectar MQTT se o WiFi estiver conectado
  if (WiFi.status() == WL_CONNECTED) {
    ensureMqtt();
  } else {
    Serial.println("[AVISO] WiFi não conectado. MQTT desabilitado.");
  }

  // Cria o semáforo mutex (melhor para proteger recursos compartilhados)
  xSemaphore = xSemaphoreCreateMutex();
  
  if (xSemaphore == NULL) {
    Serial.println("ERRO: Falha ao criar semáforo!");
    while(1);
  }
  
  // Cria a Task 1: Leitura do sensor
  BaseType_t task1Created = xTaskCreatePinnedToCore(
    taskLerSensor,      // Função da task
    "LerSensor",        // Nome da task
    4096,               // Stack size aumentado
    NULL,               // Parâmetros
    1,                  // Prioridade
    NULL,               // Handle da task
    0                   // Core 0
  );
  
  if (task1Created != pdPASS) {
    Serial.println("ERRO: Falha ao criar Task 1!");
    while(1);
  }
  
  // Cria a Task 2: Monitoramento de mudanças
  BaseType_t task2Created = xTaskCreatePinnedToCore(
    taskMonitorarMudanca,  // Função da task
    "MonitorarMudanca",    // Nome da task
    4096,                  // Stack size aumentado
    NULL,                  // Parâmetros
    1,                     // Prioridade
    NULL,                  // Handle da task
    1                      // Core 1
  );
  
  if (task2Created != pdPASS) {
    Serial.println("ERRO: Falha ao criar Task 2!");
    while(1);
  }
  
  Serial.println("Tasks criadas com sucesso!");
}

void loop() {
  // O loop() fica vazio pois as tasks cuidam de tudo
  vTaskDelay(pdMS_TO_TICKS(1000));
}
