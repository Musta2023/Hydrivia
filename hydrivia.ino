#include <WiFi.h>
#include <PubSubClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME280.h>
#include "secrets.h"

Adafruit_BME280 bme;
bool bmeAvailable = false;

#define BME280_I2C_ADDR 0x77

// ============================================================================
// GPIO
// ============================================================================

// US-100 ultrasonic sensor
#define PIN_ULTRASONIC_TRIG 5
#define PIN_ULTRASONIC_ECHO 18

// Soil moisture sensors
#define PIN_SOIL_MOISTURE_1 34   // Zone 1 - Tomato
#define PIN_SOIL_MOISTURE_2 35   // Zone 2 - Mint
#define PIN_SOIL_MOISTURE_3 36   // Zone 3 - Onion

// Common pump
#define PIN_PUMP_RELAY 27

// Electrovalves
#define PIN_VALVE1_RELAY 26
#define PIN_VALVE2_RELAY 25
#define PIN_VALVE3_RELAY 23

// Tank status LEDs
#define PIN_LED_LOW 33
#define PIN_LED_NORMAL 32

// BME280
#define PIN_I2C_SDA 21
#define PIN_I2C_SCL 22

// Device ID
const char* DEVICE_ID = "hydrivia-esp32-01";

// ============================================================================
// ZONE CONFIGURATION
// ============================================================================

const char* ZONE1_PLANT = "tomato";
const char* ZONE2_PLANT = "mint";
const char* ZONE3_PLANT = "onion";

// ============================================================================
// WATER TANK CALIBRATION
// ============================================================================



const float EMPTY_DISTANCE = 180.69f;
const float FULL_DISTANCE  = 20.21f;
const float TANK_CAPACITY_LITERS = 100.0f;

// ============================================================================
// SOIL SENSOR CALIBRATION
// ============================================================================

const int SOIL_DRY_VALUE = 3500;
const int SOIL_WET_VALUE = 1500;

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

const unsigned long PUMP_MAX_RUNTIME_MS =
    5UL * 60UL * 1000UL;

const unsigned long MQTT_RETRY_INTERVAL_MS = 5000UL;

// ============================================================================
// RELAY CONFIGURATION
// ============================================================================

const bool RELAY_ACTIVE_HIGH = true;

// ============================================================================
// MQTT TOPICS
// ============================================================================

// Zone 1
const char* TOPIC_ZONE1_STATE =
    "hydrivia/zones/1/state";

const char* TOPIC_ZONE1_COMMAND =
    "hydrivia/zones/1/command";

// Zone 2
const char* TOPIC_ZONE2_STATE =
    "hydrivia/zones/2/state";

const char* TOPIC_ZONE2_COMMAND =
    "hydrivia/zones/2/command";

// Zone 3
const char* TOPIC_ZONE3_STATE =
    "hydrivia/zones/3/state";

const char* TOPIC_ZONE3_COMMAND =
    "hydrivia/zones/3/command";

// Pump
const char* TOPIC_PUMP_STATE =
    "hydrivia/pump/state";

const char* TOPIC_PUMP_COMMAND =
    "hydrivia/pump/command";

// Tank
const char* TOPIC_TANK_STATE =
    "hydrivia/tank/state";

// Environment
const char* TOPIC_ENVIRONMENT_STATE =
    "hydrivia/environment/state";

// Complete system snapshot every 60 seconds
const char* TOPIC_SNAPSHOT =
    "hydrivia/snapshot";

// Alerts
const char* TOPIC_ALERTS =
    "hydrivia/alerts";

// ============================================================================
// MQTT
// ============================================================================

const char* MQTT_CLIENT_ID =
    "hydrivia-irrigation";

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

    const char* plant;

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

    {
        1,
        ZONE1_PLANT,
        0.0f,
        false
    },

    {
        2,
        ZONE2_PLANT,
        0.0f,
        false
    },

    {
        3,
        ZONE3_PLANT,
        0.0f,
        false
    },

    0.0f,   // waterLevel
    0.0f,   // volumeLiters
    0.0f,   // temperature
    0.0f,   // airHumidity
    false   // valid
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

void mqttCallback(
    char* topic,
    byte* payload,
    unsigned int length
);

void handleZoneCommand(
    uint8_t zone,
    String command
);

// Sensors
SensorData readSensors();

void readSoilHumidityPercent(
    float& moisture1,
    float& moisture2,
    float& moisture3
);

float readWaterLevelPercent();

float calculateVolumeLiters(
    float waterLevelPercent
);

bool validateData(
    const SensorData& data
);

// Display
void printSensorData(
    const SensorData& data
);

// MQTT publishing
void publishZoneState(
    uint8_t zone
);

void publishAllZoneStates();

void publishPumpState();

void publishTankState();

void publishEnvironmentState();

void publishSnapshot();

void publishAlert(
    const char* type,
    const char* severity,
    const char* message
);

// Pump
void startPump();

void stopPump();

void checkPumpSafety();

void emergencyShutdown();

// Zones / valves
bool isZoneOpen(
    uint8_t zone
);

void setZoneValve(
    uint8_t zone,
    bool state
);

void openZone(
    uint8_t zone
);

void closeZone(
    uint8_t zone
);

void closeAllZones();

