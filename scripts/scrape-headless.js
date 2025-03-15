#!/usr/bin/env node

/**
 * Script d'exécution du scraper Diplomeo en mode headless
 * Version pour la production sans interface graphique
 */

// Définir l'environnement comme production
process.env.NODE_ENV = 'production';
process.env.HEADLESS = 'true';

const { run } = require('../src/scraper');

console.log('=== Démarrage du scraping de Diplomeo (mode production) ===');
console.log('Date de début:', new Date().toLocaleString());
console.log('Mode headless: activé');
console.log('------------------------------------');

run()
  .then(() => {
    console.log('------------------------------------');
    console.log('Date de fin:', new Date().toLocaleString());
    console.log('=== Scraping terminé avec succès ===');
  })
  .catch(error => {
    console.error('------------------------------------');
    console.error('Erreur lors du scraping:', error);
    console.error('Date de fin (avec erreur):', new Date().toLocaleString());
    console.error('=== Scraping terminé avec erreur ===');
    process.exit(1);
  }); 