#include <WiFi.h>
#include <PubSubClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME280.h>

#include "secrets.h" // to gitignore

// ============================================================================
// HYDRIVIA - SMART IRRIGATION SYSTEM
//============================================================================

// ============================================================================
// BME280
// ============================================================================

Adafruit_BME280 bme;

#define BME280_I2C_ADDR 0x77

// ============================================================================
// MQTT CLIENT
// ============================================================================

const char* MQTT_CLIENT_ID =
    "hydrivia-irrigation";


// ============================================================================
// MQTT SENSOR TOPICS
// ============================================================================

const char* TOPIC_TEMP =
    "hydrivia/sensors/temperature";

const char* TOPIC_AIR_HUMIDITY =
    "hydrivia/sensors/air_humidity";

const char* TOPIC_WATER_LEVEL =
    "hydrivia/sensors/water_level";

const char* TOPIC_SOIL_HUMIDITY =
    "hydrivia/sensors/soil_humidity";


// ============================================================================
// MQTT SENSOR SNAPSHOT // for each 60s
// ============================================================================

const char* TOPIC_SENSOR_SNAPSHOT =
    "hydrivia/sensors/snapshot";


// ============================================================================
// MQTT PUMP TOPICS
// ============================================================================

const char* TOPIC_PUMP_COMMAND =
    "hydrivia/pump/command";

const char* TOPIC_PUMP_STATUS =
    "hydrivia/pump/status";


// ============================================================================
// MQTT VALVE 1 TOPICS
// Tomato
// ============================================================================

const char* TOPIC_VALVE1_COMMAND =
    "hydrivia/valve/1/command";

const char* TOPIC_VALVE1_STATUS =
    "hydrivia/valve/1/status";


// ============================================================================
// MQTT VALVE 2 TOPICS
// Mint
// ============================================================================

const char* TOPIC_VALVE2_COMMAND =
    "hydrivia/valve/2/command";

const char* TOPIC_VALVE2_STATUS =
    "hydrivia/valve/2/status";


// ============================================================================
// MQTT VALVE 3 TOPICS
// Onion
// ============================================================================

const char* TOPIC_VALVE3_COMMAND =
    "hydrivia/valve/3/command";

const char* TOPIC_VALVE3_STATUS =
    "hydrivia/valve/3/status";


// ============================================================================
// MQTT ALERTS
// ============================================================================

const char* TOPIC_ALERTS =
    "hydrivia/alerts";


// ============================================================================
// GPIO DEFINITIONS
// ============================================================================

//

#define PIN_ULTRASONIC_TRIG 5 //X15
#define PIN_ULTRASONIC_ECHO 18 //X14


// Soil Moisture

#define PIN_SOIL_MOISTURE 34 //X6


// Pump Relay

#define PIN_PUMP_RELAY 27 //integrated


// Electrovalves( simulated by leds )

#define PIN_VALVE1_RELAY 26 //led 1 X1
#define PIN_VALVE2_RELAY 25 //led 2 X2
#define PIN_VALVE3_RELAY 23 //Led 3 X10


// LEDs

#define PIN_LED_LOW 33 //tank level crtic <20%
#define PIN_LED_NORMAL 32 // tank level normal


// BME280

#define PIN_I2C_SDA 21
#define PIN_I2C_SCL 22


// ============================================================================
// WATER TANK CALIBRATION
// ============================================================================

const float EMPTY_DISTANCE = 18.69; // in cm

const float FULL_DISTANCE = 8.21;


// ============================================================================
// SOIL MOISTURE CALIBRATION
// ============================================================================

const int SOIL_DRY_VALUE = 3500; // sec

const int SOIL_WET_VALUE = 1500;// watered 


// ============================================================================
// WATER LEVEL SAFETY
// ============================================================================

const float WATER_LEVEL_CRITICAL_PCT =
    20.0; // critical

const float WATER_LEVEL_LOW_PCT =
    30.0; //warnning


// ============================================================================
// TIMING
// ============================================================================

// Sensors every 2 seconds

const unsigned long SENSOR_INTERVAL_MS =
    2000;


// for fusionAI workflow, snapshot every 60 seconds

const unsigned long SENSOR_SNAPSHOT_INTERVAL_MS =
    60000;


