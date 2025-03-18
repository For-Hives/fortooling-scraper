#!/usr/bin/env node

/**
 * Script pour générer un rapport HTML détaillé des écoles classées par secteur
 * Utilise les données du fichier schools_by_sector.json
 */

const fs = require('fs');
const path = require('path');

// Dossiers de données
const DATA_DIR = path.join(__dirname, '..', 'data');
const REPORTS_DIR = path.join(__dirname, '..', 'reports');
const SOURCE_FILE = path.join(DATA_DIR, 'schools_by_sector.json');
const OUTPUT_FILE = path.join(REPORTS_DIR, 'sector-report.html');

// Assurer que le dossier de rapports existe
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

/**
 * Génère le rapport HTML
 */
async function generateReport() {
  console.log('=== Génération du rapport par secteur ===');
  console.log('Date de début:', new Date().toLocaleString());
  console.log('------------------------------------');
  
  // Vérifier que le fichier source existe
  if (!fs.existsSync(SOURCE_FILE)) {
    console.error(`Erreur: Fichier source non trouvé: ${SOURCE_FILE}`);
    console.error('Veuillez d\'abord exécuter le script de traitement par secteur.');
    process.exit(1);
  }
  
  try {
    // Lire les données classées par secteur
    const schoolsBySector = JSON.parse(fs.readFileSync(SOURCE_FILE, 'utf8'));
    console.log(`Lecture des données de ${Object.keys(schoolsBySector).length} secteurs`);
    
    // Générer le contenu HTML
    const htmlContent = generateHtmlContent(schoolsBySector);
    console.log('Contenu HTML généré');
    
    // Écrire le fichier HTML
    fs.writeFileSync(OUTPUT_FILE, htmlContent);
    console.log(`Rapport HTML enregistré dans ${OUTPUT_FILE}`);
    
    console.log('------------------------------------');
    console.log('Date de fin:', new Date().toLocaleString());
    console.log('=== Génération terminée ===');
    
  } catch (error) {
    console.error('Erreur lors de la génération du rapport:', error);
    process.exit(1);
  }
}

/**
 * Génère le contenu HTML du rapport
 * @param {Object} schoolsBySector - Données des écoles classées par secteur
 * @returns {string} Contenu HTML
 */
