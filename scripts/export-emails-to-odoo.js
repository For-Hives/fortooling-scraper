#!/usr/bin/env node

/**
 * Script d'exportation des écoles avec emails vers Odoo
 * Formate les données des écoles pour l'importation dans Odoo
 */

const fs = require('fs');
const path = require('path');

// Configuration
const DATA_DIR = path.join(__dirname, '..', 'data');
const EMAILS_DIR = path.join(DATA_DIR, 'emails');
const ODOO_DIR = path.join(DATA_DIR, 'odoo', 'emails');
const SOURCE_FILE = path.join(EMAILS_DIR, 'schools_with_emails.json');
const ODOO_MAIN_FILE = path.join(ODOO_DIR, 'odoo_schools_with_emails.csv');
const ODOO_BY_SECTOR_DIR = path.join(ODOO_DIR, 'by_sector');

// Analyser les arguments de ligne de commande
const args = process.argv.slice(2);
const sourceFile = args.find(arg => arg.startsWith('--source=')) 
  ? path.join(DATA_DIR, args.find(arg => arg.startsWith('--source=')).split('=')[1])
  : SOURCE_FILE;
const splitBySector = !args.includes('--no-split');

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
 * Génère un ID externe pour Odoo
 * @param {string} name - Nom de l'école
 * @param {string} email - Email de l'école
 * @returns {string} - ID externe
 */
function generateExternalId(name, email) {
  // Créer un ID unique basé sur le nom et l'email
  const baseName = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  
  const emailPart = email
    .replace(/@/g, '_at_')
    .replace(/\./g, '_');
  
  return `school_${baseName}_${emailPart}`.substring(0, 100);
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
 * Formate une école pour Odoo
 * @param {Object} school - Données de l'école
 * @returns {Object} - Données formatées pour Odoo
 */
function formatSchoolForOdoo(school) {
  // Générer un ID externe
  const externalId = generateExternalId(school.name, school.email);
  
  // Formatage Odoo
  return {
    id: externalId,
    name: school.name || '',
    is_company: 'true',
    company_type: 'company',
    customer_rank: '1',
    supplier_rank: '0',
    type: 'contact',
    email: school.email || '',
    phone: school.phone || '',
    mobile: '',
    website: school.website || '',
    street: school.address || '',
    city: school.city || '',
    zip: '',
    country_id: 'France',
    function: '',
    title: '',
    parent_id: '',
    user_id: '',
    team_id: '',
    industry_id: school.sector || '',
    comment: school.description || '',
    tag_ids: 'École,Diplomeo',
    vat: '',
    ref: school.url || '',
    lang: 'fr_FR',
    date: new Date().toISOString().split('T')[0]
  };
}

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
 * Organise les écoles par secteur
 * @param {Array} schools - Liste des écoles
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
 * Fonction principale
 */
async function run() {
  console.log('=== Exportation des écoles avec emails vers Odoo ===');
  console.log(`Date: ${new Date().toLocaleString()}`);
  console.log(`Fichier source: ${sourceFile}`);
  
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
  
  // Formater les données pour Odoo
  console.log('Formatage des données pour Odoo...');
  const odooSchools = schools.map(formatSchoolForOdoo);
  
  // Définir les champs Odoo
  const odooFields = [
    'id', 'name', 'is_company', 'company_type', 'customer_rank', 'supplier_rank',
    'type', 'email', 'phone', 'mobile', 'website', 'street', 'city', 'zip',
    'country_id', 'function', 'title', 'parent_id', 'user_id', 'team_id',
    'industry_id', 'comment', 'tag_ids', 'vat', 'ref', 'lang', 'date'
  ];
  
  // Créer le répertoire de sortie
  ensureDirectoryExists(ODOO_DIR);
  
  // Écrire le fichier CSV principal
  console.log(`Exportation des données vers: ${ODOO_MAIN_FILE}`);
  const csvContent = convertToCSV(odooSchools, odooFields);
  fs.writeFileSync(ODOO_MAIN_FILE, csvContent);
  
  // Organiser par secteur si demandé
  if (splitBySector) {
    console.log('Organisation des écoles par secteur...');
    const schoolsBySector = organizeSchoolsBySector(schools);
    
    // Créer le répertoire pour les secteurs
    ensureDirectoryExists(ODOO_BY_SECTOR_DIR);
    
    // Écrire un fichier par secteur
    console.log(`Exportation des données par secteur dans: ${ODOO_BY_SECTOR_DIR}`);
    const sectors = Object.keys(schoolsBySector);
    
    for (const sector of sectors) {
      const sectorSchools = schoolsBySector[sector].map(formatSchoolForOdoo);
      const sectorFileName = normalizeFileName(sector);
      
      const sectorCsvFile = path.join(ODOO_BY_SECTOR_DIR, `odoo_${sectorFileName}.csv`);
      const csvContent = convertToCSV(sectorSchools, odooFields);
      fs.writeFileSync(sectorCsvFile, csvContent);
    }
    
    console.log(`${sectors.length} fichiers par secteur générés.`);
  }
  
  console.log('\n=== Exportation terminée avec succès ===');
  console.log(`Total: ${schools.length} écoles exportées pour Odoo.`);
  console.log(`Fichiers générés dans: ${ODOO_DIR}`);
  
  console.log('\n=== Comment importer dans Odoo ===');
  console.log('1. Connectez-vous à votre instance Odoo');
  console.log('2. Accédez au module "Contacts"');
  console.log('3. Cliquez sur "Importer" dans le menu');
  console.log('4. Sélectionnez le fichier CSV généré');
  console.log('5. Vérifiez que le mappage des champs est correct');
  console.log('6. Cochez "Les ID externes existent déjà" si vous mettez à jour des contacts existants');
  console.log('7. Cliquez sur "Importer" pour finaliser');
}

// Afficher l'aide si demandé
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage: node ${path.basename(__filename)} [options]

Options:
  --source=FILE.json   Utilise le fichier spécifié comme source (par défaut: emails/schools_with_emails.json)
  --no-split           Ne divise pas les données par secteur
  --help, -h           Affiche cette aide
  
Description:
  Ce script exporte les écoles avec emails au format CSV compatible avec Odoo.
  Il génère un fichier principal et des fichiers séparés par secteur.
  
Fichiers générés:
  - data/odoo/emails/odoo_schools_with_emails.csv      Fichier principal
  - data/odoo/emails/by_sector/odoo_*.csv              Fichiers par secteur
  
Format Odoo:
  Le fichier CSV généré contient les champs nécessaires pour l'importation dans Odoo:
  - id                 ID externe pour identifier de manière unique chaque école
  - name               Nom de l'école
  - is_company         Toujours "true" car les écoles sont des organisations
  - company_type       Toujours "company"
  - type               Type de contact (toujours "contact" pour l'adresse principale)
  - email, phone       Coordonnées
  - website            Site web
  - street, city       Adresse
  - country_id         Pays (toujours "France")
  - industry_id        Secteur d'activité
  - tag_ids            Tags ("École,Diplomeo")
  - ref                Référence (URL de l'école)
  
Ces champs permettent d'importer directement les données dans Odoo sans traitement supplémentaire.
  `);
  process.exit(0);
}

// Exécuter le script
run().catch(err => {
  console.error('Erreur non gérée:', err);
  process.exit(1);
}); 