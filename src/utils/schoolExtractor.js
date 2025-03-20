/**
 * Module d'extraction des données des écoles
 * Contient des fonctions pour extraire les liens et les informations des établissements
 */

/**
 * Extrait les liens des écoles à partir d'une page
 * @param {import('playwright').Page} page - L'instance de page Playwright 
 * @returns {Promise<Array<Object>>} Liste des écoles trouvées avec leur nom, URL, secteur et ville
 */
async function extractSchoolLinks(page) {
  return await page.evaluate(() => {
    try {
      // Utiliser un Set pour stocker les URLs uniques
      const uniqueUrls = new Set();
      const links = [];
      
      // Approche 1: Sélecteur standard
      let items = document.querySelectorAll('ul[data-cy="hub-schools-results"] li');
      console.log(`Approche 1: ${items.length} éléments trouvés`);
      
      // Si aucun résultat, essayer une approche alternative
      if (items.length === 0) {
        // Approche 2: Recherche plus générale des éléments de groupe
        items = document.querySelectorAll('.tw-group');
        console.log(`Approche 2: ${items.length} éléments trouvés`);
      }
      
      // Si toujours aucun résultat, essayer une recherche directe des liens
      if (items.length === 0) {
        // Approche 3: Recherche directe des liens d'établissements (plus large)
        const directLinks = Array.from(document.querySelectorAll('a[href*="/etablissement-"], a[href*="/ecole-"], a[href*="/universite-"], a[href*="/formation-"]'));
        console.log(`Approche 3: ${directLinks.length} liens directs trouvés`);
        
        directLinks.forEach(link => {
          const name = link.textContent.trim();
          if (!name) return; // Ignorer les liens sans texte
          
          // Corriger l'URL pour ne pas avoir de duplication du domaine
          const href = link.getAttribute('href');
          if (!href || !href.includes('/etablissement-')) return; // Ignorer les liens qui ne pointent pas vers des établissements
          
          const url = href.startsWith('http') ? href : 'https://diplomeo.com' + href;
          
          // Ne pas ajouter si l'URL existe déjà
          if (uniqueUrls.has(url)) return;
          uniqueUrls.add(url);
          
          // Essayer de trouver le secteur et la ville via les parents
          let sector = 'Non spécifié';
          let city = 'Non spécifiée';
          
          // Rechercher dans les éléments parents (jusqu'à 5 niveaux)
          let parent = link;
          for (let i = 0; i < 5; i++) {
            parent = parent.parentElement;
            if (!parent) break;
            
            // Essayer de trouver le secteur
            const sectorElement = parent.querySelector('.tw-text-body-xs.tw-font-sans.tw-text-gray-800, .tw-text-xs');
            if (sectorElement && !sector.includes('spécifié')) {
              sector = sectorElement.textContent.trim();
            }
            
            // Essayer de trouver la ville
            const cityElement = parent.querySelector('.tw-text-body-xs.tw-font-semibold, .tw-text-xs.tw-font-bold');
            if (cityElement && !city.includes('spécifiée')) {
              city = cityElement.textContent.trim();
            }
            
            // Si on a trouvé les deux, on arrête
            if (!sector.includes('spécifié') && !city.includes('spécifiée')) break;
          }
          
          links.push({ name, url, sector, city });
        });
        
        console.log(`Approche 3: ${links.length} écoles uniques extraites`);
        return links;
      }
      
      // Utiliser les items trouvés par l'approche 1 ou 2
      items.forEach(item => {
        try {
          const linkElement = item.querySelector('a[href*="/etablissement-"]');
          if (linkElement) {
            const name = linkElement.textContent.trim();
            if (!name) return; // Ignorer les liens sans texte
            
            // Corriger l'URL pour ne pas avoir de duplication du domaine
            const href = linkElement.getAttribute('href');
            const url = href.startsWith('http') ? href : 'https://diplomeo.com' + href;
            
            // Ne pas ajouter si l'URL existe déjà
            if (uniqueUrls.has(url)) return;
            uniqueUrls.add(url);
            
            // Récupération du secteur
            const sectorElement = item.querySelector('.tw-text-body-xs.tw-font-sans.tw-text-gray-800, .tw-text-xs');
            const sector = sectorElement ? sectorElement.textContent.trim() : 'Non spécifié';
            
            // Récupération de la ville
            const cityElement = item.querySelector('.tw-text-body-xs.tw-font-semibold, .tw-text-xs.tw-font-bold');
            const city = cityElement ? cityElement.textContent.trim() : 'Non spécifiée';
            
            links.push({ name, url, sector, city });
          }
        } catch (e) {
          console.error('Erreur lors de l\'extraction d\'une école:', e);
        }
      });
      
      // Approche supplémentaire: rechercher directement dans tous les éléments qui pourraient contenir des écoles
      if (links.length < 10) {
        const containers = document.querySelectorAll('.tw-flex.tw-flex-col, .tw-grid');
        containers.forEach(container => {
          const linkElements = container.querySelectorAll('a[href*="/etablissement-"]');
          linkElements.forEach(linkElement => {
            const name = linkElement.textContent.trim();
            if (!name) return;
            
            const href = linkElement.getAttribute('href');
            const url = href.startsWith('http') ? href : 'https://diplomeo.com' + href;
            
            if (uniqueUrls.has(url)) return;
            uniqueUrls.add(url);
            
            let sector = 'Non spécifié';
            let city = 'Non spécifiée';
            
            // Chercher dans les éléments voisins
            const parent = linkElement.closest('.tw-flex, .tw-grid-item');
            if (parent) {
              const textElements = Array.from(parent.querySelectorAll('span, p, div')).filter(el => el !== linkElement);
              
              // Le premier élément qui ressemble à un secteur
              const possibleSector = textElements.find(el => {
                const text = el.textContent.trim();
                return text.length > 0 && text.length < 50 && !text.match(/^\d/);
              });
              
              // Le premier élément qui ressemble à une ville (court, possiblement avec un code postal)
              const possibleCity = textElements.find(el => {
                const text = el.textContent.trim();
                return text.length > 0 && text.length < 30 && (text.match(/^\d{5}/) || text.match(/^[A-Z]/));
              });
              
              if (possibleSector) sector = possibleSector.textContent.trim();
              if (possibleCity) city = possibleCity.textContent.trim();
            }
            
            links.push({ name, url, sector, city });
          });
        });
      }
      
      console.log(`${links.length} écoles uniques extraites avec succès`);
      return links;
    } catch (error) {
      console.error('Erreur globale lors de l\'extraction:', error);
      return [];
    }
  });
}

/**
 * Extrait les informations de contact d'une école à partir de sa page
 * @param {import('playwright').Page} page - L'instance de page Playwright
 * @returns {Promise<Object>} Informations de contact (email, téléphone, site web)
 */
async function extractSchoolContactInfo(page) {
  return await page.evaluate(() => {
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
}

/**
 * Clique sur le bouton "Voir plus" pour charger d'autres écoles
 * @param {import('playwright').Page} page - L'instance de page Playwright
 * @returns {Promise<boolean>} true si le bouton a été cliqué avec succès, false sinon
 */
async function clickSeeMoreButton(page) {
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
      return true;
    } else {
      console.log('Aucun bouton trouvé');
      return false;
    }
  } catch (error) {
    console.log('Erreur lors du clic:', error.message);
    return false;
  }
}

module.exports = {
  extractSchoolLinks,
  extractSchoolContactInfo,
  clickSeeMoreButton
}; 