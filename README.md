# Diplomeo Scraper

Un outil de scraping pour extraire des informations sur les écoles depuis le site Diplomeo.

## Structure du projet

```
diplomeo-scraper/
├── data/               # Données extraites (JSON)
│   ├── archive/        # Archives des précédentes extractions
│   └── odoo/           # Fichiers d'exportation pour Odoo (CSV)
├── screenshots/        # Captures d'écran générées pendant le scraping
│   └── archive/        # Archives des précédentes captures d'écran
├── scripts/            # Scripts d'exécution
│   ├── scrape-all.js   # Lance le scraper en mode normal
│   ├── scrape-headless.js # Lance le scraper en mode headless (production)
│   ├── scrape-all-schools.js # Lance le scraper massif pour 1700+ écoles
│   ├── scrape-all-headless.js # Lance le scraper massif en mode headless
│   ├── export-to-odoo.js  # Exporte les données au format CSV pour Odoo
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
- **Scraping massif de 1700+ écoles** via différentes stratégies combinées
- Extraction robuste avec plusieurs stratégies de secours
- Nettoyage et correction des données extraites
- Sauvegarde régulière des données intermédiaires
- Exportation des données au format CSV compatible avec Odoo

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

### Scraping massif (1700+ écoles)

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

#### Temps d'exécution estimé

L'extraction complète de 1700+ écoles peut prendre plusieurs heures (4-8h selon la connexion). Le script est conçu pour:
- Sauvegarder régulièrement les données intermédiaires
- Traiter les écoles par lots pour éviter de tout perdre en cas d'erreur
- Gérer les erreurs de navigation et les tentatives de reconnexion
- Pouvoir être interrompu et reprendre ultérieurement

### Exportation des données vers Odoo

Une fois que les données ont été extraites, vous pouvez les exporter au format CSV compatible avec Odoo :

```
node scripts/export-to-odoo.js
```

ou 

```
npm run export:odoo
```

Cette commande génère trois fichiers CSV dans le dossier `data/odoo/` :
- `odoo_schools.csv` : Toutes les écoles en un seul fichier (format contacts)
- `odoo_companies.csv` : Les écoles au format entreprises
- `odoo_contacts.csv` : Structure pour ajouter des contacts liés aux écoles (préparé mais vide)

Les fichiers générés sont prêts à être importés dans Odoo en utilisant la fonctionnalité d'import.

## Données extraites

Les données sont sauvegardées dans le dossier `data/` au format JSON :

- `schools_list.json` : Liste des écoles trouvées avec leur URL
- `schools_list_complete.json` : Liste complète des 1700+ écoles avec leur URL
- `schools_data_complete.json` : Données complètes des écoles (extraction partielle)
- `schools_data_complete_all.json` : Données complètes des 1700+ écoles
- `schools_data_cleaned.json` : Données nettoyées avec corrections
- `schools_data_progress.json` : Sauvegarde intermédiaire pendant l'exécution

## Captures d'écran

Les captures d'écran sont sauvegardées dans le dossier `screenshots/` pour aider au diagnostic et à la vérification du processus de scraping.

## Importation dans Odoo

Pour importer les données dans Odoo, suivez ces étapes :

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