#!/usr/bin/env node

/**
 * Script d'exportation des données des écoles vers un format CSV compatible avec Odoo
 */

const fs = require('fs');
const path = require('path');
const { exportToOdooCSV, exportMultipleEntities } = require('../src/utils/csvExporter');

// Dossiers de données
const DATA_DIR = path.join(__dirname, '..', 'data');
const OUTPUT_DIR = path.join(DATA_DIR, 'odoo');

// S'assurer que le dossier de sortie existe
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Fichier source des données d'écoles nettoyées
const SOURCE_FILE = path.join(DATA_DIR, 'schools_data_cleaned.json');

// Fichier de sortie pour le CSV complet
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'odoo_schools.csv');

/**
 * Fonction principale d'exportation
 */
async function run() {
  console.log('=== Démarrage de l\'exportation vers Odoo ===');
  console.log('Date de début:', new Date().toLocaleString());
  console.log('------------------------------------');
  
  // Vérifier que le fichier source existe
  if (!fs.existsSync(SOURCE_FILE)) {
    console.error(`Erreur: Fichier source non trouvé: ${SOURCE_FILE}`);
    console.error('Veuillez d\'abord exécuter le scraper pour collecter les données.');
    process.exit(1);
  }
  
  try {
    // Lire les données des écoles
    const schoolsData = JSON.parse(fs.readFileSync(SOURCE_FILE, 'utf8'));
    console.log(`Lecture de ${schoolsData.length} écoles depuis ${SOURCE_FILE}`);
    
    // 1. Exporter vers un fichier CSV unique (toutes les écoles comme contacts/entreprises)
    await exportToOdooCSV(schoolsData, OUTPUT_FILE);
    
    // 2. Exporter vers plusieurs fichiers (companies et contacts séparés)
    await exportMultipleEntities(schoolsData, OUTPUT_DIR);
    
    console.log('------------------------------------');
    console.log('Exportation terminée avec succès!');
    console.log('Fichiers générés:');
    console.log(`- ${OUTPUT_FILE}`);
    console.log(`- ${path.join(OUTPUT_DIR, 'odoo_companies.csv')}`);
    console.log(`- ${path.join(OUTPUT_DIR, 'odoo_contacts.csv')}`);
    console.log('------------------------------------');
    console.log('Date de fin:', new Date().toLocaleString());
    console.log('=== Exportation terminée ===');
  } catch (error) {
    console.error('Erreur lors de l\'exportation:', error);
    process.exit(1);
  }
}

// Exécuter le script
run().catch(console.error); 