#!/usr/bin/env node

/**
 * Script de scraping massif pour récupérer toutes les écoles de Diplomeo
 * Utilise plusieurs stratégies pour maximiser le nombre d'écoles récupérées
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { handleCookieConsent } = require('../src/utils/cookieConsentHandler');
const { extractSchoolLinks, extractSchoolContactInfo, clickSeeMoreButton } = require('../src/utils/schoolExtractor');
const { generatePageUrls } = require('../src/utils/scraperUtils');

// Vérifier si le mode headless est activé
const isHeadless = process.argv.includes('--headless');

// URL de base et nombre maximum de pages à parcourir
const BASE_URL = 'https://diplomeo.com/etablissements/resultats';
const MAX_PAGES = 500; // Augmentation significative du nombre de pages
const MAX_SCROLLS = 300; // Augmentation du nombre de défilements
const MAX_SCHOOLS = 10000; // Objectif de 10 000 écoles
const SCROLL_BATCH_SIZE = 50; // Nombre d'écoles par lot de défilement

// Créer les dossiers nécessaires
const ensureDirExists = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const DATA_DIR = path.join(__dirname, '..', 'data');
const SCREENSHOTS_DIR = path.join(__dirname, '..', 'screenshots');
ensureDirExists(DATA_DIR);
ensureDirExists(SCREENSHOTS_DIR);

/**
 * Sauvegarde intermédiaire des données
 * @param {Array} schools - Les écoles à sauvegarder
 * @param {string} suffix - Suffixe pour le nom du fichier
 */
function saveIntermediateData(schools, suffix = 'progress') {
  const filename = path.join(DATA_DIR, `schools_data_${suffix}.json`);
  fs.writeFileSync(filename, JSON.stringify(schools, null, 2));
  console.log(`Sauvegarde intermédiaire effectuée: ${schools.length} écoles dans ${filename}`);
}

/**
 * Configuration d'un délai de pause pour éviter de surcharger le serveur
 * @param {number} ms - Délai en millisecondes
 * @returns {Promise<void>}
 */
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Script principal
 */
