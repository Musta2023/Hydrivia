#include "secrets.h"
#include <Adafruit_BME280.h>
#include <Adafruit_Sensor.h>
#include <ArduinoJson.h>
#include <PubSubClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <Wire.h>

Adafruit_BME280 bme;
bool bmeAvailable = false;

#define BME280_I2C_ADDR 0x77

// ============================================================================
// GPIO
// ============================================================================

// Ultrasonic distance sensor (GPIO trigger/echo mode)
#define PIN_ULTRASONIC_TRIG                                                    \
  14 // X15 — moved from GPIO5 (boot strapping pin) to GPIO14
#define PIN_ULTRASONIC_ECHO 18 // X14

// Soil moisture sensors
#define PIN_SOIL_MOISTURE_1 34 // X4  // Zone 1 - Tomato
#define PIN_SOIL_MOISTURE_2 35 // X5  // Zone 2 - Mint
#define PIN_SOIL_MOISTURE_3 32 // X6  // Zone 3 - Onion

// Common pump
#define PIN_PUMP_RELAY 27 // integrated

// Electrovalves
#define PIN_VALVE1_RELAY 26 // X1 // tomato
#define PIN_VALVE2_RELAY 25 // X2 // Mint
#define PIN_VALVE3_RELAY 23 // X10 // Onion

// Tank status LEDs
#define PIN_LED_LOW 33 // integrated

// BME280
#define PIN_I2C_SDA 21 // integrated
#define PIN_I2C_SCL 22

// Device ID
const char *DEVICE_ID = "hydrivia-esp32-01";

// ============================================================================
// ZONE CONFIGURATION
// ============================================================================

const char *ZONE1_PLANT = "tomato";
const char *ZONE2_PLANT = "mint";
const char *ZONE3_PLANT = "onion";

// ============================================================================
// WATER TANK CALIBRATION
// ============================================================================

const float EMPTY_DISTANCE = 180.69f;
const float FULL_DISTANCE = 1.21f;
const float TANK_CAPACITY_LITERS = 7000.0f;

// ============================================================================
// SOIL SENSOR CALIBRATION
// ============================================================================

const int SOIL_DRY_VALUE = 3500;
const int SOIL_WET_VALUE = 1500;

// ============================================================================
// PUMP WATER FLOW l/MIN
// ============================================================================
const float PUMP_FLOW_RATE = 30.0f; // Litres per minute

// ============================================================================
// ZONE WATERING SCHEDULE & STATE
// ============================================================================

struct ZoneWateringSchedule {
  bool queued;
  bool active;
  float targetWateringL;
  float targetSoilMoisturePct;
  unsigned long durationMs;
  unsigned long startMillis;
};

ZoneWateringSchedule zoneSchedules[3] = {
    {false, false, 0.0f, 0.0f, 0UL, 0UL}, // Tomato {queued, active, targetWateringL, targetSoilMoisturePct, durationMs, startMillis}
    {false, false, 0.0f, 0.0f, 0UL, 0UL},  // Mint
    {false, false, 0.0f, 0.0f, 0UL, 0UL}}; // Onion

// ============================================================================
// INCOMING MQTT COMMAND FIFO BUFFER (Decouples TLS reception from execution)
// ============================================================================

struct PendingCommand {
  uint8_t zoneId;
  String payload;
};

#define MAX_PENDING_COMMANDS 8
PendingCommand pendingCommands[MAX_PENDING_COMMANDS];
int pendingCmdHead = 0;
int pendingCmdTail = 0;

void enqueuePendingCommand(uint8_t zoneId, const String &payload) {
  int nextHead = (pendingCmdHead + 1) % MAX_PENDING_COMMANDS;
  if (nextHead != pendingCmdTail) {
    pendingCommands[pendingCmdHead].zoneId = zoneId;
    pendingCommands[pendingCmdHead].payload = payload;
    pendingCmdHead = nextHead;
  }
}

bool dequeuePendingCommand(PendingCommand &cmd) {
  if (pendingCmdHead == pendingCmdTail) {
    return false;
  }
  cmd = pendingCommands[pendingCmdTail];
  pendingCmdTail = (pendingCmdTail + 1) % MAX_PENDING_COMMANDS;
  return true;
}

// ============================================================================
// SAFETY THRESHOLDS
// ============================================================================

const float WATER_LEVEL_CRITICAL_PCT = 20.0f;
const float WATER_LEVEL_LOW_PCT = 30.0f;

// ============================================================================
// TIMING
// ============================================================================

const unsigned long SENSOR_INTERVAL_MS = 2000UL;
const unsigned long SENSOR_SNAPSHOT_INTERVAL_MS = 60000UL;

const unsigned long PUMP_MAX_RUNTIME_MS = 5UL * 60UL * 1000UL;

const unsigned long MQTT_RETRY_INTERVAL_MS = 5000UL;

// ============================================================================
// RELAY CONFIGURATION
// ============================================================================

const bool RELAY_ACTIVE_HIGH = true;

// ============================================================================
// MQTT TOPICS
// ============================================================================

// Zone 1
const char *TOPIC_ZONE1_STATE = "hydrivia/zones/1/state";

const char *TOPIC_ZONE1_COMMAND = "hydrivia/zones/1/command";

// Zone 2
const char *TOPIC_ZONE2_STATE = "hydrivia/zones/2/state";

const char *TOPIC_ZONE2_COMMAND = "hydrivia/zones/2/command";

// Zone 3
const char *TOPIC_ZONE3_STATE = "hydrivia/zones/3/state";

const char *TOPIC_ZONE3_COMMAND = "hydrivia/zones/3/command";

// Pump
const char *TOPIC_PUMP_STATE = "hydrivia/pump/state";

// Tank
const char *TOPIC_TANK_STATE = "hydrivia/tank/state";

// Environment
const char *TOPIC_ENVIRONMENT_STATE = "hydrivia/environment/state";

// Complete system snapshot every 60 seconds
const char *TOPIC_SNAPSHOT = "hydrivia/snapshot";

// Alerts
const char *TOPIC_ALERTS = "hydrivia/alerts";

// ============================================================================
// MQTT
// ============================================================================

const char *MQTT_CLIENT_ID = "hydrivia-irrigation";

WiFiClientSecure espClient;
PubSubClient mqttClient(espClient);

// ============================================================================
// TIMERS
// ============================================================================

unsigned long lastSensorRead = 0;
unsigned long lastSensorSnapshot = 0;
unsigned long lastMqttRetryMillis = 0;
unsigned long pumpStartMillis = 0;

// ============================================================================
// DATA STRUCTURES
// ============================================================================

struct ZoneData {

  uint8_t id;

  const char *plant;

  float soilHumidity;

  bool valveOpen;
};

struct SensorData {

  ZoneData zone1;

  ZoneData zone2;

  ZoneData zone3;

  // Tank
  float waterLevel;
  float volumeLiters;

  // Environment
  float temperature;
  float airHumidity;

  bool valid;
};

// ============================================================================
// CURRENT SENSOR DATA
// ============================================================================

SensorData currentData = {

    {1, ZONE1_PLANT, 0.0f, false},

    {2, ZONE2_PLANT, 0.0f, false},

    {3, ZONE3_PLANT, 0.0f, false},

    0.0f, // waterLevel
    0.0f, // volumeLiters
    0.0f, // temperature
    0.0f, // airHumidity
    false // valid
};

// ============================================================================
// ACTUATOR STATES
// ============================================================================

bool pumpRunning = false;

// ============================================================================
// FUNCTION PROTOTYPES
// ============================================================================

// Wi-Fi / MQTT
void connectWiFi();

void connectMQTT();

void mqttCallback(char *topic, byte *payload, unsigned int length);

void handleZoneCommand(uint8_t zone, String command);

// Automated Sequential Watering Control
void startZoneWatering(uint8_t zone, float wateringL,
                       float targetSoilMoisturePct);
void executeZoneWatering(uint8_t zone);
bool isAnyZoneWateringActive();
void startNextQueuedZone();
void startZoneWateringManual(uint8_t zone);
void stopZoneWatering(uint8_t zone);
void checkZoneWateringProgress();

