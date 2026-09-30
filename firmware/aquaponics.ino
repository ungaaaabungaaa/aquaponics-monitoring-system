// Aquaponics Monitor — ESP32 sensor node.
// Reads water temperature (DS18B20), pH and dissolved oxygen (analog probes),
// air temperature/humidity (DHT22) and light (LDR), then POSTs JSON every 2s.

#include <WiFi.h>
#include <HTTPClient.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <DHT.h>

#define WIFI_SSID   "your-ssid"
#define WIFI_PASS   "your-password"
#define ENDPOINT    "http://192.168.1.10:8080/readings"

#define PIN_DS18B20 4
#define PIN_DHT     5
#define PIN_PH      34
#define PIN_DO      35
#define PIN_LDR     32

OneWire oneWire(PIN_DS18B20);
DallasTemperature waterTemp(&oneWire);
DHT dht(PIN_DHT, DHT22);

void setup() {
  Serial.begin(115200);
  waterTemp.begin();
  dht.begin();
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) delay(500);
}

void loop() {
  waterTemp.requestTemperatures();
  float ph = analogRead(PIN_PH) * (14.0 / 4095.0);        // calibrate for your probe
  float dox = analogRead(PIN_DO) * (20.0 / 4095.0);       // mg/L, calibrate for your probe
  float lux = analogRead(PIN_LDR) * (20000.0 / 4095.0);

  String json = "{\"waterTemp\":" + String(waterTemp.getTempCByIndex(0), 1) +
                ",\"ph\":" + String(ph, 2) +
                ",\"oxygen\":" + String(dox, 2) +
                ",\"airTemp\":" + String(dht.readTemperature(), 1) +
                ",\"humidity\":" + String(dht.readHumidity(), 1) +
                ",\"light\":" + String(lux, 0) + "}";

  HTTPClient http;
  http.begin(ENDPOINT);
  http.addHeader("Content-Type", "application/json");
  http.POST(json);
  http.end();
  Serial.println(json);
  delay(2000);
}
