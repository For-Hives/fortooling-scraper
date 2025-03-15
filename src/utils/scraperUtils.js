/**
 * Utilitaires pour le scraper Diplomeo
 * Contient des fonctions de décodage et d'extraction de données
 */

/**
 * Décode une chaîne encodée en ROT13
 * @param {string} encodedStr - La chaîne encodée
 * @returns {string} La chaîne décodée
 */
function decodeROT13(encodedStr) {
  return encodedStr.replace(/[a-zA-Z]/g, function(c) {
    const base = c <= 'Z' ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
  }).replace(/=cg=/g, '.').replace(/=pt=/g, '.');
}

/**
 * Décode une URL encodée en ROT13 avec caractères spéciaux
 * @param {string} encodedURL - L'URL encodée
 * @returns {string} L'URL décodée
 */
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

/**
 * Nettoie et corrige les extensions d'email
 * @param {string} email - L'email à nettoyer
 * @returns {string} L'email nettoyé
 */
function cleanEmail(email) {
  return email
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

/**
 * Nettoie et corrige les URLs de site web
 * @param {string} website - L'URL à nettoyer
 * @returns {string} L'URL nettoyée
 */
function cleanWebsite(website) {
  return website
    .replace(/=cg=/g, '.')
    .replace(/=pt=/g, '.')
    .replace(/=co=/g, '-')
    .replace('khttps', 'https');
}

/**
 * Génère des URLs de pagination
 * @param {string} baseUrl - L'URL de base
 * @param {number} pageCount - Le nombre de pages à générer
 * @returns {Array<string>} Un tableau d'URLs pour chaque page
 */
function generatePageUrls(baseUrl, pageCount) {
  const urls = [];
  for (let i = 1; i <= pageCount; i++) {
    urls.push(`${baseUrl}?page=${i}`);
  }
  return urls;
}

module.exports = {
  decodeROT13,
  decodeROT13URL,
  cleanEmail,
  cleanWebsite,
  generatePageUrls
}; 