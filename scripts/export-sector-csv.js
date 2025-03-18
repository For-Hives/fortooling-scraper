#!/usr/bin/env node

/**
 * Script pour exporter les écoles par secteur spécifique en format CSV
 * Se concentre sur les secteurs Commerce et Communication
 */

const fs = require('fs');
const path = require('path');

// Dossiers de données
const DATA_DIR = path.join(__dirname, '..', 'data');
const EXPORTS_DIR = path.join(__dirname, '..', 'exports');
const SOURCE_FILE = path.join(DATA_DIR, 'schools_by_sector.json');

// Créer le dossier d'exports s'il n'existe pas
if (!fs.existsSync(EXPORTS_DIR)) {
  fs.mkdirSync(EXPORTS_DIR, { recursive: true });
}

// Fichiers de sortie
const COMMERCE_CSV = path.join(EXPORTS_DIR, 'ecoles_commerce.csv');
const COMMUNICATION_CSV = path.join(EXPORTS_DIR, 'ecoles_communication.csv');

/**
 * Fonction principale d'exportation
 */
async function exportSectorCSV() {
  console.log('=== Démarrage de l\'exportation des secteurs en CSV ===');
  console.log('Date de début:', new Date().toLocaleString());
  console.log('------------------------------------');
  
  // Vérifier que le fichier source existe
  if (!fs.existsSync(SOURCE_FILE)) {
    console.error(`Erreur: Fichier source non trouvé: ${SOURCE_FILE}`);
    console.error('Veuillez d\'abord exécuter le script de traitement par secteur.');
    process.exit(1);
  }
  
  try {
    // Lire les données classées par secteur
    const schoolsBySector = JSON.parse(fs.readFileSync(SOURCE_FILE, 'utf8'));
    console.log(`Lecture des données de ${Object.keys(schoolsBySector).length} secteurs`);
    
    // Extraire les écoles de commerce et de communication
    const commerceSchools = schoolsBySector['Commerce'] || [];
    const communicationSchools = schoolsBySector['Communication'] || [];
    
    console.log(`Écoles de commerce trouvées: ${commerceSchools.length}`);
    console.log(`Écoles de communication trouvées: ${communicationSchools.length}`);
    
    // Générer les CSV
    const commerceCSV = generateCSV(commerceSchools, 'commerce');
    const communicationCSV = generateCSV(communicationSchools, 'communication');
    
    // Écrire les fichiers
    fs.writeFileSync(COMMERCE_CSV, commerceCSV);
    fs.writeFileSync(COMMUNICATION_CSV, communicationCSV);
    
    console.log(`Exportation terminée:`);
    console.log(`- Écoles de commerce: ${COMMERCE_CSV}`);
    console.log(`- Écoles de communication: ${COMMUNICATION_CSV}`);
    
    console.log('------------------------------------');
    console.log('Date de fin:', new Date().toLocaleString());
    console.log('=== Exportation terminée ===');
    
  } catch (error) {
    console.error('Erreur lors de l\'exportation:', error);
    process.exit(1);
  }
}

/**
 * Génère le contenu CSV pour un ensemble d'écoles
 * @param {Array<Object>} schools - Liste des écoles
 * @param {string} sectorPrefix - Préfixe pour les ID externes
 * @returns {string} Contenu CSV
 */
function generateCSV(schools, sectorPrefix) {
  // Créer l'en-tête
  const headers = [
    'External ID',
    'Name',
    'Company Name',
    'Email',
    'Country',
    'Mailing List',
    'Phone',
    'Website',
    'City'
  ];
  
  // Commencer avec l'en-tête
  let csvContent = headers.join(',') + '\n';
  
  // Ajouter chaque école
  schools.forEach((school, index) => {
    const externalId = `${sectorPrefix}_school_${index + 1}`;
    const companyName = school.name; // Utiliser le nom de l'école comme nom d'entreprise
    const country = 'FR'; // Par défaut pour les écoles françaises
    const mailingList = 'Newsletter'; // Valeur par défaut
    
    // Formater chaque valeur pour CSV
    const row = [
      externalId,
      formatCSVValue(school.name),
      formatCSVValue(companyName),
      formatCSVValue(school.email),
      country,
      mailingList,
      formatCSVValue(school.phone),
      formatCSVValue(school.website),
      formatCSVValue(school.city)
    ];
    
    csvContent += row.join(',') + '\n';
  });
  
  return csvContent;
}

/**
 * Formate une valeur pour l'inclusion dans un CSV
 * @param {string} value - Valeur à formater
 * @returns {string} Valeur formatée
 */
function formatCSVValue(value) {
  if (value === undefined || value === null || value === '') {
    return '';
  }
  
  // Convertir en chaîne
  const strValue = String(value);
  
  // Échapper les guillemets doubles en les doublant
  // et encadrer de guillemets si nécessaire
  if (strValue.includes('"') || strValue.includes(',') || strValue.includes('\n')) {
    return `"${strValue.replace(/"/g, '""')}"`;
  }
  
  return strValue;
}

// Exécuter le script
if (require.main === module) {
  exportSectorCSV().catch(err => {
    console.error('Erreur fatale:', err);
    process.exit(1);
  });
}

module.exports = { exportSectorCSV }; 