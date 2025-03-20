#!/usr/bin/env node

/**
 * Script pour traiter toutes les écoles déjà collectées
 * Extrait les informations détaillées de chaque école à partir des liens
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { handleCookieConsent } = require('../src/utils/cookieConsentHandler');
const { extractSchoolContactInfo } = require('../src/utils/schoolExtractor');

// Analyser les arguments de ligne de commande
const args = process.argv.slice(2);
const showBrowser = args.includes('--show-browser');
const startFromBatch = args.find(arg => arg.startsWith('--batch='));
const startBatchNumber = startFromBatch ? parseInt(startFromBatch.split('=')[1], 10) : null;
const limitBatches = args.find(arg => arg.startsWith('--limit='));
const maxBatches = limitBatches ? parseInt(limitBatches.split('=')[1], 10) : Infinity;

// Vérifier si le mode headless est activé (par défaut: oui)
const isHeadless = !showBrowser;
const BATCH_SIZE = 50; // Nombre d'écoles à traiter par lot

// Chemins des fichiers
const DATA_DIR = path.join(__dirname, '..', 'data');
const SCREENSHOTS_DIR = path.join(__dirname, '..', 'screenshots');
const SOURCE_FILE = args.find(arg => arg.startsWith('--source=')) 
  ? path.join(DATA_DIR, args.find(arg => arg.startsWith('--source=')).split('=')[1])
  : path.join(DATA_DIR, 'schools_data_links_sectors.json');
const OUTPUT_FILE = path.join(DATA_DIR, 'schools_data_complete.json');
const BACKUP_PREFIX = 'schools_data_batch_';

// Configuration des délais
const DELAY_BETWEEN_SCHOOLS = 1500; // 1.5 secondes entre chaque école
const DELAY_BETWEEN_BATCHES = 5000; // 5 secondes entre les lots
const MAX_RETRIES = 3; // Nombre maximum de tentatives par école

/**
 * Délai d'attente
 * @param {number} ms - Temps en millisecondes
 * @returns {Promise<void>}
 */
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Sauvegarde des données d'un lot
 * @param {Array} schools - Écoles avec leurs données
 * @param {number} batchNumber - Numéro du lot
 */
function saveBatchData(schools, batchNumber) {
  const filename = path.join(DATA_DIR, `${BACKUP_PREFIX}${batchNumber}.json`);
  fs.writeFileSync(filename, JSON.stringify(schools, null, 2));
  console.log(`Sauvegarde du lot ${batchNumber} effectuée: ${schools.length} écoles dans ${filename}`);
}

/**
 * Extrait les informations détaillées d'une école
 * @param {import('playwright').Page} page - L'instance de page Playwright
 * @param {Object} school - Données de base de l'école
 * @returns {Promise<Object>} Données complètes de l'école
 */
