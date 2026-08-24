#include "secrets.h"
#include <Adafruit_BME280.h>
#include <Adafruit_Sensor.h>
#include <ArduinoJson.h>
#include <PubSubClient.h>
#include <RTClib.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <Wire.h>

Adafruit_BME280 bme;
bool bmeAvailable = false;

RTC_DS3231 rtc;
bool rtcAvailable = false;

#define BME280_I2C_ADDR 0x77

// ============================================================================
// GPIO CONFIGURATION
// ============================================================================

// Ultrasonic distance sensor (GPIO trigger/echo mode)
#define PIN_ULTRASONIC_TRIG 14 // X15
#define PIN_ULTRASONIC_ECHO 18 // X14

// Soil moisture sensors (ADC1 channels - Wi-Fi safe)
#define PIN_SOIL_MOISTURE_1 34 // X4  // Zone 1 - Tomato
#define PIN_SOIL_MOISTURE_2 35 // X5  // Zone 2 - Mint
#define PIN_SOIL_MOISTURE_3 32 // X6  // Zone 3 - Onion

// Common pump
#define PIN_PUMP_RELAY 27 // integrated

// Electrovalves
#define PIN_VALVE1_RELAY 26 // X1 // Tomato
#define PIN_VALVE2_RELAY 25 // X2 // Mint
#define PIN_VALVE3_RELAY 23 // X10 // Onion

// Tank status LEDs
#define PIN_LED_LOW 33 // integrated

// BME280 I2C
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
// PUMP WATER FLOW L/MIN
// ============================================================================

const float PUMP_FLOW_RATE_LPM = 30.0f; // Litres per minute
const float PUMP_FLOW_RATE = 30.0f;     // Backward-compatible alias

// ============================================================================
// STATE MACHINE & IRRIGATION QUEUE STRUCTURES
// ============================================================================

enum IrrigationState {
  IRRIGATION_IDLE,
  IRRIGATION_RUNNING,
  IRRIGATION_COMPLETED,
  IRRIGATION_EMERGENCY
};

IrrigationState currentIrrigationState = IRRIGATION_IDLE;

// FIFO Irrigation Command Structure
struct IrrigationCommand {
  uint8_t zone;
  float wateringL;
  float targetSoilMoisturePct;
  unsigned long durationMs;
  unsigned long receivedAt;
};

// Central Active Irrigation Tracking
struct ActiveIrrigation {
  bool active;
  uint8_t zone;
  float wateringL;
  float targetSoilMoisturePct;
  unsigned long startMillis;
  unsigned long durationMs;
};

ActiveIrrigation activeIrrigation = {false, 0, 0.0f, 0.0f, 0UL, 0UL};

// FIFO Queue Ring Buffer
#define MAX_PENDING_COMMANDS 8
IrrigationCommand irrigationQueue[MAX_PENDING_COMMANDS];
int queueHead = 0;
int queueTail = 0;
int queueCount = 0;

// Backward-compatible schedule array
struct ZoneWateringSchedule {
  bool queued;
  bool active;
  float targetWateringL;
  float targetSoilMoisturePct;
  unsigned long durationMs;
  unsigned long startMillis;
};

ZoneWateringSchedule zoneSchedules[3] = {
    {false, false, 0.0f, 0.0f, 0UL, 0UL},
    {false, false, 0.0f, 0.0f, 0UL, 0UL},
    {false, false, 0.0f, 0.0f, 0UL, 0UL}};

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
const unsigned long PUMP_MAX_RUNTIME_MS = 5UL * 60UL * 1000UL; // 5 minutes hard safety
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

// On-Demand Real-time Sensor Request & Response
const char *TOPIC_SENSOR_REQUEST = "hydrivia/sensors/request";
const char *TOPIC_SENSOR_RESPONSE = "hydrivia/sensors/realtime";

// ============================================================================
// MQTT & TLS CLIENTS
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

// Current Sensor Data
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

// Actuator States
bool pumpRunning = false;

// Flag indicating an automated zone-to-zone switch is in progress (prevents safety glitch)
bool isTransitioningZone = false;

// ============================================================================
// FUNCTION PROTOTYPES
// ============================================================================

// Wi-Fi / MQTT
void connectWiFi();
void connectMQTT();
void mqttCallback(char *topic, byte *payload, unsigned int length);
void handleZoneCommand(uint8_t zone, String command);
void handleSensorRequest(const String &message);
String getIsoTimestamp();
void syncRtcFromNtp();

// FIFO Command Queue Operations
bool enqueueIrrigationCommand(const IrrigationCommand &cmd);
bool dequeueIrrigationCommand(IrrigationCommand &cmd);
int getQueueSize();
void clearIrrigationQueue();

// Automated Irrigation State Machine & Controls
void updateIrrigationStateMachine();
void startZoneWatering(const IrrigationCommand &cmd);
void completeCurrentZone(const char *reason = "Target reached");
void startNextQueuedZone();
void stopZoneWatering(uint8_t zone);
void startZoneWateringManual(uint8_t zone);
float getCurrentZoneSoilMoisture(uint8_t zone);

// Sensors
SensorData readSensors();
void readSoilHumidityPercent(float &moisture1, float &moisture2, float &moisture3);
float readWaterLevelPercent();
float calculateVolumeLiters(float waterLevelPercent);
bool validateData(const SensorData &data);

// Display
void printSensorData(const SensorData &data);

// MQTT Publishing
void publishZoneState(uint8_t zone);
void publishAllZoneStates();
void publishPumpState();
void publishTankState();
void publishEnvironmentState();
void publishSnapshot();
void publishAlert(const char *type, const char *severity, const char *message);

// Pump & Valves
void setRelay(int pin, bool state);
void setPumpHardware(bool state);
void setZoneValveHardware(uint8_t zone, bool state);
void stopPumpImmediately();
void checkPumpSafety();
void checkPumpZoneSafety();
void emergencyShutdown();
bool isZoneOpen(uint8_t zone);
bool areAllZonesClosed();
void closeAllZones();

