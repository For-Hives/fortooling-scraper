#!/usr/bin/env node

/**
 * Script d'exécution du scraper Diplomeo
 * Lance le processus de scraping complet
 */

const { run } = require('../src/scraper');

console.log('=== Démarrage du scraping de Diplomeo ===');
console.log('Date de début:', new Date().toLocaleString());
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