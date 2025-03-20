#!/usr/bin/env node

/**
 * Script de génération de rapport HTML avec visualisations
 * Crée un rapport interactif à partir des données d'écoles
 */

const fs = require('fs');
const path = require('path');

// Chemins des fichiers
const DATA_DIR = path.join(__dirname, '..', 'data');
const SOURCE_FILE = path.join(DATA_DIR, 'schools_data_complete.json');
const REPORT_DIR = path.join(DATA_DIR, 'reports', 'html');
const REPORT_FILE = path.join(REPORT_DIR, 'index.html');
const SECTORS_FILE = path.join(DATA_DIR, 'schools_by_sector.json');
const STATISTICS_FILE = path.join(DATA_DIR, 'schools_report.json');
const EMAILS_FILE = path.join(DATA_DIR, 'schools_emails_analysis.json');

// Analyser les arguments de ligne de commande
const args = process.argv.slice(2);
const sourceFile = args.find(arg => arg.startsWith('--source=')) 
  ? path.join(DATA_DIR, args.find(arg => arg.startsWith('--source=')).split('=')[1])
  : SOURCE_FILE;

// Vérifier si nous devons régénérer les analyses
const regenerateAnalysis = args.includes('--regenerate');

/**
 * Exécute une commande Node.js
 * @param {string} scriptPath - Chemin du script à exécuter
 * @param {Array<string>} args - Arguments pour le script
 * @returns {Promise<void>}
 */
function runNodeScript(scriptPath, args = []) {
  return new Promise((resolve, reject) => {
    console.log(`Exécution de ${scriptPath} avec arguments: ${args.join(' ')}`);
    
    const { spawn } = require('child_process');
    const process = spawn('node', [scriptPath, ...args], {
      stdio: 'inherit'
    });
    
    process.on('close', code => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Le script ${scriptPath} s'est terminé avec le code ${code}`));
      }
    });
    
    process.on('error', err => {
      reject(err);
    });
  });
}

/**
 * Génère le graphique de distribution par secteur
 * @param {Object} sectorStats - Statistiques par secteur
 * @returns {string} Code HTML du graphique
 */
function generateSectorChart(sectorStats) {
  // Trier les secteurs par nombre d'écoles
  const sortedSectors = Object.entries(sectorStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15); // Limiter aux 15 principaux secteurs
  
  const labels = sortedSectors.map(([sector]) => sector);
  const data = sortedSectors.map(([_, count]) => count);
  
  // Générer des couleurs aléatoires
  const colors = Array(labels.length).fill().map(() => {
    const r = Math.floor(Math.random() * 200) + 55;
    const g = Math.floor(Math.random() * 200) + 55;
    const b = Math.floor(Math.random() * 200) + 55;
    return `rgba(${r},${g},${b},0.7)`;
  });
  
  // Générer le HTML pour le graphique
  return `
    <div class="chart-container">
      <canvas id="sectorsChart"></canvas>
    </div>
    <script>
      const sectorsCtx = document.getElementById('sectorsChart').getContext('2d');
      new Chart(sectorsCtx, {
        type: 'bar',
        data: {
          labels: ${JSON.stringify(labels)},
          datasets: [{
            label: 'Nombre d\'écoles par secteur',
            data: ${JSON.stringify(data)},
            backgroundColor: ${JSON.stringify(colors)},
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true
            }
          },
          plugins: {
            legend: {
              display: false
            },
            title: {
              display: true,
              text: 'Distribution des écoles par secteur (top 15)'
            }
          }
        }
      });
    </script>
  `;
}

/**
 * Génère le graphique de disponibilité des informations
 * @param {Object} stats - Statistiques
 * @returns {string} Code HTML du graphique
 */