// Sensors
SensorData readSensors();

void readSoilHumidityPercent(float &moisture1, float &moisture2,
                             float &moisture3);

float readWaterLevelPercent();

float calculateVolumeLiters(float waterLevelPercent);

bool validateData(const SensorData &data);

// Display
void printSensorData(const SensorData &data);

// MQTT publishing
void publishZoneState(uint8_t zone);

void publishAllZoneStates();

void publishPumpState();

void publishTankState();

void publishEnvironmentState();

void publishSnapshot();

void publishAlert(const char *type, const char *severity, const char *message);

// Pump
void startPump();

void stopPump();

void checkPumpSafety();

void checkPumpZoneSafety();

void emergencyShutdown();

// Zones / valves
bool isZoneOpen(uint8_t zone);

bool areAllZonesClosed();

void setZoneValve(uint8_t zone, bool state);

void openZone(uint8_t zone);

void closeZone(uint8_t zone);

void closeAllZones();

// GPIO
void setRelay(int pin, bool state);

// ============================================================================
// SETUP
// ============================================================================

void setup() {

  Serial.begin(115200);

  delay(1000);

  Serial.println();
  Serial.println("==============================================");
  Serial.println("       HYDRIVIA SMART IRRIGATION");
  Serial.println("       ZONE-BASED MQTT ARCHITECTURE");
  Serial.println("==============================================");
  Serial.println();

  // ========================================================================
  // GPIO — relay pins get an immediate inactive write after pinMode
  // to prevent boot glitches on active-LOW relay boards.
  // ========================================================================

  pinMode(PIN_PUMP_RELAY, OUTPUT);
  digitalWrite(PIN_PUMP_RELAY, RELAY_ACTIVE_HIGH ? LOW : HIGH);

  pinMode(PIN_VALVE1_RELAY, OUTPUT);
  digitalWrite(PIN_VALVE1_RELAY, RELAY_ACTIVE_HIGH ? LOW : HIGH);

  pinMode(PIN_VALVE2_RELAY, OUTPUT);
  digitalWrite(PIN_VALVE2_RELAY, RELAY_ACTIVE_HIGH ? LOW : HIGH);

  pinMode(PIN_VALVE3_RELAY, OUTPUT);
  digitalWrite(PIN_VALVE3_RELAY, RELAY_ACTIVE_HIGH ? LOW : HIGH);

  pinMode(PIN_ULTRASONIC_TRIG, OUTPUT);

  pinMode(PIN_ULTRASONIC_ECHO, INPUT);

  pinMode(PIN_SOIL_MOISTURE_1, INPUT);

  pinMode(PIN_SOIL_MOISTURE_2, INPUT);

  pinMode(PIN_SOIL_MOISTURE_3, INPUT);

  pinMode(PIN_LED_LOW, OUTPUT);

  analogReadResolution(12);

  digitalWrite(PIN_ULTRASONIC_TRIG, LOW);

  digitalWrite(PIN_LED_LOW, LOW);

  // Relay states confirmed OFF via setRelay (redundant but explicit)
  setRelay(PIN_PUMP_RELAY, false);

  setRelay(PIN_VALVE1_RELAY, false);

  setRelay(PIN_VALVE2_RELAY, false);

  setRelay(PIN_VALVE3_RELAY, false);

  Serial.println("[OK] GPIO initialized.");

  // ========================================================================
  // BME280
  // ========================================================================

  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);

  bmeAvailable = bme.begin(BME280_I2C_ADDR, &Wire);

  if (bmeAvailable) {

    Serial.println("[OK] BME280 initialized.");

  } else {

    Serial.println("[WARNING] BME280 not found.");

    Serial.println("[WARNING] Temperature and air humidity = 0.");
  }

  // ========================================================================
  // WIFI
  // ========================================================================

  connectWiFi();

  // ========================================================================
  // NTP TIME SYNC — required for TLS certificate date validation
  // ========================================================================

  configTime(0, 0, "pool.ntp.org", "time.nist.gov");

  Serial.print("Syncing NTP time");

  time_t now = time(nullptr);
  int ntpAttempts = 0;

  while (now < 8 * 3600 * 2 && ntpAttempts < 20) {
    delay(500);
    Serial.print(".");
    now = time(nullptr);
    ntpAttempts++;
  }

  Serial.println();

  if (now >= 8 * 3600 * 2) {
    Serial.println("[OK] NTP time synced.");
  } else {
    Serial.println("[WARNING] NTP sync failed — TLS may not work.");
  }

  // ========================================================================
  // MQTT
  // ========================================================================

  // HiveMQ Cloud uses ISRG Root X1 (Let's Encrypt) CA certificate
  static const char *HIVEMQ_CA_CERT =
      "-----BEGIN CERTIFICATE-----\n"
      "MIIFazCCA1OgAwIBAgIRAIIQz7DSQONZRGPgu2OCiwAwDQYJKoZIhvcNAQELBQAw\n"
      "TzELMAkGA1UEBhMCVVMxKTAnBgNVBAoTIEludGVybmV0IFNlY3VyaXR5IFJlc2Vh\n"
      "cmNoIEdyb3VwMRUwEwYDVQQDEwxJU1JHIFJvb3QgWDEwHhcNMTUwNjA0MTEwNDM4\n"
      "WhcNMzUwNjA0MTEwNDM4WjBPMQswCQYDVQQGEwJVUzEpMCcGA1UEChMgSW50ZXJu\n"
      "ZXQgU2VjdXJpdHkgUmVzZWFyY2ggR3JvdXAxFTATBgNVBAMTDElTUkcgUm9vdCBY\n"
      "MTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAK3oJHP0FDfzm54rVygc\n"
      "h77ct984kIxuPOZXoHj3dcKi/vVqbvYATyjb3miGbESTtrFj/RQSa78f0uoxmyF+\n"
      "0TM8ukj13Xnfs7j/EvEhmkvBioZxaUpmZmyPfjxwv60pIgbz5MDmgK7iS4+3mX6U\n"
      "A5/TR5d8mUgjU+g4rk8Kb4Mu0UlXjIB0ttov0DiNewNwIRt18jA8+o+u3dpjq+sW\n"
      "T8KOEUt+zwvo/7V3LvSye0rgTBIlDHCNAymg4VMk7BPZ7hm/ELNKjD+Jo2FR3qyH\n"
      "B5T0Y3HsLuJvW5iB4YlcNHlsdu87kGJ55tukmi8mxdAQ4Q7e2RCOFvu396j3x+UC\n"
      "B5iPNgiV5+I3lg02dZ77DnKxHZu8A/lJBdiB3QW0KtZB6awBdpUKD9jf1b0SHzUv\n"
      "KBds0pjBqAlkd25HN7rOrFleaJ1/ctaJxQZBKT5ZPt0m9STJEadao0xAH0ahmbWn\n"
      "OlFuhjuefXKnEgV4We0+UXgVCwOPjdAvBbI+e0ocS3MFEvzG6uBQE3xDk3SzynTn\n"
      "jh8BCNAw1FtxNrQHusEwMFxIt4I7mKZ9YIqioymCzLq9gwQbooMDQaHWBfEbwrbw\n"
      "qHyGO0aoSCqI3Haadr8faqU9GY/rOPNk3sgrDQoo//fb4hVC1CLQJ13hef4Y53CI\n"
      "rU7m2Ys6xt0nUW7/vGT1M0NPAgMBAAGjQjBAMA4GA1UdDwEB/wQEAwIBBjAPBgNV\n"
      "HRMBAf8EBTADAQH/MB0GA1UdDgQWBBR5tFnme7bl5AFzgAiIyBpY9umbbjANBgkq\n"
      "hkiG9w0BAQsFAAOCAgEAVR9YqbyyqFDQDLHYGmkgJykIrGF1XIpu+ILlaS/V9lZL\n"
      "ubhzEFnTIZd+50xx+7LSYK05qAvqFyFWhfFQDlnrzuBZ6brJFe+GnY+EgPbk6ZGQ\n"
      "3BebYhtF8GaV0nxvwuo77x/Py9auJ/GpsMiu/X1+mvoiBOv/2X/qkSsisRcOj/KK\n"
      "NFtY2PwByVS5uCbMiogziUwthDyC3+6WVwW6LLv3xLfHTjuCvjHIInNzktHCgKQ5\n"
      "ORAzI4JMPJ+GslWYHb4phowim57iaztXOoJwTdwJx4nLCgdNbOhdjsnvzqvHu7Ur\n"
      "TkXWStAmzOVyyghqpZXjFaH3pO3JLF+l+/+sKAIuvtd7u+Nxe5AW0wdeRlN8NwdC\n"
      "jNPElpzVmbUq4JUagEiuTDkHzsxHpFKVK7q4+63SM1N95R1NbdWhscdCb+ZAJzVc\n"
      "oyi3B43njTOQ5yOf+1CceWxG1bQVs5ZufpsMljq4Ui0/1lvh+wjChP4kqKOJ2qxq\n"
      "4RgqsahDYVvTH9w7jXbyLeiNdd8XM2w9U/t7y0Ff/9yi0GE44Za4rF2LN9d11TPA\n"
      "mRGunUHBcnWEvgJBQl9nJEiU0Zsnvgc/ubhPgXRR4Xq37Z0j4r7g1SgEEzwxA57d\n"
      "emyPxgcYxn/eR44/KJ4EBs+lVDR3veyJm+kXQ99b21/+jh5Xos1AnX5iItreGCc=\n"
      "-----END CERTIFICATE-----\n";

  espClient.setCACert(HIVEMQ_CA_CERT);

  mqttClient.setServer(MQTT_SERVER, MQTT_PORT);

  mqttClient.setCallback(mqttCallback);

  mqttClient.setBufferSize(2304);

  mqttClient.setKeepAlive(30);

  mqttClient.setSocketTimeout(15);

  connectMQTT();

  // ========================================================================
  // INITIAL SENSOR READING
  // ========================================================================

  currentData = readSensors();

  currentData.valid = validateData(currentData);

  printSensorData(currentData);

  Serial.println();
  Serial.println("==============================================");
  Serial.println("       HYDRIVIA READY");
  Serial.println("==============================================");
  Serial.println();
}

