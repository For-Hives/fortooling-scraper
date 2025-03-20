#!/usr/bin/env node

/**
 * Script de génération d'un guide d'importation Odoo
 * Crée un document HTML avec des instructions détaillées pour l'importation
 */

const fs = require('fs');
const path = require('path');

// Configuration
const DATA_DIR = path.join(__dirname, '..', 'data');
const ODOO_DIR = path.join(DATA_DIR, 'odoo', 'emails');
const GUIDE_FILE = path.join(ODOO_DIR, 'guide_importation_odoo.html');
const ODOO_BY_SECTOR_DIR = path.join(ODOO_DIR, 'by_sector');

/**
 * Crée un répertoire s'il n'existe pas
 * @param {string} dir - Chemin du répertoire
 */
function ensureDirectoryExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Liste tous les fichiers CSV dans un répertoire
 * @param {string} dir - Répertoire à analyser
 * @returns {Array} - Liste des fichiers CSV
 */
function listCsvFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }
  
  return fs.readdirSync(dir)
    .filter(file => file.endsWith('.csv'))
    .map(file => ({
      name: file,
      path: path.join(dir, file),
      size: fs.statSync(path.join(dir, file)).size,
      records: countRecords(path.join(dir, file))
    }))
    .sort((a, b) => b.records - a.records); // Trier par nombre d'enregistrements
}

/**
 * Compte le nombre d'enregistrements dans un fichier CSV
 * @param {string} filePath - Chemin du fichier CSV
 * @returns {number} - Nombre d'enregistrements
 */
function countRecords(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    // Soustraire 1 pour l'en-tête et ignorer la ligne vide à la fin
    return lines.length > 2 ? lines.length - 2 : 0;
  } catch (error) {
    console.error(`Erreur lors du comptage des enregistrements dans ${filePath}: ${error.message}`);
    return 0;
  }
}

/**
 * Formate la taille d'un fichier en unités lisibles
 * @param {number} bytes - Taille en octets
 * @returns {string} - Taille formatée
 */