async function extractSchoolDetails(page, school) {
  console.log(`Traitement de l'école: ${school.name}`);
  
  try {
    // Plusieurs tentatives en cas d'échec
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        await page.goto(school.url, { timeout: 60000, waitUntil: 'networkidle' });
        break; // Sortir de la boucle si réussi
      } catch (navError) {
        if (attempt < MAX_RETRIES) {
          console.log(`Tentative ${attempt}/${MAX_RETRIES} échouée, nouvelle tentative dans ${attempt * 2} secondes...`);
          await delay(attempt * 2000); // Délai croissant entre les tentatives
        } else {
          console.error(`Impossible d'accéder à l'URL après ${MAX_RETRIES} tentatives:`, school.url);
          throw navError;
        }
      }
    }
    
    // Gérer les cookies si nécessaire (seulement occasionnellement avec la nouvelle méthode améliorée)
    if (Math.random() < 0.1) { // 10% de chance
      try {
        // La fonction retourne maintenant un booléen, mais on ignore le résultat
        // car on continue dans tous les cas
        await handleCookieConsent(page);
      } catch (cookieError) {
        console.log('Erreur lors de la gestion des cookies (non bloquant):', cookieError.message);
        // Continuer malgré l'erreur - le script ne doit pas s'arrêter ici
      }
    }
    
    // Attendre que la page soit chargée, utiliser un try-catch pour éviter les blocages
    try {
      await page.waitForTimeout(2000);
    } catch (timeoutError) {
      console.log('Erreur lors de l\'attente de chargement:', timeoutError.message);
      // Continuer malgré l'erreur
    }
    
    // Extraire les informations de contact avec gestion d'erreur renforcée
    let contactInfo = { 
      email: { found: false, value: 'Non disponible' },
      phone: { found: false, value: 'Non disponible' },
      website: { found: false, value: 'Non disponible' }
    };
    
    try {
      contactInfo = await extractSchoolContactInfo(page);
    } catch (contactError) {
      console.log(`Erreur lors de l'extraction des contacts pour ${school.name}:`, contactError.message);
      // Continuer avec les valeurs par défaut
    }
    
    // Extraire d'autres informations de la page avec gestion d'erreur renforcée
    let additionalInfo = {
      description: '',
      address: '',
      formations: []
    };
    
    try {
      additionalInfo = await page.evaluate(() => {
        const info = {
          description: '',
          address: '',
          formations: []
        };
        
        try {
          // Description de l'école
          const descriptionElement = document.querySelector('.school-description, .tw-text-body-sm');
          if (descriptionElement) {
            info.description = descriptionElement.textContent.trim();
          }
        } catch (e) {
          // Ignorer les erreurs individuelles et continuer
        }
        
        try {
          // Adresse complète
          const addressElement = document.querySelector('.externals-item[data-l*="xnqqerff:"], .tw-flex.tw-gap-2.tw-items-start:has(.tw-text-body-xs)');
          if (addressElement) {
            info.address = addressElement.textContent.trim();
          }
        } catch (e) {
          // Ignorer les erreurs individuelles et continuer
        }
        
        try {
          // Formations proposées
          const formationElements = document.querySelectorAll('.diplomas-list li, .tw-grid-cols-1 .tw-flex.tw-flex-col a');
          info.formations = Array.from(formationElements).map(el => el.textContent.trim()).filter(text => text);
        } catch (e) {
          // Ignorer les erreurs individuelles et continuer
        }
        
        return info;
      });
    } catch (infoError) {
      console.log(`Erreur lors de l'extraction des informations additionnelles pour ${school.name}:`, infoError.message);
      // Continuer avec les valeurs par défaut
    }
    
    // Construire l'objet école complet
    return {
      name: school.name,
      city: school.city,
      sector: school.sector,
      url: school.url,
      description: additionalInfo.description,
      address: additionalInfo.address,
      formations: additionalInfo.formations,
      email: contactInfo.email.value,
      email_found: contactInfo.email.found,
      phone: contactInfo.phone.value,
      phone_found: contactInfo.phone.found,
      website: contactInfo.website.value,
      website_found: contactInfo.website.found,
      processed_at: new Date().toISOString()
    };
  } catch (error) {
    console.error(`Erreur lors du traitement de ${school.name}:`, error.message);
    
    // Retourner un objet avec les données de base et une indication d'erreur
    return {
      name: school.name,
      city: school.city,
      sector: school.sector,
      url: school.url,
      error: error.message,
      email: 'Non disponible (erreur)',
      email_found: false,
      phone: 'Non disponible (erreur)',
      phone_found: false,
      website: 'Non disponible (erreur)',
      website_found: false,
      processed_at: new Date().toISOString()
    };
  }
}

/**
 * Traite un lot d'écoles
 * @param {import('playwright').Page} page - L'instance de page Playwright
 * @param {Array<Object>} batch - Lot d'écoles à traiter
 * @returns {Promise<Array<Object>>} Écoles avec leurs données complètes
 */
