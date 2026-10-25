# Port du Système de Direction et Stabilité Automobile (Unity CarSteering)

## Architecture Intégrée
Le script Unity `CarSteering` a été fidèlement porté et branché dans le moteur physique Three.js :

1. **Courbe d'Angle Max selon la Vitesse (`maxAngleBySpeed`)** :
   - 0 km/h : 35° (manœuvres, épingles, demi-tour)
   - 60 km/h : 22° (virages urbains et moyens)
   - 120 km/h : 10° (courbes rapides)
   - 200 km/h et + : 5° (stabilité absolue à haute vitesse sur autoroute)

2. **Lissage de l'Entrée & Taux Asymétriques** :
   - Vitesse de braquage (`steerRate`) : 150°/s
   - Vitesse de retour au centre (`returnRate`) : 280°/s (recentrage quasiment 2x plus rapide pour éliminer tout flottement)
   - Amortissement haute vitesse (`highSpeedDamping`) : 0.5 à 180 km/h (`Mathf.MoveTowards`)

3. **Géométrie d'Ackermann (`ApplyAckermann`)** :
   - Empattement (`wheelBase`) : 2.6 m | Voie (`trackWidth`) : 1.5 m
   - La roue intérieure braque plus fort que la roue extérieure selon le rayon de braquage calculé.
   - Synchronisation visuelle exacte sur les pivots de roues `frontLeftPivot` et `frontRightPivot`.

4. **Aide au Contre-Braquage Automatique (`ComputeCounterSteer`)** :
   - Détection de l'angle de dérapage (*slip angle*) par rapport au vecteur de vitesse.
   - Application d'un contre-braquage automatique proportionnel (facteur 0.35, correction max 20°).
   - Désactivée en marche arrière.

5. **Stabilité, Appui Aérodynamique & Barre Anti-Roulis** :
   - `downforce = 30f` : charge verticale et adhérence proportionnelles à la vitesse.
   - `antiRollForce = 6000f` : contrôle strict du roulis de caisse dans les virages.