// Pump maximum runtime = 5 minutes (to prevent sensors damage or error data collecting so the pump run infinitly)

const unsigned long PUMP_MAX_RUNTIME_MS =
    5UL * 60UL * 1000UL;


// ============================================================================
// RELAY CONFIGURATION
// ============================================================================

//relay initializing
const bool RELAY_ACTIVE_HIGH = true;


// ============================================================================
// GLOBAL OBJECTS
// ============================================================================

WiFiClientSecure espClient;

PubSubClient mqttClient(
    espClient
);


// ============================================================================
// GLOBAL TIMERS
// ============================================================================

unsigned long lastSensorRead = 0;

unsigned long lastSensorSnapshot = 0;

unsigned long pumpStartMillis = 0;

unsigned long lastMqttRetryMillis = 0;


// ============================================================================
// ACTUATOR STATES
// ============================================================================

bool pumpRunning = false;

bool valve1Running = false;

bool valve2Running = false;

bool valve3Running = false;


// ============================================================================
// SENSOR DATA
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

// WiFi

void connectWiFi();


// MQTT

void connectMQTT();

void mqttCallback(
    char* topic,
    byte* payload,
    unsigned int length
);


// Sensors

SensorData readSensors();

float readSoilHumidityPercent();

float readWaterLevelPercent();

bool validateData(
    const SensorData& d
);


// Sensor MQTT // to read only from the adress ram

void publishSensorData(
    const SensorData& d
);

void publishSensorSnapshot(
    const SensorData& d
);


// Pump

void startPump();

void stopPump();

void publishPumpStatus();


// Valves

void openValve(
    int valve
);

void closeValve(
    int valve
);

void closeAllValves();

void publishValveStatus(
    int valve
);

void publishAllActuatorStatus();


// Safety

void checkPumpSafety();

void emergencyShutdown();


// Relay

void setRelay(
    int pin,
    bool state
);


// Alerts

void publishAlert(
    const char* type,
    const char* severity,
    const char* message
);


// Serial

void printSensorData(
    const SensorData& d
);


// ============================================================================
// SETUP
// ============================================================================