function generateInfoAvailabilityChart(stats) {
  // Préparer les données
  const labels = [
    'Emails', 'Téléphones', 'Sites Web', 'Descriptions', 'Adresses', 'Formations'
  ];
  const data = [
    stats.withEmail, stats.withPhone, stats.withWebsite, 
    stats.withDescription, stats.withAddress, stats.withFormations
  ];
  const total = stats.total;
  
  // Générer des pourcentages
  const percentages = data.map(value => ((value / total) * 100).toFixed(1));
  
  // Générer le HTML pour le graphique
  return `
    <div class="chart-container">
      <canvas id="infoAvailabilityChart"></canvas>
    </div>
    <script>
      const infoCtx = document.getElementById('infoAvailabilityChart').getContext('2d');
      new Chart(infoCtx, {
        type: 'bar',
        data: {
          labels: ${JSON.stringify(labels)},
          datasets: [{
            label: 'Disponibilité en %',
            data: ${JSON.stringify(percentages)},
            backgroundColor: [
              'rgba(54, 162, 235, 0.7)',
              'rgba(255, 99, 132, 0.7)',
              'rgba(255, 206, 86, 0.7)',
              'rgba(75, 192, 192, 0.7)',
              'rgba(153, 102, 255, 0.7)',
              'rgba(255, 159, 64, 0.7)'
            ],
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              max: 100,
              ticks: {
                callback: function(value) {
                  return value + '%';
                }
              }
            }
          },
          plugins: {
            tooltip: {
              callbacks: {
                label: function(context) {
                  const index = context.dataIndex;
                  return \`\${percentages[index]}% (\${data[index]} écoles)\`;
                }
              }
            },
            title: {
              display: true,
              text: 'Disponibilité des informations'
            }
          }
        }
      });
    </script>
  `;
}

/**
 * Génère le graphique des domaines d'email
 * @param {Object} emailDomains - Statistiques des domaines d'email
 * @returns {string} Code HTML du graphique
 */
function generateEmailDomainsChart(emailDomains) {
  // Préparer les données
  const entries = Object.entries(emailDomains);
  const top10 = entries.slice(0, 10);
  const others = entries.slice(10).reduce((sum, [_, count]) => sum + count, 0);
  
  const labels = [...top10.map(([domain]) => domain)];
  if (others > 0) labels.push('Autres');
  
  const data = [...top10.map(([_, count]) => count)];
  if (others > 0) data.push(others);
  
  // Générer des couleurs
  const colors = Array(labels.length).fill().map(() => {
    const r = Math.floor(Math.random() * 200) + 55;
    const g = Math.floor(Math.random() * 200) + 55;
    const b = Math.floor(Math.random() * 200) + 55;
    return `rgba(${r},${g},${b},0.7)`;
  });
  
  // Générer le HTML pour le graphique
  return `
    <div class="chart-container">
      <canvas id="emailDomainsChart"></canvas>
    </div>
    <script>
      const emailDomainsCtx = document.getElementById('emailDomainsChart').getContext('2d');
      new Chart(emailDomainsCtx, {
        type: 'pie',
        data: {
          labels: ${JSON.stringify(labels)},
          datasets: [{
            data: ${JSON.stringify(data)},
            backgroundColor: ${JSON.stringify(colors)},
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right'
            },
            title: {
              display: true,
              text: 'Distribution des domaines d\'email'
            }
          }
        }
      });
    </script>
  `;
}

/**
 * Génère le graphique des catégories d'email
 * @param {Object} emailCategories - Statistiques des catégories d'email
 * @returns {string} Code HTML du graphique
 */
function generateEmailCategoriesChart(emailCategories) {
  // Préparer les données
  const entries = Object.entries(emailCategories);
  const labels = entries.map(([category]) => category);
  const data = entries.map(([_, count]) => count);
  
  // Générer des couleurs
  const colors = [
    'rgba(54, 162, 235, 0.7)',
    'rgba(255, 99, 132, 0.7)',
    'rgba(255, 206, 86, 0.7)',
    'rgba(75, 192, 192, 0.7)',
    'rgba(153, 102, 255, 0.7)',
    'rgba(255, 159, 64, 0.7)',
    'rgba(201, 203, 207, 0.7)'
  ];
  
  // Générer le HTML pour le graphique
  return `
    <div class="chart-container">
      <canvas id="emailCategoriesChart"></canvas>
    </div>
    <script>
      const emailCategoriesCtx = document.getElementById('emailCategoriesChart').getContext('2d');
      new Chart(emailCategoriesCtx, {
        type: 'doughnut',
        data: {
          labels: ${JSON.stringify(labels)},
          datasets: [{
            data: ${JSON.stringify(data)},
            backgroundColor: ${JSON.stringify(colors.slice(0, labels.length))},
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right'
            },
            title: {
              display: true,
              text: 'Catégories des adresses email'
            }
          }
        }
      });
    </script>
  `;
}