// ============================================================================
// LOOP
// ============================================================================

void loop() {

  unsigned long now = millis();

  // ========================================================================
  // WIFI
  // ========================================================================

  if (WiFi.status() != WL_CONNECTED) {

    connectWiFi();
  }

  // ========================================================================
  // MQTT
  // ========================================================================

  if (!mqttClient.connected()) {

    if (now - lastMqttRetryMillis >= MQTT_RETRY_INTERVAL_MS) {

      lastMqttRetryMillis = now;

      connectMQTT();
    }

  } else {

    mqttClient.loop();

    // Process all pending MQTT zone commands received during callback
    PendingCommand pendingCmd;
    while (dequeuePendingCommand(pendingCmd)) {
      handleZoneCommand(pendingCmd.zoneId, pendingCmd.payload);
    }
  }

  // ========================================================================
  // SENSOR READING - EVERY 2 SECONDS
  // ========================================================================

  if (now - lastSensorRead >= SENSOR_INTERVAL_MS) {

    lastSensorRead = now;

    currentData = readSensors();

    currentData.valid = validateData(currentData);

    // Synchronize zone valve states
    currentData.zone1.valveOpen = isZoneOpen(1);

    currentData.zone2.valveOpen = isZoneOpen(2);

    currentData.zone3.valveOpen = isZoneOpen(3);

    printSensorData(currentData);

    // ====================================================================
    // WATER SAFETY
    // ====================================================================

    if (currentData.waterLevel < WATER_LEVEL_CRITICAL_PCT) {

      digitalWrite(PIN_LED_LOW, HIGH);

      if (pumpRunning || currentData.zone1.valveOpen ||
          currentData.zone2.valveOpen || currentData.zone3.valveOpen) {

        emergencyShutdown();
      }

    } else {

      digitalWrite(PIN_LED_LOW, LOW);
    }

    // ====================================================================
    // PUMP / VALVE SAFETY
    // ====================================================================

    /*
     * IMPORTANT:
     *
     * If Zone 1, Zone 2 and Zone 3 are all OFF,
     * the pump must also be OFF.
     *
     * This check is kept here as an additional safety layer.
     * The MQTT command handler also performs the shutdown immediately.
     */

    checkPumpZoneSafety();

    // ====================================================================
    // PUBLISH LIVE DATA
    // ====================================================================

    if (currentData.valid && mqttClient.connected()) {

      publishAllZoneStates();

      publishPumpState();

      publishTankState();

      publishEnvironmentState();
    }
  }

  // ========================================================================
  // COMPLETE SNAPSHOT - EVERY 60 SECONDS
  // ========================================================================

  if (now - lastSensorSnapshot >= SENSOR_SNAPSHOT_INTERVAL_MS) {

    lastSensorSnapshot = now;

    if (currentData.valid && mqttClient.connected()) {

      publishSnapshot();
    }
  }

  // ========================================================================
  // AUTOMATED WATERING PROGRESS CHECK
  // ========================================================================

  checkZoneWateringProgress();

  // ========================================================================
  // PUMP SAFETY
  // ========================================================================

  checkPumpSafety();

  // ========================================================================
  // PUMP / VALVE SAFETY
  // ========================================================================

  checkPumpZoneSafety(); // if all valves are off, pump should be off
}

// ============================================================================
// SENSOR READING
// ============================================================================

SensorData readSensors() {

  SensorData data = currentData;

  // ========================================================================
  // SOIL
  // ========================================================================

  readSoilHumidityPercent(data.zone1.soilHumidity, data.zone2.soilHumidity,
                          data.zone3.soilHumidity);

  // ========================================================================
  // WATER LEVEL
  // ========================================================================

  data.waterLevel = readWaterLevelPercent();

  // ========================================================================
  // WATER VOLUME
  // ========================================================================

  data.volumeLiters = calculateVolumeLiters(data.waterLevel);

  // ========================================================================
  // BME280
  // ========================================================================

  if (bmeAvailable) {

    data.temperature = bme.readTemperature();

    data.airHumidity = bme.readHumidity();

    if (isnan(data.temperature) || isnan(data.airHumidity)) {

      Serial.println("[ERROR] BME280 reading failed.");

      data.temperature = 0.0f;

      data.airHumidity = 0.0f;
    }

  } else {

    data.temperature = 0.0f;

    data.airHumidity = 0.0f;
  }

  data.valid = false;

  return data;
}

// ============================================================================
// SOIL MOISTURE - THREE SENSORS
// ============================================================================

void readSoilHumidityPercent(float &moisture1, float &moisture2,
                             float &moisture3) {

  long sumRaw1 = 0;
  long sumRaw2 = 0;
  long sumRaw3 = 0;

  const int samples = 10;

  for (int i = 0; i < samples; i++) {

    sumRaw1 += analogRead(PIN_SOIL_MOISTURE_1);

    sumRaw2 += analogRead(PIN_SOIL_MOISTURE_2);

    sumRaw3 += analogRead(PIN_SOIL_MOISTURE_3);

    delayMicroseconds(100);
  }

  int rawValue1 = sumRaw1 / samples;

  int rawValue2 = sumRaw2 / samples;

  int rawValue3 = sumRaw3 / samples;

  Serial.print("Soil ADC: ");

  Serial.print(rawValue1);

  Serial.print(" | ");

  Serial.print(rawValue2);

  Serial.print(" | ");

  Serial.println(rawValue3);

  float denominator = (float)(SOIL_DRY_VALUE - SOIL_WET_VALUE);

  if (denominator == 0.0f) {

    moisture1 = 0.0f;
    moisture2 = 0.0f;
    moisture3 = 0.0f;

    return;
  }

  moisture1 = ((float(SOIL_DRY_VALUE - rawValue1)) / denominator) * 100.0f;

  moisture2 = ((float(SOIL_DRY_VALUE - rawValue2)) / denominator) * 100.0f;

  moisture3 = ((float(SOIL_DRY_VALUE - rawValue3)) / denominator) * 100.0f;

  moisture1 = constrain(moisture1, 0.0f, 100.0f);

  moisture2 = constrain(moisture2, 0.0f, 100.0f);

  moisture3 = constrain(moisture3, 0.0f, 100.0f);
}

