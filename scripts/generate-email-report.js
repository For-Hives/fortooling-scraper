#!/usr/bin/env node

/**
 * Script d'analyse avancée des emails des écoles
 * Extraction, validation et classification des adresses email
 */

const fs = require('fs');
const path = require('path');

// Chemins des fichiers
const DATA_DIR = path.join(__dirname, '..', 'data');
const SOURCE_FILE = path.join(DATA_DIR, 'schools_data_complete.json');
const EMAILS_OUTPUT_FILE = path.join(DATA_DIR, 'schools_emails_analysis.json');
const EMAIL_CSV_FILE = path.join(DATA_DIR, 'reports', 'emails_valides.csv');

// Analyser les arguments de ligne de commande
const args = process.argv.slice(2);
const sourceFile = args.find(arg => arg.startsWith('--source=')) 
  ? path.join(DATA_DIR, args.find(arg => arg.startsWith('--source=')).split('=')[1])
  : SOURCE_FILE;

/**
 * Valide et normalise une adresse email
 * @param {string} email - Adresse email à valider
 * @returns {Object} - Résultat de validation avec l'email normalisé
 */
function validateEmail(email) {
  if (!email) return { valid: false, normalized: null, reason: 'Email vide' };
  
  // Normaliser l'email (suppression des espaces, passage en minuscules)
  let normalized = email.trim().toLowerCase();
  
  // Expression régulière pour valider un email basique
  const basicEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!basicEmailRegex.test(normalized)) {
    return { valid: false, normalized, reason: 'Format invalide' };
  }
  
  // Vérification des domaines suspects ou génériques
  const suspectDomains = ['example.com', 'domain.com', 'email.com', 'test.com'];
  const domain = normalized.split('@')[1];
  
  if (suspectDomains.includes(domain)) {
    return { valid: false, normalized, reason: 'Domaine suspect' };
  }
  
  return { valid: true, normalized, domain };
}

/**
 * Catégorise un email en fonction de son domaine
 * @param {string} domain - Domaine de l'email
 * @returns {string} - Catégorie
 */
function categorizeEmailDomain(domain) {
  if (!domain) return 'Inconnu';
  
  // Liste des domaines éducatifs français
  const educationalDomains = ['ac-', '.edu', 'enseigne', 'etudiant', 'sorbonne', 'univ-', '.univ.', 'ecole', 'lycee', 'college'];
  
  // Liste des fournisseurs d'email personnels communs
  const personalProviders = ['gmail.com', 'hotmail.com', 'yahoo.', 'outlook.com', 'orange.fr', 'wanadoo.fr', 'free.fr', 'sfr.fr', 'laposte.net'];
  
  // Liste des domaines professionnels génériques
  const professionalDomains = ['entreprise', 'group', 'agency', 'conseil', 'consulting', 'formation', 'institute', 'center', 'centre'];
  
  // Vérifier les correspondances
  if (educationalDomains.some(ed => domain.includes(ed))) {
    return 'Éducation';
  } else if (personalProviders.some(pp => domain.includes(pp))) {
    return 'Personnel';
  } else if (professionalDomains.some(pd => domain.includes(pd))) {
    return 'Professionnel générique';
  } else if (domain.endsWith('.edu') || domain.endsWith('.ac.fr')) {
    return 'Éducation';
  } else if (domain.endsWith('.org') || domain.endsWith('.asso.fr')) {
    return 'Organisation';
  } else if (domain.endsWith('.gov.fr') || domain.endsWith('.gouv.fr')) {
    return 'Gouvernement';
  } else if (domain.endsWith('.com') || domain.endsWith('.fr') || domain.endsWith('.io') || domain.endsWith('.net')) {
    return 'Professionnel';
  }
  
  return 'Autre';
}

/**
 * Analyse les emails des écoles
 * @param {Array<Object>} schools - Liste des écoles
 * @returns {Object} - Résultats de l'analyse
 */
function analyzeEmails(schools) {
  // Statistiques et catégorisation
  const results = {
    total: schools.length,
    emailStats: {
      totalWithEmailField: 0,
      validEmails: 0,
      invalidEmails: 0,
      uniqueDomains: new Set(),
      categoryCounts: {},
      domainCounts: {},
      invalidReasons: {}
    },
    schoolsWithValidEmails: []
  };
  
  schools.forEach(school => {
    // Ignorer les écoles sans champ email
    if (!school.email) return;
    
    results.emailStats.totalWithEmailField++;
    
    // Valider l'email
    const validation = validateEmail(school.email);
    
    if (validation.valid) {
      results.emailStats.validEmails++;
      results.emailStats.uniqueDomains.add(validation.domain);
      
      // Catégoriser l'email
      const category = categorizeEmailDomain(validation.domain);
      results.emailStats.categoryCounts[category] = (results.emailStats.categoryCounts[category] || 0) + 1;
      
      // Compteur de domaines
      results.emailStats.domainCounts[validation.domain] = (results.emailStats.domainCounts[validation.domain] || 0) + 1;
      
      // Ajouter l'école à la liste de celles avec des emails valides
      results.schoolsWithValidEmails.push({
        ...school,
        email_normalized: validation.normalized,
        email_domain: validation.domain,
        email_category: category
      });
    } else {
      results.emailStats.invalidEmails++;
      results.emailStats.invalidReasons[validation.reason] = (results.emailStats.invalidReasons[validation.reason] || 0) + 1;
    }
  });
  
  // Convertir le Set en array pour le JSON
  results.emailStats.uniqueDomains = Array.from(results.emailStats.uniqueDomains);
  
  // Trier les domaines par fréquence
  results.emailStats.domainCounts = Object.entries(results.emailStats.domainCounts)
    .sort((a, b) => b[1] - a[1])
    .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {});
  
  return results;
}