// GPIO
void setRelay(
    int pin,
    bool state
);

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
    // GPIO
    // ========================================================================

    pinMode(
        PIN_PUMP_RELAY,
        OUTPUT
    );

    pinMode(
        PIN_VALVE1_RELAY,
        OUTPUT
    );

    pinMode(
        PIN_VALVE2_RELAY,
        OUTPUT
    );

    pinMode(
        PIN_VALVE3_RELAY,
        OUTPUT
    );

    pinMode(
        PIN_ULTRASONIC_TRIG,
        OUTPUT
    );

    pinMode(
        PIN_ULTRASONIC_ECHO,
        INPUT
    );

    pinMode(
        PIN_SOIL_MOISTURE_1,
        INPUT
    );

    pinMode(
        PIN_SOIL_MOISTURE_2,
        INPUT
    );

    pinMode(
        PIN_SOIL_MOISTURE_3,
        INPUT
    );

    pinMode(
        PIN_LED_LOW,
        OUTPUT
    );

    pinMode(
        PIN_LED_NORMAL,
        OUTPUT
    );

    analogReadResolution(12);

    digitalWrite(
        PIN_ULTRASONIC_TRIG,
        LOW
    );

    digitalWrite(
        PIN_LED_LOW,
        LOW
    );

    digitalWrite(
        PIN_LED_NORMAL,
        LOW
    );

    // Everything OFF at startup
    setRelay(
        PIN_PUMP_RELAY,
        false
    );

    setRelay(
        PIN_VALVE1_RELAY,
        false
    );

    setRelay(
        PIN_VALVE2_RELAY,
        false
    );

    setRelay(
        PIN_VALVE3_RELAY,
        false
    );

    Serial.println(
        "[OK] GPIO initialized."
    );

    // ========================================================================
    // BME280
    // ========================================================================

    Wire.begin(
        PIN_I2C_SDA,
        PIN_I2C_SCL
    );

    bmeAvailable =
        bme.begin(
            BME280_I2C_ADDR,
            &Wire
        );

    if (bmeAvailable) {

        Serial.println(
            "[OK] BME280 initialized."
        );

    } else {

        Serial.println(
            "[WARNING] BME280 not found."
        );

        Serial.println(
            "[WARNING] Temperature and air humidity = 0."
        );
    }

    // ========================================================================
    // WIFI
    // ========================================================================

    connectWiFi();

    // ========================================================================
    // MQTT
    // ========================================================================

    espClient.setInsecure();

    mqttClient.setServer(
        MQTT_SERVER,
        MQTT_PORT
    );

    mqttClient.setCallback(
        mqttCallback
    );

    mqttClient.setBufferSize(
        2048
    );

    mqttClient.setKeepAlive(
        30
    );

    mqttClient.setSocketTimeout(
        15
    );

    connectMQTT();

    // ========================================================================
    // INITIAL SENSOR READING
    // ========================================================================

    currentData =
        readSensors();

    currentData.valid =
        validateData(
            currentData
        );

    printSensorData(
        currentData
    );

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

    unsigned long now =
        millis();

    // ========================================================================
    // WIFI
    // ========================================================================

    if (
        WiFi.status() !=
        WL_CONNECTED
    ) {

        connectWiFi();
    }

    // ========================================================================
    // MQTT
    // ========================================================================

    if (!mqttClient.connected()) {

        if (
            now - lastMqttRetryMillis
            >= MQTT_RETRY_INTERVAL_MS
        ) {

            lastMqttRetryMillis =
                now;

            connectMQTT();
        }

    } else {

        mqttClient.loop();
    }

    // ========================================================================
    // SENSOR READING - EVERY 2 SECONDS
    // ========================================================================

    if (
        now - lastSensorRead
        >= SENSOR_INTERVAL_MS
    ) {

        lastSensorRead =
            now;

        currentData =
            readSensors();

        currentData.valid =
            validateData(
                currentData
            );

        // Synchronize zone valve states
        currentData.zone1.valveOpen =
            isZoneOpen(1);

        currentData.zone2.valveOpen =
            isZoneOpen(2);

        currentData.zone3.valveOpen =
            isZoneOpen(3);

        printSensorData(
            currentData
        );

        // ====================================================================
        // WATER SAFETY
        // ====================================================================

        if (
            currentData.waterLevel
            < WATER_LEVEL_CRITICAL_PCT
        ) {

            digitalWrite(
                PIN_LED_LOW,
                HIGH
            );

            digitalWrite(
                PIN_LED_NORMAL,
                LOW
            );

            if (
                pumpRunning ||
                currentData.zone1.valveOpen ||
                currentData.zone2.valveOpen ||
                currentData.zone3.valveOpen
            ) {

                emergencyShutdown();
            }

        } else {

            digitalWrite(
                PIN_LED_LOW,
                LOW
            );

            digitalWrite(
                PIN_LED_NORMAL,
                HIGH
            );
        }

        // ====================================================================
        // PUBLISH LIVE DATA
        // ====================================================================

        if (
            currentData.valid &&
            mqttClient.connected()
        ) {

            publishAllZoneStates();

            publishPumpState();

            publishTankState();

            publishEnvironmentState();
        }
    }

    // ========================================================================
    // COMPLETE SNAPSHOT - EVERY 60 SECONDS
    // ========================================================================

    if (
        now - lastSensorSnapshot
        >= SENSOR_SNAPSHOT_INTERVAL_MS
    ) {

        lastSensorSnapshot =
            now;

        if (
            currentData.valid &&
            mqttClient.connected()
        ) {

            publishSnapshot();
        }
    }

    // ========================================================================
    // PUMP SAFETY
    // ========================================================================

    checkPumpSafety();
}

