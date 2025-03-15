const { chromium } = require('playwright');
const fs = require('fs');

// URL de base et URLs des pages
const BASE_URL = 'https://diplomeo.com/etablissements/resultats';

// Fonction pour générer des URLs de pagination
const generatePageUrls = (baseUrl, pageCount) => {
  const urls = [];
  for (let i = 1; i <= pageCount; i++) {
    urls.push(`${baseUrl}?page=${i}`);
  }
  return urls;
};

(async () => {
  // Stockage des données
  const schools = [];
  const allSchoolLinks = [];
  
  console.log('Lancement du navigateur...');
  const browser = await chromium.launch({
    headless: false, // Mettre à true en production
    slowMo: 50 // Ralentir les actions pour plus de fiabilité
  });
  
  // Réinitialiser complètement le contexte pour éviter les problèmes de cookies
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }, // Utiliser une fenêtre plus grande
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    deviceScaleFactor: 1,
  });
  
  const page = await context.newPage();
  
  try {
    // Approche 1: Essayer le chargement infini (défiler et cliquer)
    console.log('=== Approche 1: Tentative avec défilement et bouton ===');
    await loadWithScrolling(page);
    
    // Si nous n'avons pas assez d'écoles, essayer l'approche de pagination
    if (allSchoolLinks.length < 100) {
      console.log('=== Approche 2: Tentative avec pagination ===');
      await loadWithPagination(page);
    }
    
    // Récupérer les URLs uniques
    const uniqueSchoolLinks = [...new Map(allSchoolLinks.map(item => [item.url, item])).values()];
    console.log(`Nombre total d'écoles uniques: ${uniqueSchoolLinks.length}`);
    
    // Limiter à 150 écoles si nécessaire
    const schoolLinksToProcess = uniqueSchoolLinks.slice(0, 150);
    console.log(`Traitement des ${schoolLinksToProcess.length} premières écoles`);
    
    // Sauvegarder la liste des écoles
    fs.writeFileSync('schools_list.json', JSON.stringify(schoolLinksToProcess, null, 2));
    console.log('Liste des écoles sauvegardée dans schools_list.json');
    
    if (schoolLinksToProcess.length === 0) {
      console.error('Aucune école trouvée, arrêt du script');
      return;
    }
    
    // Visiter chaque page d'école pour récupérer les emails
    for (let i = 0; i < schoolLinksToProcess.length; i++) {
      const school = schoolLinksToProcess[i];
      console.log(`Traitement de l'école ${i+1}/${schoolLinksToProcess.length}: ${school.name}`);
      
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
            }).replace(/=cg=/g, '.').replace(/=pt=/g, '.');
          }
          
          // Fonction pour décoder les URLs (variante ROT13 + caractères spéciaux)
          function decodeROT13URL(encodedURL) {
            return decodeROT13(encodedURL)
              .replace('xuggcf://', 'https://')
              .replace('xuggc://', 'http://')
              .replace(/=cg=/g, '.')
              .replace(/=pt=/g, '.')
              .replace(/=co=/g, '-')
              .replace(/=cg=se/g, '.com')
              .replace(/=pt=se/g, '.com')
              .replace(/=cg=bet/g, '.org')
              .replace(/=pt=bet/g, '.org')
              .replace('khttps', 'https');
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
        if ((i+1) % 5 === 0 || i === schoolLinksToProcess.length - 1) {
          fs.writeFileSync('schools_data_progress.json', JSON.stringify(schools, null, 2));
          console.log(`Sauvegarde intermédiaire effectuée: ${i+1}/${schoolLinksToProcess.length} écoles`);
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
    
    // Nettoyer correctement les données en corrigeant les extensions d'email
    const cleanedSchools = schools.map(school => {
      // Copier toutes les propriétés
      const cleanedSchool = { ...school };
      
      // Nettoyer l'email - remplacer les suffixes incorrects
      if (school.email_found) {
        cleanedSchool.email = school.email
          .replace(/=cg=/g, '.')
          .replace(/=pt=/g, '.')
          .replace(/=co=/g, '-')
          // Correction des extensions d'email
          .replace(/\.frs$/, '.fr')
          .replace(/\.frs\b/, '.fr')
          .replace(/\.coms$/, '.com')
          .replace(/\.coms\b/, '.com')
          .replace(/\.nets$/, '.net')
          .replace(/\.nets\b/, '.net')
          .replace(/\.orgs$/, '.org')
          .replace(/\.orgs\b/, '.org')
          .replace(/\.edus$/, '.edu')
          .replace(/\.edus\b/, '.edu')
          .replace(/\.ios$/, '.io')
          .replace(/\.ios\b/, '.io')
          .replace(/\.cos$/, '.co')
          .replace(/\.cos\b/, '.co');
      }
      
      // Nettoyer le site web
      if (school.website_found && school.website !== 'Non trouvé') {
        cleanedSchool.website = school.website
          .replace(/=cg=/g, '.')
          .replace(/=pt=/g, '.')
          .replace(/=co=/g, '-')
          .replace('khttps', 'https');
      }
      
      return cleanedSchool;
    });
    
    fs.writeFileSync('schools_data_cleaned.json', JSON.stringify(cleanedSchools, null, 2));
    console.log(`Données nettoyées (avec correction des extensions d'email) sauvegardées dans schools_data_cleaned.json`);
    
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
  
  // Fonction pour essayer de charger des écoles par défilement et clic sur "Voir plus"
  async function loadWithScrolling(page) {
    console.log('Accès à la page de résultats...');
    await page.goto(BASE_URL, { timeout: 90000, waitUntil: 'networkidle' });
    
    // Capturer le début de la page
    await page.screenshot({ path: 'initial-page.png' });
    
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
      await page.screenshot({ path: `scroll-${i+1}.png` });
      
      // Essayer de cliquer sur le bouton via JavaScript
      try {
        const buttonClicked = await page.evaluate(() => {
          // Cibler spécifiquement le bouton "Voir plus" avec le sélecteur exact
          const exactButton = document.querySelector('div[data-action="click->pagination#loadMoreTrainings"]');
          
          if (exactButton) {
            console.log('Bouton "Voir plus" exact trouvé!');
            // Faire défiler jusqu'au bouton
            exactButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Attendre un court instant avant de cliquer
            setTimeout(() => {
              // Essayer de cliquer de plusieurs manières
              try {
                exactButton.click();
              } catch (e) {
                // Si le clic direct ne fonctionne pas, essayer event.dispatchEvent
                const event = new MouseEvent('click', {
                  view: window,
                  bubbles: true,
                  cancelable: true
                });
                exactButton.dispatchEvent(event);
              }
            }, 100);
            return true;
          }
          
          // Si le bouton exact n'est pas trouvé, rechercher par texte
          const buttonTexts = ['voir plus', 'charger plus', 'afficher plus'];
          const elements = Array.from(document.querySelectorAll('button, a, span, div'));
          
          for (const el of elements) {
            const text = el.textContent.toLowerCase().trim();
            if (buttonTexts.some(t => text.includes(t))) {
              console.log(`Bouton trouvé par texte: ${el.textContent}`);
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              setTimeout(() => el.click(), 100);
              return true;
            }
          }
          
          // Recherche alternative - tous les boutons qui pourraient être "Voir plus"
          const buttons = Array.from(document.querySelectorAll('button, div.tw-inline-flex'));
          const visibleButtons = buttons.filter(btn => {
            const rect = btn.getBoundingClientRect();
            return rect.bottom > window.innerHeight * 0.7 && 
                   rect.top < window.innerHeight &&
                   rect.width > 0 && 
                   rect.height > 0;
          });
          
          if (visibleButtons.length > 0) {
            console.log(`Bouton visible trouvé en bas: ${visibleButtons[0].textContent}`);
            visibleButtons[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => visibleButtons[0].click(), 100);
            return true;
          }
          
          return false;
        });
        
        if (buttonClicked) {
          console.log('Bouton cliqué via JavaScript');
        } else {
          console.log('Aucun bouton trouvé, défilement simple');
        }
      } catch (error) {
        console.log('Erreur lors du clic:', error.message);
      }
      
      // Attendre le chargement
      await page.waitForTimeout(1000);
    }
    
    // Extraire les données des écoles
    console.log('Extraction des écoles après défilement...');
    const schoolLinks = await extractSchoolLinks(page);
    
    console.log(`${schoolLinks.length} écoles trouvées via défilement`);
    allSchoolLinks.push(...schoolLinks);
  }
  
  // Fonction pour charger des écoles via pagination
  async function loadWithPagination(page) {
    const pageUrls = generatePageUrls(BASE_URL, 5); // Réduire le nombre de pages à essayer
    
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
          await page.screenshot({ path: `page-${i+1}.png` });
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
  
  // Fonction pour extraire les liens des écoles sur une page
  async function extractSchoolLinks(page) {
    return await page.evaluate(() => {
      try {
        const links = [];
        
        // Approche 1: Sélecteur standard
        let items = document.querySelectorAll('ul[data-cy="hub-schools-results"] li');
        console.log(`Approche 1: ${items.length} écoles trouvées`);
        
        // Si aucun résultat, essayer une approche alternative
        if (items.length === 0) {
          // Approche 2: Recherche plus générale des éléments de groupe
          items = document.querySelectorAll('.tw-group');
          console.log(`Approche 2: ${items.length} écoles trouvées`);
        }
        
        // Si toujours aucun résultat, essayer une recherche directe des liens
        if (items.length === 0) {
          // Approche 3: Recherche directe des liens d'établissements
          const directLinks = document.querySelectorAll('a[href*="/etablissement-"]');
          console.log(`Approche 3: ${directLinks.length} liens vers des écoles trouvés`);
          
          directLinks.forEach(link => {
            const name = link.textContent.trim();
            // Corriger l'URL pour ne pas avoir de duplication du domaine
            const href = link.getAttribute('href');
            const url = href.startsWith('http') ? href : 'https://diplomeo.com' + href;
            
            // Essayer de trouver le secteur et la ville via les parents
            let sector = 'Non spécifié';
            let city = 'Non spécifiée';
            
            // Rechercher dans les éléments parents
            const parent = link.closest('.tw-group') || link.parentElement;
            if (parent) {
              const sectorElement = parent.querySelector('.tw-text-body-xs.tw-font-sans.tw-text-gray-800');
              if (sectorElement) sector = sectorElement.textContent.trim();
              
              const cityElement = parent.querySelector('.tw-text-body-xs.tw-font-semibold');
              if (cityElement) city = cityElement.textContent.trim();
            }
            
            links.push({ name, url, sector, city });
          });
          
          return links;
        }
        
        // Utiliser les items trouvés par l'approche 1 ou 2
        items.forEach(item => {
          try {
            const linkElement = item.querySelector('a[href*="/etablissement-"]');
            if (linkElement) {
              const name = linkElement.textContent.trim();
              // Corriger l'URL pour ne pas avoir de duplication du domaine
              const href = linkElement.getAttribute('href');
              const url = href.startsWith('http') ? href : 'https://diplomeo.com' + href;
              
              // Récupération du secteur
              const sectorElement = item.querySelector('.tw-text-body-xs.tw-font-sans.tw-text-gray-800');
              const sector = sectorElement ? sectorElement.textContent.trim() : 'Non spécifié';
              
              // Récupération de la ville
              const cityElement = item.querySelector('.tw-text-body-xs.tw-font-semibold');
              const city = cityElement ? cityElement.textContent.trim() : 'Non spécifiée';
              
              links.push({ name, url, sector, city });
            }
          } catch (e) {
            console.error('Erreur lors de l\'extraction d\'une école:', e);
          }
        });
        
        return links;
      } catch (error) {
        console.error('Erreur globale lors de l\'extraction:', error);
        return [];
      }
    });
  }
  
  // Fonction pour gérer la popup de consentement des cookies
  async function handleCookieConsent(page) {
    console.log('Vérification de la présence de la popup des cookies...');
    
    // Attendre un peu pour s'assurer que la popup est chargée
    await page.waitForTimeout(2000);
    
    try {
      // Détection de la popup
      const cookiePopupDetected = await page.evaluate(() => {
        return document.body.innerText.includes('cookie') || 
              document.body.innerText.includes('Cookie') ||
              document.body.innerText.includes('accepter') ||
              document.body.innerText.includes('Accepter') ||
              !!document.querySelector('.hw-cc-modal__wrapper, .hw-cc-notice-box, #tarteaucitronRoot');
      });
      
      if (cookiePopupDetected) {
        console.log('Popup des cookies détectée...');
        
        // Prendre une capture d'écran avant de tenter d'accepter les cookies
        await page.screenshot({ path: 'before-cookie-accept.png' });
        
        // Liste de sélecteurs pour les boutons d'acceptation
        const cookieButtonSelectors = [
          'button:has-text("Tout accepter")',
          'button:has-text("Accepter")',
          'button:has-text("Accepter et fermer")',
          'button:has-text("J\'accepte")',
          'button:has-text("OK")',
          '.hw-cc-btn--primary'
        ];
        
        // Essayer chaque sélecteur
        let buttonFound = false;
        for (const selector of cookieButtonSelectors) {
          try {
            const button = await page.$(selector);
            if (button) {
              await button.click();
              console.log(`Bouton trouvé et cliqué: ${selector}`);
              buttonFound = true;
              break;
            }
          } catch (e) {
            // Continuer avec le prochain sélecteur
          }
        }
        
        // Si aucun sélecteur n'a fonctionné, essayer via JavaScript
        if (!buttonFound) {
          console.log('Essai de clic via JavaScript...');
          const buttonClicked = await page.evaluate(() => {
            const buttonTexts = ['accepter', 'tout accepter', 'j\'accepte', 'ok'];
            const buttons = Array.from(document.querySelectorAll('button, a, span, div'));
            
            for (const button of buttons) {
              const text = button.textContent.toLowerCase();
              if (buttonTexts.some(t => text.includes(t))) {
                try {
                  button.click();
                  return true;
                } catch (e) {
                  console.log("Erreur lors du clic:", e);
                  // Essayer une autre méthode
                  try {
                    const event = new MouseEvent('click', {
                      view: window,
                      bubbles: true,
                      cancelable: true
                    });
                    button.dispatchEvent(event);
                    return true;
                  } catch (e2) {
                    console.log("Erreur lors du dispatchEvent:", e2);
                  }
                }
              }
            }
            return false;
          });
          
          if (buttonClicked) {
            console.log('Bouton cliqué via JavaScript');
          } else {
            console.log('Impossible de cliquer sur le bouton');
          }
        }
        
        // Attendre que la popup disparaisse
        await page.waitForTimeout(3000);
      } else {
        console.log('Aucune popup de cookies détectée - les cookies sont probablement déjà acceptés');
        // Aucune action nécessaire, continuer l'exécution
      }
    } catch (error) {
      console.error('Erreur lors de la gestion des cookies:', error);
      console.log('Continuation du script malgré l\'erreur de gestion des cookies');
      // Ne pas laisser l'erreur interrompre l'exécution
    }
    
    // Capture d'écran après la gestion des cookies
    try {
      await page.screenshot({ path: 'after-cookies.png' });
    } catch (error) {
      console.error('Erreur lors de la capture d\'écran:', error);
    }
  }
})(); 