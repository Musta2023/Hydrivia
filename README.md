# 🌿 HYDRIVIA — Architecture Technique & Documentation Système Complète

> **Système d'Irrigation Intelligente Autonome par IA & Plateforme Jumeau Numérique**  
> *Manuel technique de référence pour ingénieurs embarqués, architectes backend et développeurs full-stack.*

---

## 📑 Table des Matières

1. [Vue d'Ensemble & Objectifs du Système](#1-vue-densemble--objectifs-du-système)
2. [Pourquoi Hydrivia Existe (Problématique & Valeur Ajoutée)](#2-pourquoi-hydrivia-existe)
3. [Architecture Globale du Système](#3-architecture-globale-du-système)
4. [Architecture Matérielle & Brochage GPIO](#4-architecture-matérielle--brochage-gpio)
5. [Architecture du Firmware ESP32 (`hydrivia.ino`)](#5-architecture-du-firmware-esp32)
6. [Sous-Systèmes de Capteurs & Modèles d'Étalonnage](#6-sous-systèmes-de-capteurs--modèles-détalonnage)
7. [Actionneurs & Circuit Hydraulique](#7-actionneurs--circuit-hydraulique)
8. [Architecture MQTT & Sécurité TLS HiveMQ Cloud](#8-architecture-mqtt--sécurité-tls-hivemq-cloud)
9. [Répertoire Complet des Topics MQTT](#9-répertoire-complet-des-topics-mqtt)
10. [Spécification des Payloads JSON MQTT](#10-spécification-des-payloads-json-mqtt)
11. [Logique d'Exécution de l'Irrigation (File FIFO & Arrêt Double Condition)](#11-logique-dexécution-de-lirrigation)
12. [Flux Décisionnel IA & Intégration FusionAI](#12-flux-décisionnel-ia--intégration-fusionai)
13. [Architecture de la Passerelle Backend (Node.js / Express / Socket.IO)](#13-architecture-de-la-passerelle-backend)
14. [Architecture de la Base de Données (Supabase PostgreSQL / ORM Prisma)](#14-architecture-de-la-base-de-données)
15. [Configuration Supabase & Pooler de Connexion](#15-configuration-supabase--pooler-de-connexion)
16. [Architecture de l'Application Web (React / Vite / TailwindCSS)](#16-architecture-de-lapplication-web)
17. [Moteur de Requête de Capteurs en Temps Réel à la Demande](#17-moteur-de-requête-de-capteurs-en-temps-réel-à-la-demande)
18. [Page d'Analyse IA & Synchronisation Temps Réel](#18-page-danalyse-ia--synchronisation-temps-réel)
19. [Flux Global des Données de Bout en Bout](#19-flux-global-des-données-de-bout-en-bout)
20. [Verrous & Mécanismes de Sécurité Multi-Niveaux](#20-verrous--mécanismes-de-sécurité-multi-niveaux)
21. [Gestion des Erreurs & Tolérance aux Pannes](#21-gestion-des-erreurs--tolérance-aux-pannes)
22. [Installation & Prérequis Matériels/Logiciels](#22-installation--prérequis)
23. [Configuration & Variables d'Environnement](#23-configuration--variables-denvironnement)
24. [Démarrage du Système](#24-démarrage-du-système)
25. [Suite de Vérification & Tests](#25-suite-de-vérification--tests)
26. [Déploiement en Production](#26-déploiement-en-production)
27. [Matrice de Dépannage (Troubleshooting)](#27-matrice-de-dépannage)
28. [Modèle de Sécurité & Durcissement](#28-modèle-de-sécurité--durcissement)
29. [Feuille de Route (Roadmap)](#29-feuille-de-route)

---

## 1. Vue d'Ensemble & Objectifs du Système

**HYDRIVIA** est un écosystème IoT d'irrigation intelligente de niveau industriel conçu pour optimiser l'utilisation de l'eau agricole, prévenir le stress hydrique des cultures et protéger les équipements hydrauliques. La plateforme automatise l'irrigation multi-zones via la télémétrie environnementale, l'analyse capacitive de l'humidité du sol, la mesure ultrasonique du niveau du réservoir, les prévisions météorologiques en temps réel et le raisonnement agronomique autonome de **FusionAI**.

Le système comprend :
- **Couche Physique** : Un microcontrôleur ESP32 gérant des capteurs analogiques (sondes capacitives de sol), une mesure de distance numérique par ultrasons (HC-SR04), des capteurs atmosphériques I2C (BME280), une horloge temps réel matérielle (RTC DS3231), un relais de pompe électrique et 3 relais d'électrovannes indépendants.
- **Couche Communication** : Protocole MQTT chiffré TLS 1.2 bidirectionnel (MQTTS sur le port 8883) via HiveMQ Cloud et WebSockets temps réel (Socket.IO) reliant le firmware aux navigateurs clients.
- **Couche Backend & Persistance** : Une passerelle Node.js/Express modulaire utilisant l'ORM Prisma avec Supabase PostgreSQL, intégrant l'authentification JWT, l'agrégation historique automatisée, l'export CSV et les API SoilGrids / Open-Meteo.
- **Couche Présentation** : Un tableau de bord web réactif haute performance sous React, Vite et TailwindCSS, doté de jauges temps réel, d'un visualiseur 3D interactif de la ferme (Three.js/Fiber), d'un explorateur de décisions IA et d'un bouton d'arrêt d'urgence matériel instantané.

---

## 2. Pourquoi Hydrivia Existe

Les programmateurs d'arrosage traditionnels fonctionnent sur des plages horaires fixes, sans tenir compte de l'humidité réelle du sol, de la demande évaporative ou des pluies imminentes. Cela engendre :
1. **Gaspillage Massif d'Eau** : La sur-irrigation épuise les réserves et alourdit les coûts énergétiques de pompage.
2. **Vulnérabilité des Cultures** : Risques d'asphyxie racinaire, maladies fongiques en cas de saturation, ou avortement des fleurs en cas de déficit hydrique lors des phases critiques.
3. **Pannes Hydrauliques Sévères** : Fonctionnement de la pompe à sec (cavitation) lorsque le réservoir est vide, ou fonctionnement contre vannes fermées (surpression).

HYDRIVIA résout ces défis majeurs en :
- Fonctionnant en **boucle fermée** : l'arrosage s'interrompt automatiquement dès que le volume cible ou le seuil d'humidité est atteint.
- Appliquant une **file d'attente séquentielle FIFO** garantissant 100% de la pression et du débit nominal (30 L/min) sur une seule zone à la fois.
- Exploitant **FusionAI et les prévisions météo** pour reporter l'irrigation si une pluie significative est imminente.
- Imposant des **sécurités matérielles strictes** (coupure réservoir bas < 20%, limite temps pompe 5 min, verrouillage anti-marche à vide).

---

## 3. Architecture Globale du Système

```mermaid
flowchart TB
    subgraph Edge ["🌿 Couche Edge — Station Matérielle ESP32"]
        Sensors["Capteurs<br/>- Humidité Sol Zones 1, 2, 3<br/>- Ultrason HC-SR04 Niveau Réservoir<br/>- BME280 Temp/Hum/Pression<br/>- RTC Matériel DS3231"]
        Actuators["Actionneurs<br/>- Relais Pompe GPIO 27<br/>- Vanne 1 Tomate - GPIO 26<br/>- Vanne 2 Menthe - GPIO 25<br/>- Vanne 3 Oignon - GPIO 23"]
        ESP32["Microcontrôleur ESP32<br/>- Boucle non-bloquante FreeRTOS<br/>- File d'attente séquentielle FIFO<br/>- Machine à états Arrêt Double Condition<br/>- Client MQTTS TLS 1.2"]
        Sensors -->|Analogique / I2C / Impulsion| ESP32
        ESP32 -->|Commande Relais| Actuators
    end

    subgraph CloudMQTT ["☁️ Broker Cloud MQTT"]
        HiveMQ["HiveMQ Cloud TLS Port 8883<br/>Broker Chiffré MQTTS"]
    end

    subgraph BackendLayer ["⚙️ Couche Backend & Intelligence"]
        Gateway["Passerelle Node.js / Express<br/>- Service MQTT & Cache d'état Live<br/>- Serveur Temps Réel Socket.IO<br/>- API REST & Authentification JWT<br/>- API Open-Meteo & SoilGrids"]
        FusionAI["Moteur FusionAI<br/>- RAG Multi-sources<br/>- Raisonnement Stade Cultural<br/>- Budget Hydrique en Litres"]
        Supabase[("Supabase PostgreSQL<br/>- ORM Prisma<br/>- Télémétrie & Historiques Capteurs<br/>- Cycles d'Irrigation & Alertes<br/>- Rapports d'Analyses IA")]
    end

    subgraph FrontendLayer ["💻 Couche Présentation — Dashboard Web"]
        Dashboard["Application Web React 18 + Vite<br/>- Télémétrie Live & Jauges Circulaires<br/>- Visualiseur 3D Jumeau Numérique<br/>- Consultation IA & Exécution en 1 Clic<br/>- Arrêt d'Urgence Matériel"]
    end

    ESP32 <==>|Télémétrie & Commandes MQTTS| HiveMQ
    HiveMQ <==>|Pont Client MQTT| Gateway
    Gateway <==>|Socket.IO & HTTP REST| Dashboard
    Gateway <==>|Client Prisma SQL| Supabase
    FusionAI -->|POST /api/ai-analysis<br/>Secret Header / Bearer| Gateway
    Gateway -->|Requête à la Demande| FusionAI
```

---

## 4. Architecture Matérielle & Brochage GPIO

Le microcontrôleur principal est un **ESP32 DevKit V1 (38 broches)** interfacé avec des modules relais 5V optocouplés (niveau actif HAUT), des sondes d'humidité de sol capacitives sur ADC1 (compatibles Wi-Fi), un capteur ultrason HC-SR04, une horloge RTC DS3231 et un capteur atmosphérique BME280.

### Tableau de Brochage GPIO Complet

| Broche (GPIO) | Composant Matériel | Fonction | Mode / Spécifications Électriques |
|---|---|---|---|
| **GPIO 14** | Trigger Ultrason HC-SR04 | Émission de l'impulsion ultrasonique | `OUTPUT`, impulsion 10µs HAUTE |
| **GPIO 18** | Echo Ultrason HC-SR04 | Réception et mesure du temps d'écho | `INPUT`, pont diviseur 5V $\rightarrow$ 3.3V |
| **GPIO 34** | Sonde Sol 1 (Tomate) | Mesure capacitive d'humidité de sol | `INPUT` (Canal ADC1 6), 12 bits (0–4095) |
| **GPIO 35** | Sonde Sol 2 (Menthe) | Mesure capacitive d'humidité de sol | `INPUT` (Canal ADC1 7), 12 bits (0–4095) |
| **GPIO 32** | Sonde Sol 3 (Oignon) | Mesure capacitive d'humidité de sol | `INPUT` (Canal ADC1 4), 12 bits (0–4095) |
| **GPIO 27** | Relais Pompe à Eau | Alimentation pompe (30 L/min) | `OUTPUT`, Actif HAUT (Optocouplé) |
| **GPIO 26** | Relais Électrovanne 1 (Tomate) | Commande vanne Zone 1 | `OUTPUT`, Actif HAUT |
| **GPIO 25** | Relais Électrovanne 2 (Menthe) | Commande vanne Zone 2 | `OUTPUT`, Actif HAUT |
| **GPIO 23** | Relais Électrovanne 3 (Oignon) | Commande vanne Zone 3 | `OUTPUT`, Actif HAUT |
| **GPIO 33** | LED Niveau Eau Critique | Indicateur local de réservoir vide | `OUTPUT`, Actif HAUT |
| **GPIO 21** | Bus I2C SDA | Données BME280 & RTC DS3231 | I2C Data (Pull-up 4.7kΩ vers 3.3V) |
| **GPIO 22** | Bus I2C SCL | Horloge BME280 & RTC DS3231 | I2C Clock (Pull-up 4.7kΩ vers 3.3V) |

> ⚠️ **Avertissement ADC** : Les capteurs analogiques sont strictement câblés sur le bloc **ADC1** (broches 32, 34, 35). Le bloc ADC2 est désactivé matériellement par le contrôleur Wi-Fi de l'ESP32.

---

## 5. Architecture du Firmware ESP32 (`hydrivia.ino`)

Le firmware est écrit en C++ sous Arduino Core pour ESP32, selon une architecture strictement asynchrone et non bloquante (cadencement par `millis()` sans aucun appel à `delay()` dans la boucle principale `loop()`).

### Modules Principaux du Firmware

1. **Sous-système d'Horodatage (`getIsoTimestamp()`, `syncRtcFromNtp()`) :**
   - **Niveau 1** : RTC DS3231 sur bus I2C (`RTClib.h`) garantissant un horodatage UTC persistant même sans connexion Internet.
   - **Niveau 2** : Synchronisation NTP réseau (`pool.ntp.org`, `time.nist.gov`) via `configTime()`.
   - **Niveau 3** : Uptime millis de secours (`uptime+XXXXXms`).
2. **File d'Attente Séquentielle FIFO (`enqueueIrrigationCommand()`, `dequeueIrrigationCommand()`) :**
   - Tampon circulaire supportant jusqu'à `MAX_PENDING_COMMANDS = 8` commandes de zones en attente.
   - Empêche l'ouverture simultanée de plusieurs vannes pour concentrer la pression hydraulique.
3. **Machine à États d'Irrigation à Arrêt Double Condition (`updateIrrigationStateMachine()`, `completeCurrentZone()`) :**
   - Évalue en continu deux critères d'arrêt autonomes :
     1. Volume d'eau délivré : `(elapsedMillis / 60000.0) * 30.0 >= targetWateringL`
     2. Humidité du sol cible : `currentSoilMoisture >= targetSoilMoisturePct`
4. **Moteur de Télémétrie Fraîche à la Demande (`handleSensorRequest()`) :**
   - Écoute le topic `hydrivia/sensors/request`, échantillonne immédiatement toutes les sondes physiques et publie un rapport complet sur `hydrivia/sensors/realtime`.
5. **Publication Périodique de Télémétrie :**
   - Publications individuelles toutes les 2 secondes (zones, pompe, réservoir, environnement).
   - Snapshot global complet toutes les 60 secondes sur `hydrivia/snapshot`.

---

## 6. Sous-Systèmes de Capteurs & Modèles d'Étalonnage

### 1. Sondes d'Humidité du Sol Capacitives
- **Plage ADC 12 bits** : $[0, 4095]$.
- **Constantes d'Étalonnage** :
  - `SOIL_DRY_VALUE = 3500` (Capteur à l'air libre $\rightarrow 0\%$)
  - `SOIL_WET_VALUE = 1500` (Capteur immergé dans l'eau $\rightarrow 100\%$)
- **Équation de Conversion** :
  $$\text{Humidite (\%)} = \mathrm{constrain}\left(\frac{\mathrm{ADC_{sec}} - \mathrm{ADC_{brut}}}{\mathrm{ADC_{sec}} - \mathrm{ADC_{humide}}} \times 100.0,\, 0.0,\, 100.0\right)$$
  *(avec $\mathrm{ADC_{sec}} = 3500$ et $\mathrm{ADC_{humide}} = 1500$)*

### 2. Capteur de Niveau Ultrasonique (HC-SR04)
- **Vitesse du son** : $v \approx 343\text{ m/s} = 0.0343\text{ cm/}\mu\text{s}$.
- **Calcul de la Distance** :
  $$\text{Distance (cm)} = \frac{t_{\text{impulsion}} (\mu\text{s}) \times 0.0343}{2}$$
- **Étalonnage du Réservoir** :
  - `EMPTY_DISTANCE = 180.69 cm` (Réservoir vide $\rightarrow 0\%$)
  - `FULL_DISTANCE = 1.21 cm` (Réservoir plein $\rightarrow 100\%$)
  - `TANK_CAPACITY_LITERS = 7000.0 L`
- **Formules de Pourcentage et Volume** :
  $$\text{Niveau (\%)} = \mathrm{constrain}\left(\frac{180.69 - \text{Distance}}{180.69 - 1.21} \times 100.0,\, 0.0,\, 100.0\right)$$
  $$\text{Volume (Litres)} = \frac{\text{Niveau (\%)}}{100.0} \times 7000.0$$

### 3. Capteur Environnemental (BME280)
- Communication I2C à l'adresse `0x77`.
- Mesure la Température Ambiante (°C), l'Humidité Relative de l'Air (%RH) et la Pression Atmosphérique (hPa).

---

## 7. Actionneurs & Circuit Hydraulique

### Pompe à Eau & Électrovannes
- **Débit Nominal de la Pompe** : $Q = 30.0\text{ Litres/Minute}$ ($0.5\text{ L/s}$).
- **Verrouillage Hydraulique** :
  - La pompe ne peut **jamais** fonctionner si toutes les électrovannes sont fermées.
  - Lors d'une transition automatique entre deux zones, la nouvelle vanne est ouverte avant la fermeture de la précédente (`isTransitioningZone = true`), éliminant les coups de bélier.

### Intégration du Volume d'Eau Livré
Pendant l'arrosage, le volume d'eau injecté est calculé en continu :
$$V_{\text{livre}} (\text{L}) = \left(\frac{t_{\text{actuel}} - t_{\text{debut}}}{60000.0}\right) \times 30.0$$

---

## 8. Architecture MQTT & Sécurité TLS HiveMQ Cloud

La communication entre l'ESP32 et le serveur backend est sécurisée par TLS 1.2 :
- **Broker Cloud** : HiveMQ Cloud (`*.s1.eu.hivemq.cloud`)
- **Port** : `8883` (MQTTS chiffré)
- **Authentification** : Identifiant & Mot de passe
- **Certificat Racine CA** : Let's Encrypt / ISRG Root X1 CA intégré dans `hydrivia.ino` (`HIVEMQ_CA_CERT`).
- **Keep-Alive** : 30 secondes
- **Taille de Buffer Client** : 2304 octets

---

## 9. Répertoire Complet des Topics MQTT

| Topic | Direction | Fréquence / Déclencheur | Description |
|---|---|---|---|
| `hydrivia/zones/1/command` | Backend $\rightarrow$ ESP32 | Action utilisateur / IA | Ordre d'irrigation pour la Zone 1 |
| `hydrivia/zones/2/command` | Backend $\rightarrow$ ESP32 | Action utilisateur / IA | Ordre d'irrigation pour la Zone 2 |
| `hydrivia/zones/3/command` | Backend $\rightarrow$ ESP32 | Action utilisateur / IA | Ordre d'irrigation pour la Zone 3 |
| `hydrivia/zones/1/state` | ESP32 $\rightarrow$ Backend | Toutes les 2s / changement | État temps réel de la Zone 1 |
| `hydrivia/zones/2/state` | ESP32 $\rightarrow$ Backend | Toutes les 2s / changement | État temps réel de la Zone 2 |
| `hydrivia/zones/3/state` | ESP32 $\rightarrow$ Backend | Toutes les 2s / changement | État temps réel de la Zone 3 |
| `hydrivia/pump/state` | ESP32 $\rightarrow$ Backend | Toutes les 2s / changement | État du relais de pompe et débit |
| `hydrivia/tank/state` | ESP32 $\rightarrow$ Backend | Toutes les 2s / changement | Niveau d'eau en % et volume en Litres |
| `hydrivia/environment/state` | ESP32 $\rightarrow$ Backend | Toutes les 2s / changement | Température et humidité de l'air |
| `hydrivia/snapshot` | ESP32 $\rightarrow$ Backend | Toutes les 60s | Instantané complet consolidé du système |
| `hydrivia/alerts` | ESP32 $\rightarrow$ Backend | Sur alarme / événement | Arrêt d'urgence, niveau bas, fin de cycle |
| `hydrivia/sensors/request` | Backend $\rightarrow$ ESP32 | À la demande (IA/User) | Demande de lecture immédiate des capteurs |
| `hydrivia/sensors/realtime` | ESP32 $\rightarrow$ Backend | Réponse à la demande | Payload consolidé de capteurs frais |

---

## 10. Spécification des Payloads JSON MQTT

### 1. Commande de Zone (`hydrivia/zones/{1,2,3}/command`)
```json
{
  "wateringL": 50.0,
  "targetSoilMoisturePct": 60.0
}
```

### 2. État d'une Zone (`hydrivia/zones/1/state`)
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

### 3. État du Réservoir (`hydrivia/tank/state`)
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

### 4. Snapshot Consolidé 60s (`hydrivia/snapshot`)
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

### 5. Requête & Réponse de Capteurs en Temps Réel
**Requête (`hydrivia/sensors/request`) :**
```json
{
  "requestId": "req-1724519400"
}
```

**Réponse (`hydrivia/sensors/realtime`) :**
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

## 11. Logique d'Exécution de l'Irrigation

```mermaid
stateDiagram-v2
    [*] --> IRRIGATION_IDLE

    IRRIGATION_IDLE --> IRRIGATION_RUNNING : Ajout Commande (File > 0)
    
    state IRRIGATION_RUNNING {
        [*] --> OuvrirVanne
        OuvrirVanne --> DemarrerPompe : Vanne Matérielle Ouverte
        DemarrerPompe --> SurveillanceCycle : Pompe Active (30 L/min)
        
        state SurveillanceCycle {
            [*] --> VerificationDoubleCondition
            VerificationDoubleCondition --> CibleAtteinte : Volume Délivré >= Cible (L)\nOU\nHumidité Sol >= Cible (%)
            VerificationDoubleCondition --> SecuriteDeclenchee : Réservoir < 20%\nOU\nTemps Pompe > 5 min\nOU\nArrêt d'Urgence
        }
        
        CibleAtteinte --> FinZone : completeCurrentZone()
        SecuriteDeclenchee --> CoupureUrgence : emergencyShutdown()
    }
    
    FinZone --> VerificationFile
    state VerificationFile <<choice>>
    VerificationFile --> ZoneSuivante : File > 0 (Transition Fluide)
    ZoneSuivante --> IRRIGATION_RUNNING
    VerificationFile --> ArreterPompe : File == 0
    
    ArreterPompe --> IRRIGATION_IDLE
    CoupureUrgence --> IRRIGATION_EMERGENCY
```

### Règle de l'Arrêt à Double Condition
L'arrosage s'interrompt dès que la **première condition** est vérifiée :
$$\text{ARRET} \iff (V_{\text{livre}} \ge V_{\text{cible}}) \quad\lor\quad (\text{Humidite}_{\text{actuelle}} \ge \text{Humidite}_{\text{cible}})$$

---

## 12. Flux Décisionnel IA & Intégration FusionAI

HYDRIVIA s'interface directement avec le moteur **FusionAI** pour générer les recommandations agronomiques.

```mermaid
sequenceDiagram
    autonumber
    participant Fusion as Agent FusionAI
    participant Backend as Passerelle Node.js (/api/ai-analysis)
    participant DB as Supabase PostgreSQL
    participant MQTT as HiveMQ Cloud
    participant ESP as Firmware ESP32
    participant UI as Dashboard React

    Fusion->>Backend: POST /api/ai-analysis (avec Secret Header / Bearer)
    Note over Backend: 1. Validation du statut décisionnel<br/>2. Déduplication via Idempotency-Key / Timestamp<br/>3. Normalisation automatique en Litres
    Backend->>DB: prisma.aIAnalysis.create()
    Backend-->>Fusion: 201 Created { success: true, analysisId: "ai-analysis-..." }
    
    UI->>Backend: GET /api/ai-analysis
    Backend->>DB: Récupération des analyses triées par date décroissante
    Backend-->>UI: Retourne la liste des résumés d'analyses
    
    UI->>Backend: GET /api/ai-analysis/:id
    Backend->>DB: Retourne le détail complet (waterBudget & zoneDecisions en Litres)
    
    opt L'utilisateur clique sur "Appliquer l'arrosage"
        UI->>Backend: POST /api/zones/:id/command { wateringL: 50, targetSoilMoisturePct: 60 }
        Backend->>MQTT: Publication sur hydrivia/zones/:id/command
        MQTT->>ESP: Réception de la commande & mise en file d'attente
        ESP->>ESP: Exécution du cycle d'irrigation séquentiel
    end
```

### Champs du Modèle d'Analyse IA (Table `ai_analyses`)
- **`waterBudget`** (JSON en Litres) : `availableL`, `allocatedL`, `conservedL`, `utilizationPct`, `scarcityLevel`.
- **`weatherAssessment`** (JSON) : `nearTermRainExpected`, `meaningfulRainExpectedWithinHours`, `next24HoursRainMm`, `atmosphericDemand`, `summary`.
- **`zoneDecisions`** (Tableau JSON) : `zoneId`, `cropType`, `priorityRank`, `action`, `soilMoistureStatus`, `cropStageAssessment`, `riskLevel`, `irrigationDepthMm`, `wateringL`, `rationale`.

---

## 13. Architecture de la Passerelle Backend

Le backend (`backend/src/server.js`) est une application Node.js moderne sous modules ES :

```
backend/
├── prisma/
│   └── schema.prisma         # Schéma de base de données Supabase PostgreSQL
├── src/
│   ├── config/
│   │   └── index.js          # Configuration globale et variables d'environnement
│   ├── database/
│   │   └── index.js          # Instance Prisma et initialisation des données par défaut
│   ├── middleware/
│   │   └── auth.js           # Middleware d'authentification et de validation JWT
│   ├── routes/
│   │   ├── aiAnalysis.js     # Endpoint M2M FusionAI & API de consultation
│   │   ├── alerts.js         # Gestion et acquittement des alertes
│   │   ├── analytics.js      # Cumuls de consommation & export CSV
│   │   ├── auth.js           # Connexion administrateur & génération JWT
│   │   ├── emergency.js      # Déclenchement et réarmement de l'arrêt d'urgence
│   │   ├── logs.js           # Journal d'audit des événements système
│   │   ├── pump.js           # État live de la pompe
│   │   ├── soil.js           # Analyse pédologique proxy SoilGrids
│   │   ├── tank.js           # Niveau du réservoir & historique
│   │   ├── weather.js        # Prévisions météo proxy Open-Meteo
│   │   └── zones.js          # Zones live, historiques et envoi de commandes
│   ├── services/
│   │   ├── analyticsService.js # Agrégations de consommation (Jour/Semaine/Mois)
│   │   ├── mqttService.js      # Client TLS HiveMQ, cache d'état live, persistance DB
│   │   ├── socketService.js    # Diffusion WebSockets Socket.IO
│   │   ├── soilService.js      # Client REST ISRIC SoilGrids avec cache 24h
│   │   └── weatherService.js   # Client REST Open-Meteo avec cache 15 min
│   └── server.js             # Démarrage du serveur HTTP et des services
└── package.json
```

### Répertoire des Routes API REST

| Méthode | Endpoint | Authentification | Rôle |
|---|---|---|---|
| `GET` | `/api/health` | Public | Santé du système, type de base de données et environnement |
| `POST` | `/api/auth/login` | Public | Connexion administrateur, retourne le jeton JWT |
| `GET` | `/api/auth/me` | JWT | Profil de l'utilisateur authentifié |
| `GET` | `/api/zones` | JWT | État temps réel des 3 zones et de la pompe |
| `GET` | `/api/zones/:id` | JWT | Télémétrie de la zone, historique 24h et cycles récents |
| `POST` | `/api/zones/:id/command` | JWT | Envoi d'une commande (`wateringL`, `targetSoilMoisturePct`) |
| `POST` | `/api/zones/:id/toggle` | JWT | Bascule manuelle ON/OFF d'une vanne |
| `GET` | `/api/tank` | JWT | Volume live du réservoir, pourcentage et historique (`?period=24h\|7d\|30d`) |
| `GET` | `/api/pump` | JWT | État live de la pompe et nombre de vannes ouvertes |
| `GET` | `/api/analytics/consumption` | JWT | Métriques de consommation agrégées (jour, semaine, mois, par zone) |
| `GET` | `/api/analytics/export-csv` | JWT | Téléchargement du journal complet de consommation en fichier CSV |
| `GET` | `/api/weather` | JWT | Prévisions Open-Meteo, probabilité de pluie, évapotranspiration |
| `GET` | `/api/soil` | JWT | Texture de sol ISRIC SoilGrids (argile/sable/limon), pH, matière organique |
| `GET` | `/api/alerts` | JWT | Liste des alertes système |
| `POST` | `/api/alerts/:id/resolve` | JWT | Acquittement et résolution d'une alerte |
| `GET` | `/api/logs` | JWT | Journal d'audit des événements du système |
| `POST` | `/api/emergency/stop` | JWT | Déclenchement de l'arrêt d'urgence logiciel et matériel |
| `POST` | `/api/emergency/resume` | JWT | Réarmement du système après un arrêt d'urgence |
| `GET` | `/api/emergency/status` | JWT | Vérification du statut de l'arrêt d'urgence |
| `POST` | `/api/ai-analysis` | Secret | Enregistrement d'une analyse émise par FusionAI (Auth M2M) |
| `GET` | `/api/ai-analysis` | JWT | Liste paginée des rapports d'analyses IA |
| `GET` | `/api/ai-analysis/:id` | JWT | Détail complet d'un rapport d'analyse IA spécifique |

---

## 14. Architecture de la Base de Données

Le système s'appuie sur une base de données **Supabase PostgreSQL** pilotée par **l'ORM Prisma (v5.22.0)**.

### Schéma Entité-Association (ERD)

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

## 15. Configuration Supabase & Pooler de Connexion

Dans `backend/prisma/schema.prisma` :
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```
- **`DATABASE_URL`** : Pooler de session Supavisor de Supabase (port `5432` / `6543`) avec `?sslmode=require` pour les requêtes de l'application.
- **`DIRECT_URL`** : Connexion PostgreSQL directe pour exécuter les migrations Prisma et les opérations DDL.

---

## 16. Architecture de l'Application Web

L'interface est une Single Page Application React 18 propulsée par Vite et TailwindCSS :

```
frontend/
├── src/
│   ├── components/
│   │   ├── 3d/
│   │   │   ├── Bottom3DKPIBar.jsx    # Barre récapitulative sous la scène 3D
│   │   │   ├── FarmCanvas.jsx        # Visualiseur 3D Three.js de la ferme
│   │   │   ├── Pump3DModal.jsx       # Modal 3D interactive de la pompe
│   │   │   ├── Right3DPanel.jsx      # Tiroir latéral de télémétrie en mode 3D
│   │   │   ├── WaterTank3DModal.jsx  # Modal 3D interactive du réservoir
│   │   │   ├── Zone3DDrawer.jsx      # Tiroir d'inspection de zone avec courbes
│   │   │   └── farm3dModels.js       # Objets 3D procéduraux (cultures, vannes, tuyaux)
│   │   ├── common/
│   │   │   ├── CircularGauge.jsx     # Jauge circulaire SVG haute précision
│   │   │   ├── StatCard.jsx          # Carte KPI avec tendances et icônes
│   │   │   └── StatusBadge.jsx       # Badge coloré d'état opérationnel
│   │   └── layout/
│   │       ├── EmergencyModal.jsx    # Modal plein écran de confirmation d'arrêt d'urgence
│   │       ├── Header.jsx            # En-tête avec statuts MQTT/WS et arrêt d'urgence
│   │       └── Sidebar.jsx           # Menu de navigation sombre avec 11 vues
│   ├── context/
│   │   ├── AuthContext.jsx           # Gestion de session JWT et connexion/déconnexion
│   │   └── SocketContext.jsx         # État Socket.IO, télémétrie live et actions rapides
│   ├── pages/
│   │   ├── AIAnalysisPage.jsx        # Explorateur de décisions IA & exécution en 1 clic
│   │   ├── AlertsPage.jsx            # Gestion et acquittement des alertes
│   │   ├── ConsumptionPage.jsx       # Analyse de consommation, graphiques & export CSV
│   │   ├── DashboardOverview.jsx     # Tableau de bord principal & cartes de zones
│   │   ├── Login.jsx                 # Page de connexion administrateur
│   │   ├── LogsPage.jsx              # Journal d'audit et historique des cycles
│   │   ├── SettingsPage.jsx          # Paramètres de la station et configuration
│   │   ├── SoilPage.jsx              # Analyse pédologique, texture & conseils d'arrosage
│   │   ├── TankPage.jsx              # Niveau ultrasonique du réservoir & tendances
│   │   ├── Visualisation3D.jsx       # Interface du jumeau numérique 3D
│   │   ├── WeatherPage.jsx           # Prévisions météo à 7 jours & risques de pluie
│   │   └── ZonesPage.jsx             # Pilotage dédié multi-zones & courbes d'humidité
│   ├── services/
│   │   └── api.js                    # Instance Axios avec intercepteur JWT
│   ├── utils/
│   │   └── cn.js                     # Utilitaire de fusion des classes Tailwind
│   ├── App.jsx                       # Routeur principal et contrôle d'accès
│   └── main.jsx                      # Point d'entrée React DOM
```

---

## 17. Moteur de Requête de Capteurs en Temps Réel à la Demande

Lorsqu'une analyse IA ou une opération nécessite une précision maximale, le système contourne le cache de télémétrie de 2 secondes et sollicite une mesure matérielle immédiate.

```mermaid
sequenceDiagram
    autonumber
    participant UI as Dashboard / Service IA
    participant Gateway as Passerelle Backend
    participant HiveMQ as Broker HiveMQ Cloud
    participant ESP as Firmware ESP32

    UI->>Gateway: POST /api/zones/request-sensors (ou hook IA)
    Gateway->>HiveMQ: Publication sur hydrivia/sensors/request {"requestId": "req-98124"}
    HiveMQ->>ESP: Réception de la requête
    Note over ESP: 1. Impulsion ultrasonique HC-SR04 (3 tentatives)<br/>2. Échantillonnage sondes ADC1 (Z1, Z2, Z3)<br/>3. Lecture température et humidité BME280
    ESP->>HiveMQ: Publication sur hydrivia/sensors/realtime (retained=false)
    HiveMQ->>Gateway: Réception du payload diagnostic frais
    Gateway->>UI: Diffusion temps réel par WebSocket (telemetry:fresh)
```

---

## 18. Page d'Analyse IA & Synchronisation Temps Réel

La page **Analyse IA** (`frontend/src/pages/AIAnalysisPage.jsx`) offre un cockpit complet de supervision agronomique :
1. **Historique des Décisions** : Badges d'état colorés (`IRRIGATION REQUISE`, `DIFFÉRÉ`, `PAS D'IRRIGATION`), indice de confiance en %, durée de validité et résumé exécutif.
2. **Panneau Budget Eau** : Volumes disponible, alloué et conservé entièrement normalisés en **Litres**.
3. **Synchronisation Live avec les Capteurs** : Corrélation directe entre le diagnostic de l'IA et **l'humidité réelle mesurée par le capteur en direct** (`telemetry.zones[X].soil_humidity`) ainsi que l'état physique de la vanne.
4. **Bouton d'Exécution en 1 Clic** : Permet à l'opérateur d'appliquer instantanément la recommandation de l'IA en déclenchant la vanne et le volume préconisé.

---

## 19. Flux Global des Données de Bout en Bout

```mermaid
flowchart TD
    subgraph DataCollection ["1. Acquisition des Données"]
        S1["Sondes Sol (ADC1)"] --> F1["Firmware ESP32"]
        S2["Capteur Réservoir HC-SR04"] --> F1
        S3["Capteur Environnement BME280"] --> F1
        S4["Horloge RTC DS3231"] --> F1
    end

    subgraph Transport ["2. Transport Sécurisé"]
        F1 -->|MQTTS Port 8883| M1["Broker HiveMQ Cloud"]
        M1 -->|Abonnement MQTT| B1["Passerelle Node.js"]
    end

    subgraph StateAndDB ["3. Traitement d'État & Persistance"]
        B1 -->|Mise à jour| C1["Cache d'État Live en Mémoire"]
        B1 -->|ORM Prisma| D1[("Supabase PostgreSQL")]
        D1 -->|Enregistre| D2["sensor_readings"]
        D1 -->|Enregistre| D3["irrigation_cycles"]
        D1 -->|Enregistre| D4["alerts"]
    end

    subgraph RealTimeDistribution ["4. Diffusion Temps Réel"]
        B1 -->|Diffusion WebSocket| W1["Serveur Socket.IO"]
        W1 -->|Événement Socket| U1["Dashboard Web React"]
    end

    subgraph ExternalIntelligence ["5. Intelligence & API Externes"]
        API1["API Open-Meteo"] -->|Cache 15 min| B1
        API2["API ISRIC SoilGrids"] -->|Cache 24h| B1
        AI1["Moteur FusionAI"] <-->|REST M2M| B1
    end
```

---

## 20. Verrous & Mécanismes de Sécurité Multi-Niveaux

HYDRIVIA intègre des verrous de sécurité stricts au niveau matériel et logiciel :

1. **Coupure Automatique Niveau Réservoir Critique** :
   - Si le niveau d'eau passe sous `WATER_LEVEL_CRITICAL_PCT = 20.0%`, l'ESP32 coupe immédiatement la pompe, referme toutes les vannes, allume la LED rouge locale (`PIN_LED_LOW`) et émet une alerte critique `tank_critical`.
2. **Limite de Durée Maximale de la Pompe** :
   - `PUMP_MAX_RUNTIME_MS = 300 000 ms` (5 minutes). Si la pompe tourne en continu au-delà de 5 minutes, elle est automatiquement coupée pour prévenir toute surchauffe.
3. **Verrouillage Anti-Marche à Vide (Zéro Vanne)** :
   - La pompe ne peut jamais tourner si toutes les vannes sont fermées. Si toutes les vannes se ferment, le relais de la pompe s'ouvre instantanément.
4. **Arrêt d'Urgence Global Logiciel** :
   - Le bouton d'arrêt d'urgence du dashboard déclenche `POST /api/emergency/stop`, envoyant l'ordre de coupure à tous les relais, passant le système en statut `EMERGENCY_STOPPED` et bloquant tout nouvel arrosage jusqu'au réarmement manuel.

---

## 21. Gestion des Erreurs & Tolérance aux Pannes

| Mode de Défaillance | Détection | Action de Récupération Automatique |
|---|---|---|
| **Perte de Connexion Wi-Fi** | `WiFi.status() != WL_CONNECTED` | L'ESP32 tente des reconnexions périodiques tout en maintenant les timers de sécurité |
| **Déconnexion du Broker MQTT** | `!mqttClient.connected()` | Tentatives de reconnexion toutes les 5 secondes (`MQTT_RETRY_INTERVAL_MS`) |
| **Panne I2C du BME280** | Échec de `bme.begin()` ou retour `NaN` | Valeurs par défaut sécurisées (0.0°C), avertissement dans les logs, arrosage opérationnel |
| **Perturbation Écho Ultrason** | Timeout de `pulseIn()` (25 ms) | Moyenne sur 3 impulsions ; conservation du dernier niveau valide si échec complet |
| **Timeout du Pooler Supabase** | Exception de requête Prisma | Le backend sert l'état live depuis son cache mémoire et réessaie la connexion |
| **Surchauffe de la File d'Attente** | `queueCount >= 8` | Rejet de la commande excédentaire et émission d'une alerte haute sévérité sur `hydrivia/alerts` |

---

## 22. Installation & Prérequis

### Prérequis Matériels
- Carte de développement ESP32 (NodeMCU ESP32 / DevKit V1)
- 3x Sondes d'humidité de sol capacitives (v1.2 ou v2.0)
- 1x Capteur de distance à ultrasons HC-SR04
- 1x Module capteur I2C BME280
- 1x Module RTC I2C DS3231 + pile bouton CR2032
- 1x Module 4 relais 5V (Optocouplé)
- 1x Pompe à eau 12V (ou 220V avec contacteur de puissance)
- 3x Électrovannes d'arrosage 12V/24V
- Alimentation externe 12V 5A DC & abaisseur de tension (Step-down) 5V

### Prérequis Logiciels
- **Node.js** : version 18.0.0 ou supérieure (v22.x recommandée)
- **npm** : version 9.x ou supérieure
- **Arduino IDE** ou **PlatformIO** (avec support des cartes ESP32 v2.0.0+)
- **Git**

### Bibliothèques Requises (Arduino IDE)
- `Adafruit BME280 Library` (par Adafruit)
- `Adafruit Unified Sensor` (par Adafruit)
- `ArduinoJson` (v6.x par Benoît Blanchon)
- `PubSubClient` (par Nick O'Leary)
- `RTClib` (par Adafruit)

---

## 23. Configuration & Variables d'Environnement

### Configuration Backend (`backend/.env`)
```ini
# Serveur & Environnement
PORT=5000
NODE_ENV=development
JWT_SECRET=votre_cle_secrete_jwt_2026

# Secret M2M Webhook FusionAI
FUSIONAI_WEBHOOK_SECRET=hydrivia_fusionai_secret_token_2026

# URLs de Connexion Supabase PostgreSQL
DATABASE_URL="postgresql://postgres.[REF]:[MOT_DE_PASSE]@aws-0-[REGION].pooler.supabase.com:6543/postgres?sslmode=require"
DIRECT_URL="postgresql://postgres:[MOT_DE_PASSE]@db.[REF].supabase.co:5432/postgres?sslmode=require"

# Identifiants Administrateur par Défaut
ADMIN_EMAIL=admin@gmail.com
ADMIN_PASSWORD=AZERTY12345

# Broker MQTT HiveMQ Cloud TLS
MQTT_SERVER=votre_instance.s1.eu.hivemq.cloud
MQTT_PORT=8883
MQTT_PROTOCOL=mqtts
MQTT_USERNAME=votre_identifiant_mqtt
MQTT_PASSWORD=votre_mot_de_passe_mqtt
MQTT_CLIENT_ID=hydrivia-backend-gateway
MQTT_SIMULATE=false

# Coordonnées Géographiques du Site Agricole
SITE_NAME="Station Agricole HYDRIVIA - Parcelle 1"
SITE_LATITUDE=33.5731
SITE_LONGITUDE=-7.5898
```

### Secrets du Firmware (`secrets.h`)
```cpp
#ifndef SECRETS_H
#define SECRETS_H

#define WIFI_SSID "Votre_Reseau_WiFi"
#define WIFI_PASSWORD "Votre_Mot_De_Passe_WiFi"

#define MQTT_SERVER "votre_instance.s1.eu.hivemq.cloud"
#define MQTT_PORT 8883
#define MQTT_USERNAME "votre_identifiant_mqtt"
#define MQTT_PASSWORD "votre_mot_de_passe_mqtt"

#endif
```

---

## 24. Démarrage du Système

### 1. Installation de Toutes les Dépendances
À la racine du projet :
```bash
npm run install:all
```

### 2. Synchronisation du Schéma Supabase
```bash
npm run prisma:generate
npm run prisma:push
```

### 3. Lancement Concurrent (Backend + Frontend)
```bash
npm run dev
```
- **API Backend** : `http://localhost:5000` (Vérification Santé : `http://localhost:5000/api/health`)
- **Dashboard Web** : `http://localhost:3000`

### 4. Identifiants de Connexion par Défaut
- **Email** : `admin@gmail.com`
- **Mot de passe** : `AZERTY12345`

---

## 25. Suite de Vérification & Tests

Des scripts de validation automatisés sont disponibles dans le dossier `scratch/` :

1. **Test de Connexion Supabase & Modèles** :
   ```bash
   node scratch/check_supabase.js
   ```
2. **Test de l'Ensemble des Endpoints REST** :
   ```bash
   node scratch/test_all_endpoints.js
   ```
3. **Test d'Ingestion & Validation d'Analyse IA** :
   ```bash
   node scratch/test_ai_analysis.js
   ```
4. **Vérification du Build Frontend** :
   ```bash
   npm run build:frontend
   ```

---

## 26. Déploiement en Production

### Déploiement du Backend (Docker / VPS / Render / Railway)
- Lancer la commande `npm run start:backend` avec la variable `NODE_ENV=production`.
- Exposer le port `5000` derrière un reverse proxy (Nginx ou Caddy) avec terminaison SSL/TLS.

### Déploiement du Frontend (Vercel / Cloudflare Pages / Nginx)
- Exécuter `npm run build:frontend` pour générer le bundle de production optimisé dans `frontend/dist/`.
- Configurer les règles de réécriture d'URL (SPA fallback) vers `/index.html`.

---

## 27. Matrice de Dépannage (Troubleshooting)

| Symptôme | Cause Probable | Action Corrective |
|---|---|---|
| **L'ESP32 redémarre ou boucle sur MQTT (code -2)** | Certificat CA invalide ou identifiants erronés | Vérifier `secrets.h` et s'assurer que l'horloge NTP est synchronisée |
| **Humidité du sol bloquée à 0% ou 100%** | Sonde branchée sur ADC2 ou déconnectée | Vérifier le câblage sur GPIO 32, 34 ou 35 (ADC1) et l'alimentation 3.3V |
| **Distance ultrasonique affichant 0 cm** | Inversion des broches Trigger / Echo | Vérifier Trig $\rightarrow$ GPIO 14 et Echo $\rightarrow$ GPIO 18 (avec diviseur) |
| **Timeout de requête Prisma vers Supabase** | Port du pooler de session mal configuré | Utiliser le port `6543` dans `DATABASE_URL` avec l'option `?sslmode=require` |
| **Cartes IA affichant 0 Litres** | Payload avec anciennes clés en mL | Le backend `normalizeMlToLiters()` convertit automatiquement ; vérifier l'UI |
| **La pompe ne démarre pas sur commande** | Niveau d'eau sous le seuil critique (< 20%) | Remplir le réservoir ou recalibrer la distance vide dans `hydrivia.ino` |

---

## 28. Modèle de Sécurité & Durcissement

1. **Chiffrement MQTTS TLS 1.2** : L'ensemble des trames de télémétrie et de commande transitent chiffrées sur le réseau public.
2. **Authentification M2M par Header Secret** : Les webhooks de FusionAI requièrent l'en-tête `x-fusionai-secret` ou un jeton Bearer dédié.
3. **Authentification Utilisateur JWT** : L'accès au dashboard nécessite des jetons signés cryptographiquement (HMAC-SHA256).
4. **Immunité aux Injections SQL** : Requêtes entièrement paramétrées et typées via l'ORM Prisma.
5. **Contrôle d'Origine CORS** : Restriction des origines autorisées en environnement de production.

---

## 29. Feuille de Route (Roadmap)

- [ ] **Passerelle de Secours LoRaWAN** : Télémétrie longue portée de secours en cas d'indisponibilité du Wi-Fi.
- [ ] **Machine Learning Embarqué (Edge ML)** : Inférence Micro-TensorFlow sur ESP32 pour la prédiction de la rétention hydrique locale.
- [ ] **Télémétrie Solaire MPPT** : Intégration de la tension de batterie et de la charge solaire.
- [ ] **Fertigation Automatisée** : Commande d'un second relais pour l'injection proportionnelle de nutriments liquides.

---

*HYDRIVIA — L'ingénierie de l'irrigation intelligente au service d'une agriculture durable.*