function generateHtmlContent(schoolsBySector) {
  // Compter le nombre total d'écoles
  let totalSchools = 0;
  Object.values(schoolsBySector).forEach(schools => {
    totalSchools += schools.length;
  });
  
  // Trier les secteurs par nombre d'écoles (décroissant)
  const sortedSectors = Object.entries(schoolsBySector)
    .sort((a, b) => b[1].length - a[1].length);
  
  // Générer le contenu HTML
  let html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rapport des Écoles par Secteur</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    h1, h2, h3 {
      color: #2c3e50;
    }
    .header {
      background-color: #f8f9fa;
      padding: 20px;
      border-radius: 5px;
      margin-bottom: 30px;
      border-left: 5px solid #3498db;
    }
    .summary {
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      margin-bottom: 30px;
    }
    .summary-card {
      background-color: #fff;
      border-radius: 5px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
      padding: 15px;
      margin-bottom: 15px;
      width: calc(33% - 20px);
    }
    .sector-section {
      margin-bottom: 40px;
      background-color: #fff;
      border-radius: 5px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    .sector-header {
      background-color: #e9ecef;
      padding: 15px;
      border-bottom: 1px solid #dee2e6;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .sector-content {
      padding: 0 15px;
    }
    .school-card {
      border-bottom: 1px solid #eee;
      padding: 15px 0;
      display: flex;
      flex-wrap: wrap;
    }
    .school-card:last-child {
      border-bottom: none;
    }
    .school-info {
      flex: 2;
      min-width: 300px;
    }
    .school-contact {
      flex: 1;
      min-width: 200px;
    }
    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 3px;
      background-color: #3498db;
      color: white;
      font-size: 14px;
    }
    .pie-chart-container {
      width: 100%;
      max-width: 600px;
      margin: 20px auto;
    }
    .search-container {
      margin-bottom: 20px;
    }
    #searchInput {
      width: 100%;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 5px;
      font-size: 16px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 8px 12px;
      text-align: left;
    }
    th {
      background-color: #f2f2f2;
    }
    tr:nth-child(even) {
      background-color: #f9f9f9;
    }
    a {
      color: #3498db;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    .stats-container {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
    }
    .stat-box {
      background-color: #f8f9fa;
      border-radius: 5px;
      padding: 15px;
      margin-bottom: 15px;
      width: calc(25% - 15px);
      box-shadow: 0 2px 5px rgba(0,0,0,0.05);
      text-align: center;
    }
    .stat-box h3 {
      margin: 0;
      color: #3498db;
      font-size: 24px;
    }
    .stat-box p {
      margin: 5px 0 0;
      color: #7f8c8d;
    }
    @media (max-width: 768px) {
      .summary-card, .stat-box {
        width: 100%;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Rapport des Écoles par Secteur</h1>
    <p>Date de génération: ${new Date().toLocaleString()}</p>
  </div>
  
  <div class="stats-container">
    <div class="stat-box">
      <h3>${totalSchools}</h3>
      <p>Écoles au total</p>
    </div>
    <div class="stat-box">
      <h3>${Object.keys(schoolsBySector).length}</h3>
      <p>Secteurs différents</p>
    </div>
    <div class="stat-box">
      <h3>${sortedSectors[0][0]}</h3>
      <p>Secteur principal</p>
    </div>
    <div class="stat-box">
      <h3>${Math.round(sortedSectors[0][1].length / totalSchools * 100)}%</h3>
      <p>des écoles dans le secteur principal</p>
    </div>
  </div>
  
  <div class="search-container">
    <input type="text" id="searchInput" placeholder="Rechercher une école par nom, ville ou secteur...">
  </div>
  
  <div class="pie-chart-container">
    <canvas id="sectorChart"></canvas>
  </div>
  
  <div id="sectorList">
`;
  
  // Générer le contenu pour chaque secteur
  sortedSectors.forEach(([sector, schools]) => {
    const percentage = Math.round((schools.length / totalSchools) * 100);
    
    html += `
    <div class="sector-section" data-sector="${sector}">
      <div class="sector-header">
        <h2>${sector}</h2>
        <div><span class="badge">${schools.length} écoles</span> <span>${percentage}% du total</span></div>
      </div>
      <div class="sector-content">
        <table>
          <thead>
            <tr>
              <th>Nom de l'école</th>
              <th>Ville</th>
              <th>Email</th>
              <th>Téléphone</th>
              <th>Site Web</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    // Ajouter chaque école
    schools.forEach(school => {
      html += `
            <tr class="school-row" data-name="${school.name}" data-city="${school.city}" data-sector="${school.sector}">
              <td>${school.name}</td>
              <td>${school.city || '-'}</td>
              <td>${school.email_found ? `<a href="mailto:${school.email}">${school.email}</a>` : '-'}</td>
              <td>${school.phone_found ? `<a href="tel:${school.phone}">${school.phone}</a>` : '-'}</td>
              <td>${school.website_found ? `<a href="${school.website}" target="_blank">Visiter le site</a>` : '-'}</td>
            </tr>
      `;
    });
    
    html += `
          </tbody>
        </table>
      </div>
    </div>
    `;
  });
  
  // Fermer les balises HTML et ajouter le JavaScript pour la recherche et le graphique
  html += `
  </div>
  
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script>
    // Fonctionnalité de recherche
    document.getElementById('searchInput').addEventListener('input', function(e) {
      const searchTerm = e.target.value.toLowerCase();
      const rows = document.querySelectorAll('.school-row');
      
      rows.forEach(row => {
        const name = row.getAttribute('data-name').toLowerCase();
        const city = row.getAttribute('data-city').toLowerCase();
        const sector = row.getAttribute('data-sector').toLowerCase();
        
        if (name.includes(searchTerm) || city.includes(searchTerm) || sector.includes(searchTerm)) {
          row.style.display = '';
        } else {
          row.style.display = 'none';
        }
      });
      
      // Afficher/masquer les sections selon si elles ont des écoles visibles
      document.querySelectorAll('.sector-section').forEach(section => {
        const visibleRows = section.querySelectorAll('.school-row[style=""]').length;
        section.style.display = visibleRows > 0 ? '' : 'none';
      });
    });
    
    // Graphique en camembert des secteurs
    const ctx = document.getElementById('sectorChart').getContext('2d');
    
    // Préparer les données
    const sectorData = ${JSON.stringify(sortedSectors.map(([sector, schools]) => ({
      sector,
      count: schools.length
    })))};
    
    // Regrouper les petits secteurs en "Autres" pour lisibilité
    const threshold = Math.ceil(${totalSchools} * 0.02); // 2% du total
    const mainSectors = [];
    let othersCount = 0;
    
    sectorData.forEach(item => {
      if (item.count >= threshold) {
        mainSectors.push(item);
      } else {
        othersCount += item.count;
      }
    });
    
    if (othersCount > 0) {
      mainSectors.push({ sector: 'Autres secteurs', count: othersCount });
    }
    
    // Générer des couleurs
    function generateColors(count) {
      const colors = [];
      const baseColors = [
        '#3498db', '#2ecc71', '#e74c3c', '#f39c12', '#9b59b6',
        '#1abc9c', '#d35400', '#34495e', '#16a085', '#c0392b',
        '#27ae60', '#2980b9', '#8e44ad', '#f1c40f', '#e67e22'
      ];
      
      for (let i = 0; i < count; i++) {
        colors.push(baseColors[i % baseColors.length]);
      }
      
      return colors;
    }
    
    // Créer le graphique
    const chart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: mainSectors.map(item => item.sector),
        datasets: [{
          data: mainSectors.map(item => item.count),
          backgroundColor: generateColors(mainSectors.length),
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'right',
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const value = context.raw;
                const total = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                const percentage = Math.round((value / total) * 100);
                return \`\${context.label}: \${value} écoles (\${percentage}%)\`;
              }
            }
          }
        }
      }
    });
  </script>
</body>
</html>
`;

  return html;
}

// Exécuter le script
if (require.main === module) {
  generateReport().catch(err => {
    console.error('Erreur fatale:', err);
    process.exit(1);
  });
}

module.exports = { generateReport }; 