// ============================================================================
// SENSOR READING
// ============================================================================

SensorData readSensors() {

    SensorData data =
        currentData;

    // ========================================================================
    // SOIL
    // ========================================================================

    readSoilHumidityPercent(
        data.zone1.soilHumidity,
        data.zone2.soilHumidity,
        data.zone3.soilHumidity
    );

    // ========================================================================
    // WATER LEVEL
    // ========================================================================

    data.waterLevel =
        readWaterLevelPercent();

    // ========================================================================
    // WATER VOLUME
    // ========================================================================

    data.volumeLiters =
        calculateVolumeLiters(
            data.waterLevel
        );

    // ========================================================================
    // BME280
    // ========================================================================

    if (bmeAvailable) {

        data.temperature =
            bme.readTemperature();

        data.airHumidity =
            bme.readHumidity();

        if (
            isnan(data.temperature) ||
            isnan(data.airHumidity)
        ) {

            Serial.println(
                "[ERROR] BME280 reading failed."
            );

            data.temperature =
                0.0f;

            data.airHumidity =
                0.0f;
        }

    } else {

        data.temperature =
            0.0f;

        data.airHumidity =
            0.0f;
    }

    data.valid =
        false;

    return data;
}

// ============================================================================
// SOIL MOISTURE - THREE SENSORS
// ============================================================================

void readSoilHumidityPercent(
    float& moisture1,
    float& moisture2,
    float& moisture3
) {

    long sumRaw1 = 0;
    long sumRaw2 = 0;
    long sumRaw3 = 0;

    const int samples = 10;

    for (
        int i = 0;
        i < samples;
        i++
    ) {

        sumRaw1 +=
            analogRead(
                PIN_SOIL_MOISTURE_1
            );

        sumRaw2 +=
            analogRead(
                PIN_SOIL_MOISTURE_2
            );

        sumRaw3 +=
            analogRead(
                PIN_SOIL_MOISTURE_3
            );

        delayMicroseconds(100);
    }

    int rawValue1 =
        sumRaw1 / samples;

    int rawValue2 =
        sumRaw2 / samples;

    int rawValue3 =
        sumRaw3 / samples;

    Serial.print(
        "Soil ADC: "
    );

    Serial.print(
        rawValue1
    );

    Serial.print(
        " | "
    );

    Serial.print(
        rawValue2
    );

    Serial.print(
        " | "
    );

    Serial.println(
        rawValue3
    );

    float denominator =
        (float)(
            SOIL_DRY_VALUE -
            SOIL_WET_VALUE
        );

    if (
        denominator == 0.0f
    ) {

        moisture1 = 0.0f;
        moisture2 = 0.0f;
        moisture3 = 0.0f;

        return;
    }

    moisture1 =
        (
            (
                float(
                    SOIL_DRY_VALUE -
                    rawValue1
                )
            )
            /
            denominator
        )
        * 100.0f;

    moisture2 =
        (
            (
                float(
                    SOIL_DRY_VALUE -
                    rawValue2
                )
            )
            /
            denominator
        )
        * 100.0f;

    moisture3 =
        (
            (
                float(
                    SOIL_DRY_VALUE -
                    rawValue3
                )
            )
            /
            denominator
        )
        * 100.0f;

    moisture1 =
        constrain(
            moisture1,
            0.0f,
            100.0f
        );

    moisture2 =
        constrain(
            moisture2,
            0.0f,
            100.0f
        );

    moisture3 =
        constrain(
            moisture3,
            0.0f,
            100.0f
        );
}

// ============================================================================
// WATER LEVEL - US-100
// ============================================================================

float readWaterLevelPercent() {

    float previousLevel =
        currentData.waterLevel;

    for (
        int attempt = 0;
        attempt < 3;
        attempt++
    ) {

        // Trigger pulse
        digitalWrite(
            PIN_ULTRASONIC_TRIG,
            LOW
        );

        delayMicroseconds(2);

        digitalWrite(
            PIN_ULTRASONIC_TRIG,
            HIGH
        );

        delayMicroseconds(10);

        digitalWrite(
            PIN_ULTRASONIC_TRIG,
            LOW
        );

        // Read echo
        unsigned long duration =
            pulseIn(
                PIN_ULTRASONIC_ECHO,
                HIGH,
                25000UL
            );

        if (duration > 0) {

            // Distance in cm
            float distance =
                duration *
                0.0343f /
                2.0f;

            Serial.print(
                "Tank distance: "
            );

            Serial.print(
                distance,
                2
            );

            Serial.println(
                " cm"
            );

            // Validate distance
            if (
                distance >= 2.0f &&
                distance <= 400.0f
            ) {

                // ============================================================
                // Convert distance to percentage
                //
                // 18.69 cm = 0%
                // 8.21 cm  = 100%
                // ============================================================

                float denominator =
                    EMPTY_DISTANCE -
                    FULL_DISTANCE;

                if (
                    denominator <= 0.0f
                ) {

                    Serial.println(
                        "[ERROR] Invalid tank calibration."
                    );

                    return previousLevel;
                }

                float levelPercent =
                    (
                        (
                            EMPTY_DISTANCE -
                            distance
                        )
                        /
                        denominator
                    )
                    * 100.0f;

                levelPercent =
                    constrain(
                        levelPercent,
                        0.0f,
                        100.0f
                    );

                // ============================================================
                // Calculate volume
                // ============================================================

                float volumeLiters =
                    calculateVolumeLiters(
                        levelPercent
                    );

                Serial.print(
                    "Tank level: "
                );

                Serial.print(
                    levelPercent,
                    1
                );

                Serial.print(
                    "% | Volume: "
                );

                Serial.print(
                    volumeLiters,
                    2
                );

                Serial.println(
                    " L"
                );

                return levelPercent;
            }
        }

        Serial.println(
            "US-100: measurement failed - retrying..."
        );

        delay(200);
    }

    Serial.println(
        "US-100: all measurements failed - keeping previous level."
    );

    return previousLevel;
}