/**
 * Génère le tableau de statistiques par secteur
 * @param {Object} sectorsData - Données des écoles par secteur
 * @param {Object} stats - Statistiques générales
 * @returns {string} - HTML du tableau
 */
function generateSectorsTable(sectorsData, stats) {
  // Calculer les statistiques par secteur
  const sectorStats = [];
  
  for (const [sector, schools] of Object.entries(sectorsData)) {
    const sectorStat = {
      name: sector,
      count: schools.length,
      percentage: ((schools.length / stats.total) * 100).toFixed(1),
      withEmail: schools.filter(s => s.email_found).length,
      withPhone: schools.filter(s => s.phone_found).length,
      withWebsite: schools.filter(s => s.website_found).length
    };
    
    sectorStat.emailPercentage = ((sectorStat.withEmail / sectorStat.count) * 100).toFixed(1);
    sectorStat.phonePercentage = ((sectorStat.withPhone / sectorStat.count) * 100).toFixed(1);
    sectorStat.websitePercentage = ((sectorStat.withWebsite / sectorStat.count) * 100).toFixed(1);
    
    sectorStats.push(sectorStat);
  }
  
  // Trier par nombre d'écoles
  sectorStats.sort((a, b) => b.count - a.count);
  
  // Générer les lignes du tableau
  const tableRows = sectorStats.map(sector => `
    <tr>
      <td>${sector.name}</td>
      <td>${sector.count} <small>(${sector.percentage}%)</small></td>
      <td>${sector.withEmail} <small>(${sector.emailPercentage}%)</small></td>
      <td>${sector.withPhone} <small>(${sector.phonePercentage}%)</small></td>
      <td>${sector.withWebsite} <small>(${sector.websitePercentage}%)</small></td>
    </tr>
  `).join('');
  
  // Générer le HTML pour le tableau
  return `
    <div class="table-responsive">
      <table class="table table-striped table-bordered">
        <thead class="table-dark">
          <tr>
            <th>Secteur</th>
            <th>Nombre d'écoles</th>
            <th>Avec Email</th>
            <th>Avec Téléphone</th>
            <th>Avec Site Web</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    </div>
  `;
}

/**
 * Génère le contenu HTML du rapport
 * @param {Object} data - Données collectées (écoles, stats, etc.)
 * @returns {string} - Contenu HTML complet
 */
