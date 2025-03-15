const { chromium } = require('playwright');
const fs = require('fs');

// URL de base
const BASE_URL = 'https://diplomeo.com/etablissements/resultats';

(async () => {
  // Stockage des données
  const schools = [];
  
  console.log('Lancement du navigateur...');
  const browser = await chromium.launch({
    headless: false, // Mettre à true en production
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    console.log('Accès à la page de résultats...');
    await page.goto(BASE_URL, { timeout: 60000 });
    
    let currentPage = 1;
    let hasNextPage = true;
    
    // Boucle de pagination
    while (hasNextPage) {
      console.log(`Traitement de la page ${currentPage}...`);
      
      // Attendre le chargement de la liste des écoles
      await page.waitForSelector('ul[data-cy="hub-schools-results"]');
      
      // Récupérer les liens vers les pages de détail des écoles
      const schoolLinks = await page.evaluate(() => {
        const links = [];
        const items = document.querySelectorAll('ul[data-cy="hub-schools-results"] li');
        items.forEach(item => {
          // Récupération du lien et du secteur
          const linkElement = item.querySelector('a[href^="/etablissement-"]');
          if (linkElement) {
            const name = linkElement.textContent.trim();
            const url = 'https://diplomeo.com' + linkElement.getAttribute('href');
            const sectorElement = item.querySelector('.tw-text-body-xs.tw-font-sans.tw-text-gray-800');
            const sector = sectorElement ? sectorElement.textContent.trim() : 'Non spécifié';
            
            links.push({ name, url, sector });
          }
        });
        return links;
      });
      
      console.log(`Nombre d'écoles trouvées sur la page ${currentPage}: ${schoolLinks.length}`);
      
      // Visiter chaque page d'école pour récupérer les emails
      for (let i = 0; i < schoolLinks.length; i++) {
        const school = schoolLinks[i];
        console.log(`Traitement de l'école ${i+1}/${schoolLinks.length} (page ${currentPage}): ${school.name}`);
        
        try {
          await page.goto(school.url, { timeout: 60000 });
          
          // Recherche de l'email dans les liens de contact
          const email = await page.evaluate(() => {
            // Recherche spécifique dans les liens de la zone "Envie d'étudier avec nous"
            const emailLink = document.querySelector('.externals-item[data-l*="xznvygb:"]');
            if (emailLink) {
              // Les emails semblent être encodés, on les décode
              const encodedEmail = emailLink.getAttribute('data-l').replace('xznvygb:', '');
              return decodeROT13(encodedEmail);
            }
            return 'Non trouvé';
            
            // Fonction pour décoder les emails (ils semblent utiliser une variante de ROT13)
            function decodeROT13(encodedStr) {
              return encodedStr.replace(/[a-zA-Z]/g, function(c) {
                const base = c <= 'Z' ? 65 : 97;
                return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
              });
            }
          });
          
          // Ajout des informations à notre collection
          schools.push({
            name: school.name,
            sector: school.sector,
            url: school.url,
            email: email
          });
          
          console.log(`Email trouvé: ${email}`);
          
          // Sauvegardes intermédiaires pour ne pas perdre les données en cas d'erreur
          if (schools.length % 10 === 0) {
            fs.writeFileSync('schools_data_temp.json', JSON.stringify(schools, null, 2));
            console.log(`Sauvegarde intermédiaire effectuée: ${schools.length} écoles`);
          }
          
          // Attente courte pour ne pas surcharger le serveur
          await page.waitForTimeout(1000);
        } catch (error) {
          console.error(`Erreur lors du traitement de ${school.name}:`, error);
          // On continue avec l'école suivante en cas d'erreur
          schools.push({
            name: school.name,
            sector: school.sector,
            url: school.url,
            email: 'Erreur lors de la récupération'
          });
        }
      }
      
      // Retour à la page de résultats
      await page.goto(`${BASE_URL}?page=${currentPage}`, { timeout: 60000 });
      
      // Vérifier s'il y a une page suivante
      hasNextPage = await page.evaluate(() => {
        const nextButton = document.querySelector('a[rel="next"]');
        return nextButton !== null;
      });
      
      if (hasNextPage) {
        currentPage++;
        // Cliquer sur le bouton "Page suivante"
        await Promise.all([
          page.waitForNavigation(),
          page.click('a[rel="next"]')
        ]);
      }
    }
    
    // Sauvegarde des données dans un fichier JSON
    fs.writeFileSync('schools_data_complete.json', JSON.stringify(schools, null, 2));
    console.log(`Données sauvegardées dans schools_data_complete.json (${schools.length} écoles)`);
    
  } catch (error) {
    console.error('Erreur:', error);
    
    // Sauvegarde de secours en cas d'erreur
    if (schools.length > 0) {
      fs.writeFileSync('schools_data_backup.json', JSON.stringify(schools, null, 2));
      console.log(`Sauvegarde de secours effectuée: ${schools.length} écoles`);
    }
  } finally {
    await browser.close();
    console.log('Navigateur fermé. Scraping terminé.');
  }
})(); 