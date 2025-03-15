/**
 * Module de gestion du consentement des cookies
 * Utilitaire pour détecter et accepter les popups de cookies sur les sites web
 */

/**
 * Gère la popup de consentement des cookies sur une page
 * @param {import('playwright').Page} page - L'instance de page Playwright
 * @returns {Promise<void>}
 */
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
      
      try {
        // Prendre une capture d'écran avant de tenter d'accepter les cookies
        await page.screenshot({ path: './screenshots/before-cookie-accept.png' });
      } catch (e) {
        console.error('Erreur lors de la capture d\'écran:', e);
      }
      
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
    await page.screenshot({ path: './screenshots/after-cookies.png' });
  } catch (error) {
    console.error('Erreur lors de la capture d\'écran:', error);
  }
}

module.exports = {
  handleCookieConsent
}; 