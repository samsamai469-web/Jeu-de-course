# Apex Horizon 3D — Nouveaux Niveaux, Paramètres Avancés & Progression

Cette mise à jour enrichit **Apex Horizon 3D** avec 4 nouveaux grands niveaux ouverts aux biomes variés (portant le total à 7 circuits panoramiques sans murs étouffants ni zones d'obscurité), un panneau de paramètres de pilotage et de météo dynamique, un atelier de préparation mécanique dans le Garage, un rétroviseur central avec vue arrière et un système de progression par niveaux et médailles.

---

### Validation Utilisateur & Décisions Clés

> [!IMPORTANT]
> Toutes les options souhaitées lors de la phase de clarification ont été retenues et intégrées dans ce plan d'architecture.

- **Décision confirmée 1 — 4 Nouveaux Niveaux & Biomes Ouverts** : Ajout de *Canyon du Désert Rouge & Grand Pont*, *Col Alpin Enneigé & Lac Gelé*, *Autoroute Côtière Tropicale & Plage*, et *Vallée Volcanique & Route des Cimes* (en plus des 3 tracés existants), tous conçus à ciel ouvert avec distance de sécurité garantie sur chaque relief.
- **Décision confirmée 2 — Paramètres de Conduite, Météo & Caméra** : Intégration de la météo dynamique (*Clair, Pluie & Route Mouillée, Brouillard Dense, Neige Alpine*), du choix de transmission (*Automatique* ou *Manuelle Séquentielle avec palettes `-` / `+`*), des profils de comportement (*Adhérence GT, Mode Drift, Aides ABS/ESP*) et des réglages optiques (*Champ de vision FOV 45°–75°* et *Distance de caméra*).
- **Décision confirmée 3 — Gameplay, Garage Mécanique & Rétroviseur** : Ajout d'un système de progression (*Niveau de pilote, XP, Médailles Or/Argent/Bronze et défis par circuit*), d'un onglet de préparation mécanique dans le Garage (*Moteur, Turbo, Pneumatiques, Freins* de Niveau 1 à 3), d'un rétroviseur central en haut de l'écran avec bouton *Regarder derrière*, et du réglage du nombre d'adversaires IA et de la densité du trafic.

---

### 1. Vue d’Ensemble & Concept

- **Ce que fait cette mise à jour** : Transforme le jeu en une expérience de course et de conduite grand tourisme complète où chaque circuit possède son propre biome naturel (sable ocre et arches rocheuses, neige scintillante et lac glacé, lagon turquoise et palmiers, roche basaltique et rivières de lave), ses propres conditions d'adhérence météorologiques et une progression gratifiante.
- **Public & Expérience** : Joueurs sur mobile (Android / iPhone) et ordinateur recherchant à la fois des sensations de vitesse accessibles et des réglages de pilotage personnalisables à la carte.
- **Valeur Ajoutée** : Variété visuelle renouvelée à chaque niveau, contrôle total sur le comportement physique de la voiture (du grip pur au drift contrôlé) et objectifs de carrière clairs.

---

### 2. Expérience Utilisateur & Design Visuel

- **Parcours Utilisateur Clés** :
  1. **Sélection des Niveaux (7 Circuits Classés par Niveau)** : Le joueur parcourt les 7 circuits avec aperçu 3D en temps réel du biome, indicateur de difficulté, météo recommandée, médaille obtenue (Or, Argent, Bronze) et record personnel.
  2. **Garage — Esthétique & Préparation Mécanique** : En plus de la peinture et des jantes, un nouveau volet *Préparation Performance* permet d'améliorer 4 organes mécaniques (*Moteur, Turbo, Pneus, Freins* sur 3 paliers) avec mise à jour instantanée des jauges de vitesse, d'accélération, de tenue de route et de freinage.
  3. **Menu Paramètres Avancés** : Organisé en 4 sections claires (*Environnement & Météo*, *Pilotage & Transmission*, *Caméra & Rétroviseur*, *Trafic, IA & Audio*) permettant d'ajuster chaque paramètre en un clic, y compris depuis le menu Pause en pleine course.
  4. **En Course (HUD & Commandes)** :
     - **Rétroviseur central** optionnel en haut au centre (et bouton rapide *Vue Arrière* pour surveiller les dépassements).
     - **Palettes de vitesses `-` et `+`** affichées de part et d'autre du volant virtuel (ou touches `E` / `Q` / `PageUp` / `PageDown` sur clavier) lorsque la boîte manuelle est activée.
     - **Effets météo temps réel** : gouttes de pluie obliques et reflets humides sur l'asphalte sous la pluie, flocons tourbillonnants sur le col enneigé, et brume atmosphérique progressive.

- **Identité Visuelle & Thème** :
  - *Direction Esthétique* : Instrumentation automobile Grand Tourisme moderne, épurée et lisible, laissant plus de 85 % de l'écran libre pour la scène 3D.
  - *Palette de Couleurs* : Surfaces sombres translucides (`bg-slate-950/75 backdrop-blur-md border-white/15`), accents ambre course (`#f59e0b`), cyan nitro (`#06b6d4`), émeraude accélération (`#10b981`) et rouge compte-tours (`#ef4444`).
  - *Typographie & Hiérarchie* : Police géométrique sportive (`Chakra Petch`) pour les titres et compteurs de vitesse, associée à des chiffres tabulaires (`JetBrains Mono`, `tabular-nums`) pour les chronomètres, rapports de boîte et télémétrie.
  - *Mise en Page & Ergonomie Mobile* : Cibles tactiles d'au moins `48px`, commandes jamais superposées, étiquettes sur une seule ligne (`whitespace-nowrap shrink-0`).

---

### 3. Décisions Produit & Arbitrages Techniques

- **Décision 1 : Biomes 3D Procéduraux à Ciel Ouvert et Sans Collision de Décor**
  - *Approche choisie* : Chaque niveau applique une palette de matériaux PBR spécifique au terrain, à l'eau/glace/lave, aux formations rocheuses et à la végétation, tout en conservant l'algorithme de distance minimale garantie (`> 165 m` pour les montagnes, `> 75 m` pour les collines/dunes) afin qu'aucun relief ne coupe jamais la route.
  - *Pourquoi* : Garantit 0 % de bug de caméra dans le noir tout en offrant 7 ambiances visuelles radicalement différentes sans téléchargement lourd.
- **Décision 2 : Météo Dynamique & Physique d’Adhérence Couplées**
  - *Approche choisie* : Le choix de la météo (*Clair, Pluie, Brouillard, Neige*) modifie simultanément le rendu 3D (particules de pluie/neige, rugosité spéculaire de la route mouillée, densité du brouillard) et le coefficient d'adhérence physique (`gripFactor`), compensable par les pneus améliorés ou les aides *ABS/ESP*.
  - *Pourquoi* : Rend les nouveaux paramètres immédiatement perceptibles tant visuellement que volant en main.
- **Décision 3 : Sauvegarde Automatique de la Progression et des Réglages**
  - *Approche choisie* : Persistance locale (`localStorage`) du niveau de pilote, de l'XP, des médailles par circuit, des records au tour, des améliorations mécaniques de chaque voiture et de tous les paramètres.
  - *Pourquoi* : Permet au joueur de retrouver instantanément sa carrière, ses voitures préparées et ses réglages favoris à chaque session.

---

### 4. Architecture Technique & Modèle de Données

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        État Global & Persistance                            │
│  • Profil Pilote (Niveau, XP, Médailles Or/Argent/Bronze, Records par Piste)│
│  • Garage & Tuning (Esthétique + Niveaux 1..3 : Moteur, Turbo, Pneus, Freins)│
│  • Paramètres Avancés (Météo, Transmission, Mode Drift, ABS/ESP, FOV, IA)   │
└───────────────┬─────────────────────────────────────────────┬───────────────┘
                │                                             │
                ▼                                             ▼
┌───────────────────────────────────────┐   ┌─────────────────────────────────┐
│       Moteur 3D & Physique            │   │   Interface & Commandes (HUD)   │
│  • Générateur de 7 Niveaux / Biomes   │   │  • Sélecteur des 7 Niveaux      │
│    (Alpin, Campagne, Océan, Canyon,   │   │    avec Défis & Médailles       │
│     Neige, Tropical, Volcanique)      │   │  • Garage : Onglets Esthétique  │
│  • Système Météo 3D (Pluie, Neige,    │   │    & Préparation Mécanique      │
│    Brouillard, Asphalte Mouillé)      │   │  • Rétroviseur Central & Bouton │
│  • Physique : Boîte Auto/Manuelle,    │   │    Vue Arrière instantanée      │
│    Mode Drift, ABS/ESP, Trafic & IA   │   │  • Volant + Palettes Vitesses   │
│  • Caméra : FOV & Distance réglables  │   │    (- / +) en mode Manuel       │
└───────────────────────────────────────┘   └─────────────────────────────────┘
```

- **Modèle de Données & Entités** :
  - **7 Niveaux (`TrackSpec`)** avec identifiant de biome (`alpine`, `countryside`, `coastal`, `canyon`, `snow`, `tropical`, `volcano`), objectifs de médailles (Or / Argent / Bronze) et défis dédiés.
  - **Préparation Mécanique (`CarPerformanceUpgrades`)** : `engineLevel` (1–3), `turboLevel` (1–3), `tiresLevel` (1–3), `brakesLevel` (1–3) appliquant des multiplicateurs réels sur la vitesse de pointe, le couple, le grip et la décélération.
  - **Nouveaux Paramètres (`GameSettings`)** :
    - `weather`: `'clear' | 'rain' | 'fog' | 'snow'`
    - `transmission`: `'auto' | 'manual'`
    - `drivingStyle`: `'grip' | 'balanced' | 'drift'`
    - `absEspEnabled`: `boolean`
    - `cameraFovOffset`: `number` (`-8` à `+12` degrés)
    - `cameraDistanceOffset`: `number` (`-1.2` à `+2.0` mètres)
    - `rearViewMirror`: `boolean`
    - `aiCount`: `number` (`0` à `7` adversaires)
    - `trafficDensity`: `'off' | 'light' | 'dense'`
- **Interactions & Flux d’État** :
  - Le passage en transmission *Manuelle* active les boutons de changement de rapport `-` / `+` sur l'interface tactile et au clavier, désactive le passage automatique des 6 rapports et permet de maintenir le régime moteur optimal en dérapage.
  - Le maintien du bouton *Vue Arrière* (ou touche `B` / clic sur le rétroviseur) oriente momentanément la caméra à 180° vers l'arrière sans interrompre la direction ni l'accélération.
  - À la fin de chaque course, l'écran de résultats calcule l'XP gagnée, décerne la médaille correspondante, met à jour le niveau du pilote et sauvegarde automatiquement la progression.
