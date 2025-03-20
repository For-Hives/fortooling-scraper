#!/usr/bin/env node

/**
 * Script d'analyse des données complètes des écoles
 * Organisation par secteur, analyse des emails et génération de rapports
 */

const fs = require('fs');
const path = require('path');

// Chemins des fichiers
const DATA_DIR = path.join(__dirname, '..', 'data');
const SOURCE_FILE = path.join(DATA_DIR, 'schools_data_complete.json');
const SECTORS_OUTPUT_FILE = path.join(DATA_DIR, 'schools_by_sector.json');
const REPORT_OUTPUT_FILE = path.join(DATA_DIR, 'schools_report.json');
const EMAILS_OUTPUT_FILE = path.join(DATA_DIR, 'schools_emails.json');
const CSV_DIR = path.join(DATA_DIR, 'reports');

// Analyser les arguments de ligne de commande
const args = process.argv.slice(2);
const sourceFile = args.find(arg => arg.startsWith('--source=')) 
  ? path.join(DATA_DIR, args.find(arg => arg.startsWith('--source=')).split('=')[1])
  : SOURCE_FILE;

/**
 * Organise les écoles par secteur
 * @param {Array<Object>} schools - Liste des écoles
 * @returns {Object} - Écoles organisées par secteur
 */
function organizeBySecor(schools) {
  const sectors = {};
  
  // Regrouper les écoles par secteur
  schools.forEach(school => {
    const sector = school.sector || 'Non spécifié';
    
    if (!sectors[sector]) {
      sectors[sector] = [];
    }
    
    sectors[sector].push(school);
  });
  
  return sectors;
}

/**
 * Génère des statistiques sur les données des écoles
 * @param {Array<Object>} schools - Liste des écoles
 * @returns {Object} - Statistiques
 */
function generateStatistics(schools) {
  // Compteurs pour les statistiques
  const stats = {
    total: schools.length,
    withEmail: 0,
    withPhone: 0,
    withWebsite: 0,
    withDescription: 0,
    withAddress: 0,
    withFormations: 0,
    averageFormationsPerSchool: 0,
    sectorsCount: {},
    emailDomains: {},
    schoolsWithErrors: 0
  };
  
  let totalFormations = 0;
  
  schools.forEach(school => {
    // Compter les données de contact
    if (school.email_found) stats.withEmail++;
    if (school.phone_found) stats.withPhone++;
    if (school.website_found) stats.withWebsite++;
    
    // Compter autres informations
    if (school.description && school.description.length > 0) stats.withDescription++;
    if (school.address && school.address.length > 0) stats.withAddress++;
    if (school.formations && school.formations.length > 0) {
      stats.withFormations++;
      totalFormations += school.formations.length;
    }
    
    // Compter par secteur
    const sector = school.sector || 'Non spécifié';
    stats.sectorsCount[sector] = (stats.sectorsCount[sector] || 0) + 1;
    
    // Analyser les domaines d'email
    if (school.email_found && school.email) {
      const emailParts = school.email.split('@');
      if (emailParts.length === 2) {
        const domain = emailParts[1].toLowerCase();
        stats.emailDomains[domain] = (stats.emailDomains[domain] || 0) + 1;
      }
    }
    
    // Compter les écoles avec erreurs
    if (school.error) stats.schoolsWithErrors++;
  });
  
  // Calculer la moyenne des formations par école
  stats.averageFormationsPerSchool = totalFormations / schools.length;
  
  // Trier les domaines d'email par fréquence
  stats.emailDomains = Object.entries(stats.emailDomains)
    .sort((a, b) => b[1] - a[1])
    .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {});
  
  return stats;
}

/**
 * Extrait les emails valides des écoles
 * @param {Array<Object>} schools - Liste des écoles
 * @returns {Array<Object>} - Liste des écoles avec emails valides
 */
function extractEmails(schools) {
  return schools
    .filter(school => school.email_found && school.email)
    .map(school => ({
      name: school.name,
      sector: school.sector,
      city: school.city,
      email: school.email,
      phone: school.phone,
      website: school.website
    }));
}

/**
 * Génère un rapport CSV pour un secteur spécifique
 * @param {string} sector - Nom du secteur
 * @param {Array<Object>} schools - Liste des écoles du secteur
 * @param {string} outputDir - Répertoire de sortie
 */
function generateSectorCSV(sector, schools, outputDir) {
  // Créer le dossier s'il n'existe pas
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Nettoyer le nom du secteur pour le nom de fichier
  const safeSector = sector
    .replace(/[^a-z0-9]/gi, '_')
    .toLowerCase();
  
  const outputFile = path.join(outputDir, `secteur_${safeSector}.csv`);
  
  // Créer l'en-tête CSV
  const headers = ['Nom', 'Ville', 'Email', 'Téléphone', 'Site Web', 'Adresse', 'Formations'];
  
  // Fonction pour échapper les valeurs CSV
  const escapeCSV = (value) => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  
  // Générer les lignes CSV
  const rows = schools.map(school => {
    return [
      school.name,
      school.city || '',
      school.email || '',
      school.phone || '',
      school.website || '',
      school.address || '',
      Array.isArray(school.formations) ? school.formations.join(' | ') : ''
    ].map(escapeCSV).join(',');
  });
  
  // Écrire le fichier CSV
  const csvContent = [headers.join(','), ...rows].join('\n');
  fs.writeFileSync(outputFile, csvContent);
  
  console.log(`Rapport CSV généré pour le secteur "${sector}": ${outputFile}`);
  
  return outputFile;
}