async function processBatch(page, batch) {
  const processedSchools = [];
  
  for (let i = 0; i < batch.length; i++) {
    const school = batch[i];
    
    try {
      const processedSchool = await extractSchoolDetails(page, school);
      processedSchools.push(processedSchool);
      
      // Progression dans le lot actuel
      console.log(`École ${i+1}/${batch.length} traitée - Email: ${processedSchool.email}`);
      
      // Pause aléatoire pour éviter la détection
      const randomDelay = DELAY_BETWEEN_SCHOOLS + (Math.random() * 1000);
      await delay(randomDelay);
    } catch (error) {
      console.error(`Erreur fatale lors du traitement de l'école ${school.name}:`, error);
      // Ajouter l'école avec une indication d'erreur
      processedSchools.push({
        ...school,
        error: 'Erreur fatale: ' + error.message,
        email: 'Non disponible (erreur fatale)',
        email_found: false,
        phone: 'Non disponible (erreur fatale)',
        phone_found: false,
        website: 'Non disponible (erreur fatale)',
        website_found: false,
        processed_at: new Date().toISOString()
      });
      
      // Attendre un peu plus longtemps après une erreur
      await delay(3000);
    }
  }
  
  return processedSchools;
}

/**
 * Fonction principale
 */
async function run() {
  console.log('=== Démarrage du traitement des écoles ===');
  console.log(`Mode: ${isHeadless ? 'headless' : 'avec interface graphique'}`);
  console.log(`Fichier source: ${SOURCE_FILE}`);
  if (startBatchNumber) {
    console.log(`Reprise à partir du lot ${startBatchNumber}`);
  }
  if (maxBatches < Infinity) {
    console.log(`Limite: ${maxBatches} lots`);
  }
  console.log('Date de début:', new Date().toLocaleString());
  
  // Vérifier que le fichier source existe
  if (!fs.existsSync(SOURCE_FILE)) {
    console.error(`Fichier source introuvable: ${SOURCE_FILE}`);
    console.log('Recherche d\'alternatives...');
    
    // Rechercher des alternatives potentielles
    const files = fs.readdirSync(DATA_DIR);
    const possibleFiles = files.filter(f => f.includes('links') && f.endsWith('.json'));
    
    if (possibleFiles.length > 0) {
      console.log('Fichiers alternatifs trouvés:');
      possibleFiles.forEach(f => console.log(`- ${f}`));
      console.error('Veuillez spécifier explicitement le fichier source à utiliser avec --source=nomfichier.json');
    } else {
      console.error('Aucun fichier de liens d\'écoles trouvé dans', DATA_DIR);
    }
    
    process.exit(1);
  }
  
  // Charger les écoles depuis le fichier source
  console.log(`Chargement des écoles depuis ${SOURCE_FILE}...`);
  const schoolLinks = JSON.parse(fs.readFileSync(SOURCE_FILE, 'utf8'));
  console.log(`${schoolLinks.length} écoles chargées`);
  
  // Vérifier s'il y a des écoles à traiter
  if (schoolLinks.length === 0) {
    console.error('Aucune école à traiter. Arrêt du script.');
    process.exit(1);
  }
  
  // Vérifier si un traitement existe déjà
  const existingResults = [];
  if (fs.existsSync(OUTPUT_FILE)) {
    console.log(`Fichier de résultats existant trouvé: ${OUTPUT_FILE}`);
    const existingData = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
    existingResults.push(...existingData);
    console.log(`${existingResults.length} écoles déjà traitées dans le fichier de sortie`);
  }
  
  // Rechercher des lots déjà traités
  const files = fs.readdirSync(DATA_DIR);
  const batchFiles = files.filter(f => f.startsWith(BACKUP_PREFIX) && f.endsWith('.json'))
                          .sort((a, b) => {
                            const numA = parseInt(a.replace(BACKUP_PREFIX, '').replace('.json', ''), 10);
                            const numB = parseInt(b.replace(BACKUP_PREFIX, '').replace('.json', ''), 10);
                            return numA - numB;
                          });
  
  if (batchFiles.length > 0) {
    console.log(`${batchFiles.length} lots déjà traités trouvés`);
    
    // Afficher les lots disponibles
    console.log('Lots disponibles:');
    batchFiles.forEach(f => {
      const batchNum = parseInt(f.replace(BACKUP_PREFIX, '').replace('.json', ''), 10);
      console.log(`- Lot ${batchNum}: ${f}`);
    });
    
    // Charger les données des lots existants
    for (const batchFile of batchFiles) {
      const batchNum = parseInt(batchFile.replace(BACKUP_PREFIX, '').replace('.json', ''), 10);
      
      // Si on a spécifié un batch de départ, ignorer les batchs précédents
      if (startBatchNumber && batchNum < startBatchNumber) {
        console.log(`Ignorer le lot ${batchNum} car on commence au lot ${startBatchNumber}`);
        continue;
      }
      
      try {
        const batchData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, batchFile), 'utf8'));
        console.log(`Lot ${batchNum}: ${batchData.length} écoles`);
        
        // Ajouter uniquement les écoles qui ne sont pas dans existingResults
        const existingUrls = new Set(existingResults.map(s => s.url));
        const newSchools = batchData.filter(s => !existingUrls.has(s.url));
        
        if (newSchools.length > 0) {
          existingResults.push(...newSchools);
          console.log(`${newSchools.length} nouvelles écoles ajoutées depuis ${batchFile}`);
        }
      } catch (error) {
        console.error(`Erreur lors du chargement du lot ${batchFile}:`, error.message);
        console.log('Ce lot sera ignoré');
      }
    }
    
    console.log(`Total après fusion des lots: ${existingResults.length} écoles`);
  }
  
  // Identifier les écoles restantes à traiter
  const processedUrls = new Set(existingResults.map(school => school.url));
  let remainingSchools = schoolLinks.filter(school => !processedUrls.has(school.url));
  
  console.log(`${remainingSchools.length} écoles restantes à traiter`);
  
  // Si toutes les écoles ont déjà été traitées
  if (remainingSchools.length === 0) {
    console.log('Toutes les écoles ont déjà été traitées!');
    
    // Sauvegarder la version consolidée finale
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(existingResults, null, 2));
    console.log(`Données complètes sauvegardées dans ${OUTPUT_FILE}`);
    
    return;
  }
  
  // Lancer le navigateur
  console.log('Lancement du navigateur...');
  let browser;
  try {
    browser = await chromium.launch({
      headless: isHeadless,
      slowMo: isHeadless ? 0 : 50
    });
    
    // Configuration du contexte
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      deviceScaleFactor: 1,
    });
    
    // Créer une page
    const page = await context.newPage();
    
    try {
      // Diviser les écoles restantes en lots
      const allProcessedSchools = [...existingResults];
      const totalBatches = Math.ceil(remainingSchools.length / BATCH_SIZE);
      
      console.log(`Traitement en ${totalBatches} lots de ${BATCH_SIZE} écoles maximum`);
      
      // Si on a spécifié un batch de départ, calculer l'index dans remainingSchools
      let startIndex = 0;
      if (startBatchNumber) {
        startIndex = (startBatchNumber - 1) * BATCH_SIZE;
        if (startIndex >= remainingSchools.length) {
          console.error(`Le lot de départ ${startBatchNumber} dépasse le nombre d'écoles restantes.`);
          process.exit(1);
        }
        console.log(`Démarrage à l'index ${startIndex} (lot ${startBatchNumber})`);
        remainingSchools = remainingSchools.slice(startIndex);
      }
      
      // Limiter le nombre de lots si demandé
      const batchesToProcess = Math.min(Math.ceil(remainingSchools.length / BATCH_SIZE), maxBatches);
      console.log(`Traitement de ${batchesToProcess} lots sur ${totalBatches} au total`);
      
      // Traiter chaque lot
      for (let i = 0; i < remainingSchools.length && i / BATCH_SIZE < maxBatches; i += BATCH_SIZE) {
        const batchNumber = Math.floor(i / BATCH_SIZE) + (startBatchNumber || 1);
        const batch = remainingSchools.slice(i, i + BATCH_SIZE);
        
        console.log(`\n=== Traitement du lot ${batchNumber}/${totalBatches} (${batch.length} écoles) ===`);
        const startTime = new Date();
        
        // Traiter le lot avec une gestion d'erreur supplémentaire
        try {
          const processedBatch = await processBatch(page, batch);
          
          // Sauvegarder le lot courant
          saveBatchData(processedBatch, batchNumber);
          
          // Ajouter aux résultats globaux
          allProcessedSchools.push(...processedBatch);
          
          // Sauvegarder tous les résultats
          fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allProcessedSchools, null, 2));
          
          // Afficher la progression
          const endTime = new Date();
          const duration = (endTime - startTime) / 1000 / 60; // en minutes
          const completion = ((i + batch.length) / remainingSchools.length * 100).toFixed(2);
          
          console.log(`\nLot ${batchNumber} terminé en ${duration.toFixed(2)} minutes`);
          console.log(`Progression: ${i + batch.length}/${remainingSchools.length} (${completion}%)`);
          console.log(`Total global: ${allProcessedSchools.length} écoles traitées`);
        } catch (batchError) {
          console.error(`\nERREUR lors du traitement du lot ${batchNumber}:`, batchError);
          console.log('Tentative de sauvegarde d\'urgence et passage au lot suivant...');
          
          // Sauvegarder quand même ce qu'on a pu récupérer
          fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allProcessedSchools, null, 2));
          
          // Attendre plus longtemps après une erreur sur un lot entier
          await delay(10000);
        }
        
        // Pause entre les lots pour réduire la charge serveur
        if (i + BATCH_SIZE < remainingSchools.length && (i / BATCH_SIZE) + 1 < maxBatches) {
          console.log(`Pause de ${DELAY_BETWEEN_BATCHES/1000} secondes avant le prochain lot...`);
          await delay(DELAY_BETWEEN_BATCHES);
        }
      }
      
      console.log('\n=== Traitement terminé avec succès ===');
      console.log(`${allProcessedSchools.length} écoles traitées au total`);
      
    } catch (error) {
      console.error('\nERREUR FATALE:', error);
      
      // Tentative de sauvegarde d'urgence
      if (existingResults.length > 0) {
        const emergencyFile = path.join(DATA_DIR, `schools_data_emergency_backup_${Date.now()}.json`);
        fs.writeFileSync(emergencyFile, JSON.stringify(existingResults, null, 2));
        console.log(`Sauvegarde d'urgence effectuée dans ${emergencyFile}`);
      }
    } finally {
      try {
        // Fermer le navigateur proprement
        await browser.close();
        console.log('Navigateur fermé');
      } catch (closeError) {
        console.error('Erreur lors de la fermeture du navigateur:', closeError.message);
      }
    }
  } catch (browserError) {
    console.error('Erreur lors du lancement du navigateur:', browserError);
    process.exit(1);
  } finally {
    console.log('Date de fin:', new Date().toLocaleString());
  }
}

// Afficher l'aide si demandé
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage: node ${path.basename(__filename)} [options]

Options:
  --show-browser       Affiche le navigateur pendant l'exécution
  --batch=N            Reprend à partir du lot N
  --limit=N            Limite le traitement à N lots
  --source=FILE.json   Utilise le fichier spécifié comme source de données
  --help, -h           Affiche cette aide
  
Exemples:
  node ${path.basename(__filename)} --batch=45               Reprend à partir du lot 45
  node ${path.basename(__filename)} --show-browser --limit=2 Traite 2 lots en montrant le navigateur
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