// ============================================================================
// CALCULATE VOLUME
// ============================================================================

float calculateVolumeLiters(
    float waterLevelPercent
) {

    if (
        TANK_CAPACITY_LITERS <= 0.0f
    ) {

        return 0.0f;
    }

    waterLevelPercent =
        constrain(
            waterLevelPercent,
            0.0f,
            100.0f
        );

    float volume =
        (
            waterLevelPercent /
            100.0f
        )
        *
        TANK_CAPACITY_LITERS;

    return volume;
}

// ============================================================================
// DATA VALIDATION
// ============================================================================

bool validateData(
    const SensorData& data
) {

    // Zone 1
    if (
        data.zone1.soilHumidity < 0.0f ||
        data.zone1.soilHumidity > 100.0f
    ) {

        return false;
    }

    // Zone 2
    if (
        data.zone2.soilHumidity < 0.0f ||
        data.zone2.soilHumidity > 100.0f
    ) {

        return false;
    }

    // Zone 3
    if (
        data.zone3.soilHumidity < 0.0f ||
        data.zone3.soilHumidity > 100.0f
    ) {

        return false;
    }

    // Water level
    if (
        data.waterLevel < 0.0f ||
        data.waterLevel > 100.0f
    ) {

        return false;
    }

    // Volume
    if (
        data.volumeLiters < 0.0f ||
        data.volumeLiters > TANK_CAPACITY_LITERS
    ) {

        return false;
    }

    // Temperature
    if (
        data.temperature < -40.0f ||
        data.temperature > 85.0f
    ) {

        return false;
    }

    // Air humidity
    if (
        data.airHumidity < 0.0f ||
        data.airHumidity > 100.0f
    ) {

        return false;
    }

    return true;
}

// ============================================================================
// PRINT SENSOR DATA
// ============================================================================

void printSensorData(
    const SensorData& data
) {

    Serial.println();
    Serial.println(
        "--------------- SENSOR DATA ---------------"
    );

    // Zone 1
    Serial.print(
        "Zone 1 - "
    );

    Serial.print(
        data.zone1.plant
    );

    Serial.print(
        " - Soil: "
    );

    Serial.print(
        data.zone1.soilHumidity,
        1
    );

    Serial.print(
        "% | Valve: "
    );

    Serial.println(
        data.zone1.valveOpen
            ? "ON"
            : "OFF"
    );

    // Zone 2
    Serial.print(
        "Zone 2 - "
    );

    Serial.print(
        data.zone2.plant
    );

    Serial.print(
        " - Soil: "
    );

    Serial.print(
        data.zone2.soilHumidity,
        1
    );

    Serial.print(
        "% | Valve: "
    );

    Serial.println(
        data.zone2.valveOpen
            ? "ON"
            : "OFF"
    );

    // Zone 3
    Serial.print(
        "Zone 3 - "
    );

    Serial.print(
        data.zone3.plant
    );

    Serial.print(
        " - Soil: "
    );

    Serial.print(
        data.zone3.soilHumidity,
        1
    );

    Serial.print(
        "% | Valve: "
    );

    Serial.println(
        data.zone3.valveOpen
            ? "ON"
            : "OFF"
    );

    // Tank level
    Serial.print(
        "Tank level: "
    );

    Serial.print(
        data.waterLevel,
        1
    );

    Serial.println(
        "%"
    );

    // Tank volume
    Serial.print(
        "Tank volume: "
    );

    Serial.print(
        data.volumeLiters,
        2
    );

    Serial.println(
        " L"
    );

    // Temperature
    Serial.print(
        "Temperature: "
    );

    Serial.print(
        data.temperature,
        1
    );

    Serial.println(
        " C"
    );

    // Air humidity
    Serial.print(
        "Air humidity: "
    );

    Serial.print(
        data.airHumidity,
        1
    );

    Serial.println(
        "%"
    );

    // Pump
    Serial.print(
        "Pump: "
    );

    Serial.println(
        pumpRunning
            ? "ON"
            : "OFF"
    );

    Serial.println(
        "-------------------------------------------"
    );
}

// ============================================================================
// WIFI
// ============================================================================

