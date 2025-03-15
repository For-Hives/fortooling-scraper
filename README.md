# Diplomeo Scraper

Un outil de scraping pour extraire des informations sur les écoles depuis le site Diplomeo.

## Structure du projet

```
diplomeo-scraper/
├── data/               # Données extraites (JSON)
│   └── archive/        # Archives des précédentes extractions
├── screenshots/        # Captures d'écran générées pendant le scraping
│   └── archive/        # Archives des précédentes captures d'écran
├── scripts/            # Scripts d'exécution
│   ├── scrape-all.js   # Lance le scraper en mode normal
│   ├── scrape-headless.js # Lance le scraper en mode headless (production)
│   └── node-scraper-legacy.js # Ancienne version pour référence
├── src/                # Code source principal
│   ├── scraper.js      # Script principal de scraping
│   └── utils/          # Modules utilitaires
│       ├── cookieConsentHandler.js # Gestion des popups de cookies
│       ├── schoolExtractor.js      # Extraction des données des écoles
│       └── scraperUtils.js         # Fonctions utilitaires diverses
├── package.json        # Dépendances et scripts
└── README.md           # Documentation
```

## Fonctionnalités

- Extraction des informations de contact (email, téléphone, site web) des écoles
- Gestion automatique de la popup de consentement des cookies
- Support du chargement progressif via le bouton "Voir plus"
- Support de la pagination
- Extraction robuste avec plusieurs stratégies de secours
- Nettoyage et correction des données extraites
- Sauvegarde régulière des données intermédiaires

## Prérequis

- Node.js 14+
- npm ou yarn

## Installation

1. Cloner le dépôt
   ```
   git clone https://github.com/votre-utilisateur/diplomeo-scraper.git
   cd diplomeo-scraper
   ```

2. Installer les dépendances
   ```
   npm install
   ```

3. Installer les navigateurs de Playwright
   ```
   npx playwright install chromium
   ```

## Utilisation

### Mode développement (avec interface graphique)

```
node scripts/scrape-all.js
```

ou

```
npm run scrape
```

### Mode production (sans interface graphique)

```
node scripts/scrape-headless.js
```

ou

```
npm run scrape:headless
```

## Données extraites

Les données sont sauvegardées dans le dossier `data/` au format JSON :

- `schools_list.json` : Liste des écoles trouvées avec leur URL
- `schools_data_complete.json` : Données complètes des écoles
- `schools_data_cleaned.json` : Données nettoyées avec corrections
- `schools_data_progress.json` : Sauvegarde intermédiaire pendant l'exécution

## Captures d'écran

Les captures d'écran sont sauvegardées dans le dossier `screenshots/` pour aider au diagnostic et à la vérification du processus de scraping.

## Problèmes connus

- Le bouton "Voir plus" peut parfois ne pas être détecté correctement si le site change sa structure HTML
- La popup de consentement des cookies peut varier selon les régions ou les mises à jour du site
- Certaines écoles peuvent ne pas avoir toutes les informations de contact (email, téléphone, site web)

## Licence

Ce projet est sous licence [MIT](LICENSE) 