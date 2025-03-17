/**
 * Module d'exportation vers CSV pour Odoo
 * Permet de convertir les données des écoles en CSV compatible avec Odoo
 */

const fs = require('fs');
const path = require('path');

/**
 * Convertit une valeur en format CSV compatible
 * @param {*} value - La valeur à convertir
 * @returns {string} La valeur formatée pour CSV
 */
function formatCSVValue(value) {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  
  // Échapper les guillemets doubles en les doublant
  if (typeof value === 'string') {
    if (value.includes('"') || value.includes(',') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
  }
  
  return String(value);
}

/**
 * Génère un identifiant externe pour Odoo basé sur le nom de l'école
 * @param {string} name - Nom de l'école
 * @param {number} index - Index de l'école dans la liste
 * @returns {string} L'identifiant externe formaté
 */
function generateExternalId(name, index) {
  // Créer un slug à partir du nom (enlever les caractères spéciaux, remplacer les espaces par des tirets)
  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Enlever les accents
    .replace(/[^a-z0-9\s-]/g, '') // Enlever les caractères spéciaux
    .replace(/\s+/g, '-') // Remplacer les espaces par des tirets
    .replace(/-+/g, '-') // Éviter les tirets multiples
    .substring(0, 40); // Limiter la longueur
  
  // Ajouter un préfixe et l'index pour garantir l'unicité
  return `school_${slug}_${index}`;
}

/**
 * Convertit les données des écoles en CSV compatible avec Odoo
 * @param {Array<Object>} schools - Les données des écoles à convertir
 * @param {string} outputPath - Chemin du fichier de sortie
 * @returns {Promise<void>}
 */
async function exportToOdooCSV(schools, outputPath) {
  if (!schools || !schools.length) {
    throw new Error('Aucune donnée d\'école à exporter');
  }
  
  console.log(`Exportation de ${schools.length} écoles vers CSV pour Odoo...`);
  
  // Définir les en-têtes du CSV (colonnes pour Odoo)
  const headers = [
    'External ID',
    'Name',
    'Street',
    'Street2',
    'City',
    'State',
    'Zip',
    'Country',
    'Phone',
    'Mobile',
    'Email',
    'Website',
    'Tags',
    'Is a Company',
    'Industry',
    'Function'
  ];
  
  // Créer le contenu du CSV
  let csvContent = headers.join(',') + '\n';
  
  // Ajouter les lignes pour chaque école
  schools.forEach((school, index) => {
    const externalId = generateExternalId(school.name, index + 1);
    
    const fields = [
      externalId,
      formatCSVValue(school.name),
      '', // Street
      '', // Street2
      formatCSVValue(school.city),
      '', // State
      '', // Zip
      'France', // Country (par défaut: France pour les écoles francaises)
      formatCSVValue(school.phone_found ? school.phone : ''),
      '', // Mobile
      formatCSVValue(school.email_found ? school.email : ''),
      formatCSVValue(school.website_found ? school.website : ''),
      formatCSVValue(school.sector), // Tags
      'True', // Is a Company
      'Education', // Industry
      '', // Function
    ];
    
    csvContent += fields.join(',') + '\n';
  });
  
  // Écrire le fichier CSV
  fs.writeFileSync(outputPath, csvContent);
  
  console.log(`Exportation terminée. Le fichier a été enregistré dans ${outputPath}`);
}

/**
 * Exporte les données sous forme de plusieurs fichiers CSV pour différentes entités
 * @param {Array<Object>} schools - Les données des écoles à convertir
 * @param {string} outputDir - Dossier de sortie pour les fichiers
 */
async function exportMultipleEntities(schools, outputDir) {
  if (!schools || !schools.length) {
    throw new Error('Aucune donnée d\'école à exporter');
  }
  
  console.log(`Exportation des données vers plusieurs fichiers CSV pour Odoo...`);
  
  // Assurer que le dossier de sortie existe
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // 1. Exporter les companies (écoles)
  const companiesCSV = [
    'External ID,Name,Is a Company,Industry,Website,Phone,Email,Tags',
  ];
  
  // 2. Exporter les contacts (si besoin)
  const contactsCSV = [
    'External ID,Name,Is a Company,Related Company/External ID,Function,Email,Phone',
  ];
  
  // Ajouter les lignes pour chaque école
  schools.forEach((school, index) => {
    const externalId = generateExternalId(school.name, index + 1);
    
    // Format de l'école en tant qu'entreprise
    companiesCSV.push([
      externalId,
      formatCSVValue(school.name),
      'True',
      'Education',
      formatCSVValue(school.website_found ? school.website : ''),
      formatCSVValue(school.phone_found ? school.phone : ''),
      formatCSVValue(school.email_found ? school.email : ''),
      formatCSVValue(school.sector),
    ].join(','));
    
    // On pourrait ajouter des contacts associés à l'école si on avait ces données
    // Par exemple, le directeur ou la secrétaire de l'école
    /*
    contactsCSV.push([
      `contact_${externalId}`,
      formatCSVValue("Directeur de " + school.name),
      'False',
      externalId,
      'Directeur',
      '',
      '',
    ].join(','));
    */
  });
  
  // Écrire les fichiers CSV
  fs.writeFileSync(path.join(outputDir, 'odoo_companies.csv'), companiesCSV.join('\n'));
  fs.writeFileSync(path.join(outputDir, 'odoo_contacts.csv'), contactsCSV.join('\n'));
  
  console.log(`Exportation terminée. Les fichiers ont été enregistrés dans ${outputDir}`);
}

module.exports = {
  exportToOdooCSV,
  exportMultipleEntities
}; 