void connectWiFi() {

    if (
        WiFi.status() ==
        WL_CONNECTED
    ) {

        return;
    }

    Serial.println();
    Serial.println(
        "Connecting to Wi-Fi..."
    );

    WiFi.mode(
        WIFI_STA
    );

    WiFi.begin(
        WIFI_SSID,
        WIFI_PASSWORD
    );

    int attempts = 0;

    while (
        WiFi.status() !=
        WL_CONNECTED &&
        attempts < 20
    ) {

        delay(500);

        Serial.print(
            "."
        );

        attempts++;
    }

    Serial.println();

    if (
        WiFi.status() ==
        WL_CONNECTED
    ) {

        Serial.println(
            "[OK] Wi-Fi connected."
        );

        Serial.print(
            "IP: "
        );

        Serial.println(
            WiFi.localIP()
        );

    } else {

        Serial.println(
            "[ERROR] Wi-Fi connection failed."
        );
    }
}

// ============================================================================
// MQTT CONNECTION
// ============================================================================

void connectMQTT() {

    if (
        mqttClient.connected()
    ) {

        return;
    }

    if (
        WiFi.status() !=
        WL_CONNECTED
    ) {

        return;
    }

    Serial.println();
    Serial.println(
        "Connecting to MQTT..."
    );

    bool connected = false;

    if (
        strlen(MQTT_USERNAME) > 0
    ) {

        connected =
            mqttClient.connect(
                MQTT_CLIENT_ID,
                MQTT_USERNAME,
                MQTT_PASSWORD
            );

    } else {

        connected =
            mqttClient.connect(
                MQTT_CLIENT_ID
            );
    }

    if (connected) {

        Serial.println(
            "[OK] MQTT connected."
        );

        // Subscribe zone commands
        mqttClient.subscribe(
            TOPIC_ZONE1_COMMAND
        );

        mqttClient.subscribe(
            TOPIC_ZONE2_COMMAND
        );

        mqttClient.subscribe(
            TOPIC_ZONE3_COMMAND
        );

        // Subscribe pump command
        mqttClient.subscribe(
            TOPIC_PUMP_COMMAND
        );

        // Publish current state
        publishAllZoneStates();

        publishPumpState();

        publishTankState();

        publishEnvironmentState();

    } else {

        Serial.print(
            "[ERROR] MQTT failed. State = "
        );

        Serial.println(
            mqttClient.state()
        );
    }
}

// ============================================================================
// MQTT CALLBACK
// ============================================================================

void mqttCallback(
    char* topic,
    byte* payload,
    unsigned int length
) {

    String receivedTopic =
        String(topic);

    String message;

    for (
        unsigned int i = 0;
        i < length;
        i++
    ) {

        message +=
            (char)payload[i];
    }

    message.trim();

    String upperMessage =
        message;

    upperMessage.toUpperCase();

    Serial.println();
    Serial.println(
        "================ MQTT COMMAND ================"
    );

    Serial.print(
        "Topic: "
    );

    Serial.println(
        receivedTopic
    );

    Serial.print(
        "Payload: "
    );

    Serial.println(
        message
    );

    Serial.println(
        "==============================================="
    );

    // ========================================================================
    // PUMP COMMAND
    // ========================================================================

    if (
        receivedTopic ==
        TOPIC_PUMP_COMMAND
    ) {

        if (
            upperMessage ==
            "ON"
        ) {

            startPump();

        } else if (
            upperMessage ==
            "OFF"
        ) {

            stopPump();

        } else {

            publishAlert(
                "invalid_command",
                "medium",
                "Invalid pump command. Use ON or OFF."
            );
        }

        return;
    }

    // ========================================================================
    // ZONE 1
    // ========================================================================

    if (
        receivedTopic ==
        TOPIC_ZONE1_COMMAND
    ) {

        handleZoneCommand(
            1,
            upperMessage
        );

        return;
    }

    // ========================================================================
    // ZONE 2
    // ========================================================================

    if (
        receivedTopic ==
        TOPIC_ZONE2_COMMAND
    ) {

        handleZoneCommand(
            2,
            upperMessage
        );

        return;
    }

    // ========================================================================
    // ZONE 3
    // ========================================================================

    if (
        receivedTopic ==
        TOPIC_ZONE3_COMMAND
    ) {

        handleZoneCommand(
            3,
            upperMessage
        );

        return;
    }
}

// ============================================================================
// ZONE COMMAND HANDLER
// ============================================================================

void handleZoneCommand(
    uint8_t zone,
    String command
) {

    // ========================================================================
    // SIMPLE ON/OFF COMMAND
    // ========================================================================

    if (
        command == "ON"
    ) {

        openZone(
            zone
        );

        return;
    }

    if (
        command == "OFF"
    ) {

        closeZone(
            zone
        );

        return;
    }

    // ========================================================================
    // JSON COMMAND
    // ========================================================================

    StaticJsonDocument<256> doc;

    DeserializationError error =
        deserializeJson(
            doc,
            command
        );

    if (error) {

        publishAlert(
            "invalid_command",
            "medium",
            "Invalid zone command."
        );

        Serial.println(
            "[ERROR] Invalid zone JSON."
        );

        return;
    }

    // ========================================================================
    // VALVE
    // ========================================================================

    if (
        doc.containsKey("valve")
    ) {

        const char* valve =
            doc["valve"];

        if (valve != nullptr) {

            String valveCommand =
                String(valve);

            valveCommand.toUpperCase();

            if (
                valveCommand == "ON"
            ) {

                openZone(
                    zone
                );

            } else if (
                valveCommand == "OFF"
            ) {

                closeZone(
                    zone
                );
            }
        }
    }

    // ========================================================================
    // IRRIGATION
    // ========================================================================

    if (
        doc.containsKey("irrigation")
    ) {

        const char* irrigation =
            doc["irrigation"];

        if (irrigation != nullptr) {

            String irrigationCommand =
                String(irrigation);

            irrigationCommand.toUpperCase();

            if (
                irrigationCommand == "ON"
            ) {

                openZone(
                    zone
                );

            } else if (
                irrigationCommand == "OFF"
            ) {

                closeZone(
                    zone
                );
            }
        }
    }

    // ========================================================================
    // DURATION
    // ========================================================================

    if (
        doc.containsKey("duration")
    ) {

        unsigned long duration =
            doc["duration"];

        Serial.print(
            "[ZONE] Requested duration: "
        );

        Serial.print(
            duration
        );

        Serial.println(
            " seconds"
        );

        Serial.println(
            "[ZONE] Duration is informational only."
        );

        Serial.println(
            "[ZONE] Global 5-minute pump safety remains active."
        );
    }
}

