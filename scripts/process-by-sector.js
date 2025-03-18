#!/usr/bin/env node

/**
 * Script pour traiter et classer les données des écoles par secteur
 * Lit les données du fichier schools_data_complete_all.json, nettoie les données et les organise par secteur
 */

const fs = require('fs');
const path = require('path');

// Dossiers de données
const DATA_DIR = path.join(__dirname, '..', 'data');
const SOURCE_FILE = path.join(DATA_DIR, 'schools_data_complete_all.json');
const OUTPUT_FILE = path.join(DATA_DIR, 'schools_by_sector.json');
const CLEANED_OUTPUT_FILE = path.join(DATA_DIR, 'schools_cleaned_by_sector.json');

/**
 * Fonction principale de traitement
 */
async function processData() {
  console.log('=== Démarrage du traitement par secteur ===');
  console.log('Date de début:', new Date().toLocaleString());
  console.log('------------------------------------');
  
  // Vérifier que le fichier source existe
  if (!fs.existsSync(SOURCE_FILE)) {
    console.error(`Erreur: Fichier source non trouvé: ${SOURCE_FILE}`);
    console.error('Veuillez d\'abord exécuter le scraper pour collecter les données.');
    process.exit(1);
  }
  
  try {
    // Lire les données des écoles
    const schoolsData = JSON.parse(fs.readFileSync(SOURCE_FILE, 'utf8'));
    console.log(`Lecture de ${schoolsData.length} écoles depuis ${SOURCE_FILE}`);
    
    // Nettoyer les données
    const cleanedData = cleanSchoolsData(schoolsData);
    console.log(`Données nettoyées: ${cleanedData.length} écoles`);
    
    // Classer par secteur
    const schoolsBySector = classifyByField(cleanedData, 'sector');
    console.log(`Classification par secteur terminée. ${Object.keys(schoolsBySector).length} secteurs trouvés.`);
    
    // Afficher les statistiques par secteur
    console.log('\nStatistiques par secteur:');
    console.log('------------------------------------');
    let totalSchools = 0;
    Object.entries(schoolsBySector)
      .sort((a, b) => b[1].length - a[1].length) // Trier par nombre d'écoles décroissant
      .forEach(([sector, schools]) => {
        console.log(`${sector}: ${schools.length} écoles`);
        totalSchools += schools.length;
      });
    console.log('------------------------------------');
    console.log(`Total: ${totalSchools} écoles classées`);
    
    // Sauvegarder les données classées
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(schoolsBySector, null, 2));
    console.log(`Données classées par secteur sauvegardées dans ${OUTPUT_FILE}`);
    
    // Sauvegarder les données nettoyées (format plat)
    fs.writeFileSync(CLEANED_OUTPUT_FILE, JSON.stringify(cleanedData, null, 2));
    console.log(`Données nettoyées sauvegardées dans ${CLEANED_OUTPUT_FILE}`);
    
    console.log('------------------------------------');
    console.log('Date de fin:', new Date().toLocaleString());
    console.log('=== Traitement terminé ===');
    
  } catch (error) {
    console.error('Erreur lors du traitement des données:', error);
    process.exit(1);
  }
}

/**
 * Nettoie les données des écoles
 * @param {Array<Object>} schools - Données brutes des écoles
 * @returns {Array<Object>} Données nettoyées
 */
function cleanSchoolsData(schools) {
  return schools.map(school => {
    // Créer une copie nettoyée de l'école
    const cleanedSchool = { ...school };
    
    // Uniformiser et nettoyer le secteur
    if (cleanedSchool.sector) {
      // Supprimer les caractères spéciaux et uniformiser les secteurs
      cleanedSchool.sector = cleanSector(cleanedSchool.sector);
    } else {
      cleanedSchool.sector = 'Non spécifié';
    }
    
    // Nettoyer l'email
    if (cleanedSchool.email && cleanedSchool.email_found) {
      cleanedSchool.email = cleanEmail(cleanedSchool.email);
    }
    
    // Nettoyer le site web
    if (cleanedSchool.website && cleanedSchool.website_found) {
      cleanedSchool.website = cleanWebsite(cleanedSchool.website);
    }
    
    // Nettoyer le téléphone
    if (cleanedSchool.phone && cleanedSchool.phone_found) {
      cleanedSchool.phone = cleanPhone(cleanedSchool.phone);
    }
    
    // Normaliser le nom de la ville
    if (cleanedSchool.city) {
      cleanedSchool.city = cleanCity(cleanedSchool.city);
    }
    
    return cleanedSchool;
  });
}

/**
 * Nettoie et normalise le nom du secteur
 * @param {string} sector - Le secteur à nettoyer
 * @returns {string} Le secteur nettoyé
 */