// ============================================================================
// WATER LEVEL — Ultrasonic sensor (GPIO trigger/echo mode)
// ============================================================================

float readWaterLevelPercent() {

  float previousLevel = currentData.waterLevel;

  for (int attempt = 0; attempt < 3; attempt++) {

    // Trigger pulse
    digitalWrite(PIN_ULTRASONIC_TRIG, LOW);

    delayMicroseconds(2);

    digitalWrite(PIN_ULTRASONIC_TRIG, HIGH);

    delayMicroseconds(10);

    digitalWrite(PIN_ULTRASONIC_TRIG, LOW);

    // Read echo
    unsigned long duration = pulseIn(PIN_ULTRASONIC_ECHO, HIGH, 25000UL);

    if (duration > 0) {

      // Distance in cm
      float distance = duration * 0.0343f / 2.0f;

      Serial.print("Tank distance: ");

      Serial.print(distance, 2);

      Serial.println(" cm");

      // Validate distance
      if (distance >= 2.0f && distance <= 400.0f) {

        // ============================================================
        // Convert distance to percentage
        //
        // 180.69 cm = 0%  (EMPTY_DISTANCE)
        // 1.21 cm   = 100% (FULL_DISTANCE)
        // ============================================================

        float denominator = EMPTY_DISTANCE - FULL_DISTANCE;

        if (denominator <= 0.0f) {

          Serial.println("[ERROR] Invalid tank calibration.");

          return previousLevel;
        }

        float levelPercent =
            ((EMPTY_DISTANCE - distance) / denominator) * 100.0f;

        levelPercent = constrain(levelPercent, 0.0f, 100.0f);

        // ============================================================
        // Calculate volume
        // ============================================================

        float volumeLiters = calculateVolumeLiters(levelPercent);

        Serial.print("Tank level: ");

        Serial.print(levelPercent, 1);

        Serial.print("% | Volume: ");

        Serial.print(volumeLiters, 2);

        Serial.println(" L");

        return levelPercent;
      }
    }

    Serial.println("US-100: measurement failed - retrying...");

    delay(200);
  }

  Serial.println("US-100: all measurements failed - keeping previous level.");

  return previousLevel;
}

// ============================================================================
// CALCULATE VOLUME
// ============================================================================

float calculateVolumeLiters(float waterLevelPercent) {

  if (TANK_CAPACITY_LITERS <= 0.0f) {

    return 0.0f;
  }

  waterLevelPercent = constrain(waterLevelPercent, 0.0f, 100.0f);

  float volume = (waterLevelPercent / 100.0f) * TANK_CAPACITY_LITERS;

  return volume;
}

// ============================================================================
// DATA VALIDATION
// ============================================================================

bool validateData(const SensorData &data) {

  // Zone 1
  if (data.zone1.soilHumidity < 0.0f || data.zone1.soilHumidity > 100.0f) {

    return false;
  }

  // Zone 2
  if (data.zone2.soilHumidity < 0.0f || data.zone2.soilHumidity > 100.0f) {

    return false;
  }

  // Zone 3
  if (data.zone3.soilHumidity < 0.0f || data.zone3.soilHumidity > 100.0f) {

    return false;
  }

  // Water level
  if (data.waterLevel < 0.0f || data.waterLevel > 100.0f) {

    return false;
  }

  // Volume
  if (data.volumeLiters < 0.0f || data.volumeLiters > TANK_CAPACITY_LITERS) {

    return false;
  }

  // Temperature
  if (data.temperature < -40.0f || data.temperature > 85.0f) {

    return false;
  }

  // Air humidity
  if (data.airHumidity < 0.0f || data.airHumidity > 100.0f) {

    return false;
  }

  return true;
}

// ============================================================================
// PRINT SENSOR DATA
// ============================================================================

void printSensorData(const SensorData &data) {

  Serial.println();
  Serial.println("--------------- SENSOR DATA ---------------");

  // Zone 1
  Serial.print("Zone 1 - ");

  Serial.print(data.zone1.plant);

  Serial.print(" - Soil: ");

  Serial.print(data.zone1.soilHumidity, 1);

  Serial.print("% | Valve: ");

  Serial.println(data.zone1.valveOpen ? "ON" : "OFF");

  // Zone 2
  Serial.print("Zone 2 - ");

  Serial.print(data.zone2.plant);

  Serial.print(" - Soil: ");

  Serial.print(data.zone2.soilHumidity, 1);

  Serial.print("% | Valve: ");

  Serial.println(data.zone2.valveOpen ? "ON" : "OFF");

  // Zone 3
  Serial.print("Zone 3 - ");

  Serial.print(data.zone3.plant);

  Serial.print(" - Soil: ");

  Serial.print(data.zone3.soilHumidity, 1);

  Serial.print("% | Valve: ");

  Serial.println(data.zone3.valveOpen ? "ON" : "OFF");

  // Tank level
  Serial.print("Tank level: ");

  Serial.print(data.waterLevel, 1);

  Serial.println("%");

  // Tank volume
  Serial.print("Tank volume: ");

  Serial.print(data.volumeLiters, 2);

  Serial.println(" L");

  // Temperature
  Serial.print("Temperature: ");

  Serial.print(data.temperature, 1);

  Serial.println(" C");

  // Air humidity
  Serial.print("Air humidity: ");

  Serial.print(data.airHumidity, 1);

  Serial.println("%");

  // Pump
  Serial.print("Pump: ");

  Serial.println(pumpRunning ? "ON" : "OFF");

  Serial.println("-------------------------------------------");
}

// ============================================================================
// WIFI
// ============================================================================

void connectWiFi() {

  if (WiFi.status() == WL_CONNECTED) {

    return;
  }

  Serial.println();
  Serial.println("Connecting to Wi-Fi...");

  WiFi.mode(WIFI_STA);

  WiFi.disconnect(true);

  delay(100);

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

    Serial.print("IP: ");

    Serial.println(WiFi.localIP());

  } else {

    Serial.println("[ERROR] Wi-Fi connection failed.");
  }
}

// ============================================================================
// MQTT CONNECTION
// ============================================================================

void connectMQTT() {

  if (mqttClient.connected()) {

    return;
  }

  if (WiFi.status() != WL_CONNECTED) {

    return;
  }

  Serial.println();
  Serial.println("Connecting to MQTT...");

  bool connected = false;

  if (strlen(MQTT_USERNAME) > 0) {

    connected =
        mqttClient.connect(MQTT_CLIENT_ID, MQTT_USERNAME, MQTT_PASSWORD);

  } else {

    connected = mqttClient.connect(MQTT_CLIENT_ID);
  }

  if (connected) {

    Serial.println("[OK] MQTT connected.");

    // Subscribe to all zone commands using wildcard (covers zone 1, 2, 3 and any others)
    mqttClient.subscribe("hydrivia/zones/+/command", 1);
    mqttClient.subscribe(TOPIC_ZONE1_COMMAND, 1);
    mqttClient.subscribe(TOPIC_ZONE2_COMMAND, 1);
    mqttClient.subscribe(TOPIC_ZONE3_COMMAND, 1);

    // Publish current state
    publishAllZoneStates();

    publishPumpState();

    publishTankState();

    publishEnvironmentState();

  } else {

    Serial.print("[ERROR] MQTT failed. State = ");
    Serial.println(mqttClient.state());

    char sslErr[128];
    int errCode = espClient.lastError(sslErr, sizeof(sslErr));
    if (errCode != 0) {
      Serial.print("[TLS ERROR] ");
      Serial.println(sslErr);
    }
  }
}

// ============================================================================
// MQTT CALLBACK
// ============================================================================

