#!/usr/bin/env node

/**
 * Script pour exécuter toutes les analyses de données d'écoles
 * Séquence l'exécution des scripts d'analyse et de génération de rapports
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Analyser les arguments de ligne de commande
const args = process.argv.slice(2);
const sourceFile = args.find(arg => arg.startsWith('--source='))?.split('=')[1] || 'schools_data_complete.json';
const verbose = args.includes('--verbose');

// Configuration
const SCRIPTS_DIR = __dirname;
const DATA_DIR = path.join(__dirname, '..', 'data');
const SOURCE_PATH = path.join(DATA_DIR, sourceFile);

// Liste des scripts à exécuter dans l'ordre
const scripts = [
  {
    name: 'Analyse par secteur',
    path: path.join(SCRIPTS_DIR, 'analyze-school-data.js'),
    args: [`--source=${sourceFile}`]
  },
  {
    name: 'Analyse des emails',
    path: path.join(SCRIPTS_DIR, 'generate-email-report.js'),
    args: [`--source=${sourceFile}`]
  },
  {
    name: 'Génération du rapport HTML',
    path: path.join(SCRIPTS_DIR, 'generate-html-report.js'),
    args: [`--source=${sourceFile}`]
  }
];

/**
 * Exécute un script Node.js
 * @param {Object} script - Information sur le script à exécuter
 * @returns {Promise<number>} - Code de sortie
 */
function runScript(script) {
  return new Promise((resolve, reject) => {
    console.log(`\n=== Exécution de ${script.name} ===`);
    console.log(`Commande: node ${script.path} ${script.args.join(' ')}`);
    
    const startTime = new Date();
    
    const process = spawn('node', [script.path, ...script.args], {
      stdio: verbose ? 'inherit' : 'pipe'
    });
    
    let output = '';
    
    if (!verbose && process.stdout) {
      process.stdout.on('data', (data) => {
        output += data.toString();
      });
    }
    
    if (!verbose && process.stderr) {
      process.stderr.on('data', (data) => {
        output += data.toString();
      });
    }
    
    process.on('close', (code) => {
      const endTime = new Date();
      const duration = ((endTime - startTime) / 1000).toFixed(2);
      
      if (code === 0) {
        console.log(`✅ ${script.name} terminé en ${duration} secondes`);
        if (!verbose) {
          console.log(`   Sortie: ${output.split('\n').length} lignes`);
        }
        resolve(code);
      } else {
        console.error(`❌ ${script.name} a échoué avec le code ${code} après ${duration} secondes`);
        if (!verbose) {
          console.error('Sortie:');
          console.error(output);
        }
        reject(new Error(`Script terminé avec le code ${code}`));
      }
    });
    
    process.on('error', (err) => {
      console.error(`❌ Erreur lors de l'exécution de ${script.name}:`, err);
      reject(err);
    });
  });
}

/**
 * Fonction principale
 */
async function run() {
  console.log('=== Démarrage de l\'analyse complète des données d\'écoles ===');
  console.log(`Date: ${new Date().toLocaleString()}`);
  console.log(`Fichier source: ${SOURCE_PATH}`);
  console.log(`Mode: ${verbose ? 'verbeux' : 'silencieux'}`);
  
  // Vérifier que le fichier source existe
  if (!fs.existsSync(SOURCE_PATH)) {
    console.error(`Erreur: Le fichier source ${SOURCE_PATH} n'existe pas.`);
    process.exit(1);
  }
  
  const startTime = new Date();
  let success = true;
  
  // Exécuter les scripts en séquence
  for (let i = 0; i < scripts.length; i++) {
    const script = scripts[i];
    try {
      await runScript(script);
    } catch (error) {
      console.error(`Erreur lors de l'exécution de ${script.name}:`, error.message);
      success = false;
      break;
    }
  }
  
  const endTime = new Date();
  const duration = ((endTime - startTime) / 1000).toFixed(2);
  
  console.log('\n=== Résumé de l\'exécution ===');
  console.log(`Durée totale: ${duration} secondes`);
  console.log(`Statut: ${success ? '✅ Succès' : '❌ Échec'}`);
  
  if (success) {
    console.log('\nRapports générés:');
    console.log(`- Rapport HTML: ${path.join(DATA_DIR, 'reports', 'html', 'index.html')}`);
    console.log(`- Rapports CSV: ${path.join(DATA_DIR, 'reports')}`);
    console.log(`- Données par secteur: ${path.join(DATA_DIR, 'schools_by_sector.json')}`);
    console.log(`- Statistiques générales: ${path.join(DATA_DIR, 'schools_report.json')}`);
    console.log(`- Analyse des emails: ${path.join(DATA_DIR, 'schools_emails_analysis.json')}`);
  }
  
  process.exit(success ? 0 : 1);
}

// Afficher l'aide si demandé
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage: node ${path.basename(__filename)} [options]

Options:
  --source=FILE.json   Fichier de données source (par défaut: schools_data_complete.json)
  --verbose            Affiche toutes les sorties des scripts
  --help, -h           Affiche cette aide
  
Description:
  Ce script exécute séquentiellement tous les scripts d'analyse de données
  d'écoles et génère les rapports correspondants.
  
Scripts exécutés dans l'ordre:
  1. analyze-school-data.js    - Analyse par secteur
  2. generate-email-report.js  - Analyse des emails
  3. generate-html-report.js   - Génération du rapport HTML
  `);
  process.exit(0);
}

// Exécuter le script
run().catch(err => {
  console.error('Erreur non gérée:', err);
  process.exit(1);
}); 