async function run() {
  console.log('=== Démarrage du scraping massif de Diplomeo ===');
  console.log(`Mode: ${isHeadless ? 'headless (sans interface)' : 'avec interface graphique'}`);
  console.log('Objectif:', MAX_SCHOOLS, 'écoles');
  console.log('Date de début:', new Date().toLocaleString());
  console.log('------------------------------------');
  
  // Stocker les données
  const allSchoolLinks = [];
  const schools = [];
  
  // Lancer le navigateur
  console.log('Lancement du navigateur...');
  const browser = await chromium.launch({
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
    // Stratégie 1: Défilement intensif avec "voir plus"
    console.log('=== Stratégie 1: Défilement avec bouton "voir plus" ===');
    await loadWithScrolling(page, allSchoolLinks);
    
    // Vérifier si nous avons atteint le nombre cible
    if (allSchoolLinks.length < MAX_SCHOOLS) {
      // Stratégie 2: Pagination
      console.log('=== Stratégie 2: Pagination ===');
      await loadWithPagination(page, allSchoolLinks);
    }
    
    // Stratégie 3: Filtres par secteur (si nécessaire)
    if (allSchoolLinks.length < MAX_SCHOOLS) {
      console.log('=== Stratégie 3: Utilisation des filtres par secteur ===');
      await loadWithSectorFilters(page, allSchoolLinks);
    }
    
    // Dédupliquer les écoles
    const uniqueSchoolLinks = [...new Map(allSchoolLinks.map(item => [item.url, item])).values()];
    console.log(`Nombre total d'écoles uniques: ${uniqueSchoolLinks.length}`);
    
    // Sauvegarder la liste des écoles
    fs.writeFileSync(path.join(DATA_DIR, 'schools_list_complete.json'), JSON.stringify(uniqueSchoolLinks, null, 2));
    console.log(`Liste des écoles sauvegardée dans schools_list_complete.json`);
    
    if (uniqueSchoolLinks.length === 0) {
      console.error('Aucune école trouvée, arrêt du script');
      return;
    }
    
    // Traiter les écoles par lots pour éviter de perdre toutes les données en cas d'erreur
    const BATCH_SIZE = 50;
    let completed = 0;
    
    // Traiter par lots
    for (let i = 0; i < uniqueSchoolLinks.length; i += BATCH_SIZE) {
      const batch = uniqueSchoolLinks.slice(i, i + BATCH_SIZE);
      console.log(`Traitement du lot ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(uniqueSchoolLinks.length/BATCH_SIZE)} (${batch.length} écoles)`);
      
      await extractBatchDetails(page, batch, schools);
      completed += batch.length;
      
      // Sauvegarder après chaque lot
      saveIntermediateData(schools);
      
      console.log(`Progression: ${completed}/${uniqueSchoolLinks.length} écoles traitées (${Math.round(completed/uniqueSchoolLinks.length*100)}%)`);
      
      // Pause entre les lots pour éviter de surcharger le site
      await delay(3000);
    }
    
    // Sauvegarde finale
    fs.writeFileSync(path.join(DATA_DIR, 'schools_data_complete_all.json'), JSON.stringify(schools, null, 2));
    console.log(`Données complètes sauvegardées (${schools.length} écoles)`);
    
  } catch (error) {
    console.error('Erreur:', error);
    
    // Sauvegarde de secours
    if (allSchoolLinks.length > 0) {
      fs.writeFileSync(path.join(DATA_DIR, 'schools_list_error_backup.json'), JSON.stringify(allSchoolLinks, null, 2));
    }
    
    if (schools.length > 0) {
      fs.writeFileSync(path.join(DATA_DIR, 'schools_data_error_backup.json'), JSON.stringify(schools, null, 2));
    }
    
    console.log('Sauvegardes d\'urgence effectuées suite à l\'erreur');
  } finally {
    await browser.close();
    console.log('Navigateur fermé. Scraping terminé.');
    console.log('------------------------------------');
    console.log('Date de fin:', new Date().toLocaleString());
    console.log(`Écoles récupérées: ${schools.length}`);
    console.log('=== Fin du scraping ===');
  }
}

/**
 * Charge les écoles en utilisant le défilement et le bouton "voir plus"
 * Méthode améliorée pour accumuler les écoles au lieu de les remplacer
 */
async function loadWithScrolling(page, allSchoolLinks) {
  console.log('Accès à la page de résultats...');
  await page.goto(BASE_URL, { timeout: 90000, waitUntil: 'networkidle' });
  
  // Capturer le début de la page
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'initial-page.png') });
  
  // Gérer la popup de consentement des cookies
  await handleCookieConsent(page);
  
  // Attendre que le contenu initial soit chargé
  console.log('Attente du chargement du contenu initial...');
  try {
    await page.waitForSelector('ul[data-cy="hub-schools-results"]', { timeout: 10000 });
    console.log('Liste des écoles trouvée');
  } catch (error) {
    console.log('Sélecteur principal non trouvé, utilisation d\'une alternative...');
    try {
      await page.waitForSelector('.tw-flex.tw-flex-col.tw-w-full', { timeout: 10000 });
    } catch (e) {
      console.log('Impossible de trouver la liste des écoles avec la méthode de défilement');
      return;
    }
  }
  
  // Variables pour suivre le progrès
  let previousSchoolCount = 0;
  let noChangeCount = 0;
  
  // Utiliser un Set pour stocker les URLs uniques globalement
  const globalUniqueUrls = new Set(allSchoolLinks.map(school => school.url));
  
  // Stratégie de défilement intensif pour charger plus d'écoles
  console.log('Défilement intensif pour charger plus d\'écoles...');
  
  for (let i = 0; i < MAX_SCROLLS; i++) {
    console.log(`Défilement ${i+1}/${MAX_SCROLLS}`);
    
    // Défiler jusqu'en bas
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);
    
    // Prendre une capture d'écran périodique (pas à chaque défilement pour économiser de l'espace)
    if (i % 10 === 0) {
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `scroll-${i+1}.png`) });
    }
    
    // Cliquer plusieurs fois sur le bouton "voir plus" pour maximiser le chargement
    let buttonClickCount = 0;
    let buttonClicked = false;
    
    // Faire plusieurs tentatives de clic (maximum 3)
    for (let clickAttempt = 0; clickAttempt < 3; clickAttempt++) {
      buttonClicked = await clickSeeMoreButton(page);
      if (buttonClicked) {
        buttonClickCount++;
        await page.waitForTimeout(1500); // Attendre le chargement
      } else {
        break;
      }
    }
    
    if (buttonClickCount > 0) {
      console.log(`Bouton "voir plus" cliqué ${buttonClickCount} fois`);
    } else {
      console.log('Bouton non trouvé, essai de défilement supplémentaire...');
      await page.evaluate(() => {
        window.scrollBy(0, -300); // Remonter un peu pour voir si le bouton apparaît
      });
      await page.waitForTimeout(1000);
      await clickSeeMoreButton(page);
    }
    
    // Attendre le chargement complet
    await page.waitForTimeout(3000);
    
    // Vérifier si nous avons de nouvelles écoles
    const currentSchools = await extractSchoolLinks(page);
    console.log(`${currentSchools.length} écoles trouvées après le défilement ${i+1}`);
    
    // Ajouter les écoles à notre collection (seulement les nouvelles)
    if (currentSchools.length > 0) {
      // Vérifier si nous avons de nouvelles écoles par rapport au défilement précédent
      if (currentSchools.length === previousSchoolCount) {
        noChangeCount++;
        console.log(`Aucune nouvelle école trouvée (${noChangeCount} fois consécutives)`);
        
        // Si pas de nouvelles écoles pendant 5 défilements consécutifs, on arrête
        if (noChangeCount >= 5) {
          console.log('Pas de nouvelles écoles depuis 5 défilements, arrêt du défilement');
          break;
        }
      } else {
        // Réinitialiser le compteur si nous avons de nouvelles écoles
        noChangeCount = 0;
        previousSchoolCount = currentSchools.length;
      }
      
      // Ajouter chaque école en vérifiant les doublons par URL
      let newSchoolsCount = 0;
      for (const school of currentSchools) {
        if (!globalUniqueUrls.has(school.url)) {
          globalUniqueUrls.add(school.url);
          allSchoolLinks.push(school);
          newSchoolsCount++;
        }
      }
      
      // Afficher le compte réel d'écoles uniques ajoutées
      console.log(`${newSchoolsCount} nouvelles écoles ajoutées (total: ${allSchoolLinks.length})`);
      
      // Sauvegarde périodique
      if (i % 5 === 0 || newSchoolsCount > 0) {
        saveIntermediateData(allSchoolLinks, 'links_scroll');
      }
      
      // Si nous avons atteint le nombre cible, arrêter
      if (allSchoolLinks.length >= MAX_SCHOOLS) {
        console.log(`Nombre cible d'écoles atteint (${allSchoolLinks.length}), arrêt du défilement`);
        break;
      }
      
      // Si nous avons collecté un nombre substantiel, faire une pause pour réduire la charge serveur
      if (newSchoolsCount > SCROLL_BATCH_SIZE) {
        console.log(`Pause de 5 secondes après avoir collecté ${newSchoolsCount} écoles`);
        await delay(5000);
      }
    }
  }
  
  console.log(`Total après défilement: ${allSchoolLinks.length} écoles trouvées`);
}