function generateHtmlReport(data) {
  const { schools, schoolsBySector, stats, emailStats } = data;
  
  // Générer les graphiques
  const sectorChart = generateSectorChart(stats.sectorsCount);
  const infoAvailabilityChart = generateInfoAvailabilityChart(stats);
  
  // Graphiques d'email si disponibles
  let emailDomainsChart = '';
  let emailCategoriesChart = '';
  
  if (emailStats && emailStats.emailStats && emailStats.emailStats.domainCounts) {
    emailDomainsChart = generateEmailDomainsChart(emailStats.emailStats.domainCounts);
  }
  
  if (emailStats && emailStats.emailStats && emailStats.emailStats.categoryCounts) {
    emailCategoriesChart = generateEmailCategoriesChart(emailStats.emailStats.categoryCounts);
  }
  
  // Générer le tableau des secteurs
  const sectorsTable = generateSectorsTable(schoolsBySector, stats);
  
  // Formater la date
  const now = new Date();
  const formattedDate = now.toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  // Générer le HTML complet
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rapport d'analyse des données d'écoles</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      padding-top: 2rem;
      padding-bottom: 3rem;
    }
    .header {
      background-color: #f8f9fa;
      padding: 2rem 0;
      margin-bottom: 2rem;
      border-bottom: 1px solid #e9ecef;
    }
    .chart-container {
      height: 400px;
      margin-bottom: 2rem;
    }
    .card {
      margin-bottom: 2rem;
      box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);
    }
    .card-header {
      background-color: #f8f9fa;
      font-weight: bold;
    }
    .stats-value {
      font-size: 2rem;
      font-weight: bold;
      color: #007bff;
    }
    .stats-label {
      font-size: 0.9rem;
      color: #6c757d;
    }
    .footer {
      margin-top: 3rem;
      padding-top: 1rem;
      border-top: 1px solid #e9ecef;
      color: #6c757d;
      font-size: 0.9rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- En-tête -->
    <div class="header text-center">
      <h1 class="display-4">Rapport d'analyse des données d'écoles</h1>
      <p class="lead">Généré le ${formattedDate}</p>
    </div>
    
    <!-- Résumé des statistiques -->
    <div class="row mb-4">
      <div class="col-md-4">
        <div class="card text-center">
          <div class="card-header">Écoles analysées</div>
          <div class="card-body">
            <div class="stats-value">${stats.total}</div>
            <div class="stats-label">écoles au total</div>
          </div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="card text-center">
          <div class="card-header">Secteurs identifiés</div>
          <div class="card-body">
            <div class="stats-value">${Object.keys(stats.sectorsCount).length}</div>
            <div class="stats-label">catégories différentes</div>
          </div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="card text-center">
          <div class="card-header">Données de contact</div>
          <div class="card-body">
            <div class="stats-value">${stats.withEmail}</div>
            <div class="stats-label">emails trouvés (${((stats.withEmail / stats.total) * 100).toFixed(1)}%)</div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Graphiques -->
    <div class="row mb-4">
      <!-- Distribution par secteur -->
      <div class="col-lg-12 mb-4">
        <div class="card">
          <div class="card-header">Distribution par secteur</div>
          <div class="card-body">
            ${sectorChart}
          </div>
        </div>
      </div>
      
      <!-- Disponibilité des informations -->
      <div class="col-lg-6 mb-4">
        <div class="card">
          <div class="card-header">Disponibilité des informations</div>
          <div class="card-body">
            ${infoAvailabilityChart}
          </div>
        </div>
      </div>
      
      <!-- Domaines d'email -->
      <div class="col-lg-6 mb-4">
        <div class="card">
          <div class="card-header">Domaines d'email</div>
          <div class="card-body">
            ${emailDomainsChart || '<p class="text-center">Aucune donnée d\'email disponible</p>'}
          </div>
        </div>
      </div>
      
      <!-- Catégories d'email -->
      <div class="col-lg-6 mb-4">
        <div class="card">
          <div class="card-header">Catégories d'email</div>
          <div class="card-body">
            ${emailCategoriesChart || '<p class="text-center">Aucune donnée d\'email disponible</p>'}
          </div>
        </div>
      </div>
    </div>
    
    <!-- Tableau des secteurs -->
    <div class="row mb-4">
      <div class="col-12">
        <div class="card">
          <div class="card-header">Statistiques par secteur</div>
          <div class="card-body">
            ${sectorsTable}
          </div>
        </div>
      </div>
    </div>
    
    <!-- Pied de page -->
    <div class="footer text-center">
      <p>Rapport généré automatiquement à partir des données collectées.</p>
      <p>Total: ${stats.total} écoles dans ${Object.keys(stats.sectorsCount).length} secteurs.</p>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
  `;
}

/**
 * Fonction principale
 */
async function run() {
  console.log('=== Démarrage de la génération du rapport HTML ===');
  console.log(`Fichier source: ${sourceFile}`);
  console.log('Date:', new Date().toLocaleString());
  
  // Vérifier que le fichier source existe
  if (!fs.existsSync(sourceFile)) {
    console.error(`Fichier source introuvable: ${sourceFile}`);
    process.exit(1);
  }
  
  // Vérifier si nous devons régénérer les analyses
  if (regenerateAnalysis) {
    console.log('Régénération des analyses demandée...');
    
    try {
      // Exécuter le script d'analyse des écoles par secteur
      await runNodeScript(path.join(__dirname, 'analyze-school-data.js'), [
        `--source=${path.basename(sourceFile)}`
      ]);
      
      // Exécuter le script d'analyse des emails
      await runNodeScript(path.join(__dirname, 'generate-email-report.js'), [
        `--source=${path.basename(sourceFile)}`
      ]);
      
      console.log('Analyses régénérées avec succès.');
    } catch (error) {
      console.error('Erreur lors de la régénération des analyses:', error.message);
      process.exit(1);
    }
  }
  
  // Charger les données nécessaires
  console.log('Chargement des données...');
  const data = {};
  
  try {
    // Charger les écoles
    data.schools = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
    console.log(`${data.schools.length} écoles chargées depuis ${sourceFile}`);
    
    // Charger les données par secteur (si disponibles)
    if (fs.existsSync(SECTORS_FILE)) {
      data.schoolsBySector = JSON.parse(fs.readFileSync(SECTORS_FILE, 'utf8'));
      console.log(`Données par secteur chargées depuis ${SECTORS_FILE}`);
    } else {
      console.log(`Fichier ${SECTORS_FILE} non trouvé, organisation des écoles par secteur...`);
      const organizeBySecor = require('../analyze-school-data').organizeBySecor;
      data.schoolsBySector = organizeBySecor(data.schools);
    }
    
    // Charger les statistiques (si disponibles)
    if (fs.existsSync(STATISTICS_FILE)) {
      data.stats = JSON.parse(fs.readFileSync(STATISTICS_FILE, 'utf8'));
      console.log(`Statistiques chargées depuis ${STATISTICS_FILE}`);
    } else {
      console.log(`Fichier ${STATISTICS_FILE} non trouvé, génération des statistiques...`);
      const generateStatistics = require('../analyze-school-data').generateStatistics;
      data.stats = generateStatistics(data.schools);
    }
    
    // Charger les statistiques d'email (si disponibles)
    if (fs.existsSync(EMAILS_FILE)) {
      data.emailStats = JSON.parse(fs.readFileSync(EMAILS_FILE, 'utf8'));
      console.log(`Statistiques d'email chargées depuis ${EMAILS_FILE}`);
    } else {
      console.log(`Fichier ${EMAILS_FILE} non trouvé, l'analyse des emails ne sera pas incluse.`);
    }
  } catch (error) {
    console.error('Erreur lors du chargement des données:', error.message);
    process.exit(1);
  }
  
  // Générer le rapport HTML
  console.log('Génération du rapport HTML...');
  const htmlContent = generateHtmlReport(data);
  
  // Créer le répertoire de sortie s'il n'existe pas
  if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
  }
  
  // Écrire le fichier HTML
  fs.writeFileSync(REPORT_FILE, htmlContent);
  console.log(`Rapport HTML généré avec succès: ${REPORT_FILE}`);
  
  console.log('\n=== Génération du rapport terminée ===');
  console.log(`Vous pouvez ouvrir ${REPORT_FILE} dans votre navigateur pour visualiser le rapport.`);
}

// Afficher l'aide si demandé
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage: node ${path.basename(__filename)} [options]

Options:
  --source=FILE.json   Utilise le fichier spécifié comme source (par défaut: schools_data_complete.json)
  --regenerate         Régénère les analyses avant de créer le rapport HTML
  --help, -h           Affiche cette aide
  
Description:
  Ce script génère un rapport HTML interactif avec des visualisations graphiques
  à partir des données collectées sur les écoles. Il utilise les résultats des
  analyses précédentes ou peut les régénérer si nécessaire.
  `);
  process.exit(0);
}

// Exécuter le script
if (require.main === module) {
  run().catch(err => {
    console.error('Erreur non gérée:', err);
    process.exit(1);
  });
}

module.exports = { run }; 