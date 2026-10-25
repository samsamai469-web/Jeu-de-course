import { TrackSpec } from '../types/game';

/**
 * Configuration des 5 Grands Circuits & Corniches Panoramiques
 * Conçus pour allier fluidité extrême, vitesse pure et panoramas saisissants (Corniche en bord de mer, Canyon, Viaduc, Grand Prix) :
 * - Tracé fluide aux courbes larges et rapides (rayons amples de 150 à 350 m pour doubler à plus de 250 km/h)
 * - Dénivelés doux et progressifs (montées et descentes panoramiques sans cassures ni gondolage)
 * - 4 voies spacieuses (17,5 à 18 m de largeur) avec dégagements et vibreurs
 * - Ambiance visuelle spectaculaire et stylisée pour chaque niveau
 */
export const LEVELS: TrackSpec[] = [
  {
    id: 'level-1-corniche-azur',
    levelNumber: 1,
    name: 'Corniche Azur (Bord de Mer & Néons)',
    subtitle: 'Grand Boulevard Côtier · 4 Voies · 3 Adversaires · 2 Tours',
    location: 'Baie Métropolitaine · Nuit Étoilée & Arches Cyan',
    lengthKm: 3.8,
    defaultLaps: 2,
    aiCount: 3,
    aiSpeedFactor: 0.72,
    aiAggression: 0.35,
    difficulty: 'Facile',
    defaultTimeOfDay: 'night',
    defaultWeather: 'clear',
    roadWidth: 17.5,
    theme: 'city',
    biome: 'alpine',
    isStraight: false,
    targetGoldSec: 44,
    targetSilverSec: 52,
    targetBronzeSec: 62,
    challengeText: 'Dompter les grandes courbes de la corniche et finir dans le Top 3',
    description:
      'Splendide corniche côtière à 4 voies bordée par la mer et illuminée d’arches néon cyan. Grandes courbes rapides, longues lignes droites et vue panoramique.',
    waypoints: [
      // Longue ligne droite de départ/arrivée (parfaitement droite sur l'axe X = 0)
      [0, 0, 0],
      [0, 0, -130],
      [0, 0, -260],
      // Grande courbe nord fluide
      [45, 0, -370],
      [150, 0, -430],
      // Ligne droite transversale nord
      [280, 0, -430],
      [400, 0, -430],
      // Grande courbe est
      [495, 0, -370],
      [540, 0, -260],
      // Longue ligne droite retour parallèle
      [540, 0, -120],
      [540, 0, 20],
      [540, 0, 150],
      // Grande courbe sud de raccordement
      [490, 0, 260],
      [380, 0, 315],
      // Ligne droite sud
      [250, 0, 315],
      [130, 0, 315],
      // Courbe d'entrée + pré-grille droite avant la ligne de départ
      [35, 0, 265],
      [0, 0, 195],
      [0, 0, 100],
    ],
  },
  {
    id: 'level-2-cote-soleil',
    levelNumber: 2,
    name: 'Côte Sauvage & Plaines Dorées (Route Sablée & Or)',
    subtitle: 'Autoroute Panoramique Ensoleillée · 4 Adversaires · 2 Tours',
    location: 'Hautes Plaines Côtières · Plein Jour Lumineux',
    lengthKm: 4.2,
    defaultLaps: 2,
    aiCount: 4,
    aiSpeedFactor: 0.79,
    aiAggression: 0.48,
    difficulty: 'Facile',
    defaultTimeOfDay: 'morning',
    defaultWeather: 'clear',
    roadWidth: 17.5,
    theme: 'circuit',
    biome: 'countryside',
    isStraight: false,
    targetGoldSec: 48,
    targetSilverSec: 56,
    targetBronzeSec: 68,
    challengeText: 'Remonter le peloton à pleine vitesse sur les longues lignes droites et grandes courbes',
    description:
      'Route en béton clair doré en plein soleil avec double ligne centrale jaune, villas côtières et éoliennes. Alternance de longues lignes droites et de courbes fluides.',
    waypoints: [
      // Longue ligne droite de départ
      [0, 0, 0],
      [0, 0, -140],
      [0, 0, -280],
      // Courbe nord-ouest régulière
      [-50, 0, -395],
      [-165, 0, -450],
      // Ligne droite haute
      [-300, 0, -450],
      [-430, 0, -450],
      // Courbe ouest
      [-530, 0, -385],
      [-575, 0, -265],
      // Grande ligne droite ouest
      [-575, 0, -110],
      [-575, 0, 50],
      // Courbe sud-ouest suivie d'une ligne droite sud
      [-520, 0, 175],
      [-400, 0, 260],
      [-260, 0, 310],
      [-130, 0, 310],
      // Entrée et pré-grille parfaitement droite
      [-35, 0, 260],
      [0, 0, 195],
      [0, 0, 100],
    ],
  },
  {
    id: 'level-3-canyon-flamboyant',
    levelNumber: 3,
    name: 'Canyon des Cimes (Route Ocre & Orange)',
    subtitle: 'Grandes Lignes Droites & Courbes de Canyon · 5 Adversaires · 3 Tours',
    location: 'Massif des Falaises Rouges · Coucher de Soleil Doré',
    lengthKm: 4.5,
    defaultLaps: 3,
    aiCount: 5,
    aiSpeedFactor: 0.85,
    aiAggression: 0.62,
    difficulty: 'Intermédiaire',
    defaultTimeOfDay: 'sunset',
    defaultWeather: 'clear',
    roadWidth: 17.0,
    theme: 'coastal',
    biome: 'canyon',
    isStraight: false,
    targetGoldSec: 52,
    targetSilverSec: 60,
    targetBronzeSec: 72,
    challengeText: 'Franchir les gorges rocheuses à plus de 240 km/h et monter sur le podium',
    description:
      'Route ocre flamboyante bordée de monolithes rouges et de résidences au crépuscule. Longues sections droites ultra-rapides reliées par de grands virages francs.',
    waypoints: [
      // Ligne droite principale parfaitement rectiligne
      [0, 0, 0],
      [0, 0, -140],
      [0, 0, -280],
      // Virage nord-est ample
      [55, 0, -395],
      [175, 0, -455],
      // Ligne droite du canyon nord
      [320, 0, -455],
      [460, 0, -455],
      // Virage est
      [560, 0, -390],
      [600, 0, -270],
      // Ligne droite intermédiaire
      [600, 0, -130],
      [600, 0, 10],
      // Grand virage panoramique sud
      [540, 0, 140],
      [420, 0, 240],
      // Ligne droite sud de retour
      [280, 0, 285],
      [140, 0, 285],
      [35, 0, 245],
      [0, 0, 185],
      [0, 0, 95],
    ],
  },
  {
    id: 'level-4-viaduc-mer',
    levelNumber: 4,
    name: 'Viaduc Maritime de la Baie (Route Cyan & Mer)',
    subtitle: 'Pont Autoroutier Suspendu · Surplomb Océan · 6 Adversaires · 3 Tours',
    location: 'Grande Baie Océanique · Nuit Côtière & Pluie Fine',
    lengthKm: 4.8,
    defaultLaps: 3,
    aiCount: 6,
    aiSpeedFactor: 0.91,
    aiAggression: 0.82,
    difficulty: 'Intermédiaire',
    defaultTimeOfDay: 'night',
    defaultWeather: 'rain',
    roadWidth: 17.5,
    theme: 'coastal',
    biome: 'coastal',
    isStraight: false,
    targetGoldSec: 55,
    targetSilverSec: 64,
    targetBronzeSec: 76,
    challengeText: 'Dompter les lignes droites et courbes mouillées du viaduc marin face à 6 pilotes',
    description:
      'Immense viaduc autoroutier traversant la baie avec haubans lumineux turquoise, asphalte humide réfléchissant et longues travées droites au-dessus de l’eau.',
    waypoints: [
      // Longue travée droite de départ
      [0, 0, 0],
      [0, 0, -145],
      [0, 0, -290],
      // Grande courbe sur la baie
      [-55, 0, -405],
      [-175, 0, -465],
      // Travée droite nord
      [-320, 0, -465],
      [-460, 0, -465],
      // Courbe ouest du viaduc
      [-565, 0, -400],
      [-610, 0, -275],
      // Longue travée droite maritime ouest
      [-610, 0, -120],
      [-610, 0, 40],
      [-610, 0, 180],
      // Grande courbe sud
      [-545, 0, 295],
      [-420, 0, 355],
      // Travée droite sud
      [-270, 0, 355],
      [-135, 0, 355],
      [-35, 0, 285],
      [0, 0, 205],
      [0, 0, 105],
    ],
  },
  {
    id: 'level-5-grand-prix-arena',
    levelNumber: 5,
    name: 'Circuit Grand Prix International (Route Rouge Compétition)',
    subtitle: 'Arène Motorsport Ultime · 7 Adversaires d’Élite · 3 Tours',
    location: 'Arène Grand Prix · Stade Suréclairé & Vitesse Pure',
    lengthKm: 5.2,
    defaultLaps: 3,
    aiCount: 7,
    aiSpeedFactor: 0.97,
    aiAggression: 0.95,
    difficulty: 'Expert',
    defaultTimeOfDay: 'night',
    defaultWeather: 'clear',
    roadWidth: 17.5,
    theme: 'circuit',
    biome: 'volcano',
    isStraight: false,
    targetGoldSec: 58,
    targetSilverSec: 68,
    targetBronzeSec: 80,
    challengeText: 'Triompher des 7 pilotes d’élite sur le circuit de vitesse ultime',
    description:
      'Circuit de vitesse pure bordé de damiers rouge et blanc, portiques LED stadium, longues lignes droites de dépassement et grandes courbes paraboliques.',
    waypoints: [
      // Grande ligne droite des stands (parfaitement droite)
      [0, 0, 0],
      [0, 0, -150],
      [0, 0, -300],
      // Premier virage parabolique
      [60, 0, -420],
      [185, 0, -480],
      // Ligne droite opposée nord
      [340, 0, -480],
      [490, 0, -480],
      // Virage est
      [600, 0, -415],
      [645, 0, -285],
      // Longue ligne droite retour est
      [645, 0, -130],
      [645, 0, 30],
      [645, 0, 180],
      // Grande parabolique sud
      [585, 0, 305],
      [455, 0, 370],
      // Ligne droite sud
      [300, 0, 370],
      [150, 0, 370],
      // Dernier virage et pré-grille droite vers la ligne des stands
      [40, 0, 300],
      [0, 0, 215],
      [0, 0, 110],
    ],
  },
];
