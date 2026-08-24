# 🌿 HYDRIVIA — Complete Technical Architecture & System Documentation

> **Autonomous AI-Driven Smart Irrigation System & Digital Twin Platform**  
> *Authoritative technical manual for embedded engineers, backend architects, and full-stack developers.*

---

## 📑 Table of Contents

1. [System Overview & Purpose](#1-system-overview--purpose)
2. [Why Hydrivia Exists](#2-why-hydrivia-exists)
3. [Global System Architecture](#3-global-system-architecture)
4. [Hardware Architecture & Pinout Mapping](#4-hardware-architecture--pinout-mapping)
5. [ESP32 Firmware Architecture (`hydrivia.ino`)](#5-esp32-firmware-architecture)
6. [Sensor Subsystems & Calibration Mathematics](#6-sensor-subsystems--calibration-mathematics)
7. [Actuator Subsystems & Hydraulic Circuitry](#7-actuator-subsystems--hydraulic-circuitry)
8. [MQTT Architecture & HiveMQ Cloud TLS](#8-mqtt-architecture--hivemq-cloud-tls)
9. [Complete MQTT Topic Reference](#9-complete-mqtt-topic-reference)
10. [MQTT Payloads Specification](#10-mqtt-payloads-specification)
11. [Irrigation Execution Logic (Sequential FIFO & Dual-Stop)](#11-irrigation-execution-logic)
12. [AI Decision Workflow & FusionAI Integration](#12-ai-decision-workflow--fusionai-integration)
13. [Backend Gateway Architecture (Node.js / Express / Socket.IO)](#13-backend-gateway-architecture)
14. [Database Architecture (Supabase PostgreSQL / Prisma ORM)](#14-database-architecture)
15. [Supabase Configuration & Connection Pooling](#15-supabase-configuration--connection-pooling)
16. [Web Application Architecture (React / Vite / TailwindCSS)](#16-web-application-architecture)
17. [Real-Time On-Demand Sensor Request Engine](#17-real-time-on-demand-sensor-request-engine)
18. [AI Analysis Dashboard & Live Synchronization](#18-ai-analysis-dashboard--live-synchronization)
19. [End-to-End System Data Flow](#19-end-to-end-system-data-flow)
20. [Multi-Tier Safety Interlocks](#20-multi-tier-safety-interlocks)
21. [Error Handling & Fault Recovery](#21-error-handling--fault-recovery)
22. [Installation & Prerequisites](#22-installation--prerequisites)
23. [Configuration & Environment Variables](#23-configuration--environment-variables)
24. [Running the System](#24-running-the-system)
25. [Verification & Testing Suite](#25-verification--testing-suite)
26. [Production Deployment](#26-production-deployment)
27. [Troubleshooting Matrix](#27-troubleshooting-matrix)
28. [Security Model & Hardening](#28-security-model--hardening)
29. [Future Roadmap](#29-future-roadmap)

---

## 1. System Overview & Purpose

**HYDRIVIA** is an enterprise-grade IoT smart irrigation ecosystem designed to optimize agricultural water usage, prevent plant water stress, and protect hydraulic equipment. The platform automates multi-zone irrigation through environmental telemetry, soil moisture analysis, ultrasonic tank level sensing, cloud-based weather forecasts, and autonomous AI reasoning from **FusionAI**.

The system features:
- **Physical Layer**: An ESP32 microcontroller managing analog sensors (capacitive soil probes), digital ultrasonic distance sensing (HC-SR04), I2C atmospheric sensors (BME280), a hardware real-time clock (DS3231 RTC), an electric water pump relay, and 3 independent solenoid valve relays.
- **Communication Layer**: Bi-directional, TLS-encrypted MQTT (MQTTS on port 8883) via HiveMQ Cloud and real-time WebSockets (Socket.IO) bridging firmware to web clients.
- **Backend & Persistence Layer**: A modular Node.js/Express gateway utilizing Prisma ORM with Supabase PostgreSQL, incorporating JWT authentication, automated historical aggregations, CSV reporting, and SoilGrids/Open-Meteo API integrations.
- **Presentation Layer**: A high-density reactive web dashboard built with React, Vite, and TailwindCSS featuring real-time telemetry gauges, interactive 3D digital twin farm visualizer (Three.js/Fiber), AI decision explorer, and an instantaneous hardware emergency stop.

---

## 2. Why Hydrivia Exists

Traditional automated agricultural timers water crops on fixed schedules regardless of actual soil moisture, evaporative demand, or imminent rainfall. This results in:
1. **Severe Water Waste**: Over-irrigation drains reservoirs and inflates pumping costs.
2. **Crop Vulnerability**: Root rot, fungal infections from waterlogged soil, or flower drop due to under-watering during critical growth stages.
3. **Hydraulic Hazards**: Dry-running centrifugal pumps when tanks run low, or pump deadheading (running against closed valves), causing mechanical burnout.

HYDRIVIA resolves these challenges by:
- Operating a **closed-loop feedback system** where watering stops as soon as target soil humidity or programmed volume is reached.
- Running a **sequential FIFO queue** guaranteeing 100% hydraulic pressure (30 L/min) dedicated to one zone at a time.
- Leveraging **FusionAI & Weather Forecasts** to defer irrigation if rain is imminent or atmospheric demand is low.
- Enforcing **hard real-time safety interlocks** in firmware (tank low cutoff, 5-minute pump run limit, zero-valve pump interlock).

---

## 3. Global System Architecture

```mermaid
flowchart TB
    subgraph Edge ["🌿 Edge Layer — ESP32 Physical Station"]
        Sensors["Sensors<br/>- Soil Moisture Zone 1, 2, 3<br/>- Ultrasonic HC-SR04<br/>- BME280 Temp/Hum/Pressure<br/>- DS3231 Hardware RTC"]
        Actuators["Actuators<br/>- Water Pump Relay GPIO 27<br/>- Valve 1 Tomato - GPIO 26<br/>- Valve 2 Mint - GPIO 25<br/>- Valve 3 Onion - GPIO 23"]
        ESP32["ESP32 Microcontroller<br/>- FreeRTOS non-blocking loop<br/>- FIFO Command Queue<br/>- Dual-Stop State Machine<br/>- TLS 1.2 MQTTS Client"]
        Sensors -->|Analog / I2C / Pulse| ESP32
        ESP32 -->|Relay Control| Actuators
    end

    subgraph CloudMQTT ["☁️ Cloud MQTT Broker"]
        HiveMQ["HiveMQ Cloud TLS Port 8883<br/>MQTTS Encrypted Broker"]
    end

    subgraph BackendLayer ["⚙️ Backend & Intelligence Layer"]
        Gateway["Node.js / Express Gateway<br/>- MQTT Service & State Cache<br/>- Socket.IO Real-Time Server<br/>- REST APIs & JWT Auth<br/>- Open-Meteo & SoilGrids APIs"]
        FusionAI["FusionAI / n8n Workflow<br/>- Multi-source RAG<br/>- Crop Stage Reasoning<br/>- Water Budgeting Liters"]
        Supabase[("Supabase PostgreSQL<br/>- Prisma ORM<br/>- Sensor Telemetry & History<br/>- Irrigation Cycles & Alerts<br/>- AI Analysis Records")]
    end

    subgraph FrontendLayer ["💻 Presentation Layer — Web Dashboard"]
        Dashboard["React 18 + Vite Web App<br/>- Real-Time Telemetry & Gauges<br/>- 3D Digital Twin Farm Visualizer<br/>- AI Analysis Review & 1-Click Trigger<br/>- Hardware Emergency Stop Button"]
    end

    ESP32 <==>|MQTTS Telemetry & Commands| HiveMQ
    HiveMQ <==>|MQTT Client Bridge| Gateway
    Gateway <==>|Socket.IO & HTTP REST| Dashboard
    Gateway <==>|Prisma Client SQL| Supabase
    FusionAI -->|POST /api/ai-analysis<br/>Bearer / Header Secret| Gateway
    Gateway -->|HTTP On-Demand Request| FusionAI
```

---

## 4. Hardware Architecture & Pinout Mapping

The physical controller is an **ESP32 DevKit V1 (38-pin)** connected to 5V relay modules (active HIGH), analog soil moisture probes on ADC1 (Wi-Fi safe), HC-SR04 ultrasonic distance sensor, DS3231 I2C RTC, and BME280 I2C sensor.

### Complete GPIO Pinout

| Pin (GPIO) | Hardware Component | Function | Operating Mode / Electrical Specs |
|---|---|---|---|
| **GPIO 14** | HC-SR04 Ultrasonic Trigger | Ultrasonic burst pulse output | `OUTPUT`, 10µs HIGH pulse |
| **GPIO 18** | HC-SR04 Ultrasonic Echo | Ultrasonic echo return timing | `INPUT`, 5V→3.3V voltage divider |
| **GPIO 34** | Soil Sensor 1 (Tomato) | Capacitive moisture reading | `INPUT` (ADC1 Channel 6), 12-bit (0–4095) |
| **GPIO 35** | Soil Sensor 2 (Mint) | Capacitive moisture reading | `INPUT` (ADC1 Channel 7), 12-bit (0–4095) |
| **GPIO 32** | Soil Sensor 3 (Onion) | Capacitive moisture reading | `INPUT` (ADC1 Channel 4), 12-bit (0–4095) |
| **GPIO 27** | Water Pump Relay | Pump power control (30 L/min) | `OUTPUT`, Active HIGH (Optocoupled) |
| **GPIO 26** | Valve 1 Relay (Tomato) | Zone 1 solenoid valve control | `OUTPUT`, Active HIGH |
| **GPIO 25** | Valve 2 Relay (Mint) | Zone 2 solenoid valve control | `OUTPUT`, Active HIGH |
| **GPIO 23** | Valve 3 Relay (Onion) | Zone 3 solenoid valve control | `OUTPUT`, Active HIGH |
| **GPIO 33** | Water Tank Low LED | Local critical water indicator | `OUTPUT`, Active HIGH |
| **GPIO 21** | I2C SDA | Data bus for BME280 & DS3231 | I2C Data (4.7kΩ pull-up to 3.3V) |
| **GPIO 22** | I2C SCL | Clock bus for BME280 & DS3231 | I2C Clock (4.7kΩ pull-up to 3.3V) |

> ⚠️ **ADC Warning**: Analog soil sensors are strictly connected to **ADC1** pins (32, 34, 35). ADC2 pins cannot be read while Wi-Fi is active on the ESP32.

---

## 5. ESP32 Firmware Architecture (`hydrivia.ino`)

The firmware is structured in C++ using Arduino core for ESP32, adhering to a non-blocking asynchronous execution loop (`millis()` timers without `delay()` in `loop()`).

### Core Firmware Modules

1. **Timekeeping Subsystem (`getIsoTimestamp()`, `syncRtcFromNtp()`):**
   - **Tier 1**: Hardware DS3231 RTC over I2C (`RTClib.h`) providing persistent UTC timestamps even after cold power cycles.
   - **Tier 2**: NTP synchronized clock (`pool.ntp.org`, `time.nist.gov`) via `configTime()`.
   - **Tier 3**: Millis uptime fallback (`uptime+XXXXXms`).
2. **Sequential FIFO Queue Ring Buffer (`enqueueIrrigationCommand()`, `dequeueIrrigationCommand()`):**
   - Stores up to `MAX_PENDING_COMMANDS = 8` pending zone commands.
   - Prevents multi-valve simultaneous watering, ensuring pump delivery is focused.
3. **Dual-Stop Irrigation State Machine (`updateIrrigationStateMachine()`, `completeCurrentZone()`):**
   - Evaluates active watering cycle every loop iteration against two independent cutoff conditions:
     1. Delivered volume: `(elapsedMillis / 60000.0) * 30.0 >= targetWateringL`
     2. Soil humidity target: `currentSoilMoisture >= targetSoilMoisturePct`
4. **On-Demand Real-Time Sensor Engine (`handleSensorRequest()`):**
   - Responds to `hydrivia/sensors/request` by sampling all hardware channels immediately and publishing a structured diagnostic payload to `hydrivia/sensors/realtime`.
5. **Periodic Telemetry & Snapshot Engine:**
   - 2-second individual state publications for zones, pump, tank, and environment.
   - 60-second consolidated system snapshot on `hydrivia/snapshot`.

---

## 6. Sensor Subsystems & Calibration Mathematics

### 1. Capacitive Soil Moisture Sensors
- **Raw ADC Input**: 12-bit ADC reading range $[0, 4095]$.
- **Calibration Constants**:
  - `SOIL_DRY_VALUE = 3500` (Sensor exposed to dry air $\rightarrow 0\%$)
  - `SOIL_WET_VALUE = 1500` (Sensor submerged in water $\rightarrow 100\%$)
- **Transfer Function**:
  $$\text{Moisture (\%)} = \text{constrain}\left(\frac{\text{SOIL\_DRY\_VALUE} - \text{ADC\_RAW}}{\text{SOIL\_DRY\_VALUE} - \text{SOIL\_WET\_VALUE}} \times 100.0,\, 0.0,\, 100.0\right)$$

### 2. Ultrasonic Tank Level Sensor (HC-SR04)
- **Physics**: Speed of sound in air $v \approx 343\text{ m/s} = 0.0343\text{ cm/\mu s}$.
- **Distance Calculation**:
  $$\text{Distance (cm)} = \frac{\text{PulseDuration (\mu s)} \times 0.0343}{2}$$
- **Tank Calibration**:
  - `EMPTY_DISTANCE = 180.69 cm` (Tank empty $\rightarrow 0\%$)
  - `FULL_DISTANCE = 1.21 cm` (Tank full $\rightarrow 100\%$)
  - `TANK_CAPACITY_LITERS = 7000.0 L`
- **Percentage & Volume Formulae**:
  $$\text{Level (\%)} = \text{constrain}\left(\frac{180.69 - \text{Distance}}{180.69 - 1.21} \times 100.0,\, 0.0,\, 100.0\right)$$
  $$\text{Volume (Liters)} = \frac{\text{Level (\%)}}{100.0} \times 7000.0$$

### 3. Environmental Sensor (BME280)
- Communicates over I2C at address `0x77`.
- Measures Ambient Temperature (°C), Relative Air Humidity (%RH), and Barometric Pressure (hPa).

---

## 7. Actuator Subsystems & Hydraulic Circuitry

### Water Pump & Solenoid Valves
- **Pump Flow Rate**: $Q = 30.0\text{ Litres/Minute}$ ($0.5\text{ L/s}$).
- **Hydraulic Interlock**:
  - The pump **cannot** run if all 3 zone valves are closed.
  - If a zone transition occurs, the incoming zone valve is opened before the outgoing valve is closed (`isTransitioningZone = true`), preventing pressure spikes.

### Delivered Volume Integration
During active irrigation, delivered water volume is computed in real time:
$$V_{\text{delivered}} (\text{L}) = \left(\frac{t_{\text{current}} - t_{\text{start}}}{60000.0}\right) \times 30.0$$

---

## 8. MQTT Architecture & HiveMQ Cloud TLS

Communication between the ESP32 and the backend is brokered over TLS 1.2 encrypted MQTT:
- **Broker**: HiveMQ Cloud (`*.s1.eu.hivemq.cloud`)
- **Port**: `8883` (MQTTS)
- **Authentication**: Username & Password
- **Root CA**: Let's Encrypt / ISRG Root X1 CA embedded in `hydrivia.ino` (`HIVEMQ_CA_CERT`).
- **Keep-Alive**: 30 seconds
- **Client Buffer**: 2304 bytes

---

## 9. Complete MQTT Topic Reference

| Topic | Direction | Frequency / Trigger | Description |
|---|---|---|---|
| `hydrivia/zones/1/command` | Backend $\rightarrow$ ESP32 | On user or AI trigger | Irrigation command for Zone 1 |
| `hydrivia/zones/2/command` | Backend $\rightarrow$ ESP32 | On user or AI trigger | Irrigation command for Zone 2 |
| `hydrivia/zones/3/command` | Backend $\rightarrow$ ESP32 | On user or AI trigger | Irrigation command for Zone 3 |
| `hydrivia/zones/1/state` | ESP32 $\rightarrow$ Backend | Every 2s / on change | Real-time state of Zone 1 |
| `hydrivia/zones/2/state` | ESP32 $\rightarrow$ Backend | Every 2s / on change | Real-time state of Zone 2 |
| `hydrivia/zones/3/state` | ESP32 $\rightarrow$ Backend | Every 2s / on change | Real-time state of Zone 3 |
| `hydrivia/pump/state` | ESP32 $\rightarrow$ Backend | Every 2s / on change | Pump relay state & flow rate |
| `hydrivia/tank/state` | ESP32 $\rightarrow$ Backend | Every 2s / on change | Water level percentage & volume (L) |
| `hydrivia/environment/state` | ESP32 $\rightarrow$ Backend | Every 2s / on change | Ambient temperature & air humidity |
| `hydrivia/snapshot` | ESP32 $\rightarrow$ Backend | Every 60s | Consolidated full-system snapshot |
| `hydrivia/alerts` | ESP32 $\rightarrow$ Backend | On alarm / event | Emergency stops, low water, cycle completion |
| `hydrivia/sensors/request` | Backend $\rightarrow$ ESP32 | On-demand (AI/User) | Instant sensor capture request |
| `hydrivia/sensors/realtime` | ESP32 $\rightarrow$ Backend | Response to request | Consolidated fresh sensor payload |

---

## 10. MQTT Payloads Specification

### 1. Zone Command (`hydrivia/zones/{1,2,3}/command`)
```json
{
  "wateringL": 50.0,
  "targetSoilMoisturePct": 60.0
}
```

### 2. Zone State (`hydrivia/zones/1/state`)
```json
{
  "zone": 1,
  "plant": "tomato",
  "soil_humidity": 34.2,
  "valve": "ON",
  "watering_active": true,
  "target_liters": 50.0,
  "delivered_liters": 18.5,
  "progress_pct": 37.0,
  "timestamp": "2026-08-24T18:30:00Z"
}
```

### 3. Tank State (`hydrivia/tank/state`)
```json
{
  "water_level": 78.4,
  "volume_liters": 5488.0,
  "capacity_liters": 7000.0,
  "critical": false,
  "low": false,
  "timestamp": "2026-08-24T18:30:00Z"
}
```

### 4. Consolidated 60s Snapshot (`hydrivia/snapshot`)
```json
{
  "device_id": "hydrivia-esp32-01",
  "system": "HYDRIVIA",
  "timestamp": "2026-08-24T18:30:00Z",
  "zones": [
    { "id": 1, "plant": "tomato", "soil_humidity": 34.2, "valve": "ON" },
    { "id": 2, "plant": "mint", "soil_humidity": 55.0, "valve": "OFF" },
    { "id": 3, "plant": "onion", "soil_humidity": 48.1, "valve": "OFF" }
  ],
  "tank": {
    "water_level": 78.4,
    "volume_liters": 5488.0,
    "capacity_liters": 7000.0,
    "critical": false,
    "low": false
  },
  "environment": {
    "temperature": 26.4,
    "air_humidity": 58.2
  },
  "pump": {
    "pump": "ON",
    "flow_rate": 30.0
  },
  "status": {
    "data_valid": true,
    "active_zone": 1,
    "queue_size": 1
  }
}
```

### 5. On-Demand Sensor Request & Response
**Request (`hydrivia/sensors/request`):**
```json
{
  "requestId": "req-1724519400"
}
```

**Response (`hydrivia/sensors/realtime`):**
```json
{
  "requestId": "req-1724519400",
  "timestamp": "2026-08-24T18:30:01Z",
  "deviceId": "hydrivia-esp32-01",
  "zones": {
    "1": { "soilMoisturePct": 34.2, "valveOpen": true },
    "2": { "soilMoisturePct": 55.0, "valveOpen": false },
    "3": { "soilMoisturePct": 48.1, "valveOpen": false }
  },
  "tank": { "waterLevelPct": 78.4, "volumeLiters": 5488.0 },
  "environment": { "temperature": 26.4, "airHumidity": 58.2 },
  "pump": { "active": true },
  "status": "OK"
}
```

---

## 11. Irrigation Execution Logic

```mermaid
stateDiagram-v2
    [*] --> IRRIGATION_IDLE

    IRRIGATION_IDLE --> IRRIGATION_RUNNING : Enqueue Command (Queue > 0)
    
    state IRRIGATION_RUNNING {
        [*] --> OpenValve
        OpenValve --> StartPump : Valve Hardware Open
        StartPump --> MonitorCycle : Pump Running (30 L/min)
        
        state MonitorCycle {
            [*] --> CheckingDualStop
            CheckingDualStop --> TargetReached : Delivered Volume >= Target (L)\nOR\nSoil Moisture >= Target (%)
            CheckingDualStop --> SafetyTripped : Tank < 20%\nOR\nPump Runtime > 5 min\nOR\nEmergency Stop
        }
        
        TargetReached --> CompleteZone : completeCurrentZone()
        SafetyTripped --> EmergencyHalt : emergencyShutdown()
    }
    
    CompleteZone --> CheckQueue
    state CheckQueue <<choice>>
    CheckQueue --> StartNextZone : Queue > 0 (Smooth Transition)
    StartNextZone --> IRRIGATION_RUNNING
    CheckQueue --> StopPump : Queue == 0
    
    StopPump --> IRRIGATION_IDLE
    EmergencyHalt --> IRRIGATION_EMERGENCY
```

### Dual-Stop Rule
Watering terminates on the **first condition met**:
$$\text{STOP} \iff (V_{\text{delivered}} \ge V_{\text{target}}) \quad\lor\quad (\text{Moisture}_{\text{current}} \ge \text{Moisture}_{\text{target}})$$

---

## 12. AI Decision Workflow & FusionAI Integration

HYDRIVIA integrates with **FusionAI / n8n workflows** to provide agronomical reasoning.

```mermaid
sequenceDiagram
    autonumber
    participant Fusion as FusionAI / n8n Agent
    participant Backend as Node.js Gateway (/api/ai-analysis)
    participant DB as Supabase PostgreSQL
    participant MQTT as HiveMQ Cloud
    participant ESP as ESP32 Firmware
    participant UI as React Dashboard

    Fusion->>Backend: POST /api/ai-analysis (with Bearer / Header Secret)
    Note over Backend: 1. Validate decisionStatus<br/>2. Deduplicate via Idempotency-Key / Timestamp<br/>3. Normalize units (mL -> Liters)
    Backend->>DB: prisma.aIAnalysis.create()
    Backend-->>Fusion: 201 Created { success: true, analysisId: "ai-analysis-..." }
    
    UI->>Backend: GET /api/ai-analysis
    Backend->>DB: Fetch analyses (ordered by timestamp desc)
    Backend-->>UI: Return analysis summaries
    
    UI->>Backend: GET /api/ai-analysis/:id
    Backend->>DB: Return full analysis with waterBudget & zoneDecisions (Liters)
    
    opt User Clicks "Appliquer l'arrosage"
        UI->>Backend: POST /api/zones/:id/command { wateringL: 50, targetSoilMoisturePct: 60 }
        Backend->>MQTT: Publish to hydrivia/zones/:id/command
        MQTT->>ESP: Ingest command & enqueue
        ESP->>ESP: Execute sequential irrigation cycle
    end
```

### AI Decision Model Fields (`ai_analyses` table)
- **`waterBudget`** (JSON in Liters): `availableL`, `allocatedL`, `conservedL`, `utilizationPct`, `scarcityLevel`.
- **`weatherAssessment`** (JSON): `nearTermRainExpected`, `meaningfulRainExpectedWithinHours`, `next24HoursRainMm`, `atmosphericDemand`, `summary`.
- **`zoneDecisions`** (JSON Array): `zoneId`, `cropType`, `priorityRank`, `action`, `soilMoistureStatus`, `cropStageAssessment`, `riskLevel`, `irrigationDepthMm`, `wateringL`, `rationale`.

---

## 13. Backend Gateway Architecture

The backend (`backend/src/server.js`) is an ES-Module Node.js application:

```
backend/
├── prisma/
│   └── schema.prisma         # Supabase PostgreSQL schema definition
├── src/
│   ├── config/
│   │   └── index.js          # Centralized configuration & environment loader
│   ├── database/
│   │   └── index.js          # Prisma client instance & initial seeding
│   ├── middleware/
│   │   └── auth.js           # JWT authentication & extraction middleware
│   ├── routes/
│   │   ├── aiAnalysis.js     # FusionAI M2M endpoint & dashboard query APIs
│   │   ├── alerts.js         # Alert querying & resolution
│   │   ├── analytics.js      # Consumption totals & CSV export
│   │   ├── auth.js           # Admin authentication & token generation
│   │   ├── emergency.js      # Emergency shutdown & system resume
│   │   ├── logs.js           # System event logging
│   │   ├── pump.js           # Live pump state
│   │   ├── soil.js           # SoilGrids pedology proxy & advice
│   │   ├── tank.js           # Water tank state & history
│   │   ├── weather.js        # Open-Meteo weather forecast proxy & caching
│   │   └── zones.js          # Live zones, history, & command dispatch
│   ├── services/
│   │   ├── analyticsService.js # Consumption aggregations (Day/Week/Month)
│   │   ├── mqttService.js      # HiveMQ TLS client, live state cache, DB persist
│   │   ├── socketService.js    # Socket.IO broadcasting & telemetry pushes
│   │   ├── soilService.js      # ISRIC SoilGrids REST client with 24h caching
│   │   └── weatherService.js   # Open-Meteo REST client with 15m caching
│   └── server.js             # HTTP server bootstrap & service initializer
└── package.json
```

### Complete REST API Route Reference

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/health` | Public | System status, database type, and environment |
| `POST` | `/api/auth/login` | Public | Admin login, returns JWT token |
| `GET` | `/api/auth/me` | JWT | Get current authenticated user profile |
| `GET` | `/api/zones` | JWT | Live state of all 3 zones & pump |
| `GET` | `/api/zones/:id` | JWT | Specific zone telemetry, 24h history, & cycle logs |
| `POST` | `/api/zones/:id/command` | JWT | Dispatch irrigation command (`wateringL`, `targetSoilMoisturePct`) |
| `POST` | `/api/zones/:id/toggle` | JWT | Manual ON/OFF toggle for valve |
| `GET` | `/api/tank` | JWT | Live tank volume, percentage, and history (`?period=24h\|7d\|30d`) |
| `GET` | `/api/pump` | JWT | Live pump status and open valve count |
| `GET` | `/api/analytics/consumption` | JWT | Aggregated consumption metrics (today, week, month, by zone) |
| `GET` | `/api/analytics/export-csv` | JWT | Download complete water consumption log in CSV format |
| `GET` | `/api/weather` | JWT | Open-Meteo weather forecast, rain probability, ET0 demand |
| `GET` | `/api/soil` | JWT | ISRIC SoilGrids texture (clay/sand/silt), pH, organic matter |
| `GET` | `/api/alerts` | JWT | List system alerts |
| `POST` | `/api/alerts/:id/resolve` | JWT | Mark an alert as resolved |
| `GET` | `/api/logs` | JWT | Audit log of system events |
| `POST` | `/api/emergency/stop` | JWT | Trigger immediate hardware & software emergency stop |
| `POST` | `/api/emergency/resume` | JWT | Resume normal operation following emergency stop |
| `GET` | `/api/emergency/status` | JWT | Check emergency status |
| `POST` | `/api/ai-analysis` | Secret | Ingest new AI decision from FusionAI (M2M authentication) |
| `GET` | `/api/ai-analysis` | JWT | Paginated list of AI analysis reports |
| `GET` | `/api/ai-analysis/:id` | JWT | Complete detail of a single AI analysis report |

---

## 14. Database Architecture

The system uses **Supabase PostgreSQL** managed via **Prisma ORM (v5.22.0)**.

### Entity-Relationship Model

```mermaid
erDiagram
    users {
        int id PK
        string email UK
        string password_hash
        string role
        timestamp created_at
    }

    sensor_readings {
        bigint id PK
        timestamp timestamp
        float zone1_soil
        float zone2_soil
        float zone3_soil
        float water_level
        float volume_liters
        float temperature
        float air_humidity
        boolean pump_running
        boolean valve1
        boolean valve2
        boolean valve3
    }

    irrigation_cycles {
        int id PK
        int zone_id
        string plant
        float requested_liters
        float target_soil_moisture
        float delivered_liters
        timestamp start_time
        timestamp end_time
        string status
        string reason
    }

    alerts {
        int id PK
        string type
        string severity
        string message
        bigint timestamp_ms
        timestamp created_at
    }

    system_logs {
        int id PK
        string event_type
        string description
        string user_email
        timestamp created_at
    }

    settings {
        string key PK
        string value
    }

    ai_analyses {
        string id PK
        timestamp timestamp
        string decision_status
        int valid_for_minutes
        float confidence_pct
        int next_evaluation_minutes
        json water_budget
        json weather_assessment
        json zone_decisions
        string decision_summary
        json warnings
        timestamp created_at
    }
```

---

## 15. Supabase Configuration & Connection Pooling

In `backend/prisma/schema.prisma`:
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```
- **`DATABASE_URL`**: Supabase Supavisor Session Pooler (port `5432` / `6543`) with `?sslmode=require` for backend queries.
- **`DIRECT_URL`**: Direct PostgreSQL connection to handle Prisma schema migrations and DDL operations.

---

## 16. Web Application Architecture

The frontend is a single-page React 18 application built with Vite and TailwindCSS:

```
frontend/
├── src/
│   ├── components/
│   │   ├── 3d/
│   │   │   ├── Bottom3DKPIBar.jsx    # Real-time telemetry summary below 3D scene
│   │   │   ├── FarmCanvas.jsx        # Three.js 3D digital twin farm visualizer
│   │   │   ├── Pump3DModal.jsx       # Interactive 3D pump detail & manual trigger
│   │   │   ├── Right3DPanel.jsx      # Telemetry inspection drawer in 3D mode
│   │   │   ├── WaterTank3DModal.jsx  # Interactive 3D water reservoir inspector
│   │   │   ├── Zone3DDrawer.jsx      # Zone inspection drawer with soil graphs
│   │   │   └── farm3dModels.js       # Procedural 3D meshes (crops, valves, pipes)
│   │   ├── common/
│   │   │   ├── CircularGauge.jsx     # High-precision SVG circular gauge
│   │   │   ├── StatCard.jsx          # KPI card with trends & icons
│   │   │   └── StatusBadge.jsx       # Color-coded operational status pill
│   │   └── layout/
│   │       ├── EmergencyModal.jsx    # Full-screen critical shutdown confirmation
│   │       ├── Header.jsx            # Live MQTT/WS status, site name, emergency button
│   │       └── Sidebar.jsx           # Dark navigation bar with 11 primary views
│   ├── context/
│   │   ├── AuthContext.jsx           # JWT session state & login/logout handlers
│   │   └── SocketContext.jsx         # Socket.IO state, live telemetry cache, quick actions
│   ├── pages/
│   │   ├── AIAnalysisPage.jsx        # AI recommendation explorer & 1-click execution
│   │   ├── AlertsPage.jsx            # Real-time & historical alert triage
│   │   ├── ConsumptionPage.jsx       # Water consumption analytics, charts, & CSV export
│   │   ├── DashboardOverview.jsx     # Executive KPI summary & live zone cards
│   │   ├── Login.jsx                 # Cyberpunk-styled admin login view
│   │   ├── LogsPage.jsx              # System audit events & cycle histories
│   │   ├── SettingsPage.jsx          # Farm site configuration & parameters
│   │   ├── SoilPage.jsx              # Pedology analysis, soil texture, & drainage advice
│   │   ├── TankPage.jsx              # Ultrasonic reservoir depth & consumption trends
│   │   ├── Visualisation3D.jsx       # Interactive 3D digital twin interface
│   │   ├── WeatherPage.jsx           # Open-Meteo 7-day forecast & rain risk
│   │   └── ZonesPage.jsx             # Dedicated multi-zone command & moisture curves
│   ├── services/
│   │   └── api.js                    # Axios instance with JWT interceptor
│   ├── utils/
│   │   └── cn.js                     # Tailwind class merging utility
│   ├── App.jsx                       # Navigation router & authentication boundary
│   └── main.jsx                      # React DOM root mounting point
```

---

## 17. Real-Time On-Demand Sensor Request Engine

When an AI evaluation or high-precision action is requested, the system bypasses the 2-second telemetry cache and triggers an immediate physical hardware sampling.

```mermaid
sequenceDiagram
    autonumber
    participant UI as Dashboard / AI Service
    participant Gateway as Backend Gateway
    participant HiveMQ as HiveMQ Cloud
    participant ESP as ESP32 Firmware

    UI->>Gateway: POST /api/zones/request-sensors (or AI hook)
    Gateway->>HiveMQ: Publish hydrivia/sensors/request {"requestId": "req-98124"}
    HiveMQ->>ESP: Deliver on-demand request
    Note over ESP: 1. Trigger HC-SR04 pulse (3 attempts)<br/>2. Sample ADC1 soil probes (Z1, Z2, Z3)<br/>3. Read BME280 temperature & humidity
    ESP->>HiveMQ: Publish hydrivia/sensors/realtime (retained=false)
    HiveMQ->>Gateway: Ingest fresh diagnostic payload
    Gateway->>UI: Broadcast fresh data via WebSocket (telemetry:fresh)
```

---

## 18. AI Analysis Dashboard & Live Synchronization

The **AI Analysis Page** (`frontend/src/pages/AIAnalysisPage.jsx`) provides executive-grade agronomic decision exploration:
1. **Decision History List**: Color-coded badges (`IRRIGATION REQUISE`, `DIFFÉRÉ`, `PAS D'IRRIGATION`), confidence index percentage, validity duration, and summary.
2. **Water Budget Panel**: Available, allocated, and conserved water all standardized in **Litres**.
3. **Live Zone Synchronization**: Correlates the AI's evaluated soil status with the **real-time live sensor reading** (`telemetry.zones[X].soil_humidity`) and live valve state.
4. **1-Click Recommendation Trigger**: A direct action button allowing the operator to execute the AI recommendation immediately with one click.

---

## 19. End-to-End System Data Flow

```mermaid
flowchart TD
    subgraph DataCollection ["1. Telemetry Ingestion"]
        S1["Soil Probes (ADC1)"] --> F1["ESP32 Firmware"]
        S2["HC-SR04 Tank Sensor"] --> F1
        S3["BME280 Environment"] --> F1
        S4["DS3231 RTC Time"] --> F1
    end

    subgraph Transport ["2. Encrypted Transport"]
        F1 -->|MQTTS Port 8883| M1["HiveMQ Cloud Broker"]
        M1 -->|MQTT Subscription| B1["Node.js Gateway"]
    end

    subgraph StateAndDB ["3. State Processing & Persistence"]
        B1 -->|Update Cache| C1["Live Memory State Cache"]
        B1 -->|Prisma ORM| D1[("Supabase PostgreSQL")]
        D1 -->|Store| D2["sensor_readings"]
        D1 -->|Store| D3["irrigation_cycles"]
        D1 -->|Store| D4["alerts"]
    end

    subgraph RealTimeDistribution ["4. Real-Time Distribution"]
        B1 -->|WebSocket Broadcast| W1["Socket.IO Server"]
        W1 -->|Socket Event| U1["React Web Dashboard"]
    end

    subgraph ExternalIntelligence ["5. External APIs & AI"]
        API1["Open-Meteo API"] -->|15m Cache| B1
        API2["ISRIC SoilGrids API"] -->|24h Cache| B1
        AI1["FusionAI Agent"] <-->|REST M2M| B1
    end
```

---

## 20. Multi-Tier Safety Interlocks

HYDRIVIA implements safety interlocks at both hardware and software levels:

1. **Low Tank Emergency Cutoff**:
   - If water level drops below `WATER_LEVEL_CRITICAL_PCT = 20.0%`, the ESP32 immediately turns off the pump, closes all valves, activates the local red LED (`PIN_LED_LOW`), and publishes a `tank_critical` alert.
2. **Pump Runtime Hard Limit**:
   - `PUMP_MAX_RUNTIME_MS = 300,000 ms` (5 minutes). If the pump runs continuously past 5 minutes, it is automatically terminated.
3. **Zero-Valve Interlock**:
   - The pump is never permitted to run against closed valves (deadheading). If all valves close, the pump relay cuts out immediately.
4. **Global Software Emergency Stop**:
   - Clicking the emergency button on the dashboard triggers `POST /api/emergency/stop`, which publishes a shutdown command, cuts all relays, sets the backend state to `EMERGENCY_STOPPED`, and blocks all incoming commands until manual reset.

---

## 21. Error Handling & Fault Recovery

| Failure Mode | Detection Mechanism | Automated Recovery Action |
|---|---|---|
| **Wi-Fi Disconnected** | `WiFi.status() != WL_CONNECTED` | ESP32 enters reconnect loop while preserving ongoing timer safety |
| **MQTT Broker Disconnected** | `!mqttClient.connected()` | Reconnection attempted every 5 seconds (`MQTT_RETRY_INTERVAL_MS`) |
| **BME280 I2C Failure** | `bme.begin()` fails or returns `NaN` | Returns safe fallback (0.0°C), logs warning, continues soil & pump operations |
| **Ultrasonic Glitch / Echo Loss** | `pulseIn()` timeout (25 ms) | Averages over 3 burst attempts; keeps previous valid level if all fail |
| **Database Pooler Timeout** | Prisma query exception | Backend logs error, serves live state from in-memory cache, retries DB connection |
| **Command Queue Full** | `queueCount >= 8` | Rejects command, publishes high-severity alert to `hydrivia/alerts` |

---

## 22. Installation & Prerequisites

### Hardware Requirements
- ESP32 Development Board (NodeMCU ESP32 / DevKit V1)
- 3x Capacitive Soil Moisture Probes (v1.2 or v2.0)
- 1x HC-SR04 Ultrasonic Distance Sensor
- 1x BME280 I2C Sensor Module
- 1x DS3231 I2C RTC Module + CR2032 Coin Cell
- 1x 4-Channel 5V Relay Module (Optocoupled)
- 1x 12V Centrifugal Water Pump (or 220V with contactor)
- 3x 12V/24V Solenoid Water Valves
- External 12V 5A DC Power Supply & 5V Step-Down Converter

### Software Requirements
- **Node.js**: v18.0.0 or higher (v22.x recommended)
- **npm**: v9.x or higher
- **Arduino IDE** or **PlatformIO** (with ESP32 board support v2.0.0+)
- **Git**

### Arduino IDE Libraries Required
- `Adafruit BME280 Library` (by Adafruit)
- `Adafruit Unified Sensor` (by Adafruit)
- `ArduinoJson` (v6.x by Benoît Blanchon)
- `PubSubClient` (by Nick O'Leary)
- `RTClib` (by Adafruit)

---

## 23. Configuration & Environment Variables

### Backend Configuration (`backend/.env`)
```ini
# Server & Environment
PORT=5000
NODE_ENV=development
JWT_SECRET=your_super_secret_jwt_key_2026

# FusionAI / n8n Webhook M2M Secret
FUSIONAI_WEBHOOK_SECRET=hydrivia_fusionai_secret_token_2026
AI_WORKFLOW_SECRET=hydrivia_fusionai_secret_token_2026

# Supabase PostgreSQL Database URLs
DATABASE_URL="postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?sslmode=require"
DIRECT_URL="postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres?sslmode=require"

# Default Administrator Credentials
ADMIN_EMAIL=admin@gmail.com
ADMIN_PASSWORD=AZERTY12345

# HiveMQ Cloud TLS MQTT Broker
MQTT_SERVER=your_instance_id.s1.eu.hivemq.cloud
MQTT_PORT=8883
MQTT_PROTOCOL=mqtts
MQTT_USERNAME=your_mqtt_username
MQTT_PASSWORD=your_mqtt_password
MQTT_CLIENT_ID=hydrivia-backend-gateway
MQTT_SIMULATE=false

# Farm Geographic Location (for Open-Meteo & SoilGrids)
SITE_NAME="Station Agricole HYDRIVIA - Parcelle 1"
SITE_LATITUDE=33.5731
SITE_LONGITUDE=-7.5898
```

### Firmware Secrets (`secrets.h`)
```cpp
#ifndef SECRETS_H
#define SECRETS_H

#define WIFI_SSID "Your_WiFi_Network"
#define WIFI_PASSWORD "Your_WiFi_Password"

#define MQTT_SERVER "your_instance_id.s1.eu.hivemq.cloud"
#define MQTT_PORT 8883
#define MQTT_USERNAME "your_mqtt_username"
#define MQTT_PASSWORD "your_mqtt_password"

#endif
```

---

## 24. Running the System

### 1. Install All Dependencies
From the repository root:
```bash
npm run install:all
```

### 2. Synchronize Supabase Schema
```bash
npm run prisma:generate
npm run prisma:push
```

### 3. Launch Development Mode (Backend + Frontend Concurrently)
```bash
npm run dev
```
- **Backend API**: `http://localhost:5000` (Health Check: `http://localhost:5000/api/health`)
- **Web Dashboard**: `http://localhost:3000`

### 4. Default Login Credentials
- **Email**: `admin@gmail.com`
- **Password**: `AZERTY12345`

---

## 25. Verification & Testing Suite

Test scripts are located in `scratch/`:

1. **Verify Supabase Database Connection & Models**:
   ```bash
   node scratch/check_supabase.js
   ```
2. **Verify All REST Endpoints**:
   ```bash
   node scratch/test_all_endpoints.js
   ```
3. **Verify AI Analysis Ingestion & Parsing**:
   ```bash
   node scratch/test_ai_analysis.js
   ```
4. **Build Frontend Bundle**:
   ```bash
   npm run build:frontend
   ```

---

## 26. Production Deployment

### Backend Deployment (Docker / VPS / Render / Railway)
- Run `npm run start:backend` with `NODE_ENV=production`.
- Expose port `5000` behind a reverse proxy (Nginx or Caddy) terminating SSL.

### Frontend Deployment (Vercel / Cloudflare Pages / Nginx)
- Run `npm run build:frontend` to output optimized static assets into `frontend/dist/`.
- Configure client routing rewrites to point to `/index.html`.

---

## 27. Troubleshooting Matrix

| Symptom | Probable Cause | Corrective Action |
|---|---|---|
| **ESP32 keeps reconnecting to MQTT (code -2)** | Incorrect TLS CA or credentials | Check `secrets.h` username/password and ensure NTP clock is synced |
| **Soil Moisture reads 0% or 100% constant** | Sensor connected to ADC2 or unplugged | Ensure probe is on GPIO 32, 34, or 35 (ADC1); check 3.3V power |
| **Ultrasonic Distance reads 0 cm** | HC-SR04 trigger/echo pin reversal | Verify Trig $\rightarrow$ GPIO 14 and Echo $\rightarrow$ GPIO 18 (with divider) |
| **Prisma query timeout on Supabase** | Session pooler port misconfigured | Use port `6543` for `DATABASE_URL` with `?sslmode=require` |
| **AI analysis cards show 0 L** | Incoming data using legacy mL keys | Backend `normalizeMlToLiters()` automatically converts; verify UI uses `wateringL` |
| **Pump doesn't start on command** | Critical tank water level (<20%) | Refill tank or verify ultrasonic calibration in `hydrivia.ino` |

---

## 28. Security Model & Hardening

1. **MQTTS TLS 1.2 Encryption**: All telemetry and actuator commands traverse public networks wrapped in TLS encryption.
2. **M2M Secret Header Authentication**: Machine-to-machine AI webhooks require `x-fusionai-secret` or `Authorization: Bearer <token>`.
3. **JWT Authentication**: Web dashboard API access requires signed JSON Web Tokens (HMAC-SHA256).
4. **SQL Injection Immunity**: All database interactions use parameterized queries generated by Prisma ORM.
5. **Cross-Origin Resource Sharing (CORS)**: Strict origin control in production deployments.

---

## 29. Future Roadmap

- [ ] **LoRaWAN Gateway Fallback**: Long-range telemetry backup when Wi-Fi coverage is unavailable.
- [ ] **Edge ML on ESP32**: Micro-TensorFlow inference for localized soil water retention prediction.
- [ ] **Solar MPPT Telemetry**: Battery voltage and solar charging monitoring integration.
- [ ] **Fertigation Proportioning**: Second relay control for automated liquid nutrient injection.

---

*HYDRIVIA — Engineering Intelligent Irrigation for Sustainable Agriculture.*
