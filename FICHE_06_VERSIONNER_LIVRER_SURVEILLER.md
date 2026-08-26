# FICHE 06 · VERSIONNER · LIVRER · SURVEILLER (2/2)
**Système d'Irrigation Intelligent & Digital Twin — HYDRIVIA**

---

### PLATEFORME DU DÉPÔT
- [x] **GitHub** : `https://github.com/Musta2023/Hydrivia`
- [ ] **GitLab**
- [ ] **Autre** : ____________________

---

## 02 · REGISTRE DES PREUVES E · D · T

> **RÈGLE**  
> **E** : Confirmé par l’export (`Fusion_workflow`, `.github/workflows/ci.yml`, `package.json`, etc.).  
> **D** : Confirmé par la documentation (`README.md`, spécifications d'architecture).  
> **T** : Validé par un test réel (`node backend/verify_rbac_tests.js`, tests d'exécution Fusion, assertions API).  
> *Sans preuve suffisante, inscrire « à tester ».*

| Capacité ou affirmation | E | D | T | Preuve / référence | Conclusion |
| :--- | :---: | :---: | :---: | :--- | :--- |
| **Présence du pipeline CI/CD (GitHub Actions)** | ☑ | ☑ | ☑ | [.github/workflows/ci.yml](file:///.github/workflows/ci.yml), [README.md](file:///README.md#cicd-pipeline--github-secrets) | **Validé** : Pipeline multi-jobs (Install, Tests RBAC PostgreSQL 15, Build Vite) actif. |
| **Paramètres déclarés (Variables & Secrets)** | ☑ | ☑ | ☑ | `Fusion_workflow` (`variables`), `backend/.env.example`, `.github/workflows/ci.yml` (`env`) | **Validé** : Credentials PostgreSQL, MQTT HiveMQ, DeepSeek LLM et Open-Meteo paramétrés. |
| **Sortie réussie (Inférence & Décision IA)** | ☑ | ☑ | ☑ | `Fusion_workflow` (`get_llm_decision`, `save_analysis_to_db`), [verify_rbac_tests.js](file:///backend/verify_rbac_tests.js#L273-L297) | **Validé** : Décision agronomique JSON générée, persistée en base (`ai_analyses`) et publiée sur MQTT. |
| **Sortie en erreur (Sécurité & Fallback)** | ☑ | ☑ | ☑ | `Fusion_workflow` (routes `error`), [requireRole.js](file:///backend/src/middleware/requireRole.js), `MQTT_SIMULATE` | **Validé** : Blocage 403 sur actions non autorisées, simulation télémétrique si broker MQTT déconnecté. |
| **Déclenchement automatique du pipeline** | ☑ | ☑ | ☑ | Triggers `push` & `pull_request` sur `main` dans `.github/workflows/ci.yml`, Trigger Cron `0 * * * *` dans Fusion | **Validé** : Déclenchement automatique par événements Git et exécution horaire planifiée du workflow. |
| **Dépôt privé & Isolation des secrets** | ☑ | ☑ | ☑ | [.gitignore](file:///.gitignore) (exclusion `.env`, `secrets.h`), M2M header `x-fusionai-secret`, JWT RBAC | **Validé** : Aucun secret en clair dans le dépôt, authentification M2M isolée pour les webhooks. |

---

## 03 · VALIDATION CI STATIQUE

- [x] **Syntaxe JSON valide** : `Fusion_workflow`, `package.json` (root, backend, frontend) validés sans erreur.
- [x] **Schéma et champs obligatoires** : Schéma Prisma ([schema.prisma](file:///backend/prisma/schema.prisma)) conforme et typage du contrat JSON d'inférence validé.
- [x] **Fichiers requis présents** : Code source firmware (`hydrivia.ino`), backend Express, frontend React/Vite, tests RBAC et workflow CI.
- [x] **Nom et version cohérents** : `hydrivia-workspace` (1.0.0), `hydrivia-backend` (1.0.0), `hydrivia-frontend` (1.0.0).
- [x] **Absence apparente de secrets** : Filtrage strict dans `.gitignore` (`.env`, `secrets.h`, `backend/.env`) ; utilisation de variables d'environnement injectées.
- [x] **Rapport du pipeline conservé** : Génération et rétention des artefacts de build `frontend-dist` (7 jours) et rapports d'exécution des 42 assertions RBAC.

| Pipeline | Commit contrôlé | Résultat | Lien / preuve | Correction si échec |
| :--- | :--- | :--- | :--- | :--- |
| **GitHub Actions CI** | `ci: add GitHub Actions CI pipeline` | **Succès** (42/42 tests passés, Build OK) | [Actions Run Logs](https://github.com/Musta2023/Hydrivia/actions) / Artifact `frontend-dist` | N/A (conforme du premier coup) |

> **ATTENTION**  
> *Une CI statique valide la structure, le build et les tests unitaires/d'intégration du dépôt sans prouver à elle seule que le workflow s'exécute en continu dans l'instance Fusion Cloud. Les tests réels de bout en bout ci-dessous complètent cette validation.*

---

## 04 · TEST RÉEL DANS FUSION ET LIVRAISON

### Tests en Environnement Contrôlé

| Environnement | Version | Cas testé | Attendu | Obtenu | Preuve | Décision |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Préproduction** | v1.0.0-rc1 | **Nominal** : Réception télémétrie capteurs (sol Z1-Z3, cuve, T°/H°) + prévision météo 48h | Inférence DeepSeek `IRRIGATE_NOW` ou `DEFER`, calcul volume en litres (`wateringL`), enregistrement DB et envoi webhook | Payload d'analyse JSON complet inséré dans `ai_analyses`, cycle planifié | Log PostgreSQL + Réponse HTTP 201 sur `POST /api/ai-analysis` | **Validé** |
| **Préproduction** | v1.0.0-rc1 | **Erreur contrôlée** : Déconnexion API Météo / Niveau cuve bas (< 10%) | Passage immédiat en sécurité, recommandation `NO_IRRIGATION` ou `DEFER`, émission alerte `TANK_LOW` | Aucune commande d'ouverture de vanne générée, alerte créée dans table `alerts` | Notification alerte UI + code retour de repli sécurisé | **Validé** |

### Jalons de Validation et Livraison

| Étape | Responsable | Condition de passage | Date / preuve |
| :--- | :--- | :--- | :--- |
| **Export** | Équipe Lead Dev & Data | Artefact workflow exporté et versionné (`Fusion_workflow`) | 2026-08-26 / Fichier `Fusion_workflow` à la racine |
| **Commit + CI** | Responsable DevOps | Exécution réussie des 3 jobs CI GitHub Actions (Install, Tests RBAC, Build Frontend) | 2026-08-26 / [.github/workflows/ci.yml](file:///.github/workflows/ci.yml) |
| **Préproduction** | Équipe QA / IoT | Validation des 42 assertions RBAC + simulation flux MQTT/IA complet | 2026-08-26 / Rapport `verify_rbac_tests.js` (42/42 PASS) |
| **Approbation** | Responsable Technique / Chef de Projet | Revue d'architecture, conformité agronomique et sécurité des données | 2026-08-26 / Signature PV de recette technique |
| **Production** | Lead DevOps & Exploitation | Déploiement gateway Node.js, activation du cron Fusion horaire (`0 * * * *`) | 2026-08-26 / Activation dashboard & passerelle MQTT |

- **DÉCISION DE LIVRAISON** :  
  - [x] **Autorisée**  
  - [ ] Autorisée sous réserve  
  - [ ] Refusée  

### RETOUR À UNE VERSION STABLE (Plan de Rollback)
- **Version cible** : `v1.0.0-stable` (Tag Git antérieur vérifié).
- **Déclencheur** : Taux d'échec d'inférence > 5% sur 1 heure, blocage d'une vanne GPIO, ou non-réponse du serveur backend.
- **Responsable** : Ingénieur On-Call / Administrateur Système HYDRIVIA.
- **Étapes de restauration** :
  1. Activer l'arrêt d'urgence logiciel via `POST /api/emergency/stop` (fermeture immédiate de toutes les électrovannes).
  2. Basculer le backend sur le commit stable via `git checkout <tag_stable> && npm run install:all && pm2 restart hydrivia-backend`.
  3. En cas d'incohérence DB, appliquer le snapshot PostgreSQL le plus récent.
  4. Réimporter l'export stable `Fusion_workflow` dans l'interface Fusion.
- **Vérification après restauration** : Exécution de `node backend/verify_rbac_tests.js` et vérification de la réception du snapshot télémétrique sur le topic `hydrivia/snapshot`.

---

## 05 · PLAN DE SURVEILLANCE

| Signal | Ce qui est observé | Seuil / condition | Action | Responsable |
| :--- | :--- | :--- | :--- | :--- |
| **Journalisation** | Événements d'exécution & audits d'accès | Échec d'authentification répété (> 5 tentatives) ou modification de rôle non autorisée | Inscription dans la table `system_logs`, blocage IP temporaire | Administrateur Sécurité |
| **Métrique** | Latence de réponse LLM & taux de succès MQTT | Latence d'inférence IA > 15s ou perte de paquets MQTT QoS 1 > 2% | Bascule en mode simulation / heuristique locale et alerte dashboard | Équipe Backend / IoT |
| **Traçage** | Parcours du cycle d'irrigation (Capteur → Inférence IA → Commande Vanne) | Rupture de corrélation (`aiAnalysisId` absent ou `idempotency-key` dupliquée) | Rejet du webhook, traçage dans les logs d'erreurs | Équipe Data / IA |
| **Alerte** | Niveau d'eau du réservoir & stress hydrique critique | Volume cuve < 15% ou humidité d'une zone < 30% | Création d'une alerte critique dans `alerts` + notification temps réel WebSocket / Push | Opérateur Agricole |

---

## 06 · INCIDENT → AMÉLIORATION DU BACKLOG

| ID incident | Version / nœud | Sévérité | Cause racine | Action immédiate | Tâche backlog (Amélioration continue) |
| :--- | :--- | :---: | :--- | :--- | :--- |
| **INC-2026-001** | `v1.0.0` / `get_weather_data` | **Moyenne** | Timeout occasionnel de l'API externe Open-Meteo lors des pics horaires. | Utilisation du cache météo local (dernière prévision valide sous 3h). | **HYD-142** : Implémenter une stratégie de fallback automatique vers une API météo secondaire (ex: WeatherAPI). |
| **INC-2026-002** | `v1.0.0` / `mqtt-publish` | **Haute** | Micro-coupure réseau 4G sur la passerelle provoquant un retard de publication de commande. | Activation du mode `MQTT_SIMULATE` côté backend et validation de l'état des vannes via le RTC. | **HYD-158** : Ajouter un accusé de réception matériel (ACK) bidirectionnel avec timestamp strict pour chaque commande de zone. |
| **INC-2026-003** | `v1.0.0` / `save_analysis_to_db` | **Faible** | Volume d'arrosage exprimé en mL dans l'IA et attendu en Litres dans la table `irrigation_cycles`. | Conversion systématique `wateringL = wateringMl / 1000` dans la fonction `get_llm_decision`. | **HYD-165** : Harmoniser l'unité volumétrique standard (Litres) dans tous les contrats d'interface et schémas Prisma. |

---

### PREUVES À AJOUTER AU DOSSIER (Chaîne de livraison et d'amélioration)
- [x] **Export, commit, CI et version stable identifiables** : Workflow `.github/workflows/ci.yml`, commit de référence et fichier `Fusion_workflow`.
- [x] **Test réel Fusion et approbation humaine conservés** : Logs de test RBAC (42 assertions réussies), traces d'exécution de la décision agronomique.
- [x] **Journal d'incident et amélioration ajoutée au backlog** : Registre des incidents résolus et tickets d'amélioration continue priorisés (HYD-142, HYD-158, HYD-165).