// ============================================================================
// RELAY
// ============================================================================

void setRelay(
    int pin,
    bool state
) {

    if (
        RELAY_ACTIVE_HIGH
    ) {

        digitalWrite(
            pin,
            state
                ? HIGH
                : LOW
        );

    } else {

        digitalWrite(
            pin,
            state
                ? LOW
                : HIGH
        );
    }
}

// ============================================================================
// PUMP START
// ============================================================================

void startPump() {

    if (pumpRunning) {

        Serial.println(
            "[PUMP] Already ON."
        );

        return;
    }

    // ========================================================================
    // WATER LEVEL SAFETY
    // ========================================================================

    if (
        currentData.waterLevel
        < WATER_LEVEL_LOW_PCT
    ) {

        publishAlert(
            "pump_blocked",
            "high",
            "Pump cannot start because tank level is below 30%."
        );

        Serial.println(
            "[PUMP] START BLOCKED - water level too low."
        );

        return;
    }

    // ========================================================================
    // START PUMP
    // ========================================================================

    setRelay(
        PIN_PUMP_RELAY,
        true
    );

    pumpRunning =
        true;

    pumpStartMillis =
        millis();

    publishPumpState();

    Serial.println(
        "[PUMP] ON"
    );
}

// ============================================================================
// PUMP STOP
// ============================================================================

void stopPump() {

    setRelay(
        PIN_PUMP_RELAY,
        false
    );

    pumpRunning =
        false;

    pumpStartMillis =
        0;

    // Pump OFF => all zones OFF
    closeAllZones();

    publishPumpState();

    Serial.println(
        "[PUMP] OFF"
    );
}

// ============================================================================
// ZONE STATE
// ============================================================================

