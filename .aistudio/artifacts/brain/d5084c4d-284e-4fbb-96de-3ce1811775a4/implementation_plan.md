# Adaptation Complète de l'Architecture « Car Parking Multiplayer » (ID 1374868881)

Ce plan détaille la transformation et l'adaptation de l'application pour reproduire fidèlement l'interface, les mécaniques de conduite, les défis de stationnement, le monde ouvert urbain et le système de tuning complet de **Car Parking Multiplayer** (Olzhass).

## User Review & Critical Decisions

> [!IMPORTANT]
> Conformément à vos réponses (« Comme ce qui est dans le lien que je t'ai donné »), l'intégralité des comportements emblématiques de **Car Parking Multiplayer** est retenue dans ce plan. Aucun fichier de code n'a encore été modifié : cliquez sur **Proceed** (Accepter) si ce plan vous convient, ou indiquez vos ajustements.

- **Décision Confirmée 1 — Modes de Jeu Complets (`Levels`, `SinglePlayer / Free Drive`, `Police / Roleplay`)** : Intégration des défis de stationnement de précision (**Levels** avec cônes, barrières et zones de parking vertes qui passent au vert vif à l'arrêt complet) ainsi que du mode **Monde Ouvert Urbain & Autoroute** avec stations-service actives, ateliers mécaniques et circulation.
- **Décision Confirmée 2 — Poste de Pilotage & HUD Authentique** : Intégration du sélecteur de boîte de vitesses **P / R / N / D** (et mode manuel séquentiel/embrayage), bouton de **Frein à main (P)**, commandes d'éclairage (**Clignotant Gauche**, **Clignotant Droit**, **Feux de détresse / Warnings**, **Phares**), **Klaxon**, démarrage moteur (**Start/Stop Engine**), jauge de carburant et bouton **Sortir du véhicule à pied (Free Walk)**.
- **Décision Confirmée 3 — Garage & Tuning Mécanique/Châssis Complet** : Extension du menu Garage avec les 3 ateliers signatures de *Car Parking Multiplayer* :
  1. **Car Upgrade (Moteur & Dyno)** : Choix de moteurs (V6, V8 BiTurbo, V10, W16), Triple Turbo, Échappement, Pneus, Freins avec calcul en temps réel des **HP (Chevaux)** et **Nm (Couple)** + monnaie du jeu (**Crédits $**).
  2. **Suspension & Stance** : Réglage précis de l'**inclinaison des roues (Camber / Carrossage)**, de la **hauteur de caisse (Suspension Travel / Ride Height)**, du **déport des roues (Offset)** et du centre de gravité, visibles immédiatement en 3D sur la voiture.
  3. **Exterior (Carrosserie & Vitres)** : Peinture carrosserie, teinte des vitres (**Window Tint**), couleur de la fumée de pneus (**Tire Smoke Color**), jantes et kits carrosserie.

---

## 1. Overview & Core Concept

- **Ce que fait l'application** : Un simulateur 3D de conduite, de stationnement de précision et de monde ouvert urbain inspiré directement de *Car Parking Multiplayer*. Le joueur peut relever des missions de stationnement millimétrées sans toucher d'obstacles, explorer librement une ville et ses autoroutes, faire le plein dans des stations-service, descendre de sa voiture à pied pour l'admirer sous tous les angles, et régler chaque détail mécanique et esthétique au garage.
- **Public cible & Expérience** : Joueurs recherchant à la fois le réalisme des manœuvres à basse vitesse (créneau, marche arrière, boîte P-R-N-D, clignotants) et le plaisir de la conduite libre ou sportive avec un véhicule entièrement personnalisé.
- **Valeur clé** : Une fidélité totale aux commandes tactiles et clavier de *Car Parking Multiplayer*, combinée à une fluidité 60 FPS et des bâtiments/maisons 3D réalistes.

---

## 2. User Experience & Visual Design

- **Parcours Utilisateur Clés (User Flows)** :
  1. **Accueil Showroom 3D & Économie ($)** : Le joueur voit sa voiture en 3D dans le showroom interactif (rotation caméra à 360° au doigt/souris), son solde en **Crédits ($)** en haut, et accède à **Start** (`Levels`, `Free Drive City`, `Circuit Race`), **Garage** (`Upgrade`, `Suspension`, `Exterior`) ou **Drivers / Settings**.
  2. **Défis de Stationnement (`Levels`)** : Le joueur démarre dans un parcours balisé par des cônes et barrières. Un guide directionnel mène vers la **Zone de Parking `[P]`** lumineuse. Si la voiture touche un cône ou un trottoir, une alerte de collision s'affiche ; lorsque les 4 roues sont alignées dans le rectangle et que la voiture s'arrête (ou passe en `P`), la zone devient verte et valide le niveau avec récompense en Crédits ($).
  3. **Monde Ouvert Urbain (`Free Drive`)** : Le joueur circule librement entre les immeubles, maisons, stations-service et parkings. En s'arrêtant sur la zone d'une **Station-Service**, le réservoir d'essence se remplit en temps réel. À l'arrêt, le joueur peut appuyer sur l'icône **Piéton (Marche libre)** pour descendre du véhicule, marcher autour en 3D et remonter à bord.
- **Identité Visuelle & Thème** :
  - *Direction Esthétique* : Interface automobile tactique sombre et contrastée, fidèle à l'ergonomie mobile/desktop de *Car Parking Multiplayer*.
  - *Palette de Couleurs* : Surfaces ardoise sombre translucides (`#090d16` / `slate-950/85`), accents ambre course (`#f59e0b`) pour les sélections actives, vert émeraude (`#22c55e`) pour la validation de parking et les clignotants, et rouge vif (`#ef4444`) pour le freinage et la zone rouge du compte-tours.
  - *Typographie & Hiérarchie* : Police géométrique sportive pour les titres et compteurs, associée à des chiffres tabulaires (`tabular-nums`) pour la vitesse (KM/H), le régime moteur (RPM), les chevaux (HP/Nm), la jauge d'essence et les crédits ($).
  - *Disposition du HUD en Jeu* :
    - **Haut-Gauche** : Mini-carte radar GPS circulaire + indicateur d'heure/météo + bouton **Sortir à pied** et **Démarrer/Arrêter Moteur**.
    - **Haut-Centre** : Rétroviseur panoramique + barre d'objectif (progression du défi de parking ou distance de la zone `[P]`) + boutons de **Clignotants (`◄`, `⚠️`, `►`)**, **Phares** et **Klaxon**.
    - **Haut-Droite** : Caméra (incluant la **Vue du dessus / Top-Down Parking Cam** idéale pour les créneaux et la **Vue Orbite 360°**), Rétablir, Audio et Pause.
    - **Bas-Gauche** : Volant rotatif réaliste (ou flèches / inclinaison) + Grand cadran Compte-tours (RPM) avec vitesse numérique, odomètre et **jauge de carburant**.
    - **Bas-Droite** : Sélecteur vertical tactile **P / R / N / D** + bouton **Frein à main `((!))`** + bouton **Turbo NOS** + Pédales de **Frein** et **Accélérateur**.

---

## 3. Key Product Decisions & Trade-Offs

- **Décision 1 — Boîte de vitesses P-R-N-D authentique vs Marche arrière automatique sur la pédale de frein**
  - *Approche choisie* : Intégrer le vrai levier tactile vertical **P - R - N - D** à gauche des pédales (comme dans *Car Parking Multiplayer*). En position **D**, l'accélérateur fait avancer et la pédale de gauche freine uniquement. En position **R**, l'accélérateur fait reculer avec feux de recul blancs et bip de recul optionnel, et la pédale de gauche freine. En position **P**, les roues sont bloquées (frein de parking). Une option dans les paramètres permet aussi de garder le mode classique si souhaité.
  - *Pourquoi* : Dans *Car Parking Multiplayer*, le passage explicite entre `D` (Drive) et `R` (Reverse) avec l'accélérateur progressif est essentiel pour réussir un créneau ou une manœuvre de précision sans reculer par erreur en freinant.
- **Décision 2 — Physique de Manœuvre Basse Vitesse + Réglages Châssis (Camber & Suspension)**
  - *Approche choisie* : Ajouter un modèle de braquage précis à basse vitesse (rayon de braquage réaliste jusqu'à 38° pour les créneaux, rampe douce de l'accélérateur à bas régime) tout en appliquant visuellement et physiquement la hauteur de suspension et l'angle de carrossage (**Camber** de `0°` à `-12°`) sur les 4 groupes de roues 3D.
  - *Pourquoi* : Permet à la fois de garer la voiture au centimètre près dans les défis de parking et d'obtenir le look « Stance / Camber » emblématique du jeu.
- **Décision 3 — Mode Marche Libre (Free Walk) & Stations-Service Intégrés au Moteur 3D**
  - *Approche choisie* : Permettre au joueur à l'arrêt de basculer en mode **Piéton 3D** (avatar stylisé articulé ou vue première/troisième personne autour de la voiture garée, phares et warnings restant actifs sur la voiture) et placer des stations-service éclairées au bord de la route où l'on peut faire le plein d'essence.
  - *Pourquoi* : Ce sont deux fonctionnalités signatures qui distinguent *Car Parking Multiplayer* d'un simple jeu de course.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Architecture & Component Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        État Global & Persistance Locale                      │
│  • Argent ($ Crédits), Voitures débloquées, Niveaux Parking & Course         │
│  • Tuning Moteur (HP / Nm : Moteur, Turbo, Échappement, Puce, Freins, Pneus) │
│  • Réglages Suspension (Ride Height, Camber °, Wheel Offset, Inclinaison)    │
│  • Personnalisation (Peinture, Vitres Teintées, Fumée Pneus, Jantes, Kits)   │
└───────────────┬──────────────────────────────────────────────┬───────────────┘
                │                                              │
                ▼                                              ▼
┌───────────────────────────────────────┐    ┌─────────────────────────────────┐
│      Interface Menus & Garage 3D      │    │   Moteur WebGL 3D & Physique    │
│  ┌─────────────────────────────────┐  │    │  ┌───────────────────────────┐  │
│  │ Sélecteur de Modes :            │  │    │  │ Physique Véhicule :       │  │
│  │ • Défis Parking (Levels)        │  │    │  │ • Boîte P / R / N / D     │  │
│  │ • Monde Ouvert (Free Drive)     │  │    │  │ • Braquage précision 38°  │  │
│  │ • Course & Contre-la-montre     │  │    │  │ • Consommation Carburant  │  │
│  └─────────────────────────────────┘  │    │  └───────────────────────────┘  │
│  ┌─────────────────────────────────┐  │    │  ┌───────────────────────────┐  │
│  │ Garage 3 Onglets :              │  │    │  │ Scène 3D & Interactions : │  │
│  │ • Exterior (Peinture, Vitres)   │  │    │  │ • Zones Parking [P] & Cônes│  │
│  │ • Suspension (Camber, Hauteur)  │  │    │  │ • Stations-Service (Plein)│  │
│  │ • Engine Dyno (V8/W16, HP, Nm)  │  │    │  │ • Clignotants & Feux Recul│  │
│  └─────────────────────────────────┘  │    │  │ • Mode Piéton (Free Walk) │  │
└───────────────────────────────────────┘    └────────────────┬────────────────┘
                                                              │
                                                              ▼
                                             ┌─────────────────────────────────┐
                                             │   Poste de Pilotage (HUD)       │
                                             │  • Levier P - R - N - D + Frein │
                                             │  • Clignotants (◄ ⚠️ ►) & Phares│
                                             │  • Klaxon, Moteur Start/Stop    │
                                             │  • Caméra Parking Vue Dessus    │
                                             │  • Compte-tours + Jauge Essence │
                                             └─────────────────────────────────┘
```

### Data Model & State

- **Système de Tuning & Châssis (`CarCustomization` & `CarPerformanceUpgrades`)** :
  - Ajout des paramètres de châssis : `rideHeight` (`-0.08m` à `+0.08m`), `camberAngleDeg` (`0°` à `-12°`), `wheelOffset` (`0` à `+0.08m`), `windowTintOpacity` (`0.25` à `0.92`), `windowTintColor`, et `tireSmokeColor` (blanc, bleu, rouge, jaune, violet).
  - Calcul dynamique de la fiche technique Dyno : puissance en **HP** (ex. `420 HP` → `1250 HP` avec swap W16 + Triple Turbo) et couple en **Nm** (`550 Nm` → `1500 Nm`).
- **État Temps Réel du Véhicule (`TouchInputState` & `TelemetryState`)** :
  - Sélecteur de transmission : `shifterPos: 'P' | 'R' | 'N' | 'D'`.
  - Éclairage & Signalisation : `leftSignal: boolean`, `rightSignal: boolean`, `hazardLights: boolean`, `headlightsMode: 'off' | 'low' | 'high'`, `hornActive: boolean`, `engineRunning: boolean`, `handbrakePulled: boolean`.
  - Simulation & Monde Ouvert : `fuelPercent` (`0` à `100%`), `refueling: boolean`, `isWalking: boolean` (position et orientation du joueur à pied), `parkingStatus: 'approaching' | 'inside' | 'aligned' | 'parked_success' | 'cone_hit'`.

### Interactive Component & State Mapping

- **Sélecteur P / R / N / D & Frein à Main** : Cliquer sur `P`, `R`, `N` ou `D` change immédiatement le rapport engagé avec retour sonore mécanique. En `R`, les feux arrière blancs de recul s'allument sur la voiture 3D et la caméra peut basculer ou afficher les lignes de guidage de recul.
- **Clignotants, Warnings & Phares 3D** : Activer le clignotant gauche (`◄`), droit (`►`) ou les feux de détresse (`⚠️`) fait clignoter à 90 BPM les feux orange avant/arrière sur le modèle 3D de la voiture ainsi que les témoins lumineux sur le tableau de bord, accompagné du « tic-tac » authentique de relais de clignotant dans le moteur audio.
- **Défis de Stationnement (`Parking Challenges`)** : Génère sur la piste des couloirs de cônes de signalisation 3D, des barrières de chantier et une place de stationnement rectangulaire `[P]` avec flèche d'orientation. Le moteur vérifie à chaque frame la boîte englobante (OBB) de la voiture :
  - Collision avec un cône → pénalité / échec immédiat avec bouton de réessai rapide.
  - Voiture entièrement dans la zone `[P]` + angle aligné (`±12°`) + vitesse nulle (`< 0.5 km/h`) → validation à 100%, attribution des étoiles et gain de Crédits ($).
- **Stations-Service & Mode Piéton (`Free Walk`)** :
  - S'arrêter près d'une pompe à essence 3D ouvre un bandeau interactif **« Faire le plein (+Litres) »** qui remplit la jauge de carburant.
  - Cliquer sur le bouton **Piéton** lorsque la voiture est arrêtée fait apparaître le personnage à côté de la portière conducteur : les commandes déplacent alors le joueur à pied autour de sa voiture (qui reste garée avec ses réglages de carrossage, sa peinture et ses clignotants actifs) jusqu'à ce qu'il clique à nouveau sur **Monter en voiture**.
