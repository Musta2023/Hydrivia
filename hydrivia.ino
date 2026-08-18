#include <WiFi.h>
#include <PubSubClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME280.h>

#include "secrets.h"

// ============================================================================
// HYDRIVIA - SMART IRRIGATION SYSTEM (MQTT MANUAL/REMOTE CONTROL MODE)
// ============================================================================

// BME280 SENSOR SETUP
Adafruit_BME280 bme; // I2C configuration
#define BME280_I2C_ADDR 0x77 

// ============================================================================
// MQTT CLIENT & TOPICS
// ============================================================================

const char* MQTT_CLIENT_ID     = "hydrivia-irrigation";

// Sensor Telemetry Topics
const char* TOPIC_TEMP         = "hydrivia/sensors/temperature";
const char* TOPIC_AIR_HUMIDITY  = "hydrivia/sensors/air_humidity";
const char* TOPIC_WATER_LEVEL   = "hydrivia/sensors/water_level";
const char* TOPIC_SOIL_HUMIDITY= "hydrivia/sensors/soil_humidity";

// Actuator / Pump Topics
const char* TOPIC_PUMP_COMMAND  = "hydrivia/pump/command"; // Inbound control commands (ON/OFF)
const char* TOPIC_PUMP_STATUS   = "hydrivia/pump/status";  // Outbound state feedback

// System Events
const char* TOPIC_ALERTS        = "hydrivia/alerts";

// ============================================================================
// PIN DEFINITIONS
// ============================================================================

// US-100 Ultrasonic Sensor
#define PIN_ULTRASONIC_TRIG 5
#define PIN_ULTRASONIC_ECHO 18

// Soil Moisture Sensor (Analog)
#define PIN_SOIL_MOISTURE 34

// Relay Control
#define PIN_RELAY 27

// Indicator LEDs
#define PIN_LED_LOW 33
#define PIN_LED_NORMAL 32

// BME280 I2C Pins (ESP32 Defaults)
#define PIN_I2C_SDA 21
#define PIN_I2C_SCL 22

// ============================================================================
// WATER TANK CALIBRATION
// ============================================================================

const float EMPTY_DISTANCE = 18.69; // Distance in cm when tank is empty
const float FULL_DISTANCE  = 8.21;  // Distance in cm when tank is full

// ============================================================================
// SOIL MOISTURE CALIBRATION
// ============================================================================

const int SOIL_DRY_VALUE = 3500; // Raw ADC reading when dry in air
const int SOIL_WET_VALUE = 1500; // Raw ADC reading when wet in water

// ============================================================================
// WATER LEVEL SAFETY THRESHOLDS
// ============================================================================

const float WATER_LEVEL_CRITICAL_PCT = 20.0;
const float WATER_LEVEL_LOW_PCT      = 30.0;

// ============================================================================
// TIMING CONSTANTS
// ============================================================================

const unsigned long SENSOR_INTERVAL_MS  = 2000;             // Read sensors every 2 seconds
const unsigned long PUMP_MAX_RUNTIME_MS = 5UL * 60UL * 1000UL; // Safety cutoff: 5 minutes max

// ============================================================================
// RELAY CONFIGURATION
// ============================================================================

const bool RELAY_ACTIVE_HIGH = true; //

// ============================================================================
// GLOBAL OBJECTS
// ============================================================================

WiFiClientSecure espClient;
PubSubClient mqttClient(espClient);

// ============================================================================
// GLOBAL VARIABLES
// ============================================================================

unsigned long lastSensorRead      = 0;
unsigned long pumpStartMillis     = 0;
unsigned long lastMqttRetryMillis = 0;
bool pumpRunning                  = false;

// ============================================================================
// SENSOR DATA STRUCTURE
// ============================================================================

struct SensorData {
  float soilHumidity;
  float waterLevel;
  float temperature;
  float airHumidity;
  bool valid;
};

SensorData currentData;

// ============================================================================
// FUNCTION PROTOTYPES
// ============================================================================