/**
 * Charge les écoles en utilisant la pagination avec différentes pages et filtres
 * Méthode améliorée pour extraire plus d'écoles
 */
async function loadWithPagination(page, allSchoolLinks) {
  // Générer plusieurs ensembles d'URLs pour différentes configurations de recherche
  const mainPageUrls = generatePageUrls(BASE_URL, MAX_PAGES);
  
  // Ajouter d'autres configurations de recherche pour maximiser les résultats
  const searchConfigs = [
    { name: "Paris", param: "?filter=paris" },
    { name: "Lyon", param: "?filter=lyon" },
    { name: "Marseille", param: "?filter=marseille" },
    { name: "Niveau Bac", param: "?niveau=bac" },
    { name: "Niveau Bac+2", param: "?niveau=bac-plus-2" },
    { name: "Niveau Bac+3", param: "?niveau=bac-plus-3" },
    { name: "Niveau Bac+5", param: "?niveau=bac-plus-5" }
  ];
  
  // Créer des URLs supplémentaires basées sur les configurations
  let additionalPageUrls = [];
  for (const config of searchConfigs) {
    const configUrls = generatePageUrls(`${BASE_URL}${config.param}`, Math.floor(MAX_PAGES / 5));
    console.log(`Ajout de ${configUrls.length} URLs pour la configuration "${config.name}"`);
    additionalPageUrls = [...additionalPageUrls, ...configUrls];
  }
  
  // Combiner tous les ensembles d'URLs
  const allPageUrls = [...mainPageUrls, ...additionalPageUrls];
  console.log(`Total: ${allPageUrls.length} URLs de pagination générées`);
  
  // Stocker les URLs d'écoles déjà collectées pour éviter les doublons
  const uniqueSchoolUrls = new Set(allSchoolLinks.map(school => school.url));
  
  // Parcourir toutes les URLs de pagination
  let paginationCounter = 0;
  for (let i = 0; i < allPageUrls.length; i++) {
    paginationCounter++;
    console.log(`Visite de la page ${paginationCounter}/${allPageUrls.length}: ${allPageUrls[i]}`);
    
    try {
      await page.goto(allPageUrls[i], { timeout: 90000, waitUntil: 'networkidle' });
      
      // Gérer la popup des cookies si nécessaire (seulement périodiquement)
      if (i % 10 === 0) {
        try {
          await handleCookieConsent(page);
        } catch (error) {
          console.error('Erreur lors de la gestion des cookies, mais on continue:', error);
        }
      }
      
      // Attendre le chargement du contenu
      try {
        await page.waitForSelector('ul[data-cy="hub-schools-results"]', { timeout: 10000 });
        console.log('Liste des écoles trouvée');
      } catch (error) {
        console.log('Pas de liste d\'écoles sur cette page, passage à la suivante');
        continue;
      }
      
      // Prendre une capture d'écran périodique
      if (i % 20 === 0) {
        try {
          await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `page-${i+1}.png`) });
        } catch (error) {
          console.error('Erreur lors de la capture d\'écran, mais on continue:', error);
        }
      }
      
      // Faire défiler la page pour charger plus d'écoles
      for (let scroll = 0; scroll < 3; scroll++) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(1000);
      }
      
      // Extraire les écoles de cette page
      const schoolLinks = await extractSchoolLinks(page);
      console.log(`${schoolLinks.length} écoles trouvées sur la page ${i+1}`);
      
      // Ajouter uniquement les nouvelles écoles (non dupliquées)
      let newSchoolsCount = 0;
      
      if (schoolLinks.length > 0) {
        for (const school of schoolLinks) {
          if (!uniqueSchoolUrls.has(school.url)) {
            uniqueSchoolUrls.add(school.url);
            allSchoolLinks.push(school);
            newSchoolsCount++;
          }
        }
        
        console.log(`${newSchoolsCount} nouvelles écoles ajoutées (total: ${allSchoolLinks.length})`);
        
        // Sauvegarde périodique (seulement si des écoles ont été ajoutées)
        if ((i % 10 === 0) && newSchoolsCount > 0) {
          saveIntermediateData(allSchoolLinks, 'links_pagination');
        }
      }
      
      // Si nous avons suffisamment d'écoles, arrêter
      if (allSchoolLinks.length >= MAX_SCHOOLS) {
        console.log(`Objectif atteint (${allSchoolLinks.length} écoles), arrêt de la pagination`);
        break;
      }
      
      // Attente entre les pages pour ne pas surcharger le serveur
      await delay(2000 + Math.random() * 2000); // Délai aléatoire entre 2 et 4 secondes
    } catch (error) {
      console.error(`Erreur lors du traitement de la page ${i+1}:`, error);
      // Continuer avec la page suivante, mais faire une pause plus longue
      await delay(5000 + Math.random() * 3000);
    }
  }
  
  console.log(`Total après pagination: ${allSchoolLinks.length} écoles trouvées`);
}