void mqttCallback(char *topic, byte *payload, unsigned int length) {

  String receivedTopic = String(topic);
  receivedTopic.replace("\"", "");
  receivedTopic.replace("'", "");
  receivedTopic.replace(" ", "");
  receivedTopic.trim();

  String message = "";
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  message.trim();

  Serial.println();
  Serial.println("================ MQTT COMMAND RECEIVED ================");
  Serial.print("Raw Topic: ");
  Serial.println(topic);
  Serial.print("Clean Topic: ");
  Serial.println(receivedTopic);
  Serial.print("Payload: ");
  Serial.println(message);
  Serial.println("=======================================================");

  // Determine Zone ID from topic or payload
  uint8_t zoneId = 0;

  if (receivedTopic.indexOf("zones/1") >= 0 || receivedTopic.indexOf("/1/") >= 0) {
    zoneId = 1;
  } else if (receivedTopic.indexOf("zones/2") >= 0 || receivedTopic.indexOf("/2/") >= 0) {
    zoneId = 2;
  } else if (receivedTopic.indexOf("zones/3") >= 0 || receivedTopic.indexOf("/3/") >= 0) {
    zoneId = 3;
  }

  // Fallback: If topic was generic, look for topic inside JSON payload
  if (zoneId == 0 && message.indexOf("zones/") >= 0) {
    if (message.indexOf("zones/1") >= 0) zoneId = 1;
    else if (message.indexOf("zones/2") >= 0) zoneId = 2;
    else if (message.indexOf("zones/3") >= 0) zoneId = 3;
  }

  if (zoneId >= 1 && zoneId <= 3) {
    enqueuePendingCommand(zoneId, message);
    Serial.print("[BUFFER] Zone ");
    Serial.print(zoneId);
    Serial.println(" command ENQUEUED for execution.");
  } else {
    Serial.print("[WARNING] Could not identify zone for topic: ");
    Serial.println(receivedTopic);
  }
}

// ============================================================================
// ZONE COMMAND HANDLER
// ============================================================================

void handleZoneCommand(uint8_t zone, String command) {

  if (zone < 1 || zone > 3) {

    Serial.println("[ZONE] Invalid zone ID.");

    return;
  }

  command.trim();

  // ========================================================================
  // SIMPLE ON/OFF STRING COMMAND
  // ========================================================================

  if (command.equalsIgnoreCase("ON")) {

    startZoneWateringManual(zone);

    return;
  }

  if (command.equalsIgnoreCase("OFF")) {

    stopZoneWatering(zone);

    return;
  }

  // ========================================================================
  // JSON COMMAND
  // ========================================================================

  StaticJsonDocument<768> doc;
  StaticJsonDocument<512> docNested;

  DeserializationError error = deserializeJson(doc, command);

  if (error) {

    publishAlert("invalid_command", "medium", "Invalid zone JSON format.");

    Serial.print("[ERROR] Invalid zone JSON: ");
    Serial.println(error.f_str());

    return;
  }

  // Support envelope where message is an object or nested JSON string
  JsonObjectConst msgObj;
  if (doc.containsKey("message")) {
    if (doc["message"].is<JsonObjectConst>()) {
      msgObj = doc["message"].as<JsonObjectConst>();
    } else if (doc["message"].is<const char *>()) {
      const char *nestedStr = doc["message"].as<const char *>();
      DeserializationError errNested = deserializeJson(docNested, nestedStr);
      if (!errNested) {
        msgObj = docNested.as<JsonObjectConst>();
      } else {
        msgObj = doc.as<JsonObjectConst>();
      }
    } else {
      msgObj = doc.as<JsonObjectConst>();
    }
  } else {
    msgObj = doc.as<JsonObjectConst>();
  }

  // ========================================================================
  // 1. AUTOMATED WATERING PAYLOAD (wateringL & targetSoilMoisturePct)
  // ========================================================================

  bool hasWateringL = msgObj.containsKey("wateringL");
  bool hasTargetSoilMoisture = msgObj.containsKey("targetSoilMoisturePct");

  if (hasWateringL || hasTargetSoilMoisture) {

    float wateringL = msgObj["wateringL"] | 0.0f;
    float targetSoilMoisturePct = msgObj["targetSoilMoisturePct"] | 0.0f;

    Serial.println();
    Serial.print("[ZONE ");
    Serial.print(zone);
    Serial.print("] Command -> Watering Needed: ");
    Serial.print(wateringL, 1);
    Serial.print(" L | Target Soil Moisture: ");
    Serial.print(targetSoilMoisturePct, 1);
    Serial.println("%");

    if (wateringL > 0.0f) {

      startZoneWatering(zone, wateringL, targetSoilMoisturePct);

    } else {

      Serial.println("[ZONE] wateringL <= 0 -> stopping zone.");

      stopZoneWatering(zone);
    }

    return;
  }

  // ========================================================================
  // 2. VALVE COMMAND
  // ========================================================================

  if (msgObj.containsKey("valve")) {

    const char *valve = msgObj["valve"];

    if (valve != nullptr) {

      String valveCommand = String(valve);

      valveCommand.toUpperCase();

      if (valveCommand == "ON") {

        startZoneWateringManual(zone);

      } else if (valveCommand == "OFF") {

        stopZoneWatering(zone);
      }
    }

    return;
  }

  // ========================================================================
  // 3. IRRIGATION COMMAND
  // ========================================================================

  if (msgObj.containsKey("irrigation")) {

    const char *irrigation = msgObj["irrigation"];

    if (irrigation != nullptr) {

      String irrigationCommand = String(irrigation);

      irrigationCommand.toUpperCase();

      if (irrigationCommand == "ON") {

        startZoneWateringManual(zone);

      } else if (irrigationCommand == "OFF") {

        stopZoneWatering(zone);
      }
    }

    return;
  }

  // ========================================================================
  // 4. DURATION (INFORMATIONAL)
  // ========================================================================

  if (msgObj.containsKey("duration")) {

    unsigned long duration = msgObj["duration"];

    Serial.print("[ZONE] Requested duration: ");

    Serial.print(duration);

    Serial.println(" seconds");
  }
}

// ============================================================================
// ============================================================================
// CHECK IF ANY ZONE IS CURRENTLY WATERING
// ============================================================================

bool isAnyZoneWateringActive() {
  for (uint8_t z = 0; z < 3; z++) {
    if (zoneSchedules[z].active) {
      return true;
    }
  }
  return false;
}

// ============================================================================
// START ZONE WATERING (QUEUE OR IMMEDIATE EXECUTION)
// ============================================================================

void startZoneWatering(uint8_t zone, float wateringL,
                       float targetSoilMoisturePct) {

  if (zone < 1 || zone > 3) {
    return;
  }

  // ========================================================================
  // WATER LEVEL SAFETY
  // ========================================================================

  if (currentData.waterLevel < WATER_LEVEL_LOW_PCT) {
    publishAlert("pump_blocked", "high",
                 "Pump cannot start because tank level is below 30%.");
    Serial.println("[PUMP] START BLOCKED - water level too low.");
    return;
  }

  if (currentData.waterLevel < WATER_LEVEL_CRITICAL_PCT) {
    emergencyShutdown();
    return;
  }

  // ========================================================================
  // CALCULATE DURATION
  // duration (ms) = (wateringL / PUMP_FLOW_RATE) * 60000.0f
  // ========================================================================

  unsigned long durationMs = 0;
  if (PUMP_FLOW_RATE > 0.0f) {
    durationMs = (unsigned long)((wateringL / PUMP_FLOW_RATE) * 60000.0f);
  } else {
    durationMs = 60000UL;
  }

  if (durationMs < 1000UL) {
    durationMs = 1000UL;
  }

  // Save requested schedule parameters
  zoneSchedules[zone - 1].targetWateringL = wateringL;
  zoneSchedules[zone - 1].targetSoilMoisturePct = targetSoilMoisturePct;
  zoneSchedules[zone - 1].durationMs = durationMs;

  // ========================================================================
  // CHECK IF ANOTHER ZONE IS ALREADY RUNNING -> QUEUE THIS ZONE
  // ========================================================================

  if (isAnyZoneWateringActive()) {
    if (zoneSchedules[zone - 1].active) {
      // This zone is already active -> update duration/parameters
      zoneSchedules[zone - 1].startMillis = millis();
      Serial.print("[ZONE ");
      Serial.print(zone);
      Serial.println("] Schedule updated while actively watering.");
    } else {
      // Put in queue
      zoneSchedules[zone - 1].queued = true;
      Serial.println();
      Serial.println("----------------------------------------------");
      Serial.print("[QUEUE] Zone ");
      Serial.print(zone);
      Serial.print(" (");
      Serial.print(zone == 1 ? ZONE1_PLANT : (zone == 2 ? ZONE2_PLANT : ZONE3_PLANT));
      Serial.println(") added to SEQUENTIAL QUEUE.");
      Serial.print("[QUEUE] Will execute automatically after active zone completes.");
      Serial.println();
      Serial.println("----------------------------------------------");

      publishAlert("zone_queued", "info", "Zone added to sequential watering queue.");
    }
  } else {
    // No zone active -> execute immediately
    executeZoneWatering(zone);
  }
}