void connectWiFi();
void connectMQTT();
void mqttCallback(char* topic, byte* payload, unsigned int length);
SensorData readSensors();
float readSoilHumidityPercent();
float readWaterLevelPercent();
bool validateData(const SensorData& d);
void publishSensorData(const SensorData& d);
void publishPumpStatus();
void publishAlert(const char* type, const char* severity, const char* message);
void startPump();
void stopPump();
void checkPumpSafety();
void setRelay(bool state);
void printSensorData(const SensorData& d);

// ============================================================================
// SETUP
// ============================================================================

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n========================================");
  Serial.println("       HYDRIVIA SMART IRRIGATION");
  Serial.println("       MQTT CONTROL-ONLY MODE");
  Serial.println("========================================\n");

  // fiix startup trigger pulse for Active-LOW relays
  digitalWrite(PIN_RELAY, RELAY_ACTIVE_HIGH ? LOW : HIGH);
  pinMode(PIN_RELAY, OUTPUT);

  // Configure remaining GPIO Modes
  pinMode(PIN_ULTRASONIC_TRIG, OUTPUT);
  pinMode(PIN_ULTRASONIC_ECHO, INPUT);
  pinMode(PIN_SOIL_MOISTURE, INPUT);
  pinMode(PIN_LED_LOW, OUTPUT);
  pinMode(PIN_LED_NORMAL, OUTPUT);

  // Set ESP32 ADC Resolution to 12-bit (0-4095 range)
  analogReadResolution(12);

  // Initial Pin States
  digitalWrite(PIN_ULTRASONIC_TRIG, LOW);
  digitalWrite(PIN_LED_LOW, LOW);
  digitalWrite(PIN_LED_NORMAL, LOW);

  setRelay(false);
  pumpRunning = false;

  Serial.println("[OK] GPIO pins initialized.");

  // Initialize I2C Bus and BME280 Environment Sensor
  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
  if (!bme.begin(BME280_I2C_ADDR, &Wire)) {
    Serial.println("[ERROR] BME280 sensor not found! Check I2C wiring.");
  } else {
    Serial.println("[OK] BME280 sensor initialized.");
  }

  // Network Initialization
  connectWiFi();

  espClient.setInsecure(); // Skip certificate validation for quick deployment
  mqttClient.setServer(MQTT_SERVER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
  mqttClient.setBufferSize(512);
  mqttClient.setKeepAlive(30);
  mqttClient.setSocketTimeout(15);

  connectMQTT();

  // Perform Initial Readout
  currentData = readSensors();
  currentData.valid = validateData(currentData);
  printSensorData(currentData);

  Serial.println("\n========================================");
  Serial.println("       INITIALIZATION COMPLETE");
  Serial.println("========================================\n");
}

// ============================================================================
// MAIN LOOP
// ============================================================================

void loop() {
  unsigned long now = millis();

  // Maintain Wi-Fi Connection
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  // Maintain MQTT Connection (Non-blocking retry timer)
  if (!mqttClient.connected()) {
    if (now - lastMqttRetryMillis >= 5000) {
      lastMqttRetryMillis = now;
      connectMQTT();
    }
  } else {
    mqttClient.loop();
  }

  // Main Sensor Processing Interval
  if (now - lastSensorRead >= SENSOR_INTERVAL_MS) {
    lastSensorRead = now;

    currentData = readSensors();
    currentData.valid = validateData(currentData);
    printSensorData(currentData);

    // Update Status LEDs Based on Water Level
    if (currentData.waterLevel < WATER_LEVEL_CRITICAL_PCT) {
      digitalWrite(PIN_LED_LOW, HIGH);
      digitalWrite(PIN_LED_NORMAL, LOW);
      Serial.println("[ALERT] Water tank level < 20% - Low LED ON");
    } else {
      digitalWrite(PIN_LED_LOW, LOW);
      digitalWrite(PIN_LED_NORMAL, HIGH);
      Serial.println("[INFO] Water tank level normal - Normal LED ON");
    }

    // Publish telemetry and evaluate emergency cutoffs
    if (currentData.valid && mqttClient.connected()) {
      publishSensorData(currentData);

      // Emergency Cutoff if Tank Runs Out of Water While Running
      if (currentData.waterLevel < WATER_LEVEL_CRITICAL_PCT && pumpRunning) {
        stopPump();
        publishAlert("water_critical", "high", "Critical tank level - Pump stopped automatically");
      }
    }
  }

  // Monitor Pump Safety Timer
  checkPumpSafety();
}

