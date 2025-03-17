#!/usr/bin/env node

/**
 * Script pour lancer le scraping massif en mode headless (sans interface graphique)
 * Idéal pour l'exécution sur un serveur ou en production
 */

const { spawn } = require('child_process');
const path = require('path');

// Chemin vers le script principal
const mainScriptPath = path.join(__dirname, 'scrape-all-schools.js');

console.log('=== Lancement du scraper massif en mode headless ===');
console.log('Date:', new Date().toLocaleString());

// Lancer le script principal avec l'option --headless
const scraper = spawn('node', [mainScriptPath, '--headless'], {
  stdio: 'inherit', // Rediriger l'entrée/sortie vers le terminal parent
  detached: false  // Ne pas détacher le processus
});

// Gérer la terminaison du processus
scraper.on('close', (code) => {
  console.log(`=== Script terminé avec code: ${code} ===`);
});

// Gérer les erreurs
scraper.on('error', (err) => {
  console.error('Erreur lors du lancement du script:', err);
  process.exit(1);
});

// Gérer les signaux d'interruption pour arrêter proprement
process.on('SIGINT', () => {
  console.log('Arrêt demandé, veuillez patienter...');
  scraper.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('Terminaison demandée, veuillez patienter...');
  scraper.kill('SIGTERM');
}); 