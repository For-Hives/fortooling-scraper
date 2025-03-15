/**
 * Scraper principal pour Diplomeo
 * Ce script récupère les informations des écoles sur le site Diplomeo
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Importer les utilitaires
const { generatePageUrls, cleanEmail, cleanWebsite } = require('./utils/scraperUtils');
const { handleCookieConsent } = require('./utils/cookieConsentHandler');
const { extractSchoolLinks, extractSchoolContactInfo, clickSeeMoreButton } = require('./utils/schoolExtractor');

// URL de base
const BASE_URL = 'https://diplomeo.com/etablissements/resultats';

// Créer les dossiers s'ils n'existent pas
const ensureDirExists = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

ensureDirExists('./data');
ensureDirExists('./screenshots');

/**
 * Fonction principale qui exécute le scraping
 */
async function run() {
  // Stockage des données
  const schools = [];
  const allSchoolLinks = [];
  
  console.log('Lancement du navigateur...');
  const browser = await chromium.launch({
    headless: false, // Mettre à true en production
    slowMo: 50 // Ralentir les actions pour plus de fiabilité
  });
  
  // Configuration du contexte du navigateur
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    deviceScaleFactor: 1,
  });
  
  const page = await context.newPage();
  
  try {
    // Approche 1: Chargement avec défilement et bouton "Voir plus"
    console.log('=== Approche 1: Tentative avec défilement et bouton ===');
    await loadWithScrolling(page, allSchoolLinks);
    
    // Si nous n'avons pas assez d'écoles, essayer l'approche de pagination
    if (allSchoolLinks.length < 100) {
      console.log('=== Approche 2: Tentative avec pagination ===');
      await loadWithPagination(page, allSchoolLinks);
    }
    
    // Récupérer les URLs uniques
    const uniqueSchoolLinks = [...new Map(allSchoolLinks.map(item => [item.url, item])).values()];
    console.log(`Nombre total d'écoles uniques: ${uniqueSchoolLinks.length}`);
    
    // Limiter à 150 écoles si nécessaire
    const schoolLinksToProcess = uniqueSchoolLinks.slice(0, 150);
    console.log(`Traitement des ${schoolLinksToProcess.length} premières écoles`);
    
    // Sauvegarder la liste des écoles
    fs.writeFileSync('./data/schools_list.json', JSON.stringify(schoolLinksToProcess, null, 2));
    console.log('Liste des écoles sauvegardée dans data/schools_list.json');
    
    if (schoolLinksToProcess.length === 0) {
      console.error('Aucune école trouvée, arrêt du script');
      return;
    }
    
    // Visiter chaque page d'école pour récupérer les informations de contact
    await extractSchoolsDetails(page, schoolLinksToProcess, schools);
    
    // Sauvegarde finale des données
    fs.writeFileSync('./data/schools_data_complete.json', JSON.stringify(schools, null, 2));
    console.log(`Données sauvegardées dans data/schools_data_complete.json (${schools.length} écoles)`);
    
    // Nettoyer correctement les données
    const cleanedSchools = cleanSchoolsData(schools);
    
    fs.writeFileSync('./data/schools_data_cleaned.json', JSON.stringify(cleanedSchools, null, 2));
    console.log(`Données nettoyées sauvegardées dans data/schools_data_cleaned.json`);
    
  } catch (error) {
    console.error('Erreur:', error);
    
    // Sauvegarde de secours en cas d'erreur
    if (schools.length > 0) {
      fs.writeFileSync('./data/schools_data_backup.json', JSON.stringify(schools, null, 2));
      console.log(`Sauvegarde de secours effectuée: ${schools.length} écoles`);
    }
  } finally {
    await browser.close();
    console.log('Navigateur fermé. Scraping terminé.');
  }
}

/**
 * Charge les écoles en utilisant le défilement et le bouton "Voir plus"
 * @param {import('playwright').Page} page - L'instance de page Playwright
 * @param {Array<Object>} allSchoolLinks - Tableau pour stocker les liens d'écoles trouvés
 */