// ============================================================================
// SENSOR READINGS & UTILITIES
// ============================================================================

SensorData readSensors() {
  SensorData d;

  d.soilHumidity = readSoilHumidityPercent();
  d.waterLevel   = readWaterLevelPercent();

  // Read BME280 Measurements
  d.temperature = bme.readTemperature();
  d.airHumidity = bme.readHumidity();

  // Fallback if I2C Read Fails
  if (isnan(d.temperature) || isnan(d.airHumidity)) {
    Serial.println("[ERROR] BME280 read failed!");
    d.temperature = 0.0;
    d.airHumidity = 0.0;
  }

  return d;
}

float readSoilHumidityPercent() {
  // Average 10 raw ADC readings to filter high-frequency noise
  long sumRaw = 0;
  for (int i = 0; i < 10; i++) {
    sumRaw += analogRead(PIN_SOIL_MOISTURE);
    delayMicroseconds(100);
  }
  int rawValue = sumRaw / 10;

  Serial.print("Soil raw ADC value: ");
  Serial.println(rawValue);

  // Convert raw value to moisture percentage
  float moisture = ((float)(SOIL_DRY_VALUE - rawValue) / (float)(SOIL_DRY_VALUE - SOIL_WET_VALUE)) * 100.0;
  return constrain(moisture, 0.0, 100.0);
}

float readWaterLevelPercent() {
  for (int attempt = 0; attempt < 3; attempt++) {
    // Send 10 microsecond trigger pulse
    digitalWrite(PIN_ULTRASONIC_TRIG, LOW);
    delayMicroseconds(2);
    digitalWrite(PIN_ULTRASONIC_TRIG, HIGH);
    delayMicroseconds(10);
    digitalWrite(PIN_ULTRASONIC_TRIG, LOW);

    // Measure echo pulse duration (25 ms timeout)
    long duration = pulseIn(PIN_ULTRASONIC_ECHO, HIGH, 25000);

    if (duration > 0) {
      float distance = duration * 0.0343 / 2.0;
      if (distance >= 2.0 && distance <= 400.0) {
        float level = ((EMPTY_DISTANCE - distance) / (EMPTY_DISTANCE - FULL_DISTANCE)) * 100.0;
        level = constrain(level, 0.0, 100.0);

        Serial.print("Distance: ");
        Serial.print(distance, 2);
        Serial.print(" cm | Level: ");
        Serial.print(level, 1);
        Serial.println(" %");

        return level;
      }
    }

    // 200 ms settling delay between pings to prevent internal echo stacking inside the tankk
    delay(200);
  }

  Serial.println("US-100: No valid measurement");
  return currentData.waterLevel;
}

bool validateData(const SensorData& d) {
  if (d.soilHumidity < 0 || d.soilHumidity > 100) return false;
  if (d.waterLevel < 0 || d.waterLevel > 100) return false;
  if (d.temperature < -40 || d.temperature > 85) return false;
  if (d.airHumidity < 0 || d.airHumidity > 100) return false;
  return true;
}

void printSensorData(const SensorData& d) {
  Serial.println("--- SENSOR DATA ---");
  Serial.print("Soil Humidity: "); Serial.print(d.soilHumidity, 1); Serial.println("%");
  Serial.print("Water Level:   "); Serial.print(d.waterLevel, 1); Serial.println("%");
  Serial.print("Temperature:   "); Serial.print(d.temperature, 1); Serial.println(" °C");
  Serial.print("Air Humidity:  "); Serial.print(d.airHumidity, 1); Serial.println("%");
  Serial.println("-------------------");
}