// ============================================================================
// EXECUTE ZONE WATERING (INTERNAL WORKER)
// ============================================================================

void executeZoneWatering(uint8_t zone) {

  if (zone < 1 || zone > 3) {
    return;
  }

  // ========================================================================
  // CHECK CURRENT SOIL MOISTURE
  // ========================================================================

  float currentMoisture = 0.0f;
  if (zone == 1) {
    currentMoisture = currentData.zone1.soilHumidity;
  } else if (zone == 2) {
    currentMoisture = currentData.zone2.soilHumidity;
  } else if (zone == 3) {
    currentMoisture = currentData.zone3.soilHumidity;
  }

  if (zoneSchedules[zone - 1].targetSoilMoisturePct > 0.0f &&
      currentMoisture >= zoneSchedules[zone - 1].targetSoilMoisturePct) {

    Serial.print("[ZONE ");
    Serial.print(zone);
    Serial.print("] Current soil moisture (");
    Serial.print(currentMoisture, 1);
    Serial.print("%) is already >= target (");
    Serial.print(zoneSchedules[zone - 1].targetSoilMoisturePct, 1);
    Serial.println("%). Skipping to next queued zone.");

    zoneSchedules[zone - 1].queued = false;
    zoneSchedules[zone - 1].active = false;

    publishAlert("watering_skipped", "info",
                 "Soil moisture already meets or exceeds target.");

    // Advance queue
    startNextQueuedZone();
    return;
  }

  // Set active
  zoneSchedules[zone - 1].queued = false;
  zoneSchedules[zone - 1].active = true;
  zoneSchedules[zone - 1].startMillis = millis();

  // Close all other valves to ensure full hydraulic pressure on this single zone
  for (uint8_t z = 1; z <= 3; z++) {
    if (z != zone) {
      setZoneValve(z, false);
      zoneSchedules[z - 1].active = false;
    }
  }

  // Open this zone's valve
  setZoneValve(zone, true);

  // Start pump
  if (!pumpRunning) {
    setRelay(PIN_PUMP_RELAY, true);
    pumpRunning = true;
    pumpStartMillis = millis();
    publishPumpState();
    Serial.println("[PUMP] ON");
  }

  publishZoneState(zone);

  Serial.println();
  Serial.println("==============================================");
  Serial.print("[SEQUENTIAL EXECUTION] STARTING ZONE ");
  Serial.print(zone);
  Serial.print(" (");
  Serial.print(zone == 1 ? ZONE1_PLANT : (zone == 2 ? ZONE2_PLANT : ZONE3_PLANT));
  Serial.println(")");
  Serial.print("Target Volume: ");
  Serial.print(zoneSchedules[zone - 1].targetWateringL, 1);
  Serial.print(" L | Target Soil Moisture: ");
  Serial.print(zoneSchedules[zone - 1].targetSoilMoisturePct, 1);
  Serial.print("% | Duration: ");
  Serial.print(zoneSchedules[zone - 1].durationMs / 1000UL);
  Serial.println("s");
  Serial.println("==============================================");
}

// ============================================================================
// START NEXT QUEUED ZONE
// ============================================================================

void startNextQueuedZone() {

  for (uint8_t z = 1; z <= 3; z++) {
    if (zoneSchedules[z - 1].queued) {
      Serial.println();
      Serial.print("[QUEUE] Launching next queued Zone ");
      Serial.print(z);
      Serial.println(" now...");
      executeZoneWatering(z);
      return;
    }
  }

  // If no more zones queued
  Serial.println();
  Serial.println("[QUEUE] All sequential watering cycles finished.");
  if (pumpRunning && areAllZonesClosed()) {
    checkPumpZoneSafety();
  }
}

// ============================================================================
// START ZONE WATERING (MANUAL)
// ============================================================================

void startZoneWateringManual(uint8_t zone) {

  if (zone < 1 || zone > 3) {
    return;
  }

  if (currentData.waterLevel < WATER_LEVEL_LOW_PCT) {
    publishAlert("pump_blocked", "high",
                 "Pump cannot start because tank level is below 30%.");
    Serial.println("[PUMP] START BLOCKED - water level too low.");
    return;
  }

  if (currentData.waterLevel < WATER_LEVEL_CRITICAL_PCT) {
    emergencyShutdown();
    return;
  }

  // Open valve
  setZoneValve(zone, true);

  // Start pump
  if (!pumpRunning) {
    setRelay(PIN_PUMP_RELAY, true);
    pumpRunning = true;
    pumpStartMillis = millis();
    publishPumpState();
    Serial.println("[PUMP] ON");
  }

  zoneSchedules[zone - 1].active = false;
  zoneSchedules[zone - 1].queued = false;

  publishZoneState(zone);

  Serial.print("[ZONE ");
  Serial.print(zone);
  Serial.println("] Valve ON (Manual)");
}

// ============================================================================
// STOP ZONE WATERING
// ============================================================================

void stopZoneWatering(uint8_t zone) {

  if (zone < 1 || zone > 3) {
    return;
  }

  zoneSchedules[zone - 1].active = false;
  zoneSchedules[zone - 1].queued = false;
  zoneSchedules[zone - 1].durationMs = 0;
  zoneSchedules[zone - 1].startMillis = 0;

  closeZone(zone);

  Serial.print("[ZONE ");
  Serial.print(zone);
  Serial.println("] Valve OFF / Watering Stopped.");

  // Automatically start the next queued zone if available
  startNextQueuedZone();
}

// ============================================================================
// CHECK ZONE WATERING PROGRESS
// ============================================================================

void checkZoneWateringProgress() {

  unsigned long now = millis();

  for (uint8_t z = 1; z <= 3; z++) {

    if (zoneSchedules[z - 1].active) {

      unsigned long elapsed = now - zoneSchedules[z - 1].startMillis;

      bool timeElapsed = (elapsed >= zoneSchedules[z - 1].durationMs);

      // Get current soil moisture
      float currentMoisture = 0.0f;
      if (z == 1) {
        currentMoisture = currentData.zone1.soilHumidity;
      } else if (z == 2) {
        currentMoisture = currentData.zone2.soilHumidity;
      } else if (z == 3) {
        currentMoisture = currentData.zone3.soilHumidity;
      }

      bool moistureReached =
          (zoneSchedules[z - 1].targetSoilMoisturePct > 0.0f &&
           currentMoisture >= zoneSchedules[z - 1].targetSoilMoisturePct);

      if (timeElapsed || moistureReached) {

        Serial.println();
        Serial.print("[ZONE ");
        Serial.print(z);
        Serial.print("] Watering COMPLETE! Reason: ");

        if (timeElapsed) {
          Serial.print("Target volume delivered (");
          Serial.print(zoneSchedules[z - 1].targetWateringL, 1);
          Serial.print(" L)");
        }

        if (timeElapsed && moistureReached) {
          Serial.print(" and ");
        }

        if (moistureReached) {
          Serial.print("Target moisture reached (Current: ");
          Serial.print(currentMoisture, 1);
          Serial.print("%, Target: ");
          Serial.print(zoneSchedules[z - 1].targetSoilMoisturePct, 1);
          Serial.print("%)");
        }

        Serial.println();

        stopZoneWatering(z);

        publishAlert("watering_complete", "info",
                     moistureReached ? "Target soil moisture reached."
                                     : "Target watering volume delivered.");
      }
    }
  }
}