function cleanSector(sector) {
  // Convertir en chaîne si ce n'est pas le cas
  if (!sector) return 'Non spécifié';
  
  // Normaliser le texte (minuscules, sans accents)
  let normalizedSector = sector.trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  
  // Mapper vers des catégories standardisées
  const sectorMapping = {
    'communication': 'Communication',
    'commerce': 'Commerce',
    'management': 'Management',
    'gestion': 'Management',
    'ressources humaines': 'Ressources Humaines',
    'rh': 'Ressources Humaines',
    'informatique': 'Informatique',
    'numerique': 'Informatique',
    'digital': 'Informatique',
    'art': 'Art & Design',
    'design': 'Art & Design',
    'graphisme': 'Art & Design',
    'sante': 'Santé',
    'medical': 'Santé',
    'paramedical': 'Santé',
    'marketing': 'Marketing',
    'finance': 'Finance & Comptabilité',
    'comptabilite': 'Finance & Comptabilité',
    'international': 'International',
    'ingenieur': 'Ingénierie',
    'ingenierie': 'Ingénierie',
    'tourisme': 'Tourisme & Hôtellerie',
    'hotellerie': 'Tourisme & Hôtellerie',
    'restauration': 'Tourisme & Hôtellerie',
    'architecture': 'Architecture',
    'immobilier': 'Immobilier',
    'juridique': 'Droit & Juridique',
    'droit': 'Droit & Juridique',
    'agriculture': 'Agriculture & Environnement',
    'environnement': 'Agriculture & Environnement',
    'education': 'Éducation & Formation',
    'formation': 'Éducation & Formation',
    'sport': 'Sport',
    'transport': 'Transport & Logistique',
    'logistique': 'Transport & Logistique',
    'luxe': 'Luxe & Mode',
    'mode': 'Luxe & Mode',
    'cinema': 'Médias & Audiovisuel',
    'audiovisuel': 'Médias & Audiovisuel',
    'media': 'Médias & Audiovisuel',
    'journalisme': 'Médias & Audiovisuel'
  };
  
  // Chercher une correspondance partielle
  for (const [key, value] of Object.entries(sectorMapping)) {
    if (normalizedSector.includes(key)) {
      return value;
    }
  }
  
  // Si aucune correspondance trouvée, capitaliser la première lettre
  return sector.charAt(0).toUpperCase() + sector.slice(1);
}

/**
 * Nettoie et normalise l'email
 * @param {string} email - L'email à nettoyer
 * @returns {string} L'email nettoyé
 */
function cleanEmail(email) {
  if (!email) return '';
  
  // Supprimer les caractères non valides dans les emails
  let cleanedEmail = email.trim();
  
  // Correction des domaines courants
  cleanedEmail = cleanedEmail
    .replace(/\.frs$/, '.fr')
    .replace(/\.coms$/, '.com')
    .replace(/\.orgs$/, '.org')
    .replace(/\.edus$/, '.edu')
    .replace(/\.nets$/, '.net')
    .replace(/\.eus$/, '.eu')
    .replace(/\.pros$/, '.pro')
    .replace(/\.schools$/, '.school')
    .replace(/\.institutes$/, '.institute')
    .replace(/\.orrgs$/, '.org')
    .replace(/\.pariss$/, '.paris');
  
  return cleanedEmail;
}

/**
 * Nettoie et normalise l'URL du site web
 * @param {string} website - Le site web à nettoyer
 * @returns {string} Le site web nettoyé
 */
function cleanWebsite(website) {
  if (!website) return '';
  
  // Nettoyer l'URL
  let cleanedWebsite = website.trim();
  
  // S'assurer que l'URL commence par http:// ou https://
  if (!cleanedWebsite.startsWith('http://') && !cleanedWebsite.startsWith('https://')) {
    cleanedWebsite = 'https://' + cleanedWebsite;
  }
  
  return cleanedWebsite;
}

/**
 * Nettoie et normalise le numéro de téléphone
 * @param {string} phone - Le numéro de téléphone à nettoyer
 * @returns {string} Le numéro de téléphone nettoyé
 */
function cleanPhone(phone) {
  if (!phone) return '';
  
  // Supprimer tous les caractères non numériques
  let cleanedPhone = phone.replace(/[^\d+]/g, '');
  
  // Format français standard
  if (cleanedPhone.startsWith('33') && cleanedPhone.length === 11) {
    cleanedPhone = '+' + cleanedPhone;
  } else if (cleanedPhone.startsWith('0') && cleanedPhone.length === 10) {
    cleanedPhone = '+33' + cleanedPhone.substring(1);
  }
  
  return cleanedPhone;
}

/**
 * Nettoie et normalise le nom de la ville
 * @param {string} city - Le nom de la ville à nettoyer
 * @returns {string} Le nom de la ville nettoyé
 */
function cleanCity(city) {
  if (!city) return '';
  
  // Nettoyer et capitaliser
  return city.trim()
    .replace(/^\w/, c => c.toUpperCase())
    .replace(/-\w/g, c => c.toUpperCase())
    .replace(/\s+/g, ' ');
}

/**
 * Classifie les données selon un champ spécifique
 * @param {Array<Object>} data - Données à classifier
 * @param {string} field - Champ à utiliser pour la classification
 * @returns {Object} Données classifiées
 */
function classifyByField(data, field) {
  const classifiedData = {};
  
  data.forEach(item => {
    const fieldValue = item[field] || 'Non spécifié';
    
    if (!classifiedData[fieldValue]) {
      classifiedData[fieldValue] = [];
    }
    
    classifiedData[fieldValue].push(item);
  });
  
  return classifiedData;
}

// Exécuter le script
if (require.main === module) {
  processData().catch(err => {
    console.error('Erreur fatale:', err);
    process.exit(1);
  });
}

module.exports = { processData }; 