/*
 * Baja Telemetry Studio — ESP32-S3 publisher (DEMONSTRAÇÃO)
 * Instalar bibliotecas ArduinoJson 7 e PubSubClient.
 * Para leituras reais, substituir as funções de geração de dados simulados
 * por drivers dos sensores e circuitos de condicionamento apropriados.
 * NUNCA ligar sinais automotivos ou 12V diretamente ao ESP32-S3.
 */
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <math.h>

const char* WIFI_SSID = "SUA_REDE";
const char* WIFI_PASSWORD = "SUA_SENHA";
// Usar IP LAN da máquina com Docker/Mosquitto, NÃO localhost.
const char* MQTT_BROKER = "192.168.1.100";
const uint16_t MQTT_PORT = 1883;
const char* MQTT_TOPIC = "baja/telemetry";

WiFiClient net;
PubSubClient mqtt(net);
unsigned long lastSend = 0;
uint32_t sequence = 0;

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("WiFi ...");
  for (int i = 0; i < 30 && WiFi.status() != WL_CONNECTED; i++) { delay(300); Serial.print('.'); }
  Serial.println(WiFi.status() == WL_CONNECTED ? " conectado" : " indisponível");
}

void connectMqtt() {
  if (WiFi.status() != WL_CONNECTED || mqtt.connected()) return;
  String clientId = "baja-esp32-" + String((uint32_t)ESP.getEfuseMac(), HEX);
  if (mqtt.connect(clientId.c_str())) Serial.println("MQTT conectado");
}

void setup() {
  Serial.begin(115200);
  WiFi.mode(WIFI_STA);
  connectWiFi();
  mqtt.setServer(MQTT_BROKER, MQTT_PORT);
  mqtt.setBufferSize(512);
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) connectWiFi();
  if (!mqtt.connected()) connectMqtt();
  if (mqtt.connected()) mqtt.loop();
  if (!mqtt.connected() || millis() - lastSend < 1000) return;
  lastSend = millis();

  // Valores artificiais somente para demonstração de comunicação.
  const float t = sequence * 0.12f;
  const float phase = (sequence % 240) * (2.0f * PI / 240);
  JsonDocument doc;
  doc["seq"] = sequence;
  doc["lap"] = (sequence / 240) + 1;
  doc["progress"] = (sequence % 240) / 240.0f;
  doc["rpm"] = roundf(4200 + 700 * sinf(t));
  doc["speedKmh"] = roundf((44 + 11 * sinf(t / 2)) * 10) / 10;
  doc["engineTempC"] = 83 + 6 * sinf(t / 6);
  doc["cvtTempC"] = 68 + 4 * sinf(t / 4);
  doc["accelerationG"] = 0.5 * sinf(t / 2);
  doc["inclineDeg"] = 9 * sinf(t / 3);
  doc["batteryV"] = 12.6;
  doc["lat"] = -2.53 + 0.00165 * sinf(phase) + 0.00033 * sinf(3 * phase);
  doc["lon"] = -44.3 + 0.00225 * cosf(phase) + 0.00044 * cosf(2 * phase + 0.4f);

  char payload[512];
  size_t len = serializeJson(doc, payload, sizeof(payload));
  if (!mqtt.publish(MQTT_TOPIC, reinterpret_cast<const uint8_t*>(payload), len)) {
    Serial.println("Falha no publish MQTT");
  }
  sequence++;
}
