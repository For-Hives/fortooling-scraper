#!/usr/bin/env node

/**
 * Script d'extraction des écoles avec des emails
 * Filtre les écoles qui possèdent une adresse email et les exporte
 * dans différents formats (JSON, CSV) dans un dossier séparé
 */

const fs = require('fs');
const path = require('path');

// Configuration
const DATA_DIR = path.join(__dirname, '..', 'data');
const SOURCE_FILE = path.join(DATA_DIR, 'schools_data_complete.json');
const EMAILS_DIR = path.join(DATA_DIR, 'emails');
const EMAILS_JSON_FILE = path.join(EMAILS_DIR, 'schools_with_emails.json');
const EMAILS_CSV_FILE = path.join(EMAILS_DIR, 'schools_with_emails.csv');
const EMAILS_BY_SECTOR_DIR = path.join(EMAILS_DIR, 'by_sector');

// Analyser les arguments de ligne de commande
const args = process.argv.slice(2);
const sourceFile = args.find(arg => arg.startsWith('--source=')) 
  ? path.join(DATA_DIR, args.find(arg => arg.startsWith('--source=')).split('=')[1])
  : SOURCE_FILE;
const generateCsv = !args.includes('--no-csv');
const splitBySector = !args.includes('--no-split');
const includeDetails = args.includes('--include-details');
const fixEmails = !args.includes('--no-fix');

/**
 * Convertit un tableau d'objets en CSV
 * @param {Array} data - Tableau d'objets
 * @param {Array} fields - Champs à inclure
 * @returns {string} - Contenu CSV
 */
function convertToCSV(data, fields) {
  // En-tête
  let csv = fields.join(',') + '\n';
  
  // Lignes
  for (const item of data) {
    const row = fields.map(field => {
      // Échapper les guillemets et les virgules
      let value = item[field] || '';
      if (typeof value === 'string') {
        // Remplacer les guillemets par des guillemets doubles
        value = value.replace(/"/g, '""');
        // Entourer de guillemets si contient virgule ou guillemet
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          value = `"${value}"`;
        }
      }
      return value;
    });
    csv += row.join(',') + '\n';
  }
  
  return csv;
}

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
 * Valide et corrige une adresse email
 * @param {string} email - Email à valider
 * @returns {string|null} - Email corrigé ou null si invalide
 */
function validateAndFixEmail(email) {
  if (!email || typeof email !== 'string') {
    return null;
  }
  
  // Normaliser l'email
  let normalized = email.trim().toLowerCase();
  
  // Vérifier si l'email est vide
  if (normalized === '') {
    return null;
  }
  
  // Expression régulière pour valider les emails
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  
  // Retirer les suffixes incorrects (.coms, .frs, etc.)
  if (fixEmails) {
    normalized = normalized
      .replace(/\.coms$/i, '.com')
      .replace(/\.frs$/i, '.fr')
      .replace(/\.orgs$/i, '.org')
      .replace(/\.nets$/i, '.net')
      .replace(/\.edus$/i, '.edu')
      .replace(/\.infos$/i, '.info')
      .replace(/\.eues$/i, '.eu')
      .replace(/\.ios$/i, '.io')
      .replace(/pariss$/, 'paris');
  }
  
  // Valider avec l'expression régulière
  if (!emailRegex.test(normalized)) {
    return null;
  }
  
  return normalized;
}

/**
 * Filtre les écoles qui ont des emails valides
 * @param {Array} schools - Liste des écoles
 * @returns {Array} - Écoles avec emails valides
 */
function filterSchoolsWithEmails(schools) {
  const filteredSchools = [];
  
  for (const school of schools) {
    // Vérifier si l'école a un email valide
    const email = validateAndFixEmail(school.email);
    if (email) {
      // Créer une copie de l'école avec l'email corrigé
      const schoolCopy = { ...school };
      schoolCopy.email = email;
      filteredSchools.push(schoolCopy);
    }
  }
  
  return filteredSchools;
}

/**
 * Prépare les données pour l'export
 * @param {Array} schools - Écoles avec emails
 * @returns {Array} - Données préparées
 */
function prepareDataForExport(schools) {
  return schools.map(school => {
    // Données de base à inclure
    const data = {
      name: school.name || '',
      email: school.email || '',
      sector: school.sector || '',
      city: school.city || '',
      url: school.url || ''
    };
    
    // Ajouter des détails supplémentaires si demandé
    if (includeDetails) {
      data.phone = school.phone || '';
      data.website = school.website || '';
      data.address = school.address || '';
      data.formations = Array.isArray(school.formations) 
        ? school.formations.join('; ') 
        : (school.formations || '');
      data.description = school.description || '';
    }
    
    return data;
  });
}

/**
 * Organise les écoles par secteur
 * @param {Array} schools - Écoles avec emails
 * @returns {Object} - Écoles organisées par secteur
 */
function organizeSchoolsBySector(schools) {
  const sectors = {};
  
  for (const school of schools) {
    const sector = school.sector || 'Non spécifié';
    
    if (!sectors[sector]) {
      sectors[sector] = [];
    }
    
    sectors[sector].push(school);
  }
  
  return sectors;
}

/**
 * Normalise un nom de fichier
 * @param {string} name - Nom à normaliser
 * @returns {string} - Nom normalisé
 */
