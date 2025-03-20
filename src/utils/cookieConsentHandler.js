/**
 * Module de gestion du consentement des cookies
 * Utilitaire pour détecter et accepter les popups de cookies sur les sites web
 */

/**
 * Gère la popup de consentement des cookies si elle est présente
 * @param {import('playwright').Page} page - L'instance de page Playwright
 * @returns {Promise<boolean>} - Vrai si le consentement a été géré, faux sinon
 */
async function handleCookieConsent(page) {
  try {
    console.log('Vérification de la présence de la popup des cookies...');
    
    // Vérifier rapidement si la popup existe avant de continuer
    const hasPopup = await page.evaluate(() => {
      // Liste des sélecteurs possibles pour les popups de cookies
      const popupSelectors = [
        '#didomi-notice',
        '.cookies-notice',
        '#tarteaucitronAlertBig',
        '#cookieChoiceInfo',
        '.cookie-consent',
        '.cookie-banner',
        '#cookie-law-info-bar',
        '.gdpr',
        '[aria-label="Cookie banner"]',
        '#CybotCookiebotDialog',
        '[aria-label="Cookies"]',
        '.js-consent-banner',
        '#cookiebanner'
      ];
      
      // Vérifier si au moins un des sélecteurs est présent
      return popupSelectors.some(selector => document.querySelector(selector) !== null);
    });
    
    // Si aucune popup n'est détectée, terminer rapidement
    if (!hasPopup) {
      console.log('Aucune popup de cookies détectée, pas besoin de gestion.');
      return false;
    }
    
    console.log('Popup des cookies détectée...');
    
    // Prendre une capture d'écran avant de gérer les cookies (avec gestion d'erreur)
    try {
      await page.screenshot({ 
        path: `screenshots/before-cookie-${Date.now()}.png`, 
        fullPage: false,
        timeout: 5000
      });
    } catch (screenshotError) {
      console.log('Erreur lors de la capture d\'écran:', screenshotError.message);
      // Continuer malgré l'erreur de capture d'écran
    }
    
    // Essayer d'abord la méthode JavaScript (plus fiable et générique)
    let cookieHandled = await tryJavaScriptClick(page);
    
    // Si la méthode JavaScript échoue, essayer les sélecteurs directs
    if (!cookieHandled) {
      cookieHandled = await tryDirectSelectors(page);
    }
    
    // Prendre une capture d'écran après la gestion (avec gestion d'erreur)
    try {
      await page.waitForTimeout(1000); // Attendre pour voir si la popup disparaît
      await page.screenshot({ 
        path: `screenshots/after-cookie-${Date.now()}.png`,
        fullPage: false,
        timeout: 5000
      });
    } catch (screenshotError) {
      console.log('Erreur lors de la capture d\'écran:', screenshotError.message);
      // Continuer malgré l'erreur
    }
    
    return cookieHandled;
  } catch (error) {
    console.log('Erreur lors de la gestion des cookies:', error.message);
    console.log('Continuation du script malgré l\'erreur de gestion des cookies');
    return false;
  }
}

/**
 * Essaie de cliquer sur les boutons de consentement via JavaScript
 * @param {import('playwright').Page} page - L'instance de page Playwright
 * @returns {Promise<boolean>} - Vrai si réussi, faux sinon
 */
async function tryJavaScriptClick(page) {
  try {
    console.log('Essai de clic via JavaScript...');
    
    const clicked = await page.evaluate(() => {
      // Liste des expressions communes pour accepter les cookies
      const acceptTexts = [
        'accept', 'accepter', 'accepte', 'j\'accepte', 'agree', 'allow', 'autoriser',
        'accept all', 'accepter tout', 'tout accepter', 'ok', 'oui', 'continuer',
        'accept cookies', 'accepter les cookies', 'accept all cookies'
      ];
      
      // Fonction pour déterminer si un élément est visible
      function isVisible(elem) {
        if (!elem) return false;
        const style = window.getComputedStyle(elem);
        return style.display !== 'none' && 
               style.visibility !== 'hidden' && 
               style.opacity !== '0' &&
               elem.offsetWidth > 0 && 
               elem.offsetHeight > 0;
      }
      
      // Fonction pour trouver les boutons par leur texte
      function findButtonsByText() {
        const allElements = document.querySelectorAll('button, a, div, span, input[type="button"], input[type="submit"]');
        
        for (const element of allElements) {
          if (!isVisible(element)) continue;
          
          const text = element.textContent.toLowerCase().trim();
          if (acceptTexts.some(acceptText => text.includes(acceptText))) {
            return element;
          }
        }
        return null;
      }
      
      // Recherche par attributs spécifiques (prioritaire)
      const specificButtons = [
        document.querySelector('button[id*="accept"], button[class*="accept"]'),
        document.querySelector('[data-testid="cookie-accept"], [data-action="accept"]'),
        document.querySelector('[aria-label*="cookies" i]'),
        document.querySelector('[onclick*="accept" i], [onclick*="cookie" i]')
      ].filter(Boolean);
      
      let clicked = false;
      
      // Essayer de cliquer sur les boutons spécifiques
      for (const button of specificButtons) {
        if (isVisible(button)) {
          button.click();
          clicked = true;
          break;
        }
      }
      
      // Si aucun bouton spécifique n'a été cliqué, essayer par texte
      if (!clicked) {
        const textButton = findButtonsByText();
        if (textButton) {
          textButton.click();
          clicked = true;
        }
      }
      
      return clicked;
    });
    
    if (clicked) {
      console.log('Bouton cliqué via JavaScript');
      // Attendre un court moment pour que la popup disparaisse
      await page.waitForTimeout(1500);
      return true;
    } else {
      console.log('Aucun bouton trouvé via JavaScript');
      return false;
    }
  } catch (error) {
    console.log('Erreur lors du clic via JavaScript:', error.message);
    return false;
  }
}

/**
 * Essaie de cliquer sur les boutons de consentement via des sélecteurs directs
 * @param {import('playwright').Page} page - L'instance de page Playwright
 * @returns {Promise<boolean>} - Vrai si réussi, faux sinon
 */
async function tryDirectSelectors(page) {
  // Liste des sélecteurs courants pour les boutons d'acceptation de cookies
  const selectors = [
    '#didomi-notice-agree-button',
    '#onetrust-accept-btn-handler',
    '.js-accept-cookies',
    '#tarteaucitronPersonalize',
    '#CybotCookiebotDialogBodyButtonAccept',
    '.cookies-notice-ok',
    '.cookie-accept',
    '.cc-btn.cc-allow',
    '#acceptCookies',
    '.accept-cookies-button',
    'button[aria-label="Consentir"]',
    '[data-gdpr-action="accept"]'
  ];
  
  try {
    console.log('Essai de clic via sélecteurs directs...');
    
    for (const selector of selectors) {
      const button = await page.$(selector);
      if (button) {
        try {
          await button.click({ timeout: 3000 });
          console.log(`Bouton accepté via le sélecteur: ${selector}`);
          // Attendre un court moment pour que la popup disparaisse
          await page.waitForTimeout(1500);
          return true;
        } catch (clickError) {
          console.log(`Erreur lors du clic sur ${selector}:`, clickError.message);
          // Continuer avec le prochain sélecteur
        }
      }
    }
    
    console.log('Aucun bouton trouvé via les sélecteurs directs');
    return false;
  } catch (error) {
    console.log('Erreur lors de la tentative via sélecteurs directs:', error.message);
    return false;
  }
}

module.exports = {
  handleCookieConsent
}; 