async function loadWithScrolling(page, allSchoolLinks) {
  console.log('Accès à la page de résultats...');
  await page.goto(BASE_URL, { timeout: 90000, waitUntil: 'networkidle' });
  
  // Capturer le début de la page
  await page.screenshot({ path: './screenshots/initial-page.png' });
  
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
  
  // Stratégie de défilement intensif pour charger plus d'écoles
  console.log('Défilement intensif pour charger plus d\'écoles...');
  const maxScrolls = 8;
  
  for (let i = 0; i < maxScrolls; i++) {
    console.log(`Défilement ${i+1}/${maxScrolls}`);
    
    // Défiler jusqu'en bas
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);
    
    // Prendre une capture d'écran
    await page.screenshot({ path: `./screenshots/scroll-${i+1}.png` });
    
    // Essayer de cliquer sur le bouton "Voir plus"
    await clickSeeMoreButton(page);
    
    // Attendre le chargement
    await page.waitForTimeout(1500);
  }
  
  // Extraire les données des écoles
  console.log('Extraction des écoles après défilement...');
  const schoolLinks = await extractSchoolLinks(page);
  
  console.log(`${schoolLinks.length} écoles trouvées via défilement`);
  allSchoolLinks.push(...schoolLinks);
}

/**
 * Charge les écoles en utilisant la pagination
 * @param {import('playwright').Page} page - L'instance de page Playwright
 * @param {Array<Object>} allSchoolLinks - Tableau pour stocker les liens d'écoles trouvés
 */
async function loadWithPagination(page, allSchoolLinks) {
  const pageUrls = generatePageUrls(BASE_URL, 5); // 5 premières pages
  
  for (let i = 0; i < pageUrls.length; i++) {
    console.log(`Visite de la page ${i+1}/${pageUrls.length}: ${pageUrls[i]}`);
    
    try {
      await page.goto(pageUrls[i], { timeout: 60000, waitUntil: 'networkidle' });
      
      // Gérer la popup des cookies si nécessaire (seulement sur la première page)
      if (i === 0) {
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
      
      // Prendre une capture d'écran
      try {
        await page.screenshot({ path: `./screenshots/page-${i+1}.png` });
      } catch (error) {
        console.error('Erreur lors de la capture d\'écran, mais on continue:', error);
      }
      
      // Extraire les écoles de cette page
      const schoolLinks = await extractSchoolLinks(page);
      console.log(`${schoolLinks.length} écoles trouvées sur la page ${i+1}`);
      
      // Ajouter les écoles à notre collection
      allSchoolLinks.push(...schoolLinks);
      
      // Si nous avons suffisamment d'écoles, arrêter
      if (allSchoolLinks.length >= 150) {
        console.log(`Objectif atteint (${allSchoolLinks.length} écoles), arrêt de la pagination`);
        break;
      }
      
      // Attente entre les pages
      await page.waitForTimeout(1000);
    } catch (error) {
      console.error(`Erreur lors du traitement de la page ${i+1}:`, error);
      // Continuer avec la page suivante
    }
  }
}

/**
 * Visite chaque page d'école pour extraire les détails de contact
 * @param {import('playwright').Page} page - L'instance de page Playwright
 * @param {Array<Object>} schoolLinks - Les liens des écoles à traiter
 * @param {Array<Object>} schools - Tableau pour stocker les données complètes des écoles
 */
async function extractSchoolsDetails(page, schoolLinks, schools) {
  for (let i = 0; i < schoolLinks.length; i++) {
    const school = schoolLinks[i];
    console.log(`Traitement de l'école ${i+1}/${schoolLinks.length}: ${school.name}`);
    
    try {
      await page.goto(school.url, { timeout: 60000 });
      
      // Prendre une capture d'écran si c'est la première école
      if (i === 0) {
        await page.screenshot({ path: './screenshots/school-page-example.png' });
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
      
      // Sauvegardes intermédiaires
      if ((i+1) % 5 === 0 || i === schoolLinks.length - 1) {
        fs.writeFileSync('./data/schools_data_progress.json', JSON.stringify(schools, null, 2));
        console.log(`Sauvegarde intermédiaire effectuée: ${i+1}/${schoolLinks.length} écoles`);
      }
      
      // Attente courte pour ne pas surcharger le serveur
      await page.waitForTimeout(1000);
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
    }
  }
}

/**
 * Nettoie et corrige les données des écoles
 * @param {Array<Object>} schools - Les données brutes des écoles
 * @returns {Array<Object>} Les données nettoyées
 */
function cleanSchoolsData(schools) {
  return schools.map(school => {
    // Copier toutes les propriétés
    const cleanedSchool = { ...school };
    
    // Nettoyer l'email
    if (school.email_found && school.email !== 'Non trouvé') {
      cleanedSchool.email = cleanEmail(school.email);
    }
    
    // Nettoyer le site web
    if (school.website_found && school.website !== 'Non trouvé') {
      cleanedSchool.website = cleanWebsite(school.website);
    }
    
    return cleanedSchool;
  });
}

// Exécuter le script si appelé directement
if (require.main === module) {
  run().catch(console.error);
}

module.exports = {
  run
}; 