function formatFileSize(bytes) {
  if (bytes < 1024) {
    return `${bytes} octets`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} Ko`;
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  }
}

/**
 * Génère le contenu HTML du guide
 * @param {Object} data - Données pour le guide
 * @returns {string} - Contenu HTML
 */
function generateGuideHtml(data) {
  const { mainFile, sectorFiles, date } = data;
  
  // Générer la liste des fichiers par secteur
  const sectorFilesList = sectorFiles.map(file => `
    <tr>
      <td>${file.name.replace(/^odoo_/, '').replace(/\.csv$/, '').replace(/_/g, ' ')}</td>
      <td>${file.records}</td>
      <td>${formatFileSize(file.size)}</td>
      <td>${path.relative(DATA_DIR, file.path)}</td>
    </tr>
  `).join('');
  
  // Générer le contenu HTML
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Guide d'importation Odoo - Écoles avec emails</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
    }
    header {
      background-color: #4c956c;
      color: white;
      padding: 2rem;
      border-radius: 8px;
      margin-bottom: 2rem;
      text-align: center;
    }
    h1 {
      margin-top: 0;
    }
    h2 {
      color: #2c6e49;
      border-bottom: 2px solid #2c6e49;
      padding-bottom: 0.5rem;
      margin-top: 2rem;
    }
    h3 {
      color: #4c956c;
    }
    .info {
      background-color: #e9f5db;
      border-left: 5px solid #4c956c;
      padding: 1rem;
      margin: 1rem 0;
      border-radius: 0 5px 5px 0;
    }
    .warning {
      background-color: #ffecd1;
      border-left: 5px solid #ff7d00;
      padding: 1rem;
      margin: 1rem 0;
      border-radius: 0 5px 5px 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1rem 0;
    }
    th, td {
      padding: 0.75rem;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }
    th {
      background-color: #f5f5f5;
      font-weight: bold;
    }
    tr:hover {
      background-color: #f5f5f5;
    }
    .step {
      background-color: #f9f9f9;
      padding: 1.5rem;
      margin: 1rem 0;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .step-number {
      display: inline-block;
      width: 30px;
      height: 30px;
      background-color: #4c956c;
      color: white;
      text-align: center;
      line-height: 30px;
      border-radius: 50%;
      margin-right: 0.75rem;
    }
    .file-main {
      background-color: #e0f5e9;
      padding: 1rem;
      border-radius: 5px;
      margin: 0.5rem 0;
    }
    img {
      max-width: 100%;
      height: auto;
      border: 1px solid #ddd;
      border-radius: 4px;
      margin: 1rem 0;
    }
    .date {
      color: #666;
      font-style: italic;
    }
    footer {
      margin-top: 4rem;
      padding-top: 1rem;
      border-top: 1px solid #ddd;
      text-align: center;
      color: #666;
    }
  </style>
</head>
<body>
  <header>
    <h1>Guide d'importation Odoo - Écoles avec emails</h1>
    <p>Procédure détaillée pour importer les écoles avec emails dans Odoo</p>
    <p class="date">Généré le ${date}</p>
  </header>

  <div class="info">
    <strong>Résumé:</strong> Ce guide vous accompagne dans l'importation des ${
      mainFile ? mainFile.records : 0
    } écoles avec leurs emails dans votre instance Odoo. Les données sont organisées par secteur pour une importation ciblée.
  </div>

  <h2>1. Fichiers disponibles</h2>
  
  <h3>Fichier principal</h3>
  <div class="file-main">
    <p><strong>Nom:</strong> ${mainFile ? mainFile.name : 'Non disponible'}</p>
    <p><strong>Chemin:</strong> ${mainFile ? path.relative(DATA_DIR, mainFile.path) : 'Non disponible'}</p>
    <p><strong>Nombre d'écoles:</strong> ${mainFile ? mainFile.records : 0}</p>
    <p><strong>Taille:</strong> ${mainFile ? formatFileSize(mainFile.size) : 'N/A'}</p>
  </div>
  
  <h3>Fichiers par secteur (${sectorFiles.length})</h3>
  <table>
    <thead>
      <tr>
        <th>Secteur</th>
        <th>Nombre d'écoles</th>
        <th>Taille</th>
        <th>Chemin</th>
      </tr>
    </thead>
    <tbody>
      ${sectorFilesList}
    </tbody>
  </table>

  <h2>2. Procédure d'importation dans Odoo</h2>
  
  <div class="step">
    <h3><span class="step-number">1</span> Connexion à Odoo</h3>
    <p>Connectez-vous à votre instance Odoo avec un compte administrateur ou ayant les droits d'importation.</p>
  </div>
  
  <div class="step">
    <h3><span class="step-number">2</span> Accéder au module Contacts</h3>
    <p>Dans le menu principal, cliquez sur "Contacts" pour accéder à la liste des contacts.</p>
  </div>
  
  <div class="step">
    <h3><span class="step-number">3</span> Lancer l'importation</h3>
    <p>Cliquez sur le bouton "Importer" situé dans la barre d'outils en haut de la page.</p>
  </div>
  
  <div class="step">
    <h3><span class="step-number">4</span> Sélection du fichier</h3>
    <p>Cliquez sur "Choisir un fichier" et sélectionnez le fichier CSV à importer:</p>
    <ul>
      <li>Utilisez le fichier principal (<strong>${mainFile ? mainFile.name : 'Non disponible'}</strong>) pour importer toutes les écoles</li>
      <li>Ou choisissez un fichier par secteur pour une importation ciblée</li>
    </ul>
    <div class="warning">
      <strong>Important:</strong> Vérifiez que le format du fichier est bien reconnu comme CSV.
    </div>
  </div>
  
  <div class="step">
    <h3><span class="step-number">5</span> Configuration de l'importation</h3>
    <p>Odoo va analyser le fichier et vous proposer de configurer le mappage des colonnes.</p>
    <ul>
      <li>Vérifiez que la colonne "id" est bien reconnue comme "ID externe"</li>
      <li>Vérifiez que les autres colonnes sont correctement mappées</li>
      <li>Pour le champ "industry_id" (secteur), choisissez "Créer si introuvable"</li>
      <li>Pour "tag_ids" (étiquettes), choisissez "Créer si introuvable" et "Séparés par virgule"</li>
    </ul>
  </div>
  
  <div class="step">
    <h3><span class="step-number">6</span> Options d'importation</h3>
    <p>Dans les options d'importation, sélectionnez:</p>
    <ul>
      <li>Si vous importez pour la première fois: laissez les options par défaut</li>
      <li>Si vous mettez à jour des données existantes: cochez "Les ID externes existent déjà"</li>
    </ul>
  </div>
  
  <div class="step">
    <h3><span class="step-number">7</span> Validation et importation</h3>
    <p>Cliquez sur "Valider" pour vérifier que l'importation fonctionne correctement sans erreurs.</p>
    <p>Si tout est correct, cliquez sur "Importer" pour finaliser le processus.</p>
  </div>

  <h2>3. Structure des données</h2>
  
  <p>Les fichiers CSV contiennent les champs suivants:</p>
  
  <table>
    <thead>
      <tr>
        <th>Champ</th>
        <th>Description</th>
        <th>Exemple</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>id</td>
        <td>Identifiant externe unique pour chaque école</td>
        <td>school_esiea_ingenieur_e_s_d_un_numerique_utile_laval_admissions_at_esiea_fr</td>
      </tr>
      <tr>
        <td>name</td>
        <td>Nom complet de l'école</td>
        <td>ESIEA, ingénieur·e·s d'un numérique utile - Laval</td>
      </tr>
      <tr>
        <td>is_company</td>
        <td>Indique que l'entrée est une entreprise/organisation</td>
        <td>true</td>
      </tr>
      <tr>
        <td>company_type</td>
        <td>Type d'entité dans Odoo</td>
        <td>company</td>
      </tr>
      <tr>
        <td>email</td>
        <td>Adresse email principale de l'école</td>
        <td>admissions@esiea.fr</td>
      </tr>
      <tr>
        <td>phone</td>
        <td>Numéro de téléphone (si disponible)</td>
        <td>01 82 39 25 00</td>
      </tr>
      <tr>
        <td>website</td>
        <td>Site web (si disponible)</td>
        <td>https://www.esiea.fr</td>
      </tr>
      <tr>
        <td>city</td>
        <td>Ville où se trouve l'école</td>
        <td>Laval</td>
      </tr>
      <tr>
        <td>country_id</td>
        <td>Pays (toujours "France" pour ce jeu de données)</td>
        <td>France</td>
      </tr>
      <tr>
        <td>industry_id</td>
        <td>Secteur d'activité (catégorie d'école)</td>
        <td>École d'ingénieurs</td>
      </tr>
      <tr>
        <td>tag_ids</td>
        <td>Étiquettes pour catégoriser les contacts</td>
        <td>École,Diplomeo</td>
      </tr>
      <tr>
        <td>ref</td>
        <td>Référence externe (URL de la page Diplomeo)</td>
        <td>https://diplomeo.com/etablissement-esiea_ingenieur_e_s_d_un_numerique_utile_laval-1848</td>
      </tr>
    </tbody>
  </table>

  <h2>4. Après l'importation</h2>
  
  <p>Une fois l'importation terminée:</p>
  <ul>
    <li>Vérifiez que les écoles apparaissent bien dans la liste des contacts</li>
    <li>Vérifiez que les secteurs d'activité ont été correctement créés</li>
    <li>Vérifiez que les étiquettes "École" et "Diplomeo" ont été appliquées</li>
    <li>Les écoles sont importées comme des organisations (entreprises), ce qui vous permettra d'ajouter des contacts individuels ultérieurement</li>
  </ul>
  
  <div class="info">
    <strong>Conseil:</strong> Vous pouvez créer une vue filtrée pour n'afficher que les contacts avec l'étiquette "École" ou "Diplomeo".
  </div>

  <h2>5. Résolution des problèmes courants</h2>
  
  <h3>Problème: Erreur de format CSV</h3>
  <p><strong>Solution:</strong> Vérifiez que le fichier est bien au format UTF-8. Si nécessaire, ouvrez le fichier dans un éditeur de texte et enregistrez-le avec l'encodage UTF-8.</p>
  
  <h3>Problème: Les ID externes existent déjà</h3>
  <p><strong>Solution:</strong> Si vous réimportez des données, cochez l'option "Les ID externes existent déjà" pour mettre à jour les enregistrements existants plutôt que d'en créer de nouveaux.</p>
  
  <h3>Problème: Certains champs ne sont pas importés</h3>
  <p><strong>Solution:</strong> Vérifiez le mappage des colonnes dans l'interface d'importation d'Odoo. Assurez-vous que chaque colonne est correctement associée au champ Odoo correspondant.</p>

  <footer>
    <p>Guide généré automatiquement le ${date}</p>
    <p>Pour toute question, contactez l'équipe d'administration</p>
  </footer>
</body>
</html>
  `;
}

