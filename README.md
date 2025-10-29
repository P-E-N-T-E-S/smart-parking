# 🅿️ Smart Parking

<p align="center">
  <img width="1913" height="674" alt="Banner SmartParking" src="https://github.com/P-E-N-T-E-S/smart-parking/blob/main/img/bannersp.png" />
  <a href="#-sobre-o-projeto">Sobre</a> •
  <a href="#-funcionalidades">Funcionalidades</a> •
  <a href="#-hardware-e-componentes">Hardware</a> •
  <a href="#-nossa-equipe">Equipe</a>
</p>

## 🚀 Sobre o Projeto

O **Smart Parking** é um sistema inteligente de monitoramento de vagas de estacionamento que utiliza **sensores ultrassônicos**, **microcontroladores ESP32/ESP8266** e **protocolo MQTT** para fornecer informações em tempo real sobre a disponibilidade de vagas. Desenvolvido com arquitetura escalável que permite a expansão para múltiplas vagas e integração com dashboards web.

## ⭐ Funcionalidades

### 🔍 **Detecção em Tempo Real**

- Monitoramento contínuo do status das vagas (LIVRE/OCUPADO)
- Leitura precisa com sensores ultrassônicos HC-SR04
- Atualização instantânea via protocolo MQTT
- Visualização em tempo real do status de todas as vagas
- Mapa de estacionamento com cores intuitivas (Verde/Vermelho)
- Contador de vagas livres e ocupadas
- Valores brutos de distância para debugging

### 🔧 **Arquitetura Escalável**

- Suporte a múltiplas vagas com tópicos MQTT individuais
- Sistema baseado em FreeRTOS para multitarefas
- Broker MQTT centralizado no Raspberry Pi

### 📱 **Monitoramento Remoto**

- Acesso web ao dashboard de qualquer dispositivo
- Log de histórico de ocupação
- Sistema de alertas e notificações

---

## 🏗️ Arquitetura do Sistema

### **Fluxo de Dados**

```
Sensor HC-SR04 → ESP32/ESP8266 → Broker MQTT (Raspberry Pi) → Dashboard Web
```

### **Tópicos MQTT**

| Tópico               | Direção          | Função                               |
| -------------------- | ---------------- | ------------------------------------ |
| `vaga/A/status`      | ESP32 → Broker   | Status da Vaga A ("LIVRE"/"OCUPADO") |
| `vaga/A/distancia`   | ESP32 → Broker   | Valor bruto da distância em cm       |
| `vaga/B/status`      | ESP8266 → Broker | Status da Vaga B                     |
| `vaga/total/livres`  | RPi → Broker     | Total de vagas livres                |
| `vaga/geral/comando` | Broker → ESPs    | Comandos de controle                 |

---

## 🔌 Hardware e Componentes

| Componente           | Quantidade  | Função                                 |
| -------------------- | ----------- | -------------------------------------- |
| **ESP32**            | 1x (Vaga A) | Leitura sensor, Wi-Fi, Cliente MQTT    |
| **ESP8266**          | 1x (Vaga B) | Módulo secundário para múltiplas vagas |
| **Sensor HC-SR04**   | 2x          | Medição de distância por ultrassom     |
| **Raspberry Pi**     | 1x          | Broker MQTT e Dashboard Web            |
| **Protótipo Físico** | 1x          | Maquete com vagas para demonstração    |

---

## 👥 Nossa Equipe

<div align="center">

| [<img src="https://avatars.githubusercontent.com/Thomazrlima" width="100" style="border-radius:50%"><br>Thomaz Lima](https://github.com/Thomazrlima) | [<img src="https://avatars.githubusercontent.com/evaldocunhaf" width="100" style="border-radius:50%"><br>Evaldo Filho](https://github.com/evaldocunhaf) | [<img src="https://avatars.githubusercontent.com/hsspedro " width="100" style="border-radius:50%"><br>Pedro Silva](https://github.com/hsspedro) | [<img src="https://avatars.githubusercontent.com/Sofia-Saraiva" width="100" style="border-radius:50%"><br>Sofia Saraiva](https://github.com/Sofia-Saraiva) |
| :--------------------------------------------------------------------------------------------------------------------------------------------------: | :-----------------------------------------------------------------------------------------------------------------------------------------------------: | :---------------------------------------------------------------------------------------------------------------------------------------------: | :--------------------------------------------------------------------------------------------------------------------------------------------------------: |
|                                                                  Frontend Developer                                                                   |                                                                Especialista em Hardware                                                                 |                                                                Desenvolvedor IoT                                                                |                                                                     Backend Developer                                                                     |

</div>

