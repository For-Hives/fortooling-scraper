# Diplomeo Scraper

Un outil de scraping pour extraire des informations sur les écoles depuis le site Diplomeo.

## Structure du projet

```
diplomeo-scraper/
├── data/               # Données extraites (JSON)
│   ├── archive/        # Archives des précédentes extractions
│   ├── odoo/           # Fichiers d'exportation pour Odoo (CSV)
│   ├── reports/        # Rapports d'analyse CSV et HTML
│   │   └── html/       # Rapports interactifs
├── screenshots/        # Captures d'écran générées pendant le scraping
│   └── archive/        # Archives des précédentes captures d'écran
├── scripts/            # Scripts d'exécution
│   ├── scrape-all.js   # Lance le scraper en mode normal
│   ├── scrape-headless.js # Lance le scraper en mode headless (production)
│   ├── scrape-all-schools.js # Lance le scraper massif pour 10000+ écoles
│   ├── scrape-all-headless.js # Lance le scraper massif en mode headless
│   ├── process-all-schools.js # Traite les données complètes des écoles
│   ├── export-to-odoo.js      # Exporte les données au format CSV pour Odoo
│   ├── analyze-school-data.js     # Analyse des données par secteur
│   ├── generate-email-report.js   # Analyse des emails
│   ├── generate-html-report.js    # Génération de rapport HTML
│   ├── run-all-analysis.js        # Exécution de toutes les analyses
│   └── node-scraper-legacy.js # Ancienne version pour référence
├── src/                # Code source principal
│   ├── scraper.js      # Script principal de scraping
│   └── utils/          # Modules utilitaires
│       ├── cookieConsentHandler.js # Gestion des popups de cookies
│       ├── schoolExtractor.js      # Extraction des données des écoles
│       ├── scraperUtils.js         # Fonctions utilitaires diverses
│       └── csvExporter.js          # Export vers CSV pour Odoo
├── package.json        # Dépendances et scripts
└── README.md           # Documentation
```

## Fonctionnalités

- Extraction des informations de contact (email, téléphone, site web) des écoles
- Gestion automatique de la popup de consentement des cookies
- Support du chargement progressif via le bouton "Voir plus"
- Support de la pagination
- **Scraping massif de 10000+ écoles** via différentes stratégies combinées
- Extraction robuste avec plusieurs stratégies de secours
- Nettoyage et correction des données extraites
- Sauvegarde régulière des données intermédiaires
- Exportation des données au format CSV compatible avec Odoo
- **Analyse des données par secteur et génération de rapports**
- **Analyse des emails et validation**
- **Génération de rapports HTML interactifs avec visualisations**

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

### Extraction des données

#### Mode développement (avec interface graphique)

```
node scripts/scrape-all.js
```

ou

```
npm run scrape
```

#### Mode production (sans interface graphique)

```
node scripts/scrape-headless.js
```

ou

```
npm run scrape:headless
```

### Scraping massif (10000+ écoles)

Le scraper massif utilise trois stratégies différentes pour maximiser le nombre d'écoles extraites:
1. Défilement intensif avec "Voir plus"
2. Pagination sur toutes les pages disponibles
3. Utilisation des filtres par secteur pour accéder à plus d'écoles

#### Avec interface graphique (pour debug)

```
node scripts/scrape-all-schools.js
```

ou

```
npm run scrape:all
```

#### En production (sans interface)

```
node scripts/scrape-all-headless.js
```

ou

```
npm run scrape:all:headless
```

### Traitement des données d'écoles

Après avoir collecté les liens des écoles, utilisez ce script pour extraire les informations détaillées de chaque école:

```bash
node scripts/process-all-schools.js

# Options disponibles
# --batch=N       : Reprendre à partir du lot N
# --limit=N       : Limiter le traitement à N lots
# --source=FILE   : Spécifier le fichier source
# --show-browser  : Afficher le navigateur pendant l'exécution
```

### Analyse des données

Pour analyser les données collectées et générer des rapports:

```bash
# Exécuter toutes les analyses d'un seul coup
node scripts/run-all-analysis.js

# Ou exécuter les analyses individuellement:

# Analyse par secteur
node scripts/analyze-school-data.js

# Analyse des emails
node scripts/generate-email-report.js

# Génération du rapport HTML
node scripts/generate-html-report.js
```

#### Options d'analyse

Tous les scripts d'analyse acceptent ces options:

```bash
--source=FILE.json   # Spécifier le fichier source à analyser
--help               # Afficher l'aide
```

Le script `generate-html-report.js` accepte également:

```bash
--regenerate         # Régénérer les analyses avant de créer le rapport HTML
```

### Exportation des données vers Odoo

Une fois que les données ont été extraites, vous pouvez les exporter au format CSV compatible avec Odoo:

```
node scripts/export-to-odoo.js
```

ou 

```
npm run export:odoo
```

Cette commande génère trois fichiers CSV dans le dossier `data/odoo/`:
- `odoo_schools.csv`: Toutes les écoles en un seul fichier (format contacts)
- `odoo_companies.csv`: Les écoles au format entreprises
- `odoo_contacts.csv`: Structure pour ajouter des contacts liés aux écoles (préparé mais vide)

Les fichiers générés sont prêts à être importés dans Odoo en utilisant la fonctionnalité d'import.

## Données extraites et générées

### Données extraites (scraping)

Les données sont sauvegardées dans le dossier `data/` au format JSON:

- `schools_list.json`: Liste des écoles trouvées avec leur URL
- `schools_list_complete.json`: Liste complète des 10000+ écoles avec leur URL
- `schools_data_links_sectors.json`: Liste des écoles avec secteur et URL
- `schools_data_complete.json`: Données complètes des écoles traitées
- `schools_data_batch_*.json`: Lots de données pendant le traitement par batch
- `schools_data_cleaned.json`: Données nettoyées avec corrections

### Fichiers d'analyse

Les résultats d'analyse sont également stockés dans le dossier `data/`:

- `schools_by_sector.json`: Données organisées par secteur
- `schools_report.json`: Statistiques générales (emails, téléphones, etc.)
- `schools_emails.json`: Liste des écoles avec emails
- `schools_emails_analysis.json`: Analyse détaillée des emails

### Rapports générés

Les rapports sont générés dans le dossier `data/reports/`:

- Rapports CSV par secteur: `secteur_*.csv`
- Rapport des emails valides: `emails_valides.csv`
- Rapport HTML interactif: `html/index.html`

## Captures d'écran

Les captures d'écran sont sauvegardées dans le dossier `screenshots/` pour aider au diagnostic et à la vérification du processus de scraping.

## Rapport HTML interactif

Le rapport HTML interactif inclut:

- Distribution des écoles par secteur
- Disponibilité des informations de contact
- Analyse des domaines d'email
- Tableau détaillé des statistiques par secteur

Pour visualiser le rapport HTML:
1. Exécuter `node scripts/generate-html-report.js`
2. Ouvrir le fichier `data/reports/html/index.html` dans un navigateur

## Importation dans Odoo

Pour importer les données dans Odoo, suivez ces étapes:

1. Connectez-vous à votre instance Odoo
2. Allez dans le module Contacts
3. Cliquez sur "Importer" dans le menu
4. Sélectionnez le fichier CSV approprié (`odoo_companies.csv` pour les entreprises)
5. Vérifiez que le mappage des champs est correct
6. Cliquez sur "Importer" pour finaliser l'importation

Les ID externes générés permettent de mettre à jour les enregistrements existants lors d'importations ultérieures, sans créer de doublons.

## Problèmes connus

- Le bouton "Voir plus" peut parfois ne pas être détecté correctement si le site change sa structure HTML
- La popup de consentement des cookies peut varier selon les régions ou les mises à jour du site
- Certaines écoles peuvent ne pas avoir toutes les informations de contact (email, téléphone, site web)
- Les sessions trop longues peuvent être interrompues par le site - utilisez la version qui sauvegarde les données par lots

## Licence

Ce projet est sous licence [MIT](LICENSE) 