// ============================================================================
// RELAY
// ============================================================================

void setRelay(int pin, bool state) {

  if (RELAY_ACTIVE_HIGH) {

    digitalWrite(pin, state ? HIGH : LOW);

  } else {

    digitalWrite(pin, state ? LOW : HIGH);
  }
}

// ============================================================================
// PUMP START
// ============================================================================

void startPump() {

  if (pumpRunning) {

    Serial.println("[PUMP] Already ON.");

    return;
  }

  // ========================================================================
  // WATER LEVEL SAFETY
  // ========================================================================

  if (currentData.waterLevel < WATER_LEVEL_LOW_PCT) {

    publishAlert("pump_blocked", "high",
                 "Pump cannot start because tank level is below 30%.");

    Serial.println("[PUMP] START BLOCKED - water level too low.");

    return;
  }

  if (currentData.waterLevel < WATER_LEVEL_CRITICAL_PCT) {

    emergencyShutdown();

    return;
  }

  // ========================================================================
  // START PUMP
  // ========================================================================

  setRelay(PIN_PUMP_RELAY, true);

  pumpRunning = true;

  pumpStartMillis = millis();

  publishPumpState();

  Serial.println("[PUMP] ON");
}

// ============================================================================
// PUMP STOP
// ============================================================================

void stopPump() {

  bool wasRunning = pumpRunning;

  setRelay(PIN_PUMP_RELAY, false);

  pumpRunning = false;

  pumpStartMillis = 0;

  // Pump OFF => all zones OFF
  closeAllZones();

  publishPumpState();

  if (wasRunning) {

    Serial.println("[PUMP] OFF");
  }
}

// ============================================================================
// ZONE STATE
// ============================================================================

bool isZoneOpen(uint8_t zone) {

  if (zone == 1) {

    return currentData.zone1.valveOpen;
  }

  if (zone == 2) {

    return currentData.zone2.valveOpen;
  }

  if (zone == 3) {

    return currentData.zone3.valveOpen;
  }

  return false;
}

// ============================================================================
// CHECK IF ALL ZONES ARE CLOSED
// ============================================================================

bool areAllZonesClosed() {

  return !currentData.zone1.valveOpen && !currentData.zone2.valveOpen &&
         !currentData.zone3.valveOpen;
}

// ============================================================================
// CHECK PUMP / ZONE SAFETY
// ============================================================================

void checkPumpZoneSafety() {

  if (pumpRunning && areAllZonesClosed()) {

    Serial.println();
    Serial.println("[SAFETY] ALL VALVES OFF!");

    Serial.println("[SAFETY] Pump will be stopped immediately.");

    setRelay(PIN_PUMP_RELAY, false);

    pumpRunning = false;

    pumpStartMillis = 0;

    publishPumpState();

    publishAlert("pump_auto_stop", "medium",
                 "Pump automatically stopped because Zone 1, Zone 2 and Zone 3 "
                 "are all OFF.");

    Serial.println("[SAFETY] PUMP OFF");
  }
}

// ============================================================================
// SET ZONE VALVE
// ============================================================================

void setZoneValve(uint8_t zone, bool state) {

  if (zone == 1) {

    setRelay(PIN_VALVE1_RELAY, state);

    currentData.zone1.valveOpen = state;

  } else if (zone == 2) {

    setRelay(PIN_VALVE2_RELAY, state);

    currentData.zone2.valveOpen = state;

  } else if (zone == 3) {

    setRelay(PIN_VALVE3_RELAY, state);

    currentData.zone3.valveOpen = state;
  }

  /*
   * Immediately check the pump after changing a valve.
   */

  if (!state && pumpRunning && areAllZonesClosed()) {

    Serial.println("[SAFETY] Last active valve turned OFF.");

    Serial.println("[SAFETY] Stopping pump immediately.");

    setRelay(PIN_PUMP_RELAY, false);

    pumpRunning = false;

    pumpStartMillis = 0;

    publishPumpState();

    publishAlert(
        "pump_auto_stop", "medium",
        "Pump automatically stopped because all irrigation valves are OFF.");
  }
}

// ============================================================================
// OPEN ZONE
// ============================================================================

void openZone(uint8_t zone) { startZoneWateringManual(zone); }

// ============================================================================
// CLOSE ZONE
// ============================================================================

void closeZone(uint8_t zone) {

  if (zone < 1 || zone > 3) {

    Serial.println("[ZONE] Invalid zone.");

    return;
  }

  zoneSchedules[zone - 1].active = false;

  setZoneValve(zone, false);

  publishZoneState(zone);

  Serial.print("[ZONE ");

  Serial.print(zone);

  Serial.println("] VALVE OFF");

  if (pumpRunning && areAllZonesClosed()) {

    Serial.println("[SAFETY] All valves are OFF - stopping pump immediately.");

    setRelay(PIN_PUMP_RELAY, false);

    pumpRunning = false;

    pumpStartMillis = 0;

    publishPumpState();

    publishAlert(
        "pump_auto_stop", "medium",
        "Pump automatically stopped because all irrigation valves are OFF.");

    Serial.println("[SAFETY] Pump OFF.");
  }
}

// ============================================================================
// CLOSE ALL ZONES
// ============================================================================

void closeAllZones() {

  for (int i = 0; i < 3; i++) {
    zoneSchedules[i].active = false;
    zoneSchedules[i].queued = false;
  }

  setRelay(PIN_VALVE1_RELAY, false);

  setRelay(PIN_VALVE2_RELAY, false);

  setRelay(PIN_VALVE3_RELAY, false);

  currentData.zone1.valveOpen = false;

  currentData.zone2.valveOpen = false;

  currentData.zone3.valveOpen = false;

  if (mqttClient.connected()) {

    publishAllZoneStates();
  }

  Serial.println("[ZONES] ALL VALVES OFF");
}

// ============================================================================
// PUMP SAFETY
// ============================================================================

void checkPumpSafety() {

  if (!pumpRunning) {
    return;
  }

  unsigned long maxAllowedRuntime = PUMP_MAX_RUNTIME_MS;

  // Extend runtime dynamically if an active schedule requires longer
  for (int i = 0; i < 3; i++) {
    if (zoneSchedules[i].active) {
      unsigned long schedLimit =
          zoneSchedules[i].durationMs + 60000UL; // +1 min grace
      if (schedLimit > maxAllowedRuntime) {
        maxAllowedRuntime = schedLimit;
      }
    }
  }

  // Maximum hard ceiling safety limit (60 minutes)
  const unsigned long HARD_SAFETY_MAX_MS = 60UL * 60UL * 1000UL;
  if (maxAllowedRuntime > HARD_SAFETY_MAX_MS) {
    maxAllowedRuntime = HARD_SAFETY_MAX_MS;
  }

  if ((millis() - pumpStartMillis) >= maxAllowedRuntime) {

    stopPump();

    publishAlert("pump_timeout", "high",
                 "Pump automatically stopped due to safety runtime limit.");

    Serial.println("[SAFETY] Pump safety timeout reached.");
  }
}

// ============================================================================
// EMERGENCY SHUTDOWN
// ============================================================================

void emergencyShutdown() {

  Serial.println();
  Serial.println("[EMERGENCY] WATER LEVEL CRITICAL!");

  for (int i = 0; i < 3; i++) {
    zoneSchedules[i].active = false;
    zoneSchedules[i].queued = false;
  }

  // ========================================================================
  // PUMP OFF
  // ========================================================================

  setRelay(PIN_PUMP_RELAY, false);

  pumpRunning = false;

  pumpStartMillis = 0;

  // ========================================================================
  // ALL VALVES OFF
  // ========================================================================

  setRelay(PIN_VALVE1_RELAY, false);

  setRelay(PIN_VALVE2_RELAY, false);

  setRelay(PIN_VALVE3_RELAY, false);

  currentData.zone1.valveOpen = false;

  currentData.zone2.valveOpen = false;

  currentData.zone3.valveOpen = false;

  // ========================================================================
  // MQTT
  // ========================================================================

  publishPumpState();

  publishAllZoneStates();

  publishAlert("water_critical", "high",
               "Critical tank level. Pump and all zones stopped.");
}