// ============================================================================
// FIFO QUEUE OPERATIONS
// ============================================================================

bool enqueueIrrigationCommand(const IrrigationCommand &cmd) {
  if (queueCount >= MAX_PENDING_COMMANDS) {
    Serial.println("[QUEUE ERROR] Command queue FULL! Cannot enqueue command.");
    publishAlert("queue_full", "high", "Irrigation command queue is full. Command rejected.");
    return false;
  }

  irrigationQueue[queueTail] = cmd;
  queueTail = (queueTail + 1) % MAX_PENDING_COMMANDS;
  queueCount++;

  Serial.print("[QUEUE] Zone ");
  Serial.print(cmd.zone);
  Serial.print(" added | Queue size: ");
  Serial.println(queueCount);

  // Update schedule queued flag
  if (cmd.zone >= 1 && cmd.zone <= 3) {
    zoneSchedules[cmd.zone - 1].queued = true;
    zoneSchedules[cmd.zone - 1].targetWateringL = cmd.wateringL;
    zoneSchedules[cmd.zone - 1].targetSoilMoisturePct = cmd.targetSoilMoisturePct;
    zoneSchedules[cmd.zone - 1].durationMs = cmd.durationMs;
  }

  return true;
}

bool dequeueIrrigationCommand(IrrigationCommand &cmd) {
  if (queueCount == 0) {
    return false;
  }

  cmd = irrigationQueue[queueHead];
  queueHead = (queueHead + 1) % MAX_PENDING_COMMANDS;
  queueCount--;

  if (cmd.zone >= 1 && cmd.zone <= 3) {
    zoneSchedules[cmd.zone - 1].queued = false;
  }

  return true;
}

int getQueueSize() {
  return queueCount;
}

void clearIrrigationQueue() {
  queueHead = 0;
  queueTail = 0;
  queueCount = 0;
  for (int i = 0; i < 3; i++) {
    zoneSchedules[i].queued = false;
  }
}

// ============================================================================
// HARDWARE ACTUATOR CONTROL (Isolated from high-level state decisions)
// ============================================================================

void setRelay(int pin, bool state) {
  if (RELAY_ACTIVE_HIGH) {
    digitalWrite(pin, state ? HIGH : LOW);
  } else {
    digitalWrite(pin, state ? LOW : HIGH);
  }
}

void setPumpHardware(bool state) {
  setRelay(PIN_PUMP_RELAY, state);
  pumpRunning = state;
  if (state) {
    pumpStartMillis = millis();
  } else {
    pumpStartMillis = 0;
  }
  publishPumpState();
}

void setZoneValveHardware(uint8_t zone, bool state) {
  int pin = 0;
  if (zone == 1) {
    pin = PIN_VALVE1_RELAY;
    currentData.zone1.valveOpen = state;
    zoneSchedules[0].active = state;
  } else if (zone == 2) {
    pin = PIN_VALVE2_RELAY;
    currentData.zone2.valveOpen = state;
    zoneSchedules[1].active = state;
  } else if (zone == 3) {
    pin = PIN_VALVE3_RELAY;
    currentData.zone3.valveOpen = state;
    zoneSchedules[2].active = state;
  }

  if (pin != 0) {
    setRelay(pin, state);
  }
}

bool isZoneOpen(uint8_t zone) {
  if (zone == 1) return currentData.zone1.valveOpen;
  if (zone == 2) return currentData.zone2.valveOpen;
  if (zone == 3) return currentData.zone3.valveOpen;
  return false;
}

bool areAllZonesClosed() {
  return !currentData.zone1.valveOpen && !currentData.zone2.valveOpen && !currentData.zone3.valveOpen;
}

void closeAllZones() {
  setZoneValveHardware(1, false);
  setZoneValveHardware(2, false);
  setZoneValveHardware(3, false);
  publishAllZoneStates();
  Serial.println("[ZONES] ALL VALVES OFF");
}

void stopPumpImmediately() {
  if (pumpRunning) {
    setPumpHardware(false);
    Serial.println("[PUMP] OFF (Immediate)");
  }
}

// ============================================================================
// IRRIGATION STATE MACHINE & SEQUENTIAL ENGINE
// ============================================================================

void startZoneWatering(const IrrigationCommand &cmd) {
  if (cmd.zone < 1 || cmd.zone > 3) {
    return;
  }

  // 1. Water level safety check
  if (currentData.waterLevel < WATER_LEVEL_LOW_PCT) {
    publishAlert("pump_blocked", "high", "Pump cannot start because tank level is below 30%.");
    Serial.println("[PUMP] START BLOCKED - water level too low.");
    clearIrrigationQueue();
    currentIrrigationState = IRRIGATION_IDLE;
    return;
  }

  if (currentData.waterLevel < WATER_LEVEL_CRITICAL_PCT) {
    emergencyShutdown();
    return;
  }

  isTransitioningZone = true;

  // 2. Close all other valves to focus hydraulic pressure
  for (uint8_t z = 1; z <= 3; z++) {
    if (z != cmd.zone) {
      setZoneValveHardware(z, false);
      publishZoneState(z);
    }
  }

  // 3. Open this zone's valve
  setZoneValveHardware(cmd.zone, true);

  // 4. Ensure pump is running (starts if not running, keeps running if already ON)
  if (!pumpRunning) {
    setPumpHardware(true);
  }

  isTransitioningZone = false;

  // 5. Update active irrigation record
  activeIrrigation.active = true;
  activeIrrigation.zone = cmd.zone;
  activeIrrigation.wateringL = cmd.wateringL;
  activeIrrigation.targetSoilMoisturePct = cmd.targetSoilMoisturePct;
  activeIrrigation.startMillis = millis();
  activeIrrigation.durationMs = cmd.durationMs;

  currentIrrigationState = IRRIGATION_RUNNING;

  publishZoneState(cmd.zone);

  // 6. Serial logs
  const char *cropName = (cmd.zone == 1 ? ZONE1_PLANT : (cmd.zone == 2 ? ZONE2_PLANT : ZONE3_PLANT));
  Serial.println();
  Serial.println("==============================================");
  Serial.print("[IRRIGATION] START | Zone: ");
  Serial.print(cmd.zone);
  Serial.print(" (");
  Serial.print(cropName);
  Serial.println(")");
  Serial.println("Valve: ON | Pump: ON");
  Serial.print("Target Volume: ");
  Serial.print(cmd.wateringL, 1);
  Serial.print(" L | Duration: ");
  Serial.print(cmd.durationMs / 1000UL);
  Serial.println(" sec");
  Serial.println("==============================================");
}