/**
 * Charge les écoles en utilisant différents filtres par secteur
 * Approche complémentaire pour récupérer plus d'écoles
 */
async function loadWithSectorFilters(page, allSchoolLinks) {
  // Liste des secteurs disponibles sur Diplomeo (liste étendue)
  const sectors = [
    'Communication',
    'Commerce',
    'Art',
    'Management',
    'Informatique',
    'Santé',
    'Marketing',
    'Design',
    'Finance',
    'International',
    'Ingénieur',
    'Gestion',
    'Graphisme',
    'Ressources Humaines',
    'Tourisme',
    'Architecture',
    'Droit',
    'Comptabilité',
    'Audiovisuel',
    'Agriculture',
    'Environnement',
    'Luxe',
    'Éducation',
    'Mode',
    'Sport',
    'Immobilier',
    'Psychologie',
    'Sciences',
    'Médecine',
    'Artisanat',
    'Hôtellerie',
    'Restauration',
    'Aéronautique',
    'Automobile'
  ];
  
  // Liste des villes importantes pour combiner avec les secteurs
  const cities = ['Paris', 'Lyon', 'Marseille', 'Bordeaux', 'Lille', 'Nantes', 'Toulouse', 'Montpellier'];
  
  // Stocker les URLs d'écoles déjà collectées pour éviter les doublons
  const uniqueSchoolUrls = new Set(allSchoolLinks.map(school => school.url));
  
  // 1. D'abord, parcourir tous les secteurs individuellement
  for (let i = 0; i < sectors.length; i++) {
    const sector = sectors[i];
    console.log(`Filtrage par secteur: ${sector} (${i+1}/${sectors.length})`);
    
    // Construire l'URL avec le filtre de secteur
    const sectorUrl = `${BASE_URL}?f[0]=field_domain:${encodeURIComponent(sector)}`;
    
    try {
      await page.goto(sectorUrl, { timeout: 60000, waitUntil: 'networkidle' });
      
      // Gérer les cookies si nécessaire
      if (i % 5 === 0) {
        try {
          await handleCookieConsent(page);
        } catch (error) {
          console.error('Erreur lors de la gestion des cookies, mais on continue:', error);
        }
      }
      
      // Attendre le chargement
      try {
        await page.waitForSelector('ul[data-cy="hub-schools-results"]', { timeout: 10000 });
      } catch (error) {
        console.log(`Pas de résultats pour le secteur ${sector}, passage au suivant`);
        continue;
      }
      
      // Faire quelques défilements pour charger plus d'écoles
      for (let j = 0; j < 5; j++) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(1500);
        await clickSeeMoreButton(page);
      }
      
      // Extraire les écoles
      const sectorSchools = await extractSchoolLinks(page);
      console.log(`${sectorSchools.length} écoles trouvées pour le secteur ${sector}`);
      
      // Ajouter uniquement les nouvelles écoles (non dupliquées)
      let newSchoolsCount = 0;
      
      if (sectorSchools.length > 0) {
        for (const school of sectorSchools) {
          if (!uniqueSchoolUrls.has(school.url)) {
            uniqueSchoolUrls.add(school.url);
            allSchoolLinks.push(school);
            newSchoolsCount++;
          }
        }
        
        console.log(`${newSchoolsCount} nouvelles écoles ajoutées (total: ${allSchoolLinks.length})`);
        
        // Sauvegarde périodique
        if (i % 3 === 0 || newSchoolsCount > 20) {
          saveIntermediateData(allSchoolLinks, 'links_sectors');
        }
      }
      
      // Si nous avons suffisamment d'écoles, arrêter
      if (allSchoolLinks.length >= MAX_SCHOOLS) {
        console.log(`Objectif atteint (${allSchoolLinks.length} écoles), arrêt du filtrage par secteur`);
        break;
      }
      
      // Attente entre les secteurs
      await delay(2000 + Math.random() * 1000);
    } catch (error) {
      console.error(`Erreur lors du traitement du secteur ${sector}:`, error);
      // Continuer avec le secteur suivant
    }
  }
  
  // 2. Ensuite, combiner secteurs et villes pour plus de résultats (si nous n'avons pas atteint l'objectif)
  if (allSchoolLinks.length < MAX_SCHOOLS) {
    console.log("=== Filtrage par combinaison secteur+ville ===");
    
    // Limiter aux secteurs principaux pour éviter trop de requêtes
    const mainSectors = sectors.slice(0, 10);
    
    for (let i = 0; i < mainSectors.length; i++) {
      const sector = mainSectors[i];
      
      for (let j = 0; j < cities.length; j++) {
        const city = cities[j];
        console.log(`Filtrage par secteur+ville: ${sector} - ${city}`);
        
        // Construire l'URL avec le filtre de secteur et ville
        const url = `${BASE_URL}?f[0]=field_domain:${encodeURIComponent(sector)}&ville=${encodeURIComponent(city)}`;
        
        try {
          await page.goto(url, { timeout: 60000, waitUntil: 'networkidle' });
          
          // Gérer les cookies si nécessaire
          if ((i * cities.length + j) % 10 === 0) {
            try {
              await handleCookieConsent(page);
            } catch (error) {
              console.error('Erreur lors de la gestion des cookies, mais on continue:', error);
            }
          }
          
          // Attendre le chargement
          try {
            await page.waitForSelector('ul[data-cy="hub-schools-results"]', { timeout: 10000 });
          } catch (error) {
            console.log(`Pas de résultats pour ${sector} - ${city}, passage au suivant`);
            continue;
          }
          
          // Extraire les écoles
          const combinedSchools = await extractSchoolLinks(page);
          console.log(`${combinedSchools.length} écoles trouvées pour ${sector} - ${city}`);
          
          // Ajouter uniquement les nouvelles écoles (non dupliquées)
          let newSchoolsCount = 0;
          
          if (combinedSchools.length > 0) {
            for (const school of combinedSchools) {
              if (!uniqueSchoolUrls.has(school.url)) {
                uniqueSchoolUrls.add(school.url);
                allSchoolLinks.push(school);
                newSchoolsCount++;
              }
            }
            
            console.log(`${newSchoolsCount} nouvelles écoles ajoutées (total: ${allSchoolLinks.length})`);
            
            // Sauvegarde périodique si des écoles ont été ajoutées
            if (newSchoolsCount > 10) {
              saveIntermediateData(allSchoolLinks, 'links_combined');
            }
          }
          
          // Si nous avons suffisamment d'écoles, arrêter
          if (allSchoolLinks.length >= MAX_SCHOOLS) {
            console.log(`Objectif atteint (${allSchoolLinks.length} écoles), arrêt du filtrage combiné`);
            break;
          }
          
          // Attente entre les requêtes
          await delay(1500 + Math.random() * 1000);
        } catch (error) {
          console.error(`Erreur lors du traitement de ${sector} - ${city}:`, error);
          // Continuer avec la prochaine combinaison
        }
      }
      
      // Si nous avons suffisamment d'écoles, arrêter la boucle extérieure aussi
      if (allSchoolLinks.length >= MAX_SCHOOLS) {
        break;
      }
    }
  }
  
  console.log(`Total après filtrage par secteur: ${allSchoolLinks.length} écoles trouvées`);
}

