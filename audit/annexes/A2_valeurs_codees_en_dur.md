# Annexe A2 — Inventaire des valeurs codées en dur et paramètres

Mise à jour du 21/11, après les corrections de l'audit (voir A4). Les emplacements sont ceux du code actuel.

| Élément | Valeur | Emplacement | Configurable ? | Observation |
|---|---|---|---|---|
| Quantité produite par défaut si vide/0 | 1 | `effectiveNbPortions`, `yieldCalculator.js` (utilisée par `calculateCosts.js:60`, `laborHours.js`, `analysisData.js`) | Non | Source unique depuis le 20/11. Signalée par `projectChecks` (`batch-size`) ; décision sur la valeur de remplacement en attente (voir A3) |
| Taille de portion par défaut si vide/0 | 1 | `calculateCosts.js` (sous-recette et marges) | Non | Signalée par `projectChecks` (`portion-size`) |
| Plafond du facteur de productivité | 100 % (valeur ≤ 0 ou > 100 → facteur 1) | `calculateCosts.js:62` | Non | Choix assumé : toute la paie est absorbée ; au-delà de 100 %, taux horaire plein |
| Perte d'ingrédient ignorée si ≥ 100 % ou ≤ 0 | seuil 100 % | `calculateCosts.js:138,235` | Non | Signalée par `projectChecks` (`loss-100`) |
| Rendement de ligne vide/0 → 100 % | — | `calculateCosts.js:144` | Non | Silencieux ; une valeur > 100 % est légitime (absorption d'eau) |
| Taux horaire chargé | taux × (1 + charges sociales) × (1 + vacances) | `loadedHourlyRate`, `utils.js:65` | Non | Formule unique depuis le 20/11 (avant : 8 copies) |
| Prix unitaire d'achat rendu | (prix − escompte + transport) ÷ format ; escompte borné à 0–100 % | `landedUnitPrice`, `utils.js:72` | Escompte et transport : oui (facultatifs) | Sans ces champs : prix ÷ format, comme avant |
| Canaux pris en compte | lignes prix/volume vers un canal existant | `activeChannelPrices`, `utils.js:83` | Non | Sans liste de canaux, rien n'est filtré |
| Vieillissement | intérêt simple : coûts directs × taux ÷ 12 × mois ; celui d'une sous-recette s'ajoute à celui du parent ; retiré de la marge de contribution du point mort | `calculateCosts.js:385` ; `analysisData.js` (segments, point mort global) | Taux et mois : oui | Coût d'opportunité pour le prix, pas une dépense réelle |
| Seuil d'ajustement des frais fixes non répartis | 0,05 $ | `analysisData.js:931` | Non | Masque ≤ 5 ¢ |
| Arrondi des allocations de frais fixes | 2 décimales (`round2`) | `analysisData.js:51-75` ; `utils.js` | Non | Arrondi ligne par ligne, résidu absorbé par le seuil ci-dessus |
| Facteurs de conversion | g=1, kg=1000, oz=28,3495, lb=453,592, tonne=1e6 ; ml=1, L=1000, cl=10, hL=1e5, fl oz=29,5735, gal US=3785,41, fl oz imp=28,4131, gal imp=4546,09 ; douzaine=12 | `utils.js:237` | Activation d'unités seulement | L'interface ne propose que des unités de la même famille ; densité implicite de 1 seulement si une donnée l'y force (avertie par `projectChecks`) |
| Unité inconnue | facteur 1 | `utils.js:284` | Non | Silencieux |
| Péremption des prix | 30 jours | `projectChecks.js:7` | Non | Avertissement seulement |
| Volatilité de prix | 10 % (modérée), 20 % (élevée) | `priceVolatility.js:10-11` | Non | Diagnostic |
| Analyse ABC | 70 % / 90 % cumulés | `analysisData.js:263-264` | Non | Diagnostic |
| Matrice de menu | 70 % de la part moyenne | `analysisData.js:827` | Non | Diagnostic |
| Moteur de répartition de Général par défaut | `directCost` | `calculateCosts.js:278` ; `analysisData.js` | Oui | Choix de l'utilisateur (aussi par activité) |
| Canal sans prix net ET sans volume | omis ; un volume vendu à 0 $ est conservé | `computeChannelBreakdown`, `calculateCosts.js` | — | Avertissement `sold-at-zero` |
| Devise | « $ » (affichage) | partout | Non | Aucune notion de devise ni de change |
| Taxes, transport, escomptes | transport et escompte : champs facultatifs ; taxes : saisir hors taxes récupérables | Ingrédients, Emballage | Oui | Guide et infobulles précisent le traitement |
| Fuseau horaire | date locale (`todayLocalISO`) ; horodatage des relevés en UTC (`SummaryTable.jsx:1204`) | `utils.js` | — | Sans effet sur les calculs de coût |