/**
 * Génère un rapport CSV des emails valides
 * @param {Array<Object>} schools - Écoles avec emails valides
 * @param {string} outputFile - Chemin du fichier de sortie
 */
function generateEmailCSV(schools, outputFile) {
  // Créer le dossier parent si nécessaire
  const dir = path.dirname(outputFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // Entêtes du CSV
  const headers = ['Nom', 'Secteur', 'Ville', 'Email', 'Domaine', 'Catégorie', 'Téléphone', 'Site Web'];
  
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
      school.sector || '',
      school.city || '',
      school.email_normalized || school.email || '',
      school.email_domain || '',
      school.email_category || '',
      school.phone || '',
      school.website || ''
    ].map(escapeCSV).join(',');
  });
  
  // Écrire le fichier CSV
  const csvContent = [headers.join(','), ...rows].join('\n');
  fs.writeFileSync(outputFile, csvContent);
  
  console.log(`Rapport CSV des emails valides généré: ${outputFile}`);
}

/**
 * Fonction principale
 */
async function run() {
  console.log('=== Démarrage de l\'analyse des emails des écoles ===');
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
  
  // Analyser les emails
  console.log('Analyse des emails...');
  const emailAnalysis = analyzeEmails(schools);
  
  // Sauvegarder les résultats
  console.log('Sauvegarde des résultats...');
  fs.writeFileSync(EMAILS_OUTPUT_FILE, JSON.stringify(emailAnalysis, null, 2));
  console.log(`Analyse des emails sauvegardée dans ${EMAILS_OUTPUT_FILE}`);
  
  // Générer un CSV des emails valides
  if (emailAnalysis.schoolsWithValidEmails.length > 0) {
    console.log('Génération du rapport CSV des emails valides...');
    generateEmailCSV(emailAnalysis.schoolsWithValidEmails, EMAIL_CSV_FILE);
  }
  
  // Afficher les statistiques
  console.log('\n=== Résultats de l\'analyse des emails ===');
  console.log(`Total des écoles: ${emailAnalysis.total}`);
  console.log(`Écoles avec un champ email: ${emailAnalysis.emailStats.totalWithEmailField} (${(emailAnalysis.emailStats.totalWithEmailField / emailAnalysis.total * 100).toFixed(2)}%)`);
  console.log(`Emails valides: ${emailAnalysis.emailStats.validEmails} (${(emailAnalysis.emailStats.validEmails / emailAnalysis.emailStats.totalWithEmailField * 100).toFixed(2)}% des emails)`);
  console.log(`Emails invalides: ${emailAnalysis.emailStats.invalidEmails} (${(emailAnalysis.emailStats.invalidEmails / emailAnalysis.emailStats.totalWithEmailField * 100).toFixed(2)}% des emails)`);
  console.log(`Domaines uniques: ${emailAnalysis.emailStats.uniqueDomains.length}`);
  
  // Afficher les raisons d'invalidité
  if (emailAnalysis.emailStats.invalidEmails > 0) {
    console.log('\nRaisons d\'invalidité:');
    Object.entries(emailAnalysis.emailStats.invalidReasons)
      .sort((a, b) => b[1] - a[1])
      .forEach(([reason, count]) => {
        console.log(`- ${reason}: ${count} (${(count / emailAnalysis.emailStats.invalidEmails * 100).toFixed(2)}%)`);
      });
  }
  
  // Afficher les catégories d'emails
  console.log('\nCatégories d\'emails:');
  Object.entries(emailAnalysis.emailStats.categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([category, count]) => {
      console.log(`- ${category}: ${count} (${(count / emailAnalysis.emailStats.validEmails * 100).toFixed(2)}%)`);
    });
  
  // Afficher les 10 domaines les plus courants
  console.log('\nTop 10 des domaines:');
  Object.entries(emailAnalysis.emailStats.domainCounts)
    .slice(0, 10)
    .forEach(([domain, count]) => {
      console.log(`- ${domain}: ${count} (${(count / emailAnalysis.emailStats.validEmails * 100).toFixed(2)}%)`);
    });
}

// Afficher l'aide si demandé
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage: node ${path.basename(__filename)} [options]

Options:
  --source=FILE.json   Utilise le fichier spécifié comme source (par défaut: schools_data_complete.json)
  --help, -h           Affiche cette aide
  
Description:
  Ce script effectue une analyse approfondie des emails des écoles, incluant
  la validation, la normalisation et la catégorisation des adresses email.
  Il génère un rapport JSON détaillé et un fichier CSV des emails valides.
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