bool isZoneOpen(
    uint8_t zone
) {

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
// SET ZONE VALVE
// ============================================================================

void setZoneValve(
    uint8_t zone,
    bool state
) {

    if (zone == 1) {

        setRelay(
            PIN_VALVE1_RELAY,
            state
        );

        currentData.zone1.valveOpen =
            state;

    } else if (zone == 2) {

        setRelay(
            PIN_VALVE2_RELAY,
            state
        );

        currentData.zone2.valveOpen =
            state;

    } else if (zone == 3) {

        setRelay(
            PIN_VALVE3_RELAY,
            state
        );

        currentData.zone3.valveOpen =
            state;
    }
}

// ============================================================================
// OPEN ZONE
// ============================================================================

void openZone(
    uint8_t zone
) {

    // ========================================================================
    // VALID ZONE
    // ========================================================================

    if (
        zone < 1 ||
        zone > 3
    ) {

        Serial.println(
            "[ZONE] Invalid zone."
        );

        return;
    }

    // ========================================================================
    // PUMP DEPENDENCY
    // ========================================================================

    if (!pumpRunning) {

        publishAlert(
            "zone_blocked",
            "medium",
            "Zone cannot open because pump is OFF."
        );

        Serial.print(
            "[ZONE "
        );

        Serial.print(
            zone
        );

        Serial.println(
            "] BLOCKED - pump is OFF."
        );

        return;
    }

    // ========================================================================
    // WATER SAFETY
    // ========================================================================

    if (
        currentData.waterLevel
        < WATER_LEVEL_CRITICAL_PCT
    ) {

        emergencyShutdown();

        return;
    }

    // ========================================================================
    // OPEN VALVE
    // ========================================================================

    setZoneValve(
        zone,
        true
    );

    publishZoneState(
        zone
    );

    Serial.print(
        "[ZONE "
    );

    Serial.print(
        zone
    );

    Serial.println(
        "] VALVE ON"
    );
}

// ============================================================================
// CLOSE ZONE
// ============================================================================

void closeZone(
    uint8_t zone
) {

    if (
        zone < 1 ||
        zone > 3
    ) {

        Serial.println(
            "[ZONE] Invalid zone."
        );

        return;
    }

    setZoneValve(
        zone,
        false
    );

    publishZoneState(
        zone
    );

    Serial.print(
        "[ZONE "
    );

    Serial.print(
        zone
    );

    Serial.println(
        "] VALVE OFF"
    );
}

// ============================================================================
// CLOSE ALL ZONES
// ============================================================================

void closeAllZones() {

    setRelay(
        PIN_VALVE1_RELAY,
        false
    );

    setRelay(
        PIN_VALVE2_RELAY,
        false
    );

    setRelay(
        PIN_VALVE3_RELAY,
        false
    );

    currentData.zone1.valveOpen =
        false;

    currentData.zone2.valveOpen =
        false;

    currentData.zone3.valveOpen =
        false;

    if (
        mqttClient.connected()
    ) {

        publishAllZoneStates();
    }

    Serial.println(
        "[ZONES] ALL VALVES OFF"
    );
}

// ============================================================================
// PUMP SAFETY
// ============================================================================

void checkPumpSafety() {

    if (
        pumpRunning &&
        (
            millis() -
            pumpStartMillis
        ) >= PUMP_MAX_RUNTIME_MS
    ) {

        stopPump();

        publishAlert(
            "pump_timeout",
            "high",
            "Pump automatically stopped after 5 minutes."
        );

        Serial.println(
            "[SAFETY] Pump timeout."
        );
    }
}

// ============================================================================
// EMERGENCY SHUTDOWN
// ============================================================================

void emergencyShutdown() {

    Serial.println();
    Serial.println(
        "[EMERGENCY] WATER LEVEL CRITICAL!"
    );

    // ========================================================================
    // PUMP OFF
    // ========================================================================

    setRelay(
        PIN_PUMP_RELAY,
        false
    );

    pumpRunning =
        false;

    pumpStartMillis =
        0;

    // ========================================================================
    // ALL VALVES OFF
    // ========================================================================

    setRelay(
        PIN_VALVE1_RELAY,
        false
    );

    setRelay(
        PIN_VALVE2_RELAY,
        false
    );

    setRelay(
        PIN_VALVE3_RELAY,
        false
    );

    currentData.zone1.valveOpen =
        false;

    currentData.zone2.valveOpen =
        false;

    currentData.zone3.valveOpen =
        false;

    // ========================================================================
    // MQTT
    // ========================================================================

    publishPumpState();

    publishAllZoneStates();

    publishAlert(
        "water_critical",
        "high",
        "Critical tank level. Pump and all zones stopped."
    );
}

// ============================================================================
// PUBLISH ZONE STATE
// ============================================================================

void publishZoneState(
    uint8_t zone
) {

    if (
        !mqttClient.connected()
    ) {

        return;
    }

    ZoneData* z =
        nullptr;

    const char* topic =
        nullptr;

    if (zone == 1) {

        z =
            &currentData.zone1;

        topic =
            TOPIC_ZONE1_STATE;

    } else if (zone == 2) {

        z =
            &currentData.zone2;

        topic =
            TOPIC_ZONE2_STATE;

    } else if (zone == 3) {

        z =
            &currentData.zone3;

        topic =
            TOPIC_ZONE3_STATE;

    } else {

        return;
    }

    StaticJsonDocument<384> doc;

    doc["device_id"] =
        DEVICE_ID;

    doc["zone"] =
        z->id;

    doc["plant"] =
        z->plant;

    doc["soil_humidity"] =
        z->soilHumidity;

    doc["valve"] =
        z->valveOpen
            ? "ON"
            : "OFF";

    doc["pump"] =
        pumpRunning
            ? "ON"
            : "OFF";

    doc["water_level"] =
        currentData.waterLevel;

    doc["volume_liters"] =
        currentData.volumeLiters;

    doc["timestamp_ms"] =
        millis();

    char buffer[384];

    size_t length =
        serializeJson(
            doc,
            buffer,
            sizeof(buffer)
        );

    if (
        length == 0 ||
        length >= sizeof(buffer)
    ) {

        Serial.println(
            "[ERROR] Zone state JSON too large."
        );

        return;
    }

    mqttClient.publish(
        topic,
        buffer,
        true
    );
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

    if (
        !mqttClient.connected()
    ) {

        return;
    }

    StaticJsonDocument<256> doc;

    doc["device_id"] =
        DEVICE_ID;

    doc["pump"] =
        pumpRunning
            ? "ON"
            : "OFF";

    doc["water_level"] =
        currentData.waterLevel;

    doc["volume_liters"] =
        currentData.volumeLiters;

    doc["timestamp_ms"] =
        millis();

    char buffer[256];

    size_t length =
        serializeJson(
            doc,
            buffer,
            sizeof(buffer)
        );

    if (
        length == 0 ||
        length >= sizeof(buffer)
    ) {

        return;
    }

    mqttClient.publish(
        TOPIC_PUMP_STATE,
        buffer,
        true
    );
}

// ============================================================================
// PUBLISH TANK
// ============================================================================

void publishTankState() {

    if (
        !mqttClient.connected()
    ) {

        return;
    }

    StaticJsonDocument<320> doc;

    doc["device_id"] =
        DEVICE_ID;

    doc["water_level"] =
        currentData.waterLevel;

    doc["volume_liters"] =
        currentData.volumeLiters;

    doc["capacity_liters"] =
        TANK_CAPACITY_LITERS;

    doc["critical"] =
        currentData.waterLevel
        < WATER_LEVEL_CRITICAL_PCT;

    doc["low"] =
        currentData.waterLevel
        < WATER_LEVEL_LOW_PCT;

    doc["timestamp_ms"] =
        millis();

    char buffer[320];

    size_t length =
        serializeJson(
            doc,
            buffer,
            sizeof(buffer)
        );

    if (
        length == 0 ||
        length >= sizeof(buffer)
    ) {

        return;
    }

    mqttClient.publish(
        TOPIC_TANK_STATE,
        buffer,
        true
    );
}

// ============================================================================
// PUBLISH ENVIRONMENT
// ============================================================================

void publishEnvironmentState() {

    if (
        !mqttClient.connected()
    ) {

        return;
    }

    StaticJsonDocument<256> doc;

    doc["device_id"] =
        DEVICE_ID;

    doc["temperature"] =
        currentData.temperature;

    doc["air_humidity"] =
        currentData.airHumidity;

    doc["timestamp_ms"] =
        millis();

    char buffer[256];

    size_t length =
        serializeJson(
            doc,
            buffer,
            sizeof(buffer)
        );

    if (
        length == 0 ||
        length >= sizeof(buffer)
    ) {

        return;
    }

    mqttClient.publish(
        TOPIC_ENVIRONMENT_STATE,
        buffer,
        true
    );
}

// ============================================================================
// COMPLETE SYSTEM SNAPSHOT - EVERY 60 SEC
// ============================================================================

void publishSnapshot() {

    if (
        !mqttClient.connected()
    ) {

        return;
    }

    StaticJsonDocument<2048> doc;

    doc["device_id"] =
        DEVICE_ID;

    doc["system"] =
        "HYDRIVIA";

    doc["timestamp_ms"] =
        millis();

    // ========================================================================
    // ZONES
    // ========================================================================

    JsonArray zones =
        doc.createNestedArray(
            "zones"
        );

    // ------------------------------------------------------------------------
    // Zone 1
    // ------------------------------------------------------------------------

    JsonObject zone1 =
        zones.createNestedObject();

    zone1["id"] =
        currentData.zone1.id;

    zone1["plant"] =
        currentData.zone1.plant;

    zone1["soil_humidity"] =
        currentData.zone1.soilHumidity;

   

    // ------------------------------------------------------------------------
    // Zone 2
    // ------------------------------------------------------------------------

    JsonObject zone2 =
        zones.createNestedObject();

    zone2["id"] =
        currentData.zone2.id;

    zone2["plant"] =
        currentData.zone2.plant;

    zone2["soil_humidity"] =
        currentData.zone2.soilHumidity;


    // ------------------------------------------------------------------------
    // Zone 3
    // ------------------------------------------------------------------------

    JsonObject zone3 =
        zones.createNestedObject();

    zone3["id"] =
        currentData.zone3.id;

    zone3["plant"] =
        currentData.zone3.plant;

    zone3["soil_humidity"] =
        currentData.zone3.soilHumidity;


    // ========================================================================
    // TANK
    // ========================================================================

    JsonObject tank =
        doc.createNestedObject(
            "tank"
        );

    tank["volume_liters"] =
        currentData.volumeLiters;

    tank["critical"] =
        currentData.waterLevel
        < WATER_LEVEL_CRITICAL_PCT;

    tank["low"] =
        currentData.waterLevel
        < WATER_LEVEL_LOW_PCT;

    // ========================================================================
    // ENVIRONMENT
    // ========================================================================

    JsonObject environment =
        doc.createNestedObject(
            "environment"
        );

    environment["temperature"] =
        currentData.temperature;

    environment["air_humidity"] =
        currentData.airHumidity;

    // ========================================================================
    // SYSTEM STATUS
    // ========================================================================

    JsonObject systemStatus =
        doc.createNestedObject(
            "status"
        );

    systemStatus["pump"] =
        pumpRunning
            ? "ON"
            : "OFF";

    systemStatus["data_valid"] =
        currentData.valid;

    systemStatus["wifi_connected"] =
        WiFi.status() ==
        WL_CONNECTED;

    systemStatus["mqtt_connected"] =
        mqttClient.connected();

    // ========================================================================
    // SERIALIZE
    // ========================================================================

    char buffer[2048];

    size_t length =
        serializeJson(
            doc,
            buffer,
            sizeof(buffer)
        );

    if (
        length == 0 ||
        length >= sizeof(buffer)
    ) {

        Serial.println(
            "[ERROR] Snapshot JSON too large."
        );

        return;
    }

    bool success =
        mqttClient.publish(
            TOPIC_SNAPSHOT,
            buffer
        );

    if (success) {

        Serial.println();
        Serial.println(
            "[MQTT] 60-SECOND SNAPSHOT PUBLISHED"
        );

        Serial.println(
            buffer
        );

        Serial.println();

    } else {

        Serial.println(
            "[ERROR] Snapshot publish failed."
        );
    }
}

// ============================================================================
// ALERT
// ============================================================================

void publishAlert(
    const char* type,
    const char* severity,
    const char* message
) {

    if (
        !mqttClient.connected()
    ) {

        return;
    }

    StaticJsonDocument<384> doc;

    doc["device_id"] =
        DEVICE_ID;

    doc["timestamp_ms"] =
        millis();

    doc["type"] =
        type;

    doc["severity"] =
        severity;

    doc["message"] =
        message;

    char buffer[384];

    size_t length =
        serializeJson(
            doc,
            buffer,
            sizeof(buffer)
        );

    if (
        length == 0 ||
        length >= sizeof(buffer)
    ) {

        return;
    }

    mqttClient.publish(
        TOPIC_ALERTS,
        buffer
    );
}