// ============================================================================
// NETWORK & PUMP CONTROL LOGIC
// ============================================================================

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.println("\nConnecting to Wi-Fi...");
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("[OK] Wi-Fi connected.");
    Serial.print("ESP32 IP: "); Serial.println(WiFi.localIP());
  } else {
    Serial.println("[ERROR] Wi-Fi connection failed.");
  }
}

void connectMQTT() {
  if (mqttClient.connected()) return;

  Serial.println("\nConnecting to MQTT broker...");
  bool connected = false;

  if (strlen(MQTT_USERNAME) > 0) {
    connected = mqttClient.connect(MQTT_CLIENT_ID, MQTT_USERNAME, MQTT_PASSWORD);
  } else {
    connected = mqttClient.connect(MQTT_CLIENT_ID);
  }

  if (connected) {
    Serial.println("[OK] MQTT connected!");
    mqttClient.subscribe(TOPIC_PUMP_COMMAND);
    publishPumpStatus();
  } else {
    Serial.print("[ERROR] MQTT failed, state = ");
    Serial.println(mqttClient.state());
  }
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  message.trim();
  message.toUpperCase();

  if (String(topic) != TOPIC_PUMP_COMMAND) return;

  Serial.print("[MQTT COMMAND RECEIVED]: ");
  Serial.println(message);

  if (message == "ON") {
    // Safety check: Do not start if tank level is under 30%
    if (currentData.waterLevel < WATER_LEVEL_LOW_PCT) {
      publishAlert("pump_blocked", "high", "Command ON refused - Water level under 30%");
      Serial.println("[REJECTED] Water level too low to start pump.");
      return;
    }
    startPump();
  } else if (message == "OFF") {
    stopPump();
  }
}

void setRelay(bool state) {
  digitalWrite(PIN_RELAY, RELAY_ACTIVE_HIGH ? (state ? HIGH : LOW) : (state ? LOW : HIGH));
}

void startPump() {
  if (pumpRunning) return;
  setRelay(true);
  pumpRunning = true;
  pumpStartMillis = millis();
  publishPumpStatus();
  Serial.println("[PUMP STATE] Turned ON via MQTT command");
}

void stopPump() {
  setRelay(false);
  pumpRunning = false;
  publishPumpStatus();
  Serial.println("[PUMP STATE] Turned OFF via MQTT command");
}

void checkPumpSafety() {
  // Automatic safety cutoff after 5 minutes continuous execution
  if (pumpRunning && (millis() - pumpStartMillis > PUMP_MAX_RUNTIME_MS)) {
    stopPump();
    publishAlert("pump_timeout", "high", "Pump safety timeout - Automatically turned off after 5 minutes");
  }
}

// ============================================================================
// MQTT PUBLISHERS
// ============================================================================

void publishSensorData(const SensorData& d) {
  if (!mqttClient.connected()) return;

  char tempBuf[16], airHumBuf[16], waterBuf[16], soilBuf[16];

  snprintf(tempBuf, sizeof(tempBuf), "%.1f", d.temperature);
  snprintf(airHumBuf, sizeof(airHumBuf), "%.1f", d.airHumidity);
  snprintf(waterBuf, sizeof(waterBuf), "%.1f", d.waterLevel);
  snprintf(soilBuf, sizeof(soilBuf), "%.1f", d.soilHumidity);

  mqttClient.publish(TOPIC_TEMP, tempBuf);
  mqttClient.publish(TOPIC_AIR_HUMIDITY, airHumBuf);
  mqttClient.publish(TOPIC_WATER_LEVEL, waterBuf);
  mqttClient.publish(TOPIC_SOIL_HUMIDITY, soilBuf);
}

void publishPumpStatus() {
  if (!mqttClient.connected()) return;
  mqttClient.publish(TOPIC_PUMP_STATUS, pumpRunning ? "ON" : "OFF");
}

void publishAlert(const char* type, const char* severity, const char* message) {
  if (!mqttClient.connected()) return;

  StaticJsonDocument<256> doc;
  doc["type"]     = type;
  doc["severity"] = severity;
  doc["message"]  = message;

  char buffer[256];
  serializeJson(doc, buffer);
  mqttClient.publish(TOPIC_ALERTS, buffer);
}