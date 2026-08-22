# 🌿 HYDRIVIA — Système d'Irrigation Intelligente & Dashboard IoT

Bienvenue sur le projet **HYDRIVIA**, une solution complète d'irrigation intelligente basée sur un microcontrôleur **ESP32**, un broker cloud **HiveMQ Cloud (TLS/MQTTS)**, un backend **Node.js / Express / Socket.IO / SQLite**, et un dashboard web professionnel haute performance **React / Vite / TailwindCSS**.

---

## 📋 Architecture Globale du Système

```
 [ Capteurs & Actionneurs ]
   - Humidité Sol (3 Zones: Tomate, Menthe, Oignon)
   - Ultrason HC-SR04 (Niveau Réservoir 7000 L)
   - BME280 (Température & Humidité de l'Air)
   - Pompe 30 L/min (Relais GPIO27)
   - 3 Électrovannes (Relais GPIO26, GPIO25, GPIO23)
              ▲
              │ Télémétrie & Commandes (MQTTS Port 8883)
              ▼
   [ Broker HiveMQ Cloud TLS ]
              ▲
              │ Pont MQTT ⟷ WebSockets (Socket.IO)
              ▼
 [ Serveur Backend Node.js / Express ]
   - Base de données SQLite (data/hydrivia.sqlite)
   - Authentification JWT Administrateur
   - API Open-Meteo & SoilGrids ISRIC
   - Export CSV & Agrégation de Consommation
              ▲
              │ HTTP / WebSockets
              ▼
 [ Dashboard Web React (Vite + TailwindCSS) ]
   - Thème Dark "Trading Terminal" (#00ff88)
   - Arrêt d'Urgence permanent (#ff3b3b)
   - Jauges circulaires, Graphiques Recharts
   - 8 Vues dédiées en Français
```

---

## 🚀 Démarrage Rapide

### 1. Prérequis
- Node.js version 18+ (testé avec Node v22.17)
- Câble USB et carte ESP32 flashée avec [hydrivia.ino](file:///c:/Users/DELL/Desktop/IoTGen/hydrivia/hydrivia.ino)

### 2. Démarrage Tout-en-Un (Recommandé)
À la racine du projet :
```bash
npm run dev
```
Cette commande lance simultanément le **Backend (port 5000)** et le **Frontend (port 3000)** avec des logs colorés et clairs.

### 3. Démarrage Séparé (Optionnel)
- **Backend uniquement** : `npm run dev:backend` (ou `cd backend && npm run dev`)
- **Frontend uniquement** : `npm run dev:frontend` (ou `cd frontend && npm run dev`)
- **Installation des dépendances** : `npm run install:all`

* API Santé : **http://localhost:5000/api/health**
* Dashboard Web : **http://localhost:3000**

---

## 🔐 Identifiants Administrateur
- **Email** : `admin@gmail.com`
- **Mot de passe** : `AZERTY12345`

---

## ⚡ Fonctionnement Séquentiel (File d'Attente FIFO "One after One")

Le firmware ESP32 intègre un gestionnaire de file d'attente séquentielle exclusive :
1. **Arrosage Exclusif d'une seule zone à la fois** : La pompe applique 100% de sa pression et son débit (30 L/min) sur la zone en cours.
2. **Mise en file d'attente automatique** : Si des commandes arrivent pour la Zone 2 et la Zone 3 pendant que la Zone 1 arrose, elles sont placées dans la file d'attente (`[QUEUE] Zone X added to SEQUENTIAL QUEUE`).
3. **Transition Automatique** : Dès que la Zone 1 atteint son volume requis (`wateringL`) ou son seuil d'humidité cible (`targetSoilMoisturePct`), la vanne 1 se ferme et le système déclenche immédiatement la zone suivante en attente.
4. **Sécurité Hydraulique** : Si toutes les vannes sont fermées, la pompe se coupe automatiquement.

---

## 📡 Topics MQTT (HiveMQ Cloud)

### Commandes reçues par l'ESP32 :
* `hydrivia/zones/1/command` : `{"wateringL": 300, "targetSoilMoisturePct": 50}`
* `hydrivia/zones/2/command` : `{"wateringL": 300, "targetSoilMoisturePct": 50}`
* `hydrivia/zones/3/command` : `{"wateringL": 300, "targetSoilMoisturePct": 50}`

### Télémétrie publiée par l'ESP32 :
* `hydrivia/zones/{1,2,3}/state` (Toutes les 2s)
* `hydrivia/pump/state` (Toutes les 2s)
* `hydrivia/tank/state` (Toutes les 2s)
* `hydrivia/environment/state` (Toutes les 2s)
* `hydrivia/snapshot` (Toutes les 60s)
* `hydrivia/alerts` (En cas d'événement)
