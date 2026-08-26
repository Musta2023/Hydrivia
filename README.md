# Hydrivia

[![CI](https://github.com/Musta2023/Hydrivia/actions/workflows/ci.yml/badge.svg)](https://github.com/Musta2023/Hydrivia/actions/workflows/ci.yml)

Smart IoT precision irrigation and digital twin platform combining ESP32 edge telemetry, MQTT transport, AI-driven agro-climatic analysis, and real-time web monitoring.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Screenshots](#screenshots)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Database Setup](#database-setup)
  - [Environment Variables](#environment-variables)
  - [Running the Application](#running-the-application)
  - [Flashing the ESP32 Firmware](#flashing-the-esp32-firmware)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
- [Roles & Permissions](#roles--permissions)
- [MQTT Topics](#mqtt-topics)
- [Hardware & GPIO Pin Mapping](#hardware--gpio-pin-mapping)
- [Database Schema](#database-schema)
- [Development](#development)
  - [Running Tests](#running-tests)
  - [Database Migrations](#database-migrations)
  - [CI/CD Pipeline & GitHub Secrets](#cicd-pipeline--github-secrets)
- [Deployment](#deployment)
- [Security Notes](#security-notes)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

Hydrivia is an autonomous precision irrigation platform designed to prevent crop water stress and optimize water usage across agricultural parcels. An ESP32 microcontroller collects real-time capacitive soil moisture, ultrasonic tank volume, and atmospheric data, streaming telemetry over TLS-encrypted MQTT (QoS 1). External AI workflows ( FusionAI) evaluate soil and weather conditions to generate targeted irrigation recommendations, while a Node.js/Express gateway synchronizes state with a PostgreSQL database and exposes real-time dashboards via WebSockets and React.

---

## Architecture

```mermaid
flowchart TB
    subgraph Edge ["🌿 ESP32 Edge Device (hydrivia-esp32-01)"]
        Sensors["Sensors: Soil Moisture (Z1-Z3), HC-SR04 Tank, BME280, RTC DS3231"]
        Actuators["Actuators: Pump Relay (GPIO 27), Valves (GPIO 26, 25, 23)"]
        Firmware["Firmware (hydrivia.ino)<br/>- Non-blocking loop & MQTT QoS 1 client<br/>- FIFO sequential command queue<br/>- Dual-condition auto shutoff & safety interlocks"]
        Sensors --> Firmware
        Firmware --> Actuators
    end

    subgraph Broker ["☁️ MQTT Broker (HiveMQ Cloud TLS)"]
        MQTTBroker["HiveMQ Cloud (Port 8883 / TLS 1.2)<br/>Topics: hydrivia/zones/*, hydrivia/pump/*, hydrivia/tank/*, etc."]
    end

    subgraph AIWorkflow ["🧠 AI Decision Engine"]
        FusionAI["FusionAI<br/>- Agro-climatic analysis<br/>- Target water budget calculation"]
    end

    subgraph Backend ["⚙️ Backend Gateway (Node.js / Express)"]
        ExpressApp["Express.js Server<br/>- MQTT Bridge & State Cache<br/>- Socket.IO Real-Time Emitter<br/>- REST API & JWT / RBAC Middleware<br/>- Weather & Soil External API Adapters"]
        Database[("Supabase PostgreSQL<br/>- Prisma ORM<br/>- Users, Readings, Cycles, Alerts, Logs")]
        ExpressApp <--> Database
    end

    subgraph Frontend ["💻 Web Dashboard (React 18 / Vite)"]
        ReactApp["React Application<br/>- Real-time gauges & telemetry<br/>- Interactive 3D Digital Twin (Three.js)<br/>- AI Analysis & 1-Click Execution<br/>- User Management & Emergency Controls"]
    end

    Firmware <==>|"MQTT QoS 1 (TLS)"| MQTTBroker
    MQTTBroker <==>|"MQTT Subscriber / Publisher"| ExpressApp
    FusionAI -->|"POST /api/ai-analysis (M2M Secret)"| ExpressApp
    ExpressApp <==>|"REST API / WebSockets (Socket.IO)"| ReactApp
```

- **ESP32 Edge Device**: Gathers sensor metrics, executes FIFO irrigation queues, controls hydraulic relays, and publishes QoS 1 telemetry.
- **MQTT Broker**: Relays encrypted messages between edge hardware and cloud services over TLS.
- **AI Decision Engine**: Ingests field conditions, calculates plant-specific water budgets, and posts decisions via secure webhook.
- **Backend Gateway**: Coordinates database persistence, authenticates users, enforces RBAC, and streams live state changes to the UI.
- **Frontend Dashboard**: Provides real-time telemetry visualization, 3D agricultural layout, historical charts, and actuator controls.

---

## Features

- **Real-Time Telemetry & Monitoring**: Live soil moisture per zone, water tank volume, temperature, humidity, and valve/pump statuses over WebSockets.
- **Sequential FIFO Irrigation Queue**: Queues multi-zone irrigation requests to maintain 100% hydraulic pressure (30 L/min) without pressure drop.
- **Dual-Condition Irrigation Cutoff**: Automatically halts watering when either the target volume in liters OR the target soil moisture percentage is reached.
- **AI Agro-Climatic Ingestion**: Ingests automated agronomic analyses from external AI pipelines (`POST /api/ai-analysis`) with 1-click execution.
- **Role-Based Access Control (RBAC)**: Strict separation between `ADMIN` (full control, manual override, user management) and `OPERATOR` (read-only monitoring with PII-redacted audit logs).
- **Interactive 3D Digital Twin**: WebGL/Three.js rendering of the farm parcel, tank level, valves, and water spray animations.
- **Multi-Level Safety Interlocks**: Automatic pump shutdown on critical tank level (< 20%), 5-minute maximum continuous pump runtime limit, and zero-valve closure interlock.
- **On-Demand Sensor Refresh**: Real-time request/response round-trip mechanism (`hydrivia/sensors/request` $\rightarrow$ `hydrivia/sensors/realtime`) bypassing periodic polling intervals.

---

## Tech Stack

| Layer | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | React | `^18.3.1` | Component-based interactive user interface |
| **Frontend Bundler** | Vite | `^6.1.0` | Fast development server and production bundler |
| **Styling** | TailwindCSS | `^3.4.17` | Utility-first responsive styling and animations |
| **3D Rendering** | Three.js | `^0.185.1` | WebGL 3D farm digital twin visualization |
| **Charts** | Recharts | `^2.15.1` | Historical consumption and sensor telemetry graphs |
| **Real-Time Client** | Socket.IO Client | `^4.8.1` | WebSocket connection for real-time frontend updates |
| **Backend Runtime** | Node.js (ES Modules) | `>=18` | Server-side JavaScript execution environment |
| **Backend Framework** | Express | `^4.21.2` | REST API routing and middleware framework |
| **ORM** | Prisma | `^5.22.0` | Type-safe database schema modeling and queries |
| **Database** | PostgreSQL (Supabase) | `15+` | Relational database persistence |
| **Real-Time Server** | Socket.IO | `^4.8.1` | WebSocket server for streaming MQTT state to browsers |
| **MQTT Client (Node)** | MQTT.js | `^5.10.3` | Backend broker client for subscribing and publishing |
| **Authentication** | JSON Web Tokens (JWT) / bcryptjs | `^9.0.2` / `^2.4.3` | Cryptographic token auth and password hashing |
| **Edge Firmware** | C++ / Arduino Framework (ESP32) | — | Microcontroller control loop and sensor reading |
| **MQTT Client (ESP32)**| 256dpi/MQTT (`MQTT.h`) | `^2.5.2` | QoS 1 TLS MQTT publishing and subscription |
| **JSON Parser (ESP32)** | ArduinoJson | `^6.21.3` | Embedded JSON serialization and deserialization |

---

## Screenshots

<!-- TODO: add screenshots -->

---

## Getting Started

### Prerequisites

- **Node.js**: `v18.0.0` or higher and `npm` `v9.0.0` or higher
- **PostgreSQL**: Accessible PostgreSQL instance (e.g. Supabase or local PostgreSQL `15+`)
- **MQTT Broker**: HiveMQ Cloud or Mosquitto instance supporting TLS (Port 8883)
- **Arduino IDE / PlatformIO**: For compiling and flashing the ESP32 firmware

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Musta2023/Hydrivia.git
   cd Hydrivia
   ```

2. **Install all dependencies (root, backend, and frontend):**
   ```bash
   npm run install:all
   ```

### Database Setup

1. **Configure backend `.env`:**
   Copy the template and fill in your PostgreSQL connection string:
   ```bash
   cp backend/.env.example backend/.env
   ```

2. **Generate the Prisma client and push schema to database:**
   ```bash
   npm run prisma:generate
   npm run prisma:push
   ```

3. **Verify/Seed Default Admin Account:**
   The backend automatically provisions the default administrator account on first boot (defined by `ADMIN_EMAIL` and `ADMIN_PASSWORD`).

### Environment Variables

All backend configuration variables are loaded from `backend/.env`:

| Variable | Required | Description | Example Value |
| :--- | :---: | :--- | :--- |
| `PORT` | Optional | Backend API port (defaults to `5000`) | `5000` |
| `NODE_ENV` | Optional | Application runtime environment | `development` |
| `DATABASE_URL` | **Required** | PostgreSQL connection string (Transaction pooler) | `postgresql://postgres.[REF]:[PASS]@[HOST]:6543/postgres?sslmode=require&pgbouncer=true` |
| `DIRECT_URL` | Optional | Direct PostgreSQL connection string (for migrations) | `postgresql://postgres.[REF]:[PASS]@[HOST]:5432/postgres?sslmode=require` |
| `JWT_SECRET` | **Required** | Secret key for signing user authentication JWTs | `your_super_secret_jwt_key_here` |
| `FUSIONAI_WEBHOOK_SECRET` | **Required** | Shared secret token for M2M AI analysis ingest | `your_fusionai_secret_token_here` |
| `ADMIN_EMAIL` | Optional | Initial seeded administrator email | `admin@gmail.com` |
| `ADMIN_PASSWORD` | Optional | Initial seeded administrator password | `your_secure_admin_password` |
| `MQTT_SERVER` | **Required** | Hostname of the MQTT broker | `your_cluster.s1.eu.hivemq.cloud` |
| `MQTT_PORT` | Optional | Port for the MQTT broker (defaults to `8883`) | `8883` |
| `MQTT_PROTOCOL` | Optional | Protocol for MQTT connection (`mqtts` / `mqtt`) | `mqtts` |
| `MQTT_USERNAME` | Optional | MQTT authentication username | `your_mqtt_username` |
| `MQTT_PASSWORD` | Optional | MQTT authentication password | `your_mqtt_password` |
| `MQTT_CLIENT_ID` | Optional | Client identifier for backend MQTT connection | `hydrivia-backend-gateway` |
| `MQTT_SIMULATE` | Optional | Set to `true` to simulate IoT telemetry if broker offline | `false` |
| `SITE_NAME` | Optional | Description of the agricultural site | `Station Agricole HYDRIVIA - Parcelle 1` |
| `SITE_LATITUDE` | Optional | Latitude coordinate for Open-Meteo & SoilGrids | `33.5731` |
| `SITE_LONGITUDE` | Optional | Longitude coordinate for Open-Meteo & SoilGrids | `-7.5898` |

### Running the Application

- **Run both backend and frontend concurrently (Development mode):**
  ```bash
  npm run dev
  ```
  - Backend Gateway: `http://localhost:5000`
  - Frontend Web App: `http://localhost:5173`

- **Run backend only:**
  ```bash
  npm run dev:backend
  ```

- **Run frontend only:**
  ```bash
  npm run dev:frontend
  ```

- **Build frontend for production:**
  ```bash
  npm run build
  ```

### Flashing the ESP32 Firmware

1. Open [hydrivia.ino](file:///c:/Users/DELL/Desktop/IoTGen/hydrivia/hydrivia.ino) in Arduino IDE or PlatformIO.
2. Create/edit `secrets.h` in the same directory as `hydrivia.ino`:
   ```cpp
   #ifndef SECRETS_H
   #define SECRETS_H

   #define WIFI_SSID "Your_WiFi_SSID"
   #define WIFI_PASSWORD "Your_WiFi_Password"

   #define MQTT_SERVER "your_cluster.s1.eu.hivemq.cloud"
   #define MQTT_PORT 8883
   #define MQTT_USERNAME "your_mqtt_username"
   #define MQTT_PASSWORD "your_mqtt_password"

   #endif
   ```
3. Install the required Arduino libraries via Library Manager:
   - **`MQTT`** by *Joel Gähwiler (256dpi)* (`^2.5.2`)
   - **`ArduinoJson`** by *Benoît Blanchon* (`^6.21.3`)
   - **`Adafruit BME280 Library`** (`^2.2.4`)
   - **`Adafruit Unified Sensor`**
   - **`RTClib`** by *Adafruit* (`^2.1.3`)
4. Select board **ESP32 Dev Module**, choose your serial COM port, and click **Upload**.

---

## Project Structure

```text
hydrivia/
├── backend/                        # Node.js Express REST API & MQTT Gateway
│   ├── prisma/
│   │   └── schema.prisma           # Prisma data models & PostgreSQL enum definitions
│   ├── src/
│   │   ├── config/                 # Environment & site configuration loader
│   │   ├── database/               # Prisma client instance & initial admin seeder
│   │   ├── middleware/             # authMiddleware (JWT) & requireRole (RBAC)
│   │   ├── routes/                 # Express route handlers
│   │   │   ├── aiAnalysis.js       # AI analysis ingest & retrieval endpoints
│   │   │   ├── alerts.js           # Alert listing & acknowledge/resolve endpoints
│   │   │   ├── analytics.js        # Water consumption stats & CSV export
│   │   │   ├── auth.js             # User login, profile, & self password change
│   │   │   ├── emergency.js        # Hardware Emergency Stop & resume endpoints
│   │   │   ├── logs.js             # Audit trail retrieval with operator PII redaction
│   │   │   ├── pump.js             # Real-time pump state endpoint
│   │   │   ├── soil.js             # SoilGrids REST integration adapter
│   │   │   ├── tank.js             # Water tank state & capacity endpoint
│   │   │   ├── users.js            # User management CRUD (Admin only)
│   │   │   ├── weather.js          # Open-Meteo weather forecast adapter
│   │   │   └── zones.js            # Zone list, details, commands, & valve toggles
│   │   ├── services/               # MQTT gateway, Socket.IO, & alert services
│   │   └── server.js               # Express application bootstrap & route mounting
│   ├── .env.example                # Backend environment variable template
│   ├── package.json                # Backend dependencies & npm scripts
│   └── verify_rbac_tests.js        # Automated end-to-end RBAC test suite
├── frontend/                       # React 18 / Vite Web Dashboard
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/             # Header, Sidebar, & EmergencyModal components
│   │   │   └── ...                 # UI charts, telemetry cards, & modal dialogs
│   │   ├── context/
│   │   │   └── AuthContext.jsx     # Global JWT auth & role permission state
│   │   ├── pages/
│   │   │   ├── DashboardOverview.jsx # Main live telemetry dashboard
│   │   │   ├── ZonesPage.jsx       # Zone cards, custom watering form, & toggle
│   │   │   ├── Visualisation3D.jsx # 3D WebGL Digital Twin scene
│   │   │   ├── AIAnalysisPage.jsx  # AI decisions list & 1-click execution
│   │   │   ├── AnalyticsPage.jsx   # Historical charts & CSV export
│   │   │   ├── AlertsPage.jsx      # Centralized alert logs & management
│   │   │   └── SettingsPage.jsx    # User management CRUD & password updater
│   │   ├── services/
│   │   │   ├── api.js              # Axios instance with JWT interceptor
│   │   │   └── socket.js           # Socket.IO client initialization
│   │   ├── App.jsx                 # Client-side routing & protected routes
│   │   ├── main.jsx                # React DOM entry point
│   │   └── index.css               # Tailwind CSS & custom design tokens
│   ├── package.json                # Frontend dependencies & scripts
│   └── vite.config.js              # Vite bundler & API proxy configuration
├── hydrivia.ino                    # ESP32 C++ firmware (Sensors, Relays, MQTT QoS 1)
├── secrets.h                       # ESP32 local Wi-Fi & MQTT credentials (git-ignored)
├── package.json                    # Monorepo root scripts (concurrent dev, prisma)
└── README.md                       # Comprehensive platform documentation
```

---

## API Reference

### Authentication (`/api/auth`)

| Method | Endpoint | Auth | Role | Description |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Public | All | Authenticates credentials; returns signed JWT containing `id`, `email`, and `role`. |
| `GET` | `/api/auth/me` | JWT | `ADMIN`, `OPERATOR` | Returns authenticated profile of the current user. |
| `POST` | `/api/auth/change-password` | JWT | `ADMIN`, `OPERATOR` | Changes the authenticated user's own password (`req.user.id`). |

### User Management (`/api/users`)

| Method | Endpoint | Auth | Role | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/users` | JWT | `ADMIN` | Lists all platform users, email addresses, and roles. |
| `POST` | `/api/users` | JWT | `ADMIN` | Provisions a new user with `ADMIN` or `OPERATOR` role. |
| `PATCH` | `/api/users/:id/role` | JWT | `ADMIN` | Updates an existing user's role (with lockout safety protection). |
| `DELETE` | `/api/users/:id` | JWT | `ADMIN` | Deletes a user account (prevents deleting the last remaining admin). |

### Zones & Actuation (`/api/zones`)

| Method | Endpoint | Auth | Role | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/zones` | JWT | `ADMIN`, `OPERATOR` | Retrieves list of all 3 zones with current live moisture and valve states. |
| `GET` | `/api/zones/:id` | JWT | `ADMIN`, `OPERATOR` | Retrieves detailed status, 24h history, and cycle logs for a single zone. |
| `POST` | `/api/zones/:id/command` | JWT | `ADMIN` | Dispatches an MQTT watering command (`wateringL`, `targetSoilMoisturePct`). |
| `POST` | `/api/zones/:id/toggle` | JWT | `ADMIN` | Manually toggles a zone valve `ON` or `OFF`. |

### Tank & Pump (`/api/tank`, `/api/pump`)

| Method | Endpoint | Auth | Role | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/tank` | JWT | `ADMIN`, `OPERATOR` | Returns tank level percentage, volume in liters, and capacity (7,000 L). |
| `GET` | `/api/pump` | JWT | `ADMIN`, `OPERATOR` | Returns main pump operational status and flow rate (30 L/min). |

### Analytics & Data Export (`/api/analytics`)

| Method | Endpoint | Auth | Role | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/analytics/consumption` | JWT | `ADMIN`, `OPERATOR` | Returns aggregated water consumption stats (daily, weekly, monthly). |
| `GET` | `/api/analytics/export-csv` | JWT | `ADMIN`, `OPERATOR` | Generates downloadable CSV export of historical water consumption. |

### Weather & Soil (`/api/weather`, `/api/soil`)

| Method | Endpoint | Auth | Role | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/weather` | JWT | `ADMIN`, `OPERATOR` | Fetches live weather forecasts from Open-Meteo for the site coordinates. |
| `GET` | `/api/soil` | JWT | `ADMIN`, `OPERATOR` | Fetches soil physical properties and texture data from SoilGrids. |

### Alerts (`/api/alerts`)

| Method | Endpoint | Auth | Role | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/alerts` | JWT | `ADMIN`, `OPERATOR` | Returns active alerts and historical system warning logs. |
| `PATCH` | `/api/alerts/:id/resolve`| JWT | `ADMIN` | Marks an active alert as acknowledged/resolved. |
| `DELETE` | `/api/alerts` | JWT | `ADMIN` | Clears all resolved alert logs from the database. |

### Audit Logs (`/api/logs`)

| Method | Endpoint | Auth | Role | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/logs` | JWT | `ADMIN`, `OPERATOR` | Returns audit trail logs (user emails are automatically redacted for Operators). |

### Emergency Shutdown (`/api/emergency`)

| Method | Endpoint | Auth | Role | Description |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/emergency/stop` | JWT | `ADMIN` | Triggers immediate physical Emergency Stop across all valves and pump. |
| `POST` | `/api/emergency/resume` | JWT | `ADMIN` | Clears emergency status and resumes normal automated operations. |
| `GET` | `/api/emergency/status` | JWT | `ADMIN`, `OPERATOR` | Returns current system emergency stop state. |

### AI Analysis Ingest & Retrieval (`/api/ai-analysis`)

| Method | Endpoint | Auth | Role | Description |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/ai-analysis` | M2M Secret | External AI | Ingests automated agronomic inference reports via header `x-fusionai-secret`. |
| `GET` | `/api/ai-analysis` | JWT | `ADMIN`, `OPERATOR` | Returns paginated list of historical AI analysis reports. |
| `GET` | `/api/ai-analysis/latest` | JWT | `ADMIN`, `OPERATOR` | Returns the most recent valid AI recommendation. |
| `GET` | `/api/ai-analysis/:id` | JWT | `ADMIN`, `OPERATOR` | Returns full detail of an AI analysis and linked sensor snapshot. |

### Health Check (`/api/health`)

| Method | Endpoint | Auth | Role | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Public | All | Returns gateway health status, environment, and database mode. |

---

## Roles & Permissions

Hydrivia enforces Role-Based Access Control on the server:

| Capability | `ADMIN` | `OPERATOR` |
| :--- | :---: | :---: |
| View live telemetry, 3D farm, charts, & logs | ✅ Allowed | ✅ Allowed |
| Manual valve toggle (`ON` / `OFF`) | ✅ Allowed | ❌ **Blocked (HTTP 403)** |
| Dispatch custom watering commands | ✅ Allowed | ❌ **Blocked (HTTP 403)** |
| Trigger / Resume Emergency Stop | ✅ Allowed | ❌ **Blocked (HTTP 403)** |
| Acknowledge & resolve system alerts | ✅ Allowed | ❌ **Blocked (HTTP 403)** |
| Create, promote/demote, & delete users | ✅ Allowed | ❌ **Blocked (HTTP 403)** |
| Change own password | ✅ Allowed | ✅ Allowed |
| View audit log user emails | ✅ Full Email | 🔒 **Redacted (`[Masqué - Admin]`)** |

---

## MQTT Topics

| Topic | Direction | QoS | Retained | Description & Sample Payload |
| :--- | :---: | :---: | :---: | :--- |
| `hydrivia/zones/1/state` | Device $\rightarrow$ Broker | 1 | `true` | Zone 1 state (`{"device_id":"hydrivia-esp32-01","zone":1,"plant":"tomato","soil_humidity":45.2,"valve":"ON","pump":"ON","water_level":78.4,"volume_liters":5488.0,"timestamp":"..."}`) |
| `hydrivia/zones/2/state` | Device $\rightarrow$ Broker | 1 | `true` | Zone 2 state (`{"device_id":"hydrivia-esp32-01","zone":2,"plant":"mint","soil_humidity":62.1,"valve":"OFF",...}`) |
| `hydrivia/zones/3/state` | Device $\rightarrow$ Broker | 1 | `true` | Zone 3 state (`{"device_id":"hydrivia-esp32-01","zone":3,"plant":"onion","soil_humidity":38.0,"valve":"OFF",...}`) |
| `hydrivia/zones/+/command` | Broker $\rightarrow$ Device | 1 | `false` | Irrigation command (`{"wateringL":15.0,"targetSoilMoisturePct":55.0}`) or text `"ON"`/`"OFF"` |
| `hydrivia/pump/state` | Device $\rightarrow$ Broker | 1 | `true` | Main pump state (`{"device_id":"hydrivia-esp32-01","pump":"ON","water_level":78.4,"volume_liters":5488.0,"timestamp":"..."}`) |
| `hydrivia/tank/state` | Device $\rightarrow$ Broker | 1 | `true` | Tank metrics (`{"device_id":"hydrivia-esp32-01","water_level":78.4,"volume_liters":5488.0,"capacity_liters":7000.0,"critical":false,"low":false,"timestamp":"..."}`) |
| `hydrivia/environment/state` | Device $\rightarrow$ Broker | 1 | `true` | Atmosphere metrics (`{"device_id":"hydrivia-esp32-01","temperature":24.5,"air_humidity":58.2,"timestamp":"..."}`) |
| `hydrivia/snapshot` | Device $\rightarrow$ Broker | 1 | `false` | Full system snapshot published every 60 seconds (consolidated JSON array of all zones, tank, pump, environment, and queue status) |
| `hydrivia/alerts` | Device $\rightarrow$ Broker | 1 | `false` | Hardware alerts (`{"device_id":"hydrivia-esp32-01","timestamp":"...","type":"water_critical","severity":"high","message":"..."}`) |
| `hydrivia/sensors/request` | Broker $\rightarrow$ Device | 1 | `false` | Trigger on-demand fresh sensor read (`{"requestId":"req-12345"}`) |
| `hydrivia/sensors/realtime`| Device $\rightarrow$ Broker | 1 | `false` | Immediate response with live sensor readings and diagnostic status |

---

## Hardware & GPIO Pin Mapping

| Hardware Component | ESP32 GPIO Pin | Function / Notes |
| :--- | :---: | :--- |
| **Ultrasonic Trigger (HC-SR04)** | `GPIO 14` | Distance trigger pulse output |
| **Ultrasonic Echo (HC-SR04)** | `GPIO 18` | Distance pulse measurement input |
| **Capacitive Soil Sensor 1 (Tomato)** | `GPIO 34` | ADC1 channel — Zone 1 soil moisture |
| **Capacitive Soil Sensor 2 (Mint)** | `GPIO 35` | ADC1 channel — Zone 2 soil moisture |
| **Capacitive Soil Sensor 3 (Onion)** | `GPIO 32` | ADC1 channel — Zone 3 soil moisture |
| **Main Water Pump Relay** | `GPIO 27` | Active-High relay driving 30 L/min pump |
| **Electrovalve Relay 1 (Tomato)** | `GPIO 26` | Active-High relay driving Zone 1 valve |
| **Electrovalve Relay 2 (Mint)** | `GPIO 25` | Active-High relay driving Zone 2 valve |
| **Electrovalve Relay 3 (Onion)** | `GPIO 23` | Active-High relay driving Zone 3 valve |
| **Critical Tank Level Indicator LED**| `GPIO 33` | Physical visual alert LED for level < 20% |
| **I2C SDA (BME280 & RTC DS3231)** | `GPIO 21` | Shared I2C Data bus |
| **I2C SCL (BME280 & RTC DS3231)** | `GPIO 22` | Shared I2C Clock bus |

---

## Database Schema

The database schema is managed via Prisma in [backend/prisma/schema.prisma](file:///c:/Users/DELL/Desktop/IoTGen/hydrivia/backend/prisma/schema.prisma):

- **`User`**: System user credentials (email, bcrypt password hash, `Role` enum: `ADMIN` or `OPERATOR`).
- **`Zone`**: Parcels configuration (Zone 1 Tomato, Zone 2 Mint, Zone 3 Onion, enabled flag).
- **`SensorReading`**: Historical telemetry log (soil moisture per zone, water level, volume, temp, humidity, actuator states).
- **`AIAnalysis`**: Ingested AI decision reports, confidence scores, water budgets, weather assessments, and JSON zone recommendations.
- **`IrrigationCycle`**: Execution records linked to zones and AI analyses, tracking requested vs delivered water in liters, start/end timestamps, and final status.
- **`Alert`**: Event log of system, water, pump, sensor, and MQTT alerts with severity rankings and resolution timestamps.
- **`SystemLog`**: Audit trail recording sensitive administrative events, emergency stops, user creation, and role modifications.
- **`Setting`**: Key-value pairs for global platform parameters.

---

## Development

### Running Tests

Run the automated end-to-end RBAC and security test suite:
```bash
node backend/verify_rbac_tests.js
```
This suite initializes an in-process instance and executes 42 automated assertions validating:
- Database enum and existing administrator retention
- Admin and Operator JWT issuance
- Operator 403 blocking on all mutating routes
- Operator 200 access on all read routes
- PII redaction on `/api/logs`
- Operator self-password change capability
- M2M shared-secret isolation for `POST /api/ai-analysis`

### Database Migrations

To apply schema changes to PostgreSQL:
```bash
# Push schema updates directly (prototyping/development)
npm run prisma:push

# Generate an updated Prisma client
npm run prisma:generate
```

### CI/CD Pipeline & GitHub Secrets

Automated continuous integration is handled via GitHub Actions in [.github/workflows/ci.yml](file:///.github/workflows/ci.yml) and runs on every push and pull request targeting the `main` branch.

The pipeline executes three parallel jobs:
1. **`install-and-lint`**: Verifies workspace dependencies install cleanly via `npm run install:all`.
2. **`backend-tests`**: Spins up an ephemeral `postgres:15` container, applies the Prisma schema, seeds canonical tables, and executes the 42-assertion RBAC & security test suite.
3. **`frontend-build`**: Builds the React 18 / Vite frontend and archives the production `dist/` bundle as a workflow artifact.

#### Repository Secrets Configuration
Configure the following secrets in **GitHub > Repository Settings > Secrets and variables > Actions**:

| Secret Name | Description | CI Behavior / Fallback |
| :--- | :--- | :--- |
| `JWT_SECRET` | Secret key for signing and verifying authentication JWTs. | Defaults to an ephemeral CI test key when omitted. |
| `FUSIONAI_WEBHOOK_SECRET` | Pre-shared token for authenticating external M2M AI webhook requests (`x-fusionai-secret` header). | Defaults to an ephemeral CI test secret when omitted. |
| `DATABASE_URL` | PostgreSQL connection string. | Defaults to the ephemeral CI `postgres:15` service container (`postgresql://postgres:postgrespassword@localhost:5432/hydrivia_test?sslmode=disable`). |

---

## Deployment

<!-- TODO: confirm deployment orchestration (Docker Compose / Kubernetes / Cloud hosting) -->

---

## Security Notes

1. **Credentials Isolation**: Never commit `secrets.h`, `.env`, or production database connection strings to source control.
2. **M2M AI Webhook Isolation**: The `POST /api/ai-analysis` endpoint is authenticated exclusively via the shared secret header (`x-fusionai-secret` or bearer token). It is intentionally decoupled from user JWT authentication so automated external worker pipelines (FusionAI) function independently of user sessions.
3. **Server-Side RBAC Enforcement**: Role permissions are checked server-side via [requireRole.js](file:///c:/Users/DELL/Desktop/IoTGen/hydrivia/backend/src/middleware/requireRole.js). Disabling or bypassing UI buttons in browser devtools will result in an immediate `HTTP 403 Forbidden` response.
4. **At-Least-Once MQTT Delivery**: MQTT publishing is configured for QoS 1. Backend and AI consumers should ensure idempotent handling of duplicate message packets by referencing the ISO timestamp.

---

## Contributing

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Commit your changes: `git commit -m "Add your descriptive commit message"`
4. Push to the branch: `git push origin feature/your-feature-name`
5. Open a Pull Request.

---

## License

This project is licensed under the **MIT License**.
