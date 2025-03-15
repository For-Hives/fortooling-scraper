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
    
    // Attendre que le contenu soit chargé
    console.log('Attente du chargement du contenu...');
    await page.waitForSelector('ul[data-cy="hub-schools-results"]', { timeout: 60000 });
    console.log('Sélecteur de liste trouvé!');
    
    // Prendre une capture d'écran pour le diagnostic
    await page.screenshot({ path: 'page-screenshot.png' });
    console.log('Capture d\'écran enregistrée pour diagnostic');
    
    // Vérifier le HTML brut pour diagnostic
    const pageContent = await page.content();
    fs.writeFileSync('page-content.html', pageContent);
    console.log('Contenu HTML enregistré pour diagnostic');
    
    // Inspecter le nombre d'éléments dans la liste
    const listItemsCount = await page.evaluate(() => {
      const items = document.querySelectorAll('ul[data-cy="hub-schools-results"] li');
      console.log(`Nombre d'éléments li trouvés : ${items.length}`);
      return items.length;
    });
    console.log(`Nombre d'éléments li dans la liste: ${listItemsCount}`);
    
    // Vérifier si le site a un délai de chargement ou du contenu dynamique
    console.log('Attente supplémentaire pour le chargement du contenu dynamique...');
    await page.waitForTimeout(5000);
    
    // Récupérer les liens vers les pages de détail des écoles
    const schoolLinks = await page.evaluate(() => {
      const links = [];
      // Essayer différents sélecteurs pour être sûr de trouver les éléments
      const items = document.querySelectorAll('ul[data-cy="hub-schools-results"] li, .tw-group');
      console.log(`Nombre d'éléments trouvés: ${items.length}`);
      
      items.forEach((item, index) => {
        console.log(`Traitement de l'élément ${index+1}`);
        // Récupération du lien et du secteur
        const linkElement = item.querySelector('a[href^="/etablissement-"], a[href*="etablissement-"]');
        if (linkElement) {
          console.log(`Lien trouvé: ${linkElement.getAttribute('href')}`);
          const name = linkElement.textContent.trim();
          const url = 'https://diplomeo.com' + linkElement.getAttribute('href');
          const sectorElement = item.querySelector('.tw-text-body-xs.tw-font-sans.tw-text-gray-800');
          const sector = sectorElement ? sectorElement.textContent.trim() : 'Non spécifié';
          
          links.push({ name, url, sector });
        } else {
          console.log(`Pas de lien trouvé dans l'élément ${index+1}`);
        }
      });
      
      // Récupération directe des liens par sélecteur d'ancre
      const directLinks = document.querySelectorAll('a[href^="/etablissement-"]');
      console.log(`Nombre de liens directs trouvés: ${directLinks.length}`);
      
      if (links.length === 0 && directLinks.length > 0) {
        directLinks.forEach(link => {
          const name = link.textContent.trim();
          const url = 'https://diplomeo.com' + link.getAttribute('href');
          // Essai de trouver le secteur via le parent
          let sector = 'Non spécifié';
          const parentLi = link.closest('li');
          if (parentLi) {
            const sectorElement = parentLi.querySelector('.tw-text-body-xs.tw-font-sans.tw-text-gray-800');
            if (sectorElement) {
              sector = sectorElement.textContent.trim();
            }
          }
          
          // Vérifier si l'entrée n'existe pas déjà dans links
          if (!links.some(l => l.url === url)) {
            links.push({ name, url, sector });
          }
        });
      }
      
      return links;
    });
    
    console.log(`Nombre d'écoles trouvées: ${schoolLinks.length}`);
    if (schoolLinks.length === 0) {
      console.log('Aucune école trouvée. Problème possible avec les sélecteurs ou le chargement dynamique.');
      return;
    }
    
    // Visiter chaque page d'école pour récupérer les emails
    for (let i = 0; i < schoolLinks.length; i++) {
      const school = schoolLinks[i];
      console.log(`Traitement de l'école ${i+1}/${schoolLinks.length}: ${school.name}`);
      
      try {
        await page.goto(school.url, { timeout: 60000 });
        
        // Recherche de l'email dans les liens de contact
        const emailInfo = await page.evaluate(() => {
          // Recherche spécifique dans les liens de la zone "Envie d'étudier avec nous"
          const emailLink = document.querySelector('.externals-item[data-l*="xznvygb:"]');
          if (emailLink) {
            // Les emails semblent être encodés, on les décode
            const encodedEmail = emailLink.getAttribute('data-l').replace('xznvygb:', '');
            return {
              found: true,
              value: decodeROT13(encodedEmail),
              encodedValue: encodedEmail
            };
          }
          
          // Chercher d'autres éléments qui pourraient contenir un email
          const possibleEmailElements = document.querySelectorAll('a[href^="mailto:"]');
          if (possibleEmailElements.length > 0) {
            return {
              found: true,
              value: possibleEmailElements[0].getAttribute('href').replace('mailto:', ''),
              method: 'mailto link'
            };
          }
          
          return { found: false, value: 'Non trouvé' };
          
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
          email: emailInfo.value,
          email_found: emailInfo.found
        });
        
        console.log(`Email trouvé: ${emailInfo.value} (Trouvé: ${emailInfo.found})`);
        
        // Attente courte pour ne pas surcharger le serveur
        await page.waitForTimeout(1000);
      } catch (error) {
        console.error(`Erreur lors du traitement de ${school.name}:`, error);
        // On continue avec l'école suivante en cas d'erreur
        schools.push({
          name: school.name,
          sector: school.sector,
          url: school.url,
          email: 'Erreur lors de la récupération',
          email_found: false
        });
      }
    }
    
    // Sauvegarde des données dans un fichier JSON
    fs.writeFileSync('schools_data.json', JSON.stringify(schools, null, 2));
    console.log('Données sauvegardées dans schools_data.json');
    
  } catch (error) {
    console.error('Erreur:', error);
  } finally {
    await browser.close();
    console.log('Navigateur fermé. Scraping terminé.');
  }
})();