/**
 * Fonction principale
 */
async function run() {
  console.log('=== Génération du guide d\'importation Odoo ===');
  
  // Vérifier que le répertoire Odoo existe
  if (!fs.existsSync(ODOO_DIR)) {
    console.error(`Erreur: Le répertoire ${ODOO_DIR} n'existe pas.`);
    console.log('Veuillez d\'abord exécuter le script export-emails-to-odoo.js pour générer les fichiers CSV.');
    process.exit(1);
  }
  
  // Récupérer la liste des fichiers CSV
  console.log('Analyse des fichiers CSV disponibles...');
  const mainFile = listCsvFiles(ODOO_DIR).find(file => file.name === 'odoo_schools_with_emails.csv');
  const sectorFiles = listCsvFiles(ODOO_BY_SECTOR_DIR);
  
  if (!mainFile) {
    console.error('Erreur: Fichier principal non trouvé. Veuillez d\'abord exécuter le script export-emails-to-odoo.js.');
    process.exit(1);
  }
  
  // Générer le guide
  console.log('Génération du guide HTML...');
  const guideHtml = generateGuideHtml({
    mainFile,
    sectorFiles,
    date: new Date().toLocaleString()
  });
  
  // Écrire le fichier HTML
  fs.writeFileSync(GUIDE_FILE, guideHtml);
  console.log(`Guide d'importation généré avec succès: ${GUIDE_FILE}`);
  
  console.log('\n=== Génération terminée ===');
  console.log(`Vous pouvez ouvrir ${GUIDE_FILE} dans votre navigateur web.`);
}

// Exécuter le script
run().catch(err => {
  console.error('Erreur non gérée:', err);
  process.exit(1);
}); 