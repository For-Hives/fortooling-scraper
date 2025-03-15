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
    slowMo: 50 // Ralentir les actions pour plus de fiabilité
  });
  
  // Réinitialiser complètement le contexte pour éviter les problèmes de cookies
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }, // Utiliser une fenêtre plus grande
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', // User agent standard
    deviceScaleFactor: 1,
  });
  
  const page = await context.newPage();
  
  try {
    console.log('Accès à la page de résultats...');
    await page.goto(BASE_URL, { timeout: 90000, waitUntil: 'networkidle' });
    
    // Capture d'écran initiale
    await page.screenshot({ path: 'initial-page.png' });
    
    // Gérer la popup de consentement des cookies de manière plus complète
    console.log('Vérification de la présence de la popup des cookies...');
    
    // Attendre un peu pour s'assurer que la popup est chargée
    await page.waitForTimeout(2000);
    
    try {
      // Approche plus systématique pour détecter et gérer les popups de cookies
      const cookieDetectionMethods = [
        // Méthode 1: Recherche de texte dans le body
        async () => {
          const cookieText = await page.evaluate(() => {
            return document.body.innerText.includes('cookie') || 
                  document.body.innerText.includes('Cookie') ||
                  document.body.innerText.includes('accepter') ||
                  document.body.innerText.includes('Accepter');
          });
          return cookieText;
        },
        // Méthode 2: Recherche d'éléments de popup spécifiques
        async () => {
          const cookiePopup = await page.evaluate(() => {
            return !!document.querySelector('.hw-cc-modal__wrapper, .hw-cc-notice-box, #tarteaucitronRoot');
          });
          return cookiePopup;
        }
      ];
      
      let cookiePopupDetected = false;
      
      for (const method of cookieDetectionMethods) {
        cookiePopupDetected = await method();
        if (cookiePopupDetected) {
          console.log('Popup des cookies détectée...');
          break;
        }
      }
      
      if (cookiePopupDetected) {
        // Prendre une capture d'écran avant de tenter d'accepter les cookies
        await page.screenshot({ path: 'before-cookie-accept.png' });
        
        // Liste de sélecteurs pour trouver les boutons d'acceptation de cookies
        const cookieButtonSelectors = [
          'button:has-text("Tout accepter")',
          'button:has-text("Accepter")',
          'button:has-text("Accepter et fermer")',
          'button:has-text("J\'accepte")',
          'button:has-text("OK")',
          'button:has-text("Accept all")',
          '.hw-cc-btn--primary',
          '#tarteaucitronAllDenied2'
        ];
        
        // Essayer chaque sélecteur
        let buttonClicked = false;
        for (const selector of cookieButtonSelectors) {
          try {
            console.log(`Essai du sélecteur: ${selector}`);
            const button = await page.$(selector);
            if (button) {
              await button.click();
              console.log(`Bouton trouvé et cliqué avec sélecteur: ${selector}`);
              buttonClicked = true;
              break;
            }
          } catch (e) {
            console.log(`Erreur avec le sélecteur ${selector}:`, e.message);
          }
        }
        
        // Si aucun sélecteur n'a fonctionné, essayer la méthode JavaScript
        if (!buttonClicked) {
          console.log('Essai de clic par JavaScript...');
          try {
            buttonClicked = await page.evaluate(() => {
              const buttonTexts = ['accepter', 'accepter tous', 'tout accepter', 'j\'accepte', 'ok'];
              const buttons = Array.from(document.querySelectorAll('button, a, div'));
              
              for (const button of buttons) {
                const text = button.textContent.toLowerCase();
                if (buttonTexts.some(t => text.includes(t))) {
                  console.log('Bouton trouvé par texte:', text);
                  button.click();
                  return true;
                }
              }
              return false;
            });
            
            if (buttonClicked) {
              console.log('Bouton cliqué via JavaScript');
            }
          } catch (e) {
            console.log('Erreur lors du clic JavaScript:', e.message);
          }
        }
        
        // Attendre que la popup disparaisse
        await page.waitForTimeout(3000);
      } else {
        console.log('Aucune popup de cookies détectée');
      }
    } catch (error) {
      console.error('Erreur lors de la gestion des cookies:', error);
    }
    
    // Attendre un peu après la gestion des cookies
    await page.waitForTimeout(3000);
    
    // Capture d'écran après la gestion des cookies
    await page.screenshot({ path: 'after-cookies.png' });
    console.log('Capture d\'écran après gestion des cookies enregistrée');
    
    // Attendre que le contenu initial soit chargé
    console.log('Attente du chargement du contenu initial...');
    
    try {
      await page.waitForSelector('ul[data-cy="hub-schools-results"]', { timeout: 10000 });
      console.log('Liste des écoles trouvée avec le sélecteur principal');
    } catch (error) {
      console.log('Sélecteur principal non trouvé, utilisation d\'une alternative...');
      try {
        // Essayer de trouver un autre conteneur d'écoles
        await page.waitForSelector('.tw-flex.tw-flex-col.tw-w-full', { timeout: 10000 });
        console.log('Liste des écoles trouvée avec le sélecteur alternatif');
      } catch (e) {
        console.error('Impossible de trouver la liste des écoles');
        await page.screenshot({ path: 'no-schools-list.png' });
        throw new Error('Liste des écoles non trouvée');
      }
    }
    
    // Extraire le HTML de la page pour l'analyser
    const pageContent = await page.content();
    fs.writeFileSync('page-content.html', pageContent);
    console.log('Contenu HTML de la page sauvegardé');
    
    // Tentative de clic sur "Voir plus" plusieurs fois pour charger davantage d'écoles
    let loadAttempts = 0;
    const MAX_ATTEMPTS = 15;
    
    while (loadAttempts < MAX_ATTEMPTS) {
      console.log(`Tentative de chargement ${loadAttempts + 1}/${MAX_ATTEMPTS}...`);
      
      // Faire défiler la page jusqu'en bas
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await page.waitForTimeout(2000);
      
      // Compter les écoles avant de cliquer
      const countBefore = await page.evaluate(() => {
        const items = document.querySelectorAll('ul[data-cy="hub-schools-results"] li, .tw-group');
        return items.length;
      });
      console.log(`Nombre d'écoles avant: ${countBefore}`);
      
      // Capture d'écran avant de cliquer
      await page.screenshot({ path: `scroll-${loadAttempts}.png` });
      
      // Recherche du bouton "Voir plus" ou équivalent
      let buttonFound = false;
      try {
        buttonFound = await page.evaluate(() => {
          // Liste de textes possibles pour le bouton
          const buttonTexts = ['voir plus', 'voir plus d\'écoles', 'charger plus', 'plus de résultats'];
          
          // Rechercher tous les éléments cliquables
          const elements = Array.from(document.querySelectorAll('button, a, span, div'));
          
          // Trouver un élément qui contient l'un des textes
          for (const text of buttonTexts) {
            const button = elements.find(el => 
              el.textContent.toLowerCase().includes(text)
            );
            
            if (button) {
              console.log(`Bouton trouvé: ${button.textContent}`);
              button.scrollIntoView({ behavior: 'smooth', block: 'center' });
              button.click();
              return true;
            }
          }
          
          // Recherche alternative - tous les boutons qui pourraient être "Voir plus"
          const loadMoreButton = elements.find(el => {
            if (el.tagName === 'BUTTON' && el.textContent.trim() !== '') {
              console.log(`Bouton trouvé: ${el.textContent}`);
              return true;
            }
            return false;
          });
          
          if (loadMoreButton) {
            loadMoreButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
            loadMoreButton.click();
            return true;
          }
          
          return false;
        });
      } catch (error) {
        console.error('Erreur lors de la recherche du bouton:', error);
      }
      
      if (buttonFound) {
        console.log('Bouton cliqué, attente du chargement...');
        await page.waitForTimeout(3000);
        
        // Vérifier si de nouvelles écoles ont été chargées
        const countAfter = await page.evaluate(() => {
          const items = document.querySelectorAll('ul[data-cy="hub-schools-results"] li, .tw-group');
          return items.length;
        });
        console.log(`Nombre d'écoles après: ${countAfter}`);
        
        if (countAfter <= countBefore) {
          console.log('Pas de nouvelles écoles chargées, dernier essai puis arrêt');
          // Un dernier essai avec défilement supplémentaire
          await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight);
          });
          await page.waitForTimeout(3000);
          break;
        }
      } else {
        console.log('Bouton non trouvé, tentative de défilement supplémentaire');
        // Tenter de faire défiler davantage
        await page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight + 1000);
        });
        await page.waitForTimeout(2000);
      }
      
      loadAttempts++;
    }
    
    // Capture d'écran finale
    await page.screenshot({ path: 'final-state.png' });
    
    // Extraire les informations des écoles
    console.log('Extraction des informations sur les écoles...');
    
    const schoolLinks = await page.evaluate(() => {
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
    
    console.log(`Nombre d'écoles extraites: ${schoolLinks.length}`);
    
    // Sauvegarder la liste des écoles
    fs.writeFileSync('schools_list.json', JSON.stringify(schoolLinks, null, 2));
    console.log('Liste des écoles sauvegardée dans schools_list.json');
    
    if (schoolLinks.length === 0) {
      console.error('Aucune école trouvée, arrêt du script');
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
          .replace(/\.coms$/, '.com')
          .replace(/\.nets$/, '.net')
          .replace(/\.orgs$/, '.org')
          .replace(/\.edus$/, '.edu')
          .replace(/\.ios$/, '.io')
          .replace(/\.cos$/, '.co');
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
})(); 