/**
 * Fonction principale
 */
async function run() {
  console.log('=== Démarrage de l\'analyse des données des écoles ===');
  console.log(`Fichier source: ${sourceFile}`);
  console.log('Date:', new Date().toLocaleString());
  
  // Vérifier que le fichier source existe
  if (!fs.existsSync(sourceFile)) {
    console.error(`Fichier source introuvable: ${sourceFile}`);
    process.exit(1);
  }
  
  // Charger les données
  console.log(`Chargement des données depuis ${sourceFile}...`);
  const schools = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
  console.log(`${schools.length} écoles chargées`);
  
  // Organiser par secteur
  console.log('Organisation des écoles par secteur...');
  const schoolsBySector = organizeBySecor(schools);
  const sectorsCount = Object.keys(schoolsBySector).length;
  console.log(`${sectorsCount} secteurs identifiés`);
  
  // Générer les statistiques
  console.log('Génération des statistiques...');
  const statistics = generateStatistics(schools);
  
  // Extraire les emails
  console.log('Extraction des emails...');
  const schoolsWithEmails = extractEmails(schools);
  console.log(`${schoolsWithEmails.length} écoles avec email valide identifiées`);
  
  // Sauvegarder les données organisées par secteur
  fs.writeFileSync(SECTORS_OUTPUT_FILE, JSON.stringify(schoolsBySector, null, 2));
  console.log(`Données par secteur sauvegardées dans ${SECTORS_OUTPUT_FILE}`);
  
  // Sauvegarder les statistiques
  fs.writeFileSync(REPORT_OUTPUT_FILE, JSON.stringify(statistics, null, 2));
  console.log(`Rapport statistique sauvegardé dans ${REPORT_OUTPUT_FILE}`);
  
  // Sauvegarder les emails
  fs.writeFileSync(EMAILS_OUTPUT_FILE, JSON.stringify(schoolsWithEmails, null, 2));
  console.log(`Liste des écoles avec email sauvegardée dans ${EMAILS_OUTPUT_FILE}`);
  
  // Générer les rapports CSV par secteur
  console.log('Génération des rapports CSV par secteur...');
  const csvFiles = [];
  
  for (const [sector, sectorSchools] of Object.entries(schoolsBySector)) {
    const csvFile = generateSectorCSV(sector, sectorSchools, CSV_DIR);
    csvFiles.push(csvFile);
  }
  
  // Générer un rapport CSV global
  generateSectorCSV('TOUS', schools, CSV_DIR);
  
  console.log('\n=== Analyse terminée avec succès ===');
  console.log(`${sectorsCount} secteurs analysés`);
  console.log(`${csvFiles.length} rapports CSV générés`);
  
  // Afficher un résumé des statistiques
  console.log('\nRésumé des statistiques:');
  console.log(`- Total des écoles: ${statistics.total}`);
  console.log(`- Écoles avec email: ${statistics.withEmail} (${(statistics.withEmail / statistics.total * 100).toFixed(2)}%)`);
  console.log(`- Écoles avec téléphone: ${statistics.withPhone} (${(statistics.withPhone / statistics.total * 100).toFixed(2)}%)`);
  console.log(`- Écoles avec site web: ${statistics.withWebsite} (${(statistics.withWebsite / statistics.total * 100).toFixed(2)}%)`);
  console.log(`- Écoles avec description: ${statistics.withDescription} (${(statistics.withDescription / statistics.total * 100).toFixed(2)}%)`);
  console.log(`- Moyenne des formations par école: ${statistics.averageFormationsPerSchool.toFixed(2)}`);
  
  // Afficher les 5 plus grands secteurs
  console.log('\nTop 5 des secteurs:');
  Object.entries(statistics.sectorsCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([sector, count]) => {
      console.log(`- ${sector}: ${count} écoles (${(count / statistics.total * 100).toFixed(2)}%)`);
    });
  
  // Afficher les 5 domaines d'email les plus courants
  if (Object.keys(statistics.emailDomains).length > 0) {
    console.log('\nTop 5 des domaines d\'email:');
    Object.entries(statistics.emailDomains)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([domain, count]) => {
        console.log(`- ${domain}: ${count} écoles`);
      });
  }
}

// Afficher l'aide si demandé
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage: node ${path.basename(__filename)} [options]

Options:
  --source=FILE.json   Utilise le fichier spécifié comme source (par défaut: schools_data_complete.json)
  --help, -h           Affiche cette aide
  
Description:
  Ce script analyse les données complètes des écoles, les organise par secteur,
  extrait les emails et génère des rapports statistiques au format JSON et CSV.
  `);
  process.exit(0);
}

// Exécuter le script
if (require.main === module) {
  run().catch(err => {
    console.error('Erreur non gérée:', err);
    process.exit(1);
  });
}

module.exports = { run }; 