void setup() {

    Serial.begin(115200);

    delay(1000);


    Serial.println();

    Serial.println(
        "========================================"
    );

    Serial.println(
        "       HYDRIVIA SMART IRRIGATION"
    );

    Serial.println(
        "       MQTT + AI READY"
    );

    Serial.println(
        "========================================"
    );

    Serial.println();


    // ========================================================================
    // GPIO INITIALIZATION
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
        PIN_SOIL_MOISTURE,
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


    // ========================================================================
    // INITIAL STATES
    // ========================================================================

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


    // Pump OFF

    setRelay(
        PIN_PUMP_RELAY,
        false
    );


    // Valves OFF

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


    pumpRunning = false;

    valve1Running = false;

    valve2Running = false;

    valve3Running = false;


    Serial.println(
        "[OK] GPIO pins initialized."
    );


    // ========================================================================
    // BME280
    // ========================================================================

    Wire.begin(
        PIN_I2C_SDA,
        PIN_I2C_SCL
    );


    if (
        !bme.begin(
            BME280_I2C_ADDR,
            &Wire
        )
    ) {

        Serial.println(
            "[ERROR] BME280 sensor not found!"
        );

    } else {

        Serial.println(
            "[OK] BME280 sensor initialized."
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
        512
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

    Serial.println(
        "========================================"
    );

    Serial.println(
        "       INITIALIZATION COMPLETE"
    );

    Serial.println(
        "========================================"
    );

    Serial.println();
}


// ============================================================================
// MAIN LOOP
// ============================================================================

void loop() {

    unsigned long now =
        millis();


    // ========================================================================
    // WIFI CONNECTION
    // ========================================================================

    if (
        WiFi.status() != WL_CONNECTED
    ) {

        connectWiFi();
    }


    // ========================================================================
    // MQTT CONNECTION
    // ========================================================================

    if (
        !mqttClient.connected()
    ) {

        if (
            now -
            lastMqttRetryMillis >=
            5000
        ) {

            lastMqttRetryMillis =
                now;

            connectMQTT();
        }

    } else {

        // MQTT must be processed continuously

        mqttClient.loop();
    }


    // ========================================================================
    // SENSOR READING - EVERY 2 SECONDS
    // ========================================================================

    if (
        now -
        lastSensorRead >=
        SENSOR_INTERVAL_MS
    ) {

        lastSensorRead =
            now;


        // Read all sensors

        currentData =
            readSensors();


        // Validate

        currentData.valid =
            validateData(
                currentData
            );


        // Serial output

        printSensorData(
            currentData
        );


        // ====================================================================
        // WATER LEVEL LED
        // ====================================================================

        if (
            currentData.waterLevel <
            WATER_LEVEL_CRITICAL_PCT
        ) {

            digitalWrite(
                PIN_LED_LOW,
                HIGH
            );

            digitalWrite(
                PIN_LED_NORMAL,
                LOW
            );


            Serial.println(
                "[ALERT] Water tank critical!"
            );


            // Emergency shutdown

            if (
                pumpRunning ||
                valve1Running ||
                valve2Running ||
                valve3Running
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
        // INDIVIDUAL SENSOR TELEMETRY
        // ====================================================================

        if (
            currentData.valid &&
            mqttClient.connected()
        ) {

            publishSensorData(
                currentData
            );
        }
    }


    // ========================================================================
    // COMPLETE SENSOR SNAPSHOT - EVERY 60 SECONDS
    // ========================================================================
    // hydrivia/sensors/snapshot
    // ========================================================================

    if (
        now -
        lastSensorSnapshot >=
        SENSOR_SNAPSHOT_INTERVAL_MS
    ) {

        lastSensorSnapshot =
            now;


        if (
            currentData.valid &&
            mqttClient.connected()
        ) {

            publishSensorSnapshot(
                currentData
            );
        }
    }


    // ========================================================================
    // PUMP SAFETY TIMER
    // ========================================================================

    checkPumpSafety();
}


// ============================================================================
// READ ALL SENSORS
// ============================================================================

SensorData readSensors() {

    SensorData d;


    // Soil

    d.soilHumidity =
        readSoilHumidityPercent();


    // Water tank

    d.waterLevel =
        readWaterLevelPercent();


    // BME280

    d.temperature =
        bme.readTemperature();


    d.airHumidity =
        bme.readHumidity();


    // ========================================================================
    // BME280 ERROR
    // ========================================================================

    if (
        isnan(d.temperature) ||
        isnan(d.airHumidity)
    ) {

        Serial.println(
            "[ERROR] BME280 read failed!"
        );


        d.temperature =
            0.0;


        d.airHumidity =
            0.0;
    }


    return d;
}


// ============================================================================
// SOIL MOISTURE
// ============================================================================

float readSoilHumidityPercent() {

    long sumRaw = 0;


    // Average 10 readings

    for (
        int i = 0;
        i < 10;
        i++
    ) {

        sumRaw +=
            analogRead(
                PIN_SOIL_MOISTURE
            );


        delayMicroseconds(100);
    }


    int rawValue =
        sumRaw / 10;


    Serial.print(
        "Soil raw ADC value: "
    );

    Serial.println(
        rawValue
    );


    float moisture =
        (
            (
                float
            )(
                SOIL_DRY_VALUE -
                rawValue
            )
            /
            (
                float
            )(
                SOIL_DRY_VALUE -
                SOIL_WET_VALUE
            )
        )
        * 100.0;


    return constrain(
        moisture,
        0.0,
        100.0
    );
}


// ============================================================================
// WATER LEVEL
// ============================================================================

float readWaterLevelPercent() {

    for (
        int attempt = 0;
        attempt < 3;
        attempt++
    ) {


        // Trigger

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


        // Echo

        long duration =
            pulseIn(
                PIN_ULTRASONIC_ECHO,
                HIGH,
                25000
            );


        if (
            duration > 0
        ) {

            float distance =
                duration *
                0.0343 /
                2.0;


            if (
                distance >= 2.0 &&
                distance <= 400.0
            ) {


                float level =
                    (
                        (
                            EMPTY_DISTANCE -
                            distance
                        )
                        /
                        (
                            EMPTY_DISTANCE -
                            FULL_DISTANCE
                        )
                    )
                    * 100.0;


                level =
                    constrain(
                        level,
                        0.0,
                        100.0
                    );


                Serial.print(
                    "Distance: "
                );

                Serial.print(
                    distance,
                    2
                );

                Serial.print(
                    " cm | Level: "
                );

                Serial.print(
                    level,
                    1
                );

                Serial.println(
                    " %"
                );


                return level;
            }
        }


        delay(200);
    }


    Serial.println(
        "US-100: No valid measurement"
    );


    // Keep previous valid value

    return currentData.waterLevel;
}


// ============================================================================
// VALIDATE SENSOR DATA
// ============================================================================

bool validateData(
    const SensorData& d
) {

    if (
        d.soilHumidity < 0 ||
        d.soilHumidity > 100
    ) {

        return false;
    }


    if (
        d.waterLevel < 0 ||
        d.waterLevel > 100
    ) {

        return false;
    }


    if (
        d.temperature < -40 ||
        d.temperature > 85
    ) {

        return false;
    }


    if (
        d.airHumidity < 0 ||
        d.airHumidity > 100
    ) {

        return false;
    }


    return true;
}


// ============================================================================
// PRINT SENSOR DATA
// ============================================================================

void printSensorData(
    const SensorData& d
) {

    Serial.println(
        "--- SENSOR DATA ---"
    );


    Serial.print(
        "Soil Humidity: "
    );

    Serial.print(
        d.soilHumidity,
        1
    );

    Serial.println(
        "%"
    );


    Serial.print(
        "Water Level:   "
    );

    Serial.print(
        d.waterLevel,
        1
    );

    Serial.println(
        "%"
    );


    Serial.print(
        "Temperature:   "
    );

    Serial.print(
        d.temperature,
        1
    );

    Serial.println(
        " °C"
    );


    Serial.print(
        "Air Humidity:  "
    );

    Serial.print(
        d.airHumidity,
        1
    );

    Serial.println(
        "%"
    );


    Serial.print(
        "Pump:          "
    );

    Serial.println(
        pumpRunning
            ? "ON"
            : "OFF"
    );


    Serial.print(
        "Valve 1:       "
    );

    Serial.println(
        valve1Running
            ? "ON"
            : "OFF"
    );


    Serial.print(
        "Valve 2:       "
    );

    Serial.println(
        valve2Running
            ? "ON"
            : "OFF"
    );


    Serial.print(
        "Valve 3:       "
    );

    Serial.println(
        valve3Running
            ? "ON"
            : "OFF"
    );


    Serial.println(
        "-------------------"
    );
}


// ============================================================================
// WIFI CONNECTION
// ============================================================================

void connectWiFi() {

    if (
        WiFi.status() ==
        WL_CONNECTED
    ) {

        return;
    }


    Serial.println(
        "\nConnecting to Wi-Fi..."
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
        WiFi.status() != WL_CONNECTED &&
        attempts < 20
    ) {

        delay(500);

        Serial.print(".");

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
            "ESP32 IP: "
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


    Serial.println(
        "\nConnecting to MQTT broker..."
    );


    bool connected =
        false;


    if (
        strlen(
            MQTT_USERNAME
        ) > 0
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
            "[OK] MQTT connected!"
        );


        // ====================================================================
        // SUBSCRIBE - PUMP
        // ====================================================================

        mqttClient.subscribe(
            TOPIC_PUMP_COMMAND
        );


        // ====================================================================
        // SUBSCRIBE - VALVES
        // ====================================================================

        mqttClient.subscribe(
            TOPIC_VALVE1_COMMAND
        );

        mqttClient.subscribe(
            TOPIC_VALVE2_COMMAND
        );

        mqttClient.subscribe(
            TOPIC_VALVE3_COMMAND
        );


        // Publish current states

        publishAllActuatorStatus();


    } else {

        Serial.print(
            "[ERROR] MQTT failed, state = "
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

    String message = "";


    for (
        unsigned int i = 0;
        i < length;
        i++
    ) {

        message +=
            (char)payload[i];
    }


    message.trim();

    message.toUpperCase();


    String receivedTopic =
        String(topic);


    Serial.println();

    Serial.println(
        "================================"
    );


    Serial.print(
        "[MQTT TOPIC] "
    );

    Serial.println(
        receivedTopic
    );


    Serial.print(
        "[MQTT COMMAND] "
    );

    Serial.println(
        message
    );


    Serial.println(
        "================================"
    );


    // ========================================================================
    // PUMP
    // ========================================================================

    if (
        receivedTopic ==
        TOPIC_PUMP_COMMAND
    ) {


        if (
            message == "ON"
        ) {

            // Safety check

            if (
                currentData.waterLevel <
                WATER_LEVEL_LOW_PCT
            ) {

                publishAlert(
                    "pump_blocked",
                    "high",
                    "Pump ON refused - Water level under 30%"
                );


                Serial.println(
                    "[REJECTED] Pump cannot start."
                );


                return;
            }


            startPump();


        } else if (
            message == "OFF"
        ) {

            stopPump();
        }


        return;
    }


    // ========================================================================
    // VALVE 1
    // ========================================================================

    if (
        receivedTopic ==
        TOPIC_VALVE1_COMMAND
    ) {


        if (
            message == "ON"
        ) {

            openValve(1);

        } else if (
            message == "OFF"
        ) {

            closeValve(1);
        }


        return;
    }


    // ========================================================================
    // VALVE 2
    // ========================================================================

    if (
        receivedTopic ==
        TOPIC_VALVE2_COMMAND
    ) {


        if (
            message == "ON"
        ) {

            openValve(2);

        } else if (
            message == "OFF"
        ) {

            closeValve(2);
        }


        return;
    }


    // ========================================================================
    // VALVE 3
    // ========================================================================

    if (
        receivedTopic ==
        TOPIC_VALVE3_COMMAND
    ) {


        if (
            message == "ON"
        ) {

            openValve(3);

        } else if (
            message == "OFF"
        ) {

            closeValve(3);
        }


        return;
    }
}


// ============================================================================
// RELAY CONTROL
// ============================================================================

void setRelay(
    int pin,
    bool state
) {

    digitalWrite(
        pin,

        RELAY_ACTIVE_HIGH
            ?
            (
                state
                    ? HIGH
                    : LOW
            )
            :
            (
                state
                    ? LOW
                    : HIGH
            )
    );
}


// ============================================================================
// START PUMP
// ============================================================================

void startPump() {

    if (
        pumpRunning
    ) {

        return;
    }


    // Safety

    if (currentData.waterLevel <WATER_LEVEL_LOW_PCT ) {

        publishAlert(
            "pump_blocked",
            "high",
            "Pump blocked - water level too low"
        );


        return;
    }


    setRelay(
        PIN_PUMP_RELAY,
        true
    );


    pumpRunning = true;


    pumpStartMillis =
        millis();


    publishPumpStatus();


    Serial.println(
        "[PUMP] ON"
    );
}


// ============================================================================
// STOP PUMP
// ============================================================================

void stopPump() {

    setRelay(
        PIN_PUMP_RELAY,
        false
    );


    pumpRunning =
        false;


    // IMPORTANT:
    // Pump OFF = all valves OFF

    closeAllValves();


    publishPumpStatus();


    Serial.println(
        "[PUMP] OFF"
    );
}


// ============================================================================
// OPEN VALVE
// ============================================================================

void openValve(int valve) {

    // ========================================================================
    // PUMP MUST BE ON
    // ========================================================================

    if (
        !pumpRunning
    ) {

        publishAlert(
            "valve_blocked",
            "medium",
            "Valve command refused - Pump is OFF"
        );


        Serial.print(
            "[REJECTED] Valve "
        );

        Serial.print(
            valve
        );

        Serial.println(
            " - Pump is OFF."
        );


        return;
    }


    // ========================================================================
    // WATER SAFETY
    // ========================================================================

    if (
        currentData.waterLevel <
        WATER_LEVEL_CRITICAL_PCT
    ) {

        emergencyShutdown();


        return;
    }


    // ========================================================================
    // VALVE 1 - TOMATO
    // ========================================================================

    if (
        valve == 1
    ) {

        setRelay(
            PIN_VALVE1_RELAY,
            true
        );


        valve1Running =
            true;


        publishValveStatus(1);


        Serial.println(
            "[VALVE 1] ON - TOMATO"
        );
    }


    // ========================================================================
    // VALVE 2 - MINT
    // ========================================================================

    else if (
        valve == 2
    ) {

        setRelay(
            PIN_VALVE2_RELAY,
            true
        );


        valve2Running =
            true;


        publishValveStatus(2);


        Serial.println(
            "[VALVE 2] ON - MINT"
        );
    }


    // ========================================================================
    // VALVE 3 - ONION
    // ========================================================================

    else if (
        valve == 3
    ) {

        setRelay(
            PIN_VALVE3_RELAY,
            true
        );


        valve3Running =
            true;


        publishValveStatus(3);


        Serial.println(
            "[VALVE 3] ON - ONION"
        );
    }
}


// ============================================================================
// CLOSE VALVE
// ============================================================================

void closeValve( int valve) {


    // Valve 1

    if (
        valve == 1
    ) {

        setRelay(
            PIN_VALVE1_RELAY,
            false
        );


        valve1Running =
            false;


        publishValveStatus(1);


        Serial.println(
            "[VALVE 1] OFF"
        );
    }


    // Valve 2

    else if (
        valve == 2
    ) {

        setRelay(
            PIN_VALVE2_RELAY,
            false
        );


        valve2Running =
            false;


        publishValveStatus(2);


        Serial.println(
            "[VALVE 2] OFF"
        );
    }


    // Valve 3

    else if (
        valve == 3
    ) {

        setRelay(
            PIN_VALVE3_RELAY,
            false
        );


        valve3Running =
            false;


        publishValveStatus(3);


        Serial.println(
            "[VALVE 3] OFF"
        );
    }
}


// ============================================================================
// CLOSE ALL VALVES
// ============================================================================

void closeAllValves() {

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


    valve1Running =
        false;


    valve2Running =
        false;


    valve3Running =
        false;


    publishValveStatus(1);

    publishValveStatus(2);

    publishValveStatus(3);


    Serial.println(
        "[VALVES] ALL OFF"
    );
}


// ============================================================================
// EMERGENCY SHUTDOWN
// ============================================================================

void emergencyShutdown() {

    Serial.println(
        "[EMERGENCY] Irrigation shutdown!"
    );


    // Pump OFF

    setRelay(
        PIN_PUMP_RELAY,
        false
    );


    pumpRunning =
        false;


    // Valves OFF

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


    valve1Running =
        false;


    valve2Running =
        false;


    valve3Running =
        false;


    // Publish states

    publishAllActuatorStatus();


    // Alert

    publishAlert(
        "water_critical",
        "high",
        "Critical tank level - Pump and all valves stopped- risq to crash the pump"
    );
}


// ============================================================================
// PUMP SAFETY TIMEOUT
// ============================================================================

void checkPumpSafety() {

    if (
        pumpRunning &&
        (
            millis() -
            pumpStartMillis
        ) >
        PUMP_MAX_RUNTIME_MS
    ) {


        stopPump();


        publishAlert(
            "pump_timeout",
            "high",
            "Pump automatically stopped after 5 minutes" // just for sefty perpus
        );


        Serial.println(
            "[SAFETY] Pump timeout!"
        );
    }
}


// ============================================================================
// PUBLISH INDIVIDUAL SENSOR DATA EVERY 2SEC
// ============================================================================

void publishSensorData(
    const SensorData& d
) {

    if (
        !mqttClient.connected()
    ) {

        return;
    }


    char tempBuf[16]; // booking a space in memory to store transforme floats to c-string to fit Json structure 

    char airHumBuf[16];

    char waterBuf[16];

    char soilBuf[16];


    snprintf(
        tempBuf,
        sizeof(tempBuf),
        "%.1f",
        d.temperature
    );


    snprintf(
        airHumBuf,
        sizeof(airHumBuf),
        "%.1f",
        d.airHumidity
    );


    snprintf(
        waterBuf,
        sizeof(waterBuf),
        "%.1f",
        d.waterLevel
    );


    snprintf(
        soilBuf,
        sizeof(soilBuf),
        "%.1f",
        d.soilHumidity
    );


    mqttClient.publish(
        TOPIC_TEMP,
        tempBuf
    );


    mqttClient.publish(
        TOPIC_AIR_HUMIDITY,
        airHumBuf
    );


    mqttClient.publish(
        TOPIC_WATER_LEVEL,
        waterBuf
    );


    mqttClient.publish(
        TOPIC_SOIL_HUMIDITY,
        soilBuf
    );
}


// ============================================================================
// PUBLISH COMPLETE SENSOR SNAPSHOT
// ============================================================================

void publishSensorSnapshot(
    const SensorData& d
) {

    if (
        !mqttClient.connected()
    ) {

        return;
    }


    // ========================================================================
    // JSON DOCUMENT
    // ========================================================================

    StaticJsonDocument<768> doc;


    // ========================================================================
    // TIMESTAMP
    // ========================================================================

    doc["timestamp_ms"] =
        millis();


    // ========================================================================
    // SENSORS
    // ========================================================================

    doc["temperature"] =
        d.temperature;


    doc["air_humidity"] =
        d.airHumidity;


    doc["soil_humidity"] =
        d.soilHumidity;


    doc["water_level"] =
        d.waterLevel;


    // ========================================================================
    // ACTUATORS
    // ========================================================================

    doc["pump"] =
        pumpRunning
            ? "ON"
            : "OFF";


    doc["valve_1"] =
        valve1Running
            ? "ON"
            : "OFF";


    doc["valve_2"] =
        valve2Running
            ? "ON"
            : "OFF";


    doc["valve_3"] =
        valve3Running
            ? "ON"
            : "OFF";


    // ========================================================================
    // SAFETY INFORMATION
    // ========================================================================

    doc["water_critical"] =
        d.waterLevel <
        WATER_LEVEL_CRITICAL_PCT;


    doc["water_low"] =
        d.waterLevel <
        WATER_LEVEL_LOW_PCT;


    // ========================================================================
    // SYSTEM
    // ========================================================================

    doc["system"] =
        "HYDRIVIA";


    doc["data_valid"] =
        d.valid;


    // ========================================================================
    // SERIALIZE
    // ========================================================================

    char buffer[768];


    serializeJson(
        doc,
        buffer
    ); 


    // ========================================================================
    // MQTT PUBLISH
    // ========================================================================

    bool success =
        mqttClient.publish(
            TOPIC_SENSOR_SNAPSHOT,
            buffer
        );


    if (success) {

        Serial.println();

        Serial.println(
            "[MQTT] 60s SENSOR SNAPSHOT PUBLISHED"
        );


        Serial.println(
            buffer
        );


        Serial.println();

    } else {

        Serial.println(
            "[ERROR] Failed to publish sensor snapshot"
        );
    }
}


// ============================================================================
// PUBLISH PUMP STATUS
// ============================================================================

void publishPumpStatus() {

    if (
        !mqttClient.connected()
    ) {

        return;
    }


    mqttClient.publish(
        TOPIC_PUMP_STATUS,

        pumpRunning
            ? "ON"
            : "OFF",

        true
    );
}


// ============================================================================
// PUBLISH VALVE STATUS
// ============================================================================

void publishValveStatus(
    int valve
) {

    if (
        !mqttClient.connected()
    ) {

        return;
    }


    if (
        valve == 1
    ) {

        mqttClient.publish(
            TOPIC_VALVE1_STATUS,

            valve1Running
                ? "ON"
                : "OFF",

            true
        );
    }


    else if (
        valve == 2
    ) {

        mqttClient.publish(
            TOPIC_VALVE2_STATUS,

            valve2Running
                ? "ON"
                : "OFF",

            true
        );
    }


    else if (
        valve == 3
    ) {

        mqttClient.publish(
            TOPIC_VALVE3_STATUS,

            valve3Running
                ? "ON"
                : "OFF",

            true
        );
    }
}


// ============================================================================
// PUBLISH ALL ACTUATOR STATES
// ============================================================================

void publishAllActuatorStatus() {

    publishPumpStatus();

    publishValveStatus(1);

    publishValveStatus(2);

    publishValveStatus(3);
}


// ============================================================================
// MQTT ALERT
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


    StaticJsonDocument<256> doc;


    doc["type"] =
        type;


    doc["severity"] =
        severity;


    doc["message"] =
        message;


    char buffer[256];


    serializeJson(
        doc,
        buffer
    );


    mqttClient.publish(
        TOPIC_ALERTS,
        buffer
    );
}