// ============================================================================
// PUBLISH ZONE STATE
// ============================================================================

void publishZoneState(uint8_t zone) {

  if (!mqttClient.connected()) {

    return;
  }

  ZoneData *z = nullptr;

  const char *topic = nullptr;

  if (zone == 1) {

    z = &currentData.zone1;

    topic = TOPIC_ZONE1_STATE;

  } else if (zone == 2) {

    z = &currentData.zone2;

    topic = TOPIC_ZONE2_STATE;

  } else if (zone == 3) {

    z = &currentData.zone3;

    topic = TOPIC_ZONE3_STATE;

  } else {

    return;
  }

  StaticJsonDocument<384> doc;

  doc["device_id"] = DEVICE_ID;

  doc["zone"] = z->id;

  doc["plant"] = z->plant;

  doc["soil_humidity"] = z->soilHumidity;

  doc["valve"] = z->valveOpen ? "ON" : "OFF";

  doc["pump"] = pumpRunning ? "ON" : "OFF";

  doc["water_level"] = currentData.waterLevel;

  doc["volume_liters"] = currentData.volumeLiters;

  doc["timestamp_ms"] = millis();

  char buffer[384];

  size_t length = serializeJson(doc, buffer, sizeof(buffer));

  if (length == 0 || length >= sizeof(buffer)) {

    Serial.println("[ERROR] Zone state JSON too large.");

    return;
  }

  mqttClient.publish(topic, buffer, true);
}

// ============================================================================
// PUBLISH ALL ZONE STATES
// ============================================================================

void publishAllZoneStates() {

  publishZoneState(1);

  publishZoneState(2);

  publishZoneState(3);
}

// ============================================================================
// PUBLISH PUMP
// ============================================================================

void publishPumpState() {

  if (!mqttClient.connected()) {

    return;
  }

  StaticJsonDocument<256> doc;

  doc["device_id"] = DEVICE_ID;

  doc["pump"] = pumpRunning ? "ON" : "OFF";

  doc["water_level"] = currentData.waterLevel;

  doc["volume_liters"] = currentData.volumeLiters;

  doc["timestamp_ms"] = millis();

  char buffer[256];

  size_t length = serializeJson(doc, buffer, sizeof(buffer));

  if (length == 0 || length >= sizeof(buffer)) {

    return;
  }

  mqttClient.publish(TOPIC_PUMP_STATE, buffer, true);
}

// ============================================================================
// PUBLISH TANK
// ============================================================================

void publishTankState() {

  if (!mqttClient.connected()) {

    return;
  }

  StaticJsonDocument<320> doc;

  doc["device_id"] = DEVICE_ID;

  doc["water_level"] = currentData.waterLevel;

  doc["volume_liters"] = currentData.volumeLiters;

  doc["capacity_liters"] = TANK_CAPACITY_LITERS;

  doc["critical"] = currentData.waterLevel < WATER_LEVEL_CRITICAL_PCT;

  doc["low"] = currentData.waterLevel < WATER_LEVEL_LOW_PCT;

  doc["timestamp_ms"] = millis();

  char buffer[320];

  size_t length = serializeJson(doc, buffer, sizeof(buffer));

  if (length == 0 || length >= sizeof(buffer)) {

    return;
  }

  mqttClient.publish(TOPIC_TANK_STATE, buffer, true);
}

// ============================================================================
// PUBLISH ENVIRONMENT
// ============================================================================

void publishEnvironmentState() {

  if (!mqttClient.connected()) {

    return;
  }

  StaticJsonDocument<256> doc;

  doc["device_id"] = DEVICE_ID;

  doc["temperature"] = currentData.temperature;

  doc["air_humidity"] = currentData.airHumidity;

  doc["timestamp_ms"] = millis();

  char buffer[256];

  size_t length = serializeJson(doc, buffer, sizeof(buffer));

  if (length == 0 || length >= sizeof(buffer)) {

    return;
  }

  mqttClient.publish(TOPIC_ENVIRONMENT_STATE, buffer, true);
}

// ============================================================================
// COMPLETE SYSTEM SNAPSHOT - EVERY 60 SEC
// ============================================================================

void publishSnapshot() {

  if (!mqttClient.connected()) {

    return;
  }

  StaticJsonDocument<2048> doc;

  doc["device_id"] = DEVICE_ID;

  doc["system"] = "HYDRIVIA";

  doc["timestamp_ms"] = millis();

  // ========================================================================
  // ZONES
  // ========================================================================

  JsonArray zones = doc.createNestedArray("zones");

  // ------------------------------------------------------------------------
  // Zone 1
  // ------------------------------------------------------------------------

  JsonObject zone1 = zones.createNestedObject();

  zone1["id"] = currentData.zone1.id;

  zone1["plant"] = currentData.zone1.plant;

  zone1["soil_humidity"] = currentData.zone1.soilHumidity;

  // ------------------------------------------------------------------------
  // Zone 2
  // ------------------------------------------------------------------------

  JsonObject zone2 = zones.createNestedObject();

  zone2["id"] = currentData.zone2.id;

  zone2["plant"] = currentData.zone2.plant;

  zone2["soil_humidity"] = currentData.zone2.soilHumidity;

  // ------------------------------------------------------------------------
  // Zone 3
  // ------------------------------------------------------------------------

  JsonObject zone3 = zones.createNestedObject();

  zone3["id"] = currentData.zone3.id;

  zone3["plant"] = currentData.zone3.plant;

  zone3["soil_humidity"] = currentData.zone3.soilHumidity;

  // ========================================================================
  // TANK
  // ========================================================================

  JsonObject tank = doc.createNestedObject("tank");

  tank["water_level"] = currentData.waterLevel;

  tank["volume_liters"] = currentData.volumeLiters;

  tank["capacity_liters"] = TANK_CAPACITY_LITERS;

  tank["critical"] = currentData.waterLevel < WATER_LEVEL_CRITICAL_PCT;

  tank["low"] = currentData.waterLevel < WATER_LEVEL_LOW_PCT;

  // ========================================================================
  // ENVIRONMENT
  // ========================================================================

  JsonObject environment = doc.createNestedObject("environment");

  environment["temperature"] = currentData.temperature;

  environment["air_humidity"] = currentData.airHumidity;

  // ========================================================================
  // SYSTEM STATUS
  // ========================================================================

  JsonObject systemStatus = doc.createNestedObject("status");

  systemStatus["data_valid"] = currentData.valid;

  // ========================================================================
  // SERIALIZE
  // ========================================================================

  char buffer[2048];

  size_t length = serializeJson(doc, buffer, sizeof(buffer));

  if (length == 0 || length >= sizeof(buffer)) {

    Serial.println("[ERROR] Snapshot JSON too large.");

    return;
  }

  bool success = mqttClient.publish(TOPIC_SNAPSHOT, buffer);

  if (success) {

    Serial.println();
    Serial.println("[MQTT] 60-SECOND SNAPSHOT PUBLISHED");

    Serial.println(buffer);

    Serial.println();

  } else {

    Serial.println("[ERROR] Snapshot publish failed.");
  }
}

// ============================================================================
// ALERT
// ============================================================================

void publishAlert(const char *type, const char *severity, const char *message) {

  if (!mqttClient.connected()) {

    return;
  }

  StaticJsonDocument<384> doc;

  doc["device_id"] = DEVICE_ID;

  doc["timestamp_ms"] = millis();

  doc["type"] = type;

  doc["severity"] = severity;

  doc["message"] = message;

  char buffer[384];

  size_t length = serializeJson(doc, buffer, sizeof(buffer));

  if (length == 0 || length >= sizeof(buffer)) {

    return;
  }

  mqttClient.publish(TOPIC_ALERTS, buffer);
}
