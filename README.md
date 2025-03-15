# Diplomeo Scraper

Ce projet est un web scraper qui extrait les informations des écoles sur le site Diplomeo.

## Fonctionnalités

- Extraction des informations des écoles (nom, ville, secteur)
- Récupération des emails, numéros de téléphone et sites web des établissements
- Gestion automatique des popups de cookies
- Gestion de l'infinite scroll pour charger plus d'écoles
- Décodage des emails et URLs encodés par le site

## Prérequis

- Node.js v14+ 
- npm ou yarn

## Installation

1. Cloner ce dépôt :
```bash
git clone https://github.com/votre-utilisateur/diplomeo-scraper.git
cd diplomeo-scraper
```

2. Installer les dépendances :
```bash
npm install
# ou
yarn install
```

3. Installer les navigateurs pour Playwright :
```bash
npx playwright install chromium
```

## Utilisation

Plusieurs scripts sont disponibles :

### 1. Script principal avec toutes les fonctionnalités

```bash
node node-scraper-final.js
```

Ce script :
- Gère la popup de consentement des cookies
- Récupère la liste des écoles
- Tente de charger plus d'écoles en faisant défiler la page et en cliquant sur le bouton "Voir plus"
- Visite chaque page d'école pour extraire les informations de contact
- Décode les emails et sites web encodés
- Sauvegarde les données dans plusieurs fichiers JSON

### 2. Script simplifié (pour tests)

```bash
node node-scraper.js
```

### 3. Script avec pagination uniquement

```bash
node node-scraper-pagination.js
```

### 4. Script avec infinite scroll

```bash
node node-scraper-infinite.js
```

## Fichiers générés

- `schools_list.json` : Liste des écoles avec leurs URLs
- `schools_data_complete.json` : Données complètes des écoles
- `schools_data_cleaned.json` : Données nettoyées avec les emails et sites web correctement formatés
- Plusieurs captures d'écran pour le débogage

## Remarques importantes

### Format des données

Les emails et sites web sont encodés par Diplomeo pour empêcher le scraping automatisé. Ce script implémente un décodage spécifique pour récupérer les informations correctes.

Notez que certains emails peuvent avoir des suffixes incorrects (.frs au lieu de .fr ou .coms au lieu de .com) car le site utilise un encodage personnalisé.

### Limitations

- Le script ne récupère actuellement qu'environ 10-20 écoles, ce qui est probablement limité par la façon dont le site charge les résultats
- Le site web peut changer sa structure à tout moment, ce qui nécessiterait des mises à jour du script

### Performance

Le script est configuré avec `headless: false` pour le débogage. Pour une exécution plus rapide en production, changez cette valeur à `true` dans le fichier de script.

## Modifications possibles

- Ajouter un filtrage par secteur d'activité
- Ajouter une pagination manuelle ou d'autres approches pour récupérer plus d'écoles
- Implémenter un export vers CSV ou Excel
- Ajouter des proxies pour éviter les limitations de taux 