function normalizeFileName(name) {
  return name
    .toLowerCase()
    .replace(/[àáâãäå]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Fonction principale
 */
async function run() {
  console.log('=== Extraction des écoles avec emails ===');
  console.log(`Date: ${new Date().toLocaleString()}`);
  console.log(`Fichier source: ${sourceFile}`);
  console.log(`Correction des emails: ${fixEmails ? 'activée' : 'désactivée'}`);
  
  // Vérifier que le fichier source existe
  if (!fs.existsSync(sourceFile)) {
    console.error(`Erreur: Le fichier source ${sourceFile} n'existe pas.`);
    process.exit(1);
  }
  
  // Charger les données
  console.log('Chargement des données...');
  let schools;
  try {
    const data = fs.readFileSync(sourceFile, 'utf8');
    schools = JSON.parse(data);
    console.log(`${schools.length} écoles chargées.`);
  } catch (error) {
    console.error(`Erreur lors du chargement des données: ${error.message}`);
    process.exit(1);
  }
  
  // Filtrer les écoles avec emails valides
  console.log('Filtrage des écoles avec emails valides...');
  const schoolsWithEmails = filterSchoolsWithEmails(schools);
  console.log(`${schoolsWithEmails.length} écoles avec emails valides trouvées (${((schoolsWithEmails.length / schools.length) * 100).toFixed(2)}%).`);
  
  // Préparer les données pour l'export
  const preparedData = prepareDataForExport(schoolsWithEmails);
  
  // Créer le répertoire de sortie
  ensureDirectoryExists(EMAILS_DIR);
  
  // Écrire le fichier JSON
  console.log(`Exportation des données au format JSON: ${EMAILS_JSON_FILE}`);
  fs.writeFileSync(EMAILS_JSON_FILE, JSON.stringify(preparedData, null, 2));
  
  // Générer le fichier CSV si demandé
  if (generateCsv) {
    console.log(`Exportation des données au format CSV: ${EMAILS_CSV_FILE}`);
    // Déterminer les champs à inclure
    const fields = includeDetails 
      ? ['name', 'email', 'sector', 'city', 'phone', 'website', 'address', 'formations', 'description', 'url']
      : ['name', 'email', 'sector', 'city', 'url'];
    
    const csvContent = convertToCSV(preparedData, fields);
    fs.writeFileSync(EMAILS_CSV_FILE, csvContent);
  }
  
  // Organiser par secteur si demandé
  if (splitBySector) {
    console.log('Organisation des écoles par secteur...');
    const schoolsBySector = organizeSchoolsBySector(preparedData);
    
    // Créer le répertoire pour les secteurs
    ensureDirectoryExists(EMAILS_BY_SECTOR_DIR);
    
    // Écrire un fichier par secteur
    console.log(`Exportation des données par secteur dans: ${EMAILS_BY_SECTOR_DIR}`);
    const sectors = Object.keys(schoolsBySector);
    
    for (const sector of sectors) {
      const schools = schoolsBySector[sector];
      const sectorFileName = normalizeFileName(sector);
      
      // JSON
      const sectorJsonFile = path.join(EMAILS_BY_SECTOR_DIR, `${sectorFileName}.json`);
      fs.writeFileSync(sectorJsonFile, JSON.stringify(schools, null, 2));
      
      // CSV si demandé
      if (generateCsv) {
        const sectorCsvFile = path.join(EMAILS_BY_SECTOR_DIR, `${sectorFileName}.csv`);
        // Déterminer les champs à inclure
        const fields = includeDetails 
          ? ['name', 'email', 'sector', 'city', 'phone', 'website', 'address', 'formations', 'description', 'url']
          : ['name', 'email', 'sector', 'city', 'url'];
        
        const csvContent = convertToCSV(schools, fields);
        fs.writeFileSync(sectorCsvFile, csvContent);
      }
    }
    
    console.log(`${sectors.length} fichiers par secteur générés.`);
  }
  
  console.log('\n=== Extraction terminée avec succès ===');
  console.log(`Total: ${schoolsWithEmails.length} écoles avec emails valides extraites.`);
  console.log(`Fichiers générés dans: ${EMAILS_DIR}`);
}

// Afficher l'aide si demandé
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage: node ${path.basename(__filename)} [options]

Options:
  --source=FILE.json   Utilise le fichier spécifié comme source (par défaut: schools_data_complete.json)
  --no-csv             Ne génère pas de fichiers CSV
  --no-split           Ne divise pas les données par secteur
  --include-details    Inclut des informations détaillées (téléphone, site web, adresse, etc.)
  --no-fix             Désactive la correction automatique des adresses email
  --help, -h           Affiche cette aide
  
Description:
  Ce script extrait les écoles qui possèdent une adresse email valide et les exporte
  dans un dossier séparé. Il génère par défaut des fichiers JSON et CSV, et
  divise également les données par secteur.
  
Fichiers générés:
  - data/emails/schools_with_emails.json       Liste complète au format JSON
  - data/emails/schools_with_emails.csv        Liste complète au format CSV
  - data/emails/by_sector/[secteur].json       Fichiers JSON par secteur
  - data/emails/by_sector/[secteur].csv        Fichiers CSV par secteur
  `);
  process.exit(0);
}

// Exécuter le script
run().catch(err => {
  console.error('Erreur non gérée:', err);
  process.exit(1);
}); 