float getCurrentZoneSoilMoisture(uint8_t zone) {
  if (zone == 1) return currentData.zone1.soilHumidity;
  if (zone == 2) return currentData.zone2.soilHumidity;
  if (zone == 3) return currentData.zone3.soilHumidity;
  return 0.0f;
}

void completeCurrentZone(const char *reason) {
  if (!activeIrrigation.active) {
    return;
  }

  uint8_t finishedZone = activeIrrigation.zone;
  unsigned long elapsed = millis() - activeIrrigation.startMillis;
  float deliveredLiters = (elapsed / (60.0f * 1000.0f)) * PUMP_FLOW_RATE_LPM;
  float currentMoisture = getCurrentZoneSoilMoisture(finishedZone);

  Serial.println();
  Serial.println("==============================================");
  Serial.print("[IRRIGATION] STOP | Zone: ");
  Serial.print(finishedZone);
  Serial.print(" | Reason: ");
  Serial.println(reason);
  Serial.print("Delivered Volume: ");
  Serial.print(deliveredLiters, 1);
  Serial.print(" / ");
  Serial.print(activeIrrigation.wateringL, 1);
  Serial.println(" L");
  Serial.print("Soil Moisture: ");
  Serial.print(currentMoisture, 1);
  Serial.print(" % (Target: ");
  Serial.print(activeIrrigation.targetSoilMoisturePct, 1);
  Serial.println(" %)");
  Serial.print("Valve ");
  Serial.print(finishedZone);
  Serial.println(": OFF");
  Serial.println("==============================================");

  // Mark zone as no longer active
  activeIrrigation.active = false;

  // Close finished zone valve
  isTransitioningZone = true;
  setZoneValveHardware(finishedZone, false);
  publishZoneState(finishedZone);

  // Check if another zone is waiting in the sequential queue
  if (getQueueSize() > 0) {
    IrrigationCommand nextCmd;
    if (dequeueIrrigationCommand(nextCmd)) {
      Serial.println();
      Serial.print("[QUEUE] Next zone: ");
      Serial.println(nextCmd.zone);

      // Transition smoothly to next zone without stopping the pump
      startZoneWatering(nextCmd);
      isTransitioningZone = false;
      return;
    }
  }

  isTransitioningZone = false;

  // No more zones in queue -> Turn off pump and return to IDLE
  stopPumpImmediately();
  currentIrrigationState = IRRIGATION_IDLE;

  Serial.println();
  Serial.println("----------------------------------------------");
  Serial.println("[IRRIGATION] ALL ZONES COMPLETE | Pump: OFF");
  Serial.println("----------------------------------------------");

  char alertMsg[128];
  snprintf(alertMsg, sizeof(alertMsg), "Zone %d stopped: %s (%.1fL, Sol: %.1f%%)", finishedZone, reason, deliveredLiters, currentMoisture);
  publishAlert("zone_complete", "info", alertMsg);
}

void startNextQueuedZone() {
  if (activeIrrigation.active) {
    return;
  }

  if (getQueueSize() > 0) {
    IrrigationCommand nextCmd;
    if (dequeueIrrigationCommand(nextCmd)) {
      startZoneWatering(nextCmd);
    }
  }
}

void stopZoneWatering(uint8_t zone) {
  if (zone < 1 || zone > 3) return;

  if (activeIrrigation.active && activeIrrigation.zone == zone) {
    completeCurrentZone("Manual stop requested");
  } else {
    // Remove if in queue
    setZoneValveHardware(zone, false);
    zoneSchedules[zone - 1].queued = false;
    publishZoneState(zone);
    Serial.print("[ZONE ");
    Serial.print(zone);
    Serial.println("] Stopped / Removed from queue.");
  }
}

void startZoneWateringManual(uint8_t zone) {
  if (zone < 1 || zone > 3) return;

  // Enqueue manual command with default 30 L (60 sec)
  IrrigationCommand cmd;
  cmd.zone = zone;
  cmd.wateringL = 30.0f;
  cmd.targetSoilMoisturePct = 50.0f;
  cmd.durationMs = 60000UL;
  cmd.receivedAt = millis();

  if (!activeIrrigation.active) {
    startZoneWatering(cmd);
  } else {
    enqueueIrrigationCommand(cmd);
  }
}

void updateIrrigationStateMachine() {
  unsigned long now = millis();

  // 1. If actively irrigating, check STOP conditions:
  //    Condition A: Watering volume reached (calculated from durationMs)
  //         OR
  //    Condition B: Target soil moisture reached (current soil moisture >= targetSoilMoisturePct)
  if (activeIrrigation.active) {
    unsigned long elapsed = now - activeIrrigation.startMillis;
    float currentMoisture = getCurrentZoneSoilMoisture(activeIrrigation.zone);

    // Condition A: Watering volume reached
    if (elapsed >= activeIrrigation.durationMs) {
      completeCurrentZone("Watering volume reached");
      return;
    }

    // Condition B: Target soil moisture reached
    if (activeIrrigation.targetSoilMoisturePct > 0.0f && currentMoisture >= activeIrrigation.targetSoilMoisturePct) {
      completeCurrentZone("Target soil moisture reached");
      return;
    }
  }

  // 2. If IDLE and commands exist in queue, trigger next
  if (!activeIrrigation.active && getQueueSize() > 0) {
    startNextQueuedZone();
  }
}

