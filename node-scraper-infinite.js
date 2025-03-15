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
    
    // Gérer la popup de consentement des cookies
    console.log('Vérification de la présence de la popup des cookies...');
    
    try {
      // Essayons différentes méthodes pour accepter les cookies
      // Méthode 1: Bouton d'acceptation standard
      const cookieButton = await page.waitForSelector('button:has-text("Accepter")', { timeout: 5000 });
      if (cookieButton) {
        console.log('Popup des cookies détectée, acceptation des cookies...');
        await cookieButton.click();
        await page.waitForTimeout(2000); // Attendre que la popup disparaisse
      }
    } catch (error) {
      try {
        // Méthode 2: Autres textes possibles
        console.log('Tentative alternative pour accepter les cookies...');
        const altButton = await page.$$eval('button', buttons => {
          const acceptButton = buttons.find(button => 
            button.textContent.toLowerCase().includes('accepter') || 
            button.textContent.toLowerCase().includes('accept') ||
            button.textContent.toLowerCase().includes('tout accepter') ||
            button.textContent.toLowerCase().includes('ok')
          );
          if (acceptButton) {
            acceptButton.click();
            return true;
          }
          return false;
        });
        
        if (altButton) {
          console.log('Bouton alternatif trouvé et cliqué');
          await page.waitForTimeout(2000);
        } else {
          console.log('Aucun bouton d\'acceptation des cookies trouvé ou pas de popup de cookies');
        }
      } catch (e) {
        console.log('Aucune popup de cookies détectée ou impossible de l\'accepter:', e.message);
      }
    }
    
    // Prendre une capture d'écran après la gestion des cookies
    await page.screenshot({ path: 'after-cookies.png' });
    console.log('Capture d\'écran après gestion des cookies enregistrée');
    
    // Attendre que le contenu initial soit chargé
    console.log('Attente du chargement du contenu initial...');
    await page.waitForSelector('ul[data-cy="hub-schools-results"]', { timeout: 60000 });
    
    // Récupérer les informations des écoles directement
    console.log('Extraction des données des écoles...');
    
    // Cliquer sur "Voir plus" jusqu'à ce que toutes les écoles soient chargées
    const clickSeeMore = async () => {
      try {
        // Vérifier si le bouton existe
        const buttonText = 'Voir plus';
        const hasButton = await page.evaluate((text) => {
          const buttons = Array.from(document.querySelectorAll('button, a, span, div'));
          return buttons.some(btn => btn.textContent.trim().includes(text));
        }, buttonText);
        
        if (!hasButton) {
          console.log('Bouton "Voir plus" non trouvé');
          return false;
        }
        
        console.log('Défilement jusqu\'en bas de la page...');
        await page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
        });
        await page.waitForTimeout(1000);
        
        // Chercher le bouton après le défilement
        console.log('Recherche du bouton "Voir plus"...');
        await page.screenshot({ path: 'before-see-more.png' });
        
        // Tenter de cliquer sur le bouton
        const found = await page.evaluate((text) => {
          const buttons = Array.from(document.querySelectorAll('button, a, span, div'));
          const seeMoreBtn = buttons.find(btn => btn.textContent.trim().includes(text));
          if (seeMoreBtn) {
            seeMoreBtn.click();
            return true;
          }
          return false;
        }, buttonText);
        
        if (found) {
          console.log('Bouton "Voir plus" cliqué');
          await page.waitForTimeout(2000); // Attendre le chargement
          return true;
        }
        
        return false;
      } catch (error) {
        console.error('Erreur lors du clic sur "Voir plus":', error);
        return false;
      }
    };
    
    // Charger toutes les écoles
    let continueLoading = true;
    let loadAttempts = 0;
    const MAX_ATTEMPTS = 20;
    
    while (continueLoading && loadAttempts < MAX_ATTEMPTS) {
      console.log(`Tentative de chargement ${loadAttempts + 1}/${MAX_ATTEMPTS}...`);
      
      // Compter les écoles avant le clic
      const countBefore = await page.evaluate(() => {
        return document.querySelectorAll('ul[data-cy="hub-schools-results"] li').length;
      });
      console.log(`Nombre d'écoles avant: ${countBefore}`);
      
      // Cliquer sur "Voir plus"
      continueLoading = await clickSeeMore();
      
      if (continueLoading) {
        // Compter les écoles après le clic
        await page.waitForTimeout(2000); // Attendre le chargement
        const countAfter = await page.evaluate(() => {
          return document.querySelectorAll('ul[data-cy="hub-schools-results"] li').length;
        });
        console.log(`Nombre d'écoles après: ${countAfter}`);
        
        // Vérifier si de nouvelles écoles ont été chargées
        if (countAfter <= countBefore) {
          console.log('Pas de nouvelles écoles chargées, arrêt du chargement');
          continueLoading = false;
        }
      }
      
      loadAttempts++;
    }
    
    // Extraire les données des écoles
    console.log('Extraction des informations sur les écoles...');
    const schoolLinks = await page.evaluate(() => {
      const links = [];
      const items = document.querySelectorAll('ul[data-cy="hub-schools-results"] li');
      console.log(`Nombre d'écoles trouvées: ${items.length}`);
      
      items.forEach(item => {
        try {
          // Récupération du lien et du secteur
          const linkElement = item.querySelector('a[href^="/etablissement-"]');
          if (linkElement) {
            const name = linkElement.textContent.trim();
            const url = 'https://diplomeo.com' + linkElement.getAttribute('href');
            
            // Récupération du secteur
            const sectorElement = item.querySelector('.tw-text-body-xs.tw-font-sans.tw-text-gray-800');
            const sector = sectorElement ? sectorElement.textContent.trim() : 'Non spécifié';
            
            // Récupération de la ville
            const cityElement = item.querySelector('.tw-text-body-xs.tw-font-semibold');
            const city = cityElement ? cityElement.textContent.trim() : 'Non spécifiée';
            
            links.push({ 
              name, 
              url, 
              sector,
              city
            });
          }
        } catch (e) {
          console.log('Erreur lors de l\'extraction des données:', e);
        }
      });
      
      return links;
    });
    
    console.log(`Nombre d'écoles extraites: ${schoolLinks.length}`);
    
    // Sauvegarder la liste des écoles
    fs.writeFileSync('schools_list.json', JSON.stringify(schoolLinks, null, 2));
    console.log('Liste des écoles sauvegardée dans schools_list.json');
    
    if (schoolLinks.length === 0) {
      console.error('Aucune école trouvée, arrêt du script');
      await page.screenshot({ path: 'no-schools-found.png' });
      return;
    }
    
    // Visiter chaque page d'école pour récupérer les emails
    for (let i = 0; i < schoolLinks.length; i++) {
      const school = schoolLinks[i];
      console.log(`Traitement de l'école ${i+1}/${schoolLinks.length}: ${school.name}`);
      
      try {
        await page.goto(school.url, { timeout: 60000 });
        
        // Prendre une capture d'écran si c'est la première école
        if (i === 0) {
          await page.screenshot({ path: 'school-page-example.png' });
        }
        
        // Recherche de l'email dans les liens de contact
        const contactInfo = await page.evaluate(() => {
          const result = {
            email: { found: false, value: 'Non trouvé' },
            phone: { found: false, value: 'Non trouvé' },
            website: { found: false, value: 'Non trouvé' }
          };
          
          // Recherche de l'email (encodé)
          const emailLink = document.querySelector('.externals-item[data-l*="xznvygb:"]');
          if (emailLink) {
            const encodedEmail = emailLink.getAttribute('data-l').replace('xznvygb:', '');
            result.email = {
              found: true,
              value: decodeROT13(encodedEmail),
              encodedValue: encodedEmail
            };
          }
          
          // Recherche du téléphone
          const phoneLink = document.querySelector('.externals-item[data-l*="xgry:"]');
          if (phoneLink) {
            const encodedPhone = phoneLink.getAttribute('data-l').replace('xgry:', '');
            result.phone = {
              found: true,
              value: encodedPhone.replace(/f$/, ''), // Enlever le 'f' final si présent
              encodedValue: encodedPhone
            };
          }
          
          // Recherche du site web
          const websiteLink = document.querySelector('.externals-item[data-l^="xuggcf://"]');
          if (websiteLink) {
            const encodedWebsite = websiteLink.getAttribute('data-l');
            result.website = {
              found: true,
              value: decodeROT13URL(encodedWebsite),
              encodedValue: encodedWebsite
            };
          }
          
          return result;
          
          // Fonction pour décoder les emails (variante ROT13)
          function decodeROT13(encodedStr) {
            return encodedStr.replace(/[a-zA-Z]/g, function(c) {
              const base = c <= 'Z' ? 65 : 97;
              return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
            });
          }
          
          // Fonction pour décoder les URLs (variante ROT13 + caractères spéciaux)
          function decodeROT13URL(encodedURL) {
            return decodeROT13(encodedURL)
              .replace('xuggcf://', 'https://')
              .replace('xuggc://', 'http://')
              .replace(/=pt=/g, '.co')
              .replace(/=pt=se/g, '.com')
              .replace(/=pt=bet/g, '.org');
          }
        });
        
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
          fs.writeFileSync('schools_data_progress.json', JSON.stringify(schools, null, 2));
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
    
    // Sauvegarde finale des données
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