/**
 * Extrait les détails d'un lot d'écoles
 * @param {import('playwright').Page} page - L'instance de page Playwright
 * @param {Array<Object>} schoolLinks - Le lot d'écoles à traiter
 * @param {Array<Object>} schools - Tableau pour stocker les données complètes
 */
async function extractBatchDetails(page, schoolLinks, schools) {
  for (let i = 0; i < schoolLinks.length; i++) {
    const school = schoolLinks[i];
    console.log(`Traitement de l'école ${i+1}/${schoolLinks.length}: ${school.name}`);
    
    try {
      // Ajouter des tentatives en cas d'échec de navigation
      let maxRetries = 3;
      let success = false;
      
      for (let attempt = 1; attempt <= maxRetries && !success; attempt++) {
        try {
          await page.goto(school.url, { timeout: 60000 });
          success = true;
        } catch (navError) {
          if (attempt < maxRetries) {
            console.log(`Erreur de navigation, tentative ${attempt+1}/${maxRetries}...`);
            await delay(5000 * attempt); // Attente croissante
          } else {
            throw navError;
          }
        }
      }
      
      // Prendre une capture d'écran si c'est la première école
      if (i === 0) {
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'school-page-example.png') });
      }
      
      // Recherche des informations de contact
      const contactInfo = await extractSchoolContactInfo(page);
      
      // Ajout des informations à notre collection
      schools.push({
        name: school.name,
        city: school.city,
        sector: school.sector,
        url: school.url,
        email: contactInfo.email.value,
        email_found: contactInfo.email.found,
        phone: contactInfo.phone.value,
        phone_found: contactInfo.phone.found,
        website: contactInfo.website.value,
        website_found: contactInfo.website.found
      });
      
      console.log(`Email trouvé: ${contactInfo.email.value} (Trouvé: ${contactInfo.email.found})`);
      
      // Attente courte pour ne pas surcharger le serveur
      // Varier le délai pour sembler plus humain
      await delay(1000 + Math.random() * 1000);
    } catch (error) {
      console.error(`Erreur lors du traitement de ${school.name}:`, error);
      // On continue avec l'école suivante en cas d'erreur
      schools.push({
        name: school.name,
        city: school.city,
        sector: school.sector,
        url: school.url,
        email: 'Erreur lors de la récupération',
        email_found: false,
        phone: 'Erreur lors de la récupération',
        phone_found: false,
        website: 'Erreur lors de la récupération',
        website_found: false
      });
      
      // Attente plus longue en cas d'erreur
      await delay(3000);
    }
  }
}

// Exécuter le script
if (require.main === module) {
  run().catch(err => {
    console.error('Erreur fatale:', err);
    process.exit(1);
  });
}

module.exports = { run }; 