// ============================================================================
// SETUP
// ============================================================================

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("==============================================");
  Serial.println("       HYDRIVIA SMART IRRIGATION");
  Serial.println("       NON-BLOCKING STATE MACHINE");
  Serial.println("==============================================");
  Serial.println();

  // GPIO Mode & Safe Initial States
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

  setRelay(PIN_PUMP_RELAY, false);
  setRelay(PIN_VALVE1_RELAY, false);
  setRelay(PIN_VALVE2_RELAY, false);
  setRelay(PIN_VALVE3_RELAY, false);

  Serial.println("[OK] GPIO initialized.");

  // I2C Bus — shared by BME280 and DS3231
  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);

  // BME280 Initialization
  bmeAvailable = bme.begin(BME280_I2C_ADDR, &Wire);
  if (bmeAvailable) {
    Serial.println("[OK] BME280 initialized.");
  } else {
    Serial.println("[WARNING] BME280 not found. Temperature and air humidity = 0.");
  }

  // DS3231 RTC Initialization
  rtcAvailable = rtc.begin(&Wire);
  if (rtcAvailable) {
    if (rtc.lostPower()) {
      Serial.println("[WARNING] DS3231 lost power — time not set yet. Will sync from NTP.");
    } else {
      DateTime rtcNow = rtc.now();
      Serial.print("[OK] DS3231 RTC initialized. Current RTC time: ");
      char rtcBuf[25];
      snprintf(rtcBuf, sizeof(rtcBuf), "%04d-%02d-%02dT%02d:%02d:%02dZ",
               rtcNow.year(), rtcNow.month(), rtcNow.day(),
               rtcNow.hour(), rtcNow.minute(), rtcNow.second());
      Serial.println(rtcBuf);
    }
  } else {
    Serial.println("[WARNING] DS3231 not found. Falling back to NTP / millis().");
  }

  // Wi-Fi Connection
  connectWiFi();

  // NTP Time Sync for TLS Validation
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
    // Push NTP time into DS3231 so it stays accurate across reboots
    syncRtcFromNtp();
  } else {
    Serial.println("[WARNING] NTP sync failed — TLS may not work.");
  }

  // MQTT Client Configuration with ISRG Root X1 CA Certificate
  static const char *HIVEMQ_CA_CERT =
      "-----BEGIN CERTIFICATE-----\n"
      "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\n"
      "-----END CERTIFICATE-----\n";

  espClient.setCACert(HIVEMQ_CA_CERT);
  mqttClient.setServer(MQTT_SERVER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
  mqttClient.setBufferSize(2304);
  mqttClient.setKeepAlive(30);
  mqttClient.setSocketTimeout(15);

  connectMQTT();

  // Initial sensor read
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
// MAIN LOOP (Non-blocking execution)
// ============================================================================

void loop() {
  unsigned long now = millis();

  // 1. Wi-Fi Connection Maintenance
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  // 2. MQTT Client Maintenance & Message Polling
  if (!mqttClient.connected()) {
    if (now - lastMqttRetryMillis >= MQTT_RETRY_INTERVAL_MS) {
      lastMqttRetryMillis = now;
      connectMQTT();
    }
  } else {
    mqttClient.loop();
  }

  // 3. Sequential Irrigation State Machine Execution
  updateIrrigationStateMachine();

  // 4. Sensor Reading - Every 2 Seconds
  if (now - lastSensorRead >= SENSOR_INTERVAL_MS) {
    lastSensorRead = now;

    currentData = readSensors();
    currentData.valid = validateData(currentData);

    // Synchronize valve states
    currentData.zone1.valveOpen = isZoneOpen(1);
    currentData.zone2.valveOpen = isZoneOpen(2);
    currentData.zone3.valveOpen = isZoneOpen(3);

    printSensorData(currentData);

    // Water level critical safety check
    if (currentData.waterLevel < WATER_LEVEL_CRITICAL_PCT) {
      digitalWrite(PIN_LED_LOW, HIGH);
      if (pumpRunning || !areAllZonesClosed() || activeIrrigation.active) {
        emergencyShutdown();
      }
    } else {
      digitalWrite(PIN_LED_LOW, LOW);
    }

    // Pump / Valve safety verification
    checkPumpZoneSafety();

    // Publish live telemetry
    if (currentData.valid && mqttClient.connected()) {
      publishAllZoneStates();
      publishPumpState();
      publishTankState();
      publishEnvironmentState();
    }
  }

  // 5. Complete System Snapshot - Every 60 Seconds
  if (now - lastSensorSnapshot >= SENSOR_SNAPSHOT_INTERVAL_MS) {
    lastSensorSnapshot = now;
    if (currentData.valid && mqttClient.connected()) {
      publishSnapshot();
    }
  }

  // 6. Hard safety runtime check on the pump
  checkPumpSafety();

  // 7. General pump/valve interlock check
  checkPumpZoneSafety();
}

// ============================================================================
// MQTT CALLBACK (Non-blocking command ingestion)
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

  // 1. On-Demand Real-time Sensor Request
  if (receivedTopic.equals(TOPIC_SENSOR_REQUEST) || receivedTopic.indexOf("sensors/request") >= 0) {
    handleSensorRequest(message);
    return;
  }

  // 2. Identify Zone ID for irrigation commands
  uint8_t zoneId = 0;
  if (receivedTopic.indexOf("zones/1") >= 0 || receivedTopic.indexOf("/1/") >= 0) {
    zoneId = 1;
  } else if (receivedTopic.indexOf("zones/2") >= 0 || receivedTopic.indexOf("/2/") >= 0) {
    zoneId = 2;
  } else if (receivedTopic.indexOf("zones/3") >= 0 || receivedTopic.indexOf("/3/") >= 0) {
    zoneId = 3;
  }

  // Fallback: Check inside JSON payload for zone topic
  if (zoneId == 0 && message.indexOf("zones/") >= 0) {
    if (message.indexOf("zones/1") >= 0) zoneId = 1;
    else if (message.indexOf("zones/2") >= 0) zoneId = 2;
    else if (message.indexOf("zones/3") >= 0) zoneId = 3;
  }

  if (zoneId < 1 || zoneId > 3) {
    Serial.print("[WARNING] Unknown command topic: ");
    Serial.println(receivedTopic);
    return;
  }

  // Parse and enqueue command immediately
  handleZoneCommand(zoneId, message);
}

// ============================================================================
// ZONE COMMAND PARSING & ENQUEUEING
// ============================================================================

void handleZoneCommand(uint8_t zone, String command) {
  if (zone < 1 || zone > 3) return;

  command.trim();

  // 1. Simple text commands
  if (command.equalsIgnoreCase("ON")) {
    startZoneWateringManual(zone);
    return;
  }

  if (command.equalsIgnoreCase("OFF")) {
    stopZoneWatering(zone);
    return;
  }

  // 2. JSON Command Parsing
  StaticJsonDocument<768> doc;
  StaticJsonDocument<512> docNested;

  DeserializationError error = deserializeJson(doc, command);
  if (error) {
    publishAlert("invalid_command", "medium", "Invalid zone JSON format.");
    Serial.print("[ERROR] Invalid zone JSON: ");
    Serial.println(error.f_str());
    return;
  }

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

  // 3. Automated watering command (wateringL & targetSoilMoisturePct)
  bool hasWateringL = msgObj.containsKey("wateringL");
  bool hasTargetSoilMoisture = msgObj.containsKey("targetSoilMoisturePct");

  if (hasWateringL || hasTargetSoilMoisture) {
    float wateringL = msgObj["wateringL"] | 0.0f;
    float targetSoilMoisturePct = msgObj["targetSoilMoisturePct"] | 50.0f;

    if (wateringL <= 0.0f) {
      Serial.println("[ZONE] wateringL <= 0 -> stopping zone.");
      stopZoneWatering(zone);
      return;
    }

    // Calculate theoretical duration in ms: (wateringL / 30.0) * 60 * 1000
    unsigned long durationMs = (unsigned long)((wateringL / PUMP_FLOW_RATE_LPM) * 60.0f * 1000.0f);
    if (durationMs < 1000UL) {
      durationMs = 1000UL;
    }

    Serial.println();
    Serial.println("================ MQTT COMMAND RECEIVED ================");
    Serial.println("[MQTT] Command received");
    Serial.print("Zone: ");
    Serial.println(zone);
    Serial.print("Watering: ");
    Serial.print(wateringL, 1);
    Serial.println(" L");
    Serial.print("Target soil: ");
    Serial.print(targetSoilMoisturePct, 1);
    Serial.println(" %");
    Serial.print("Duration: ");
    Serial.print(durationMs);
    Serial.println(" ms");
    Serial.println("=======================================================");

    IrrigationCommand cmd;
    cmd.zone = zone;
    cmd.wateringL = wateringL;
    cmd.targetSoilMoisturePct = targetSoilMoisturePct;
    cmd.durationMs = durationMs;
    cmd.receivedAt = millis();

    // If idle, start immediately; otherwise enqueue
    if (!activeIrrigation.active) {
      startZoneWatering(cmd);
    } else {
      enqueueIrrigationCommand(cmd);
    }

    return;
  }

  // 4. Valve state ON/OFF commands
  if (msgObj.containsKey("valve")) {
    const char *valve = msgObj["valve"];
    if (valve != nullptr) {
      String valveCmd = String(valve);
      valveCmd.toUpperCase();
      if (valveCmd == "ON") {
        startZoneWateringManual(zone);
      } else if (valveCmd == "OFF") {
        stopZoneWatering(zone);
      }
    }
    return;
  }

  // 5. Irrigation ON/OFF commands
  if (msgObj.containsKey("irrigation")) {
    const char *irrigation = msgObj["irrigation"];
    if (irrigation != nullptr) {
      String irrigCmd = String(irrigation);
      irrigCmd.toUpperCase();
      if (irrigCmd == "ON") {
        startZoneWateringManual(zone);
      } else if (irrigCmd == "OFF") {
        stopZoneWatering(zone);
      }
    }
    return;
  }
}

// ============================================================================
// SENSOR READING & CALIBRATION
// ============================================================================

SensorData readSensors() {
  SensorData data = currentData;

  readSoilHumidityPercent(data.zone1.soilHumidity, data.zone2.soilHumidity, data.zone3.soilHumidity);
  data.waterLevel = readWaterLevelPercent();
  data.volumeLiters = calculateVolumeLiters(data.waterLevel);

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

void readSoilHumidityPercent(float &moisture1, float &moisture2, float &moisture3) {
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

float readWaterLevelPercent() {
  float previousLevel = currentData.waterLevel;

  for (int attempt = 0; attempt < 3; attempt++) {
    digitalWrite(PIN_ULTRASONIC_TRIG, LOW);
    delayMicroseconds(2);
    digitalWrite(PIN_ULTRASONIC_TRIG, HIGH);
    delayMicroseconds(10);
    digitalWrite(PIN_ULTRASONIC_TRIG, LOW);

    unsigned long duration = pulseIn(PIN_ULTRASONIC_ECHO, HIGH, 25000UL);

    if (duration > 0) {
      float distance = duration * 0.0343f / 2.0f;

      if (distance >= 2.0f && distance <= 400.0f) {
        float denominator = EMPTY_DISTANCE - FULL_DISTANCE;
        if (denominator <= 0.0f) {
          Serial.println("[ERROR] Invalid tank calibration.");
          return previousLevel;
        }

        float levelPercent = ((EMPTY_DISTANCE - distance) / denominator) * 100.0f;
        levelPercent = constrain(levelPercent, 0.0f, 100.0f);
        return levelPercent;
      }
    }
    delay(100);
  }

  return previousLevel;
}

float calculateVolumeLiters(float waterLevelPercent) {
  if (TANK_CAPACITY_LITERS <= 0.0f) {
    return 0.0f;
  }
  waterLevelPercent = constrain(waterLevelPercent, 0.0f, 100.0f);
  return (waterLevelPercent / 100.0f) * TANK_CAPACITY_LITERS;
}

bool validateData(const SensorData &data) {
  if (data.zone1.soilHumidity < 0.0f || data.zone1.soilHumidity > 100.0f) return false;
  if (data.zone2.soilHumidity < 0.0f || data.zone2.soilHumidity > 100.0f) return false;
  if (data.zone3.soilHumidity < 0.0f || data.zone3.soilHumidity > 100.0f) return false;
  if (data.waterLevel < 0.0f || data.waterLevel > 100.0f) return false;
  if (data.volumeLiters < 0.0f || data.volumeLiters > TANK_CAPACITY_LITERS) return false;
  if (data.temperature < -40.0f || data.temperature > 85.0f) return false;
  if (data.airHumidity < 0.0f || data.airHumidity > 100.0f) return false;
  return true;
}

void printSensorData(const SensorData &data) {
  Serial.println();
  Serial.println("--------------- SENSOR DATA ---------------");
  Serial.print("Zone 1 - "); Serial.print(data.zone1.plant); Serial.print(" - Soil: "); Serial.print(data.zone1.soilHumidity, 1); Serial.print("% | Valve: "); Serial.println(data.zone1.valveOpen ? "ON" : "OFF");
  Serial.print("Zone 2 - "); Serial.print(data.zone2.plant); Serial.print(" - Soil: "); Serial.print(data.zone2.soilHumidity, 1); Serial.print("% | Valve: "); Serial.println(data.zone2.valveOpen ? "ON" : "OFF");
  Serial.print("Zone 3 - "); Serial.print(data.zone3.plant); Serial.print(" - Soil: "); Serial.print(data.zone3.soilHumidity, 1); Serial.print("% | Valve: "); Serial.println(data.zone3.valveOpen ? "ON" : "OFF");
  Serial.print("Tank level: "); Serial.print(data.waterLevel, 1); Serial.print("% | Volume: "); Serial.print(data.volumeLiters, 2); Serial.println(" L");
  Serial.print("Temperature: "); Serial.print(data.temperature, 1); Serial.print(" C | Air humidity: "); Serial.print(data.airHumidity, 1); Serial.println("%");
  Serial.print("Pump: "); Serial.print(pumpRunning ? "ON" : "OFF"); Serial.print(" | Active Zone: "); Serial.print(activeIrrigation.active ? String(activeIrrigation.zone) : "None"); Serial.print(" | Queue: "); Serial.println(getQueueSize());
  Serial.println("-------------------------------------------");
}

// ============================================================================
// WIFI & MQTT CONNECTION MAINTENANCE
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

void connectMQTT() {
  if (mqttClient.connected() || WiFi.status() != WL_CONNECTED) {
    return;
  }

  Serial.println();
  Serial.println("Connecting to MQTT...");

  bool connected = false;
  if (strlen(MQTT_USERNAME) > 0) {
    connected = mqttClient.connect(MQTT_CLIENT_ID, MQTT_USERNAME, MQTT_PASSWORD);
  } else {
    connected = mqttClient.connect(MQTT_CLIENT_ID);
  }

  if (connected) {
    Serial.println("[OK] MQTT connected.");

    mqttClient.subscribe("hydrivia/zones/+/command", 1);
    mqttClient.subscribe(TOPIC_ZONE1_COMMAND, 1);
    mqttClient.subscribe(TOPIC_ZONE2_COMMAND, 1);
    mqttClient.subscribe(TOPIC_ZONE3_COMMAND, 1);
    mqttClient.subscribe(TOPIC_SENSOR_REQUEST, 1);

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
// SAFETY MECHANISMS
// ============================================================================

void checkPumpZoneSafety() {
  // If pump is running but no valve is open and no zone transition is happening -> emergency stop pump
  if (pumpRunning && areAllZonesClosed() && !isTransitioningZone) {
    Serial.println();
    Serial.println("[SAFETY] ALL VALVES OFF! Pump will be stopped immediately.");
    stopPumpImmediately();
    publishAlert("pump_auto_stop", "medium", "Pump automatically stopped because all zone valves are OFF.");
  }
}

void checkPumpSafety() {
  if (!pumpRunning) {
    return;
  }

  unsigned long maxAllowedRuntime = PUMP_MAX_RUNTIME_MS;

  // Extend runtime ceiling if the current active zone duration exceeds 5 minutes
  if (activeIrrigation.active) {
    unsigned long schedLimit = activeIrrigation.durationMs + 60000UL; // +1 min grace
    if (schedLimit > maxAllowedRuntime) {
      maxAllowedRuntime = schedLimit;
    }
  }

  // Maximum hard ceiling safety limit (60 minutes)
  const unsigned long HARD_SAFETY_MAX_MS = 60UL * 60UL * 1000UL;
  if (maxAllowedRuntime > HARD_SAFETY_MAX_MS) {
    maxAllowedRuntime = HARD_SAFETY_MAX_MS;
  }

  if ((millis() - pumpStartMillis) >= maxAllowedRuntime) {
    Serial.println("[SAFETY] Pump safety timeout reached.");
    stopPumpImmediately();
    closeAllZones();
    clearIrrigationQueue();
    activeIrrigation.active = false;
    currentIrrigationState = IRRIGATION_IDLE;
    publishAlert("pump_timeout", "high", "Pump automatically stopped due to safety runtime limit.");
  }
}

void emergencyShutdown() {
  Serial.println();
  Serial.println("[EMERGENCY] CRITICAL WATER LEVEL DETECTED!");

  clearIrrigationQueue();
  activeIrrigation.active = false;
  currentIrrigationState = IRRIGATION_EMERGENCY;

  stopPumpImmediately();
  closeAllZones();

  publishAlert("water_critical", "high", "Critical tank level (< 20%). Pump and all zone valves stopped.");
}

// ============================================================================
// MQTT TELEMETRY PUBLISHERS
// ============================================================================

void publishZoneState(uint8_t zone) {
  if (!mqttClient.connected()) return;

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
  doc["timestamp"] = getIsoTimestamp();

  char buffer[384];
  size_t length = serializeJson(doc, buffer, sizeof(buffer));
  if (length > 0 && length < sizeof(buffer)) {
    mqttClient.publish(topic, buffer, true);
  }
}

void publishAllZoneStates() {
  publishZoneState(1);
  publishZoneState(2);
  publishZoneState(3);
}

void publishPumpState() {
  if (!mqttClient.connected()) return;

  StaticJsonDocument<256> doc;
  doc["device_id"] = DEVICE_ID;
  doc["pump"] = pumpRunning ? "ON" : "OFF";
  doc["water_level"] = currentData.waterLevel;
  doc["volume_liters"] = currentData.volumeLiters;
  doc["timestamp"] = getIsoTimestamp();

  char buffer[256];
  size_t length = serializeJson(doc, buffer, sizeof(buffer));
  if (length > 0 && length < sizeof(buffer)) {
    mqttClient.publish(TOPIC_PUMP_STATE, buffer, true);
  }
}

void publishTankState() {
  if (!mqttClient.connected()) return;

  StaticJsonDocument<320> doc;
  doc["device_id"] = DEVICE_ID;
  doc["water_level"] = currentData.waterLevel;
  doc["volume_liters"] = currentData.volumeLiters;
  doc["capacity_liters"] = TANK_CAPACITY_LITERS;
  doc["critical"] = currentData.waterLevel < WATER_LEVEL_CRITICAL_PCT;
  doc["low"] = currentData.waterLevel < WATER_LEVEL_LOW_PCT;
  doc["timestamp"] = getIsoTimestamp();

  char buffer[320];
  size_t length = serializeJson(doc, buffer, sizeof(buffer));
  if (length > 0 && length < sizeof(buffer)) {
    mqttClient.publish(TOPIC_TANK_STATE, buffer, true);
  }
}

void publishEnvironmentState() {
  if (!mqttClient.connected()) return;

  StaticJsonDocument<256> doc;
  doc["device_id"] = DEVICE_ID;
  doc["temperature"] = currentData.temperature;
  doc["air_humidity"] = currentData.airHumidity;
  doc["timestamp"] = getIsoTimestamp();

  char buffer[256];
  size_t length = serializeJson(doc, buffer, sizeof(buffer));
  if (length > 0 && length < sizeof(buffer)) {
    mqttClient.publish(TOPIC_ENVIRONMENT_STATE, buffer, true);
  }
}

void publishSnapshot() {
  if (!mqttClient.connected()) return;

  StaticJsonDocument<2048> doc;
  doc["device_id"] = DEVICE_ID;
  doc["system"] = "HYDRIVIA";
  doc["timestamp"] = getIsoTimestamp();

  JsonArray zones = doc.createNestedArray("zones");

  JsonObject zone1 = zones.createNestedObject();
  zone1["id"] = currentData.zone1.id;
  zone1["plant"] = currentData.zone1.plant;
  zone1["soil_humidity"] = currentData.zone1.soilHumidity;
  zone1["valve"] = currentData.zone1.valveOpen ? "ON" : "OFF";

  JsonObject zone2 = zones.createNestedObject();
  zone2["id"] = currentData.zone2.id;
  zone2["plant"] = currentData.zone2.plant;
  zone2["soil_humidity"] = currentData.zone2.soilHumidity;
  zone2["valve"] = currentData.zone2.valveOpen ? "ON" : "OFF";

  JsonObject zone3 = zones.createNestedObject();
  zone3["id"] = currentData.zone3.id;
  zone3["plant"] = currentData.zone3.plant;
  zone3["soil_humidity"] = currentData.zone3.soilHumidity;
  zone3["valve"] = currentData.zone3.valveOpen ? "ON" : "OFF";

  JsonObject tank = doc.createNestedObject("tank");
  tank["water_level"] = currentData.waterLevel;
  tank["volume_liters"] = currentData.volumeLiters;
  tank["capacity_liters"] = TANK_CAPACITY_LITERS;
  tank["critical"] = currentData.waterLevel < WATER_LEVEL_CRITICAL_PCT;
  tank["low"] = currentData.waterLevel < WATER_LEVEL_LOW_PCT;

  JsonObject environment = doc.createNestedObject("environment");
  environment["temperature"] = currentData.temperature;
  environment["air_humidity"] = currentData.airHumidity;

  JsonObject pumpObj = doc.createNestedObject("pump");
  pumpObj["pump"] = pumpRunning ? "ON" : "OFF";
  pumpObj["flow_rate"] = PUMP_FLOW_RATE_LPM;

  JsonObject systemStatus = doc.createNestedObject("status");
  systemStatus["data_valid"] = currentData.valid;
  systemStatus["active_zone"] = activeIrrigation.active ? activeIrrigation.zone : 0;
  systemStatus["queue_size"] = getQueueSize();

  char buffer[2048];
  size_t length = serializeJson(doc, buffer, sizeof(buffer));
  if (length > 0 && length < sizeof(buffer)) {
    bool success = mqttClient.publish(TOPIC_SNAPSHOT, buffer);
    if (success) {
      Serial.println();
      Serial.println("[MQTT] 60-SECOND SNAPSHOT PUBLISHED");
    } else {
      Serial.println("[ERROR] Snapshot publish failed.");
    }
  }
}

void publishAlert(const char *type, const char *severity, const char *message) {
  if (!mqttClient.connected()) return;

  StaticJsonDocument<384> doc;
  doc["device_id"] = DEVICE_ID;
  doc["timestamp"] = getIsoTimestamp();
  doc["type"] = type;
  doc["severity"] = severity;
  doc["message"] = message;

  char buffer[384];
  size_t length = serializeJson(doc, buffer, sizeof(buffer));
  if (length > 0 && length < sizeof(buffer)) {
    mqttClient.publish(TOPIC_ALERTS, buffer);
  }
}

// ============================================================================
// ON-DEMAND SENSOR REQUEST / REALTIME RESPONSE
// ============================================================================

// Sync DS3231 hardware clock from the ESP32 NTP-synced system clock
void syncRtcFromNtp() {
  if (!rtcAvailable) return;
  time_t ntpNow = time(nullptr);
  if (ntpNow < 8 * 3600 * 2) {
    Serial.println("[RTC] NTP not ready — skipping DS3231 sync.");
    return;
  }
  rtc.adjust(DateTime(ntpNow));
  Serial.println("[RTC] DS3231 synchronized from NTP.");
}

// 3-tier timestamp: DS3231 RTC → NTP system clock → millis() fallback
String getIsoTimestamp() {
  // Priority 1: DS3231 hardware RTC (accurate even offline)
  if (rtcAvailable) {
    DateTime dt = rtc.now();
    if (dt.isValid() && dt.year() >= 2024) {
      char buf[25];
      snprintf(buf, sizeof(buf), "%04d-%02d-%02dT%02d:%02d:%02dZ",
               dt.year(), dt.month(), dt.day(),
               dt.hour(), dt.minute(), dt.second());
      return String(buf);
    }
  }

  // Priority 2: NTP-synced system clock (online only)
  time_t now = time(nullptr);
  if (now > 100000) {
    struct tm timeinfo;
    gmtime_r(&now, &timeinfo);
    char buf[30];
    strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &timeinfo);
    return String(buf);
  }

  // Priority 3: millis() uptime fallback (no real time available)
  return "uptime+" + String(millis()) + "ms";
}

void handleSensorRequest(const String &message) {
  // 1. Extract requestId from incoming JSON
  String requestId = "";
  if (message.length() > 0 && message.startsWith("{")) {
    StaticJsonDocument<256> reqDoc;
    DeserializationError err = deserializeJson(reqDoc, message);
    if (!err && reqDoc.containsKey("requestId")) {
      requestId = reqDoc["requestId"].as<String>();
    }
  }

  // Fallback if requestId is absent
  if (requestId.length() == 0) {
    requestId = "req-" + String(millis());
  }

  Serial.print("[SENSOR REQUEST] Received requestId=");
  Serial.println(requestId);
  Serial.println("[SENSOR REQUEST] Reading current sensors...");

  // 2. Read FRESH sensor data immediately (no cached values)
  float freshSoil1 = 0.0f, freshSoil2 = 0.0f, freshSoil3 = 0.0f;
  readSoilHumidityPercent(freshSoil1, freshSoil2, freshSoil3);

  float freshWaterLevel = readWaterLevelPercent();
  float freshVolume = calculateVolumeLiters(freshWaterLevel);

  float freshTemp = 0.0f;
  float freshHum = 0.0f;
  bool bmeSuccess = false;

  if (bmeAvailable) {
    freshTemp = bme.readTemperature();
    freshHum = bme.readHumidity();
    if (!isnan(freshTemp) && !isnan(freshHum)) {
      bmeSuccess = true;
    } else {
      freshTemp = 0.0f;
      freshHum = 0.0f;
    }
  }

  // Update currentData state with the fresh readings
  currentData.zone1.soilHumidity = freshSoil1;
  currentData.zone2.soilHumidity = freshSoil2;
  currentData.zone3.soilHumidity = freshSoil3;
  currentData.waterLevel = freshWaterLevel;
  currentData.volumeLiters = freshVolume;
  currentData.temperature = freshTemp;
  currentData.airHumidity = freshHum;
  currentData.valid = validateData(currentData);

  // 3. Build consolidated JSON response
  bool hasErrors = false;
  StaticJsonDocument<1536> doc;
  doc["requestId"] = requestId;
  doc["timestamp"] = getIsoTimestamp();
  doc["deviceId"] = DEVICE_ID;

  // Zones object
  JsonObject zonesObj = doc.createNestedObject("zones");
  
  JsonObject z1 = zonesObj.createNestedObject("1");
  z1["soilMoisturePct"] = freshSoil1;
  z1["valveOpen"] = isZoneOpen(1);

  JsonObject z2 = zonesObj.createNestedObject("2");
  z2["soilMoisturePct"] = freshSoil2;
  z2["valveOpen"] = isZoneOpen(2);

  JsonObject z3 = zonesObj.createNestedObject("3");
  z3["soilMoisturePct"] = freshSoil3;
  z3["valveOpen"] = isZoneOpen(3);

  // Tank object
  JsonObject tankObj = doc.createNestedObject("tank");
  tankObj["waterLevelPct"] = freshWaterLevel;
  tankObj["volumeLiters"] = freshVolume;

  // Environment object
  JsonObject envObj = doc.createNestedObject("environment");
  envObj["temperature"] = freshTemp;
  envObj["airHumidity"] = freshHum;

  // Pump object
  JsonObject pumpObj = doc.createNestedObject("pump");
  pumpObj["active"] = pumpRunning;

  // Sensor diagnostic validation
  JsonArray errors = doc.createNestedArray("errors");
  if (!bmeAvailable || !bmeSuccess) {
    hasErrors = true;
    errors.add("BME280 environment sensor unavailable or read failed");
  }
  if (freshWaterLevel < 0.0f || freshWaterLevel > 100.0f) {
    hasErrors = true;
    errors.add("Ultrasonic water level sensor reading out of valid range");
  }

  if (hasErrors) {
    doc["status"] = "PARTIAL";
  } else {
    doc["status"] = "OK";
    doc.remove("errors");
  }

  // 4. Serialize and publish without retention (retained = false)
  char buffer[1536];
  size_t len = serializeJson(doc, buffer, sizeof(buffer));

  if (len > 0 && len < sizeof(buffer) && mqttClient.connected()) {
    bool published = mqttClient.publish(TOPIC_SENSOR_RESPONSE, buffer, false);
    if (published) {
      Serial.println("[SENSOR RESPONSE] Published realtime sensor data");
    } else {
      Serial.println("[SENSOR RESPONSE] MQTT publish failed");
    }
  } else {
    Serial.println("[SENSOR RESPONSE] MQTT publish failed (Client disconnected or buffer overflow)");
  }
}
