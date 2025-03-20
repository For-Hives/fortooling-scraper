#!/bin/bash

# Script pour exécuter toute la chaîne de traitement des emails
# De l'extraction à la préparation pour Odoo

# Couleurs pour les messages
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonction pour afficher un message d'en-tête
header() {
  echo -e "\n${BLUE}======================================================${NC}"
  echo -e "${BLUE}  $1${NC}"
  echo -e "${BLUE}======================================================${NC}"
}

# Fonction pour afficher un message de succès
success() {
  echo -e "${GREEN}✓ $1${NC}"
}

# Fonction pour afficher un message d'erreur
error() {
  echo -e "${RED}✗ $1${NC}"
  exit 1
}

# Fonction pour afficher un message d'information
info() {
  echo -e "${YELLOW}→ $1${NC}"
}

# Vérifier que tous les scripts nécessaires existent
check_scripts() {
  header "Vérification des scripts nécessaires"
  
  if [ ! -f "scripts/extract-schools-with-emails.js" ]; then
    error "Le script extract-schools-with-emails.js n'existe pas"
  fi
  
  if [ ! -f "scripts/export-emails-to-odoo.js" ]; then
    error "Le script export-emails-to-odoo.js n'existe pas"
  fi
  
  if [ ! -f "scripts/create-odoo-import-guide.js" ]; then
    error "Le script create-odoo-import-guide.js n'existe pas"
  fi
  
  # Vérifier que les scripts sont exécutables
  chmod +x scripts/extract-schools-with-emails.js
  chmod +x scripts/export-emails-to-odoo.js
  chmod +x scripts/create-odoo-import-guide.js
  
  success "Tous les scripts nécessaires sont disponibles"
}

# Vérifier que le fichier source existe
check_source_file() {
  header "Vérification du fichier source"
  
  SOURCE_FILE="${1:-data/schools_data_complete.json}"
  
  if [ ! -f "$SOURCE_FILE" ]; then
    error "Le fichier source $SOURCE_FILE n'existe pas"
  fi
  
  success "Fichier source $SOURCE_FILE trouvé"
  echo "$SOURCE_FILE"
}

# Extraire les écoles avec emails
extract_schools_with_emails() {
  header "Extraction des écoles avec emails"
  
  SOURCE_FILE="$1"
  INCLUDE_DETAILS="$2"
  
  # Extraire le nom de fichier sans le chemin
  FILENAME=$(basename "$SOURCE_FILE")
  
  CMD="./scripts/extract-schools-with-emails.js --source=$FILENAME"
  
  if [ "$INCLUDE_DETAILS" = "true" ]; then
    CMD="$CMD --include-details"
  fi
  
  info "Exécution de: $CMD"
  
  $CMD || error "Erreur lors de l'extraction des écoles avec emails"
  
  success "Extraction des écoles avec emails terminée"
}

# Exporter vers Odoo
export_to_odoo() {
  header "Exportation vers Odoo"
  
  ./scripts/export-emails-to-odoo.js || error "Erreur lors de l'exportation vers Odoo"
  
  success "Exportation vers Odoo terminée"
}

# Créer le guide d'importation
create_import_guide() {
  header "Création du guide d'importation"
  
  ./scripts/create-odoo-import-guide.js || error "Erreur lors de la création du guide d'importation"
  
  success "Guide d'importation créé"
}

# Afficher un résumé
show_summary() {
  header "Résumé de l'exécution"
  
  echo -e "${GREEN}Le traitement est terminé avec succès!${NC}"
  echo -e "Fichiers générés:"
  echo -e "  - ${YELLOW}data/emails/schools_with_emails.json${NC} (Liste complète des écoles avec emails)"
  echo -e "  - ${YELLOW}data/emails/schools_with_emails.csv${NC} (Format CSV des écoles avec emails)"
  echo -e "  - ${YELLOW}data/emails/by_sector/${NC} (Écoles organisées par secteur)"
  echo -e "  - ${YELLOW}data/odoo/emails/odoo_schools_with_emails.csv${NC} (Format Odoo)"
  echo -e "  - ${YELLOW}data/odoo/emails/by_sector/${NC} (Format Odoo par secteur)"
  echo -e "  - ${YELLOW}data/odoo/emails/guide_importation_odoo.html${NC} (Guide d'importation HTML)"
  
  echo -e "\n${BLUE}Pour importer dans Odoo:${NC}"
  echo -e "  1. Ouvrez le guide d'importation HTML dans votre navigateur"
  echo -e "  2. Suivez les instructions détaillées pour l'importation"
  
  echo -e "\n${GREEN}Traitement terminé à $(date)${NC}"
}

# Afficher l'aide
show_help() {
  echo -e "Utilisation: $0 [options]"
  echo -e ""
  echo -e "Options:"
  echo -e "  --source=FILE      Spécifier le fichier source (par défaut: data/schools_data_complete.json)"
  echo -e "  --include-details  Inclure tous les détails des écoles (téléphone, site web, etc.)"
  echo -e "  --help             Afficher cette aide"
  echo -e ""
  echo -e "Description:"
  echo -e "  Ce script exécute la chaîne complète de traitement pour extraire les écoles"
  echo -e "  avec des emails et les préparer pour l'importation dans Odoo."
  echo -e ""
  echo -e "Étapes exécutées:"
  echo -e "  1. Extraction des écoles avec emails"
  echo -e "  2. Exportation au format compatible avec Odoo"
  echo -e "  3. Génération d'un guide d'importation HTML"
  echo -e ""
  exit 0
}

# Fonction principale
main() {
  # Analyser les arguments
  SOURCE_FILE="data/schools_data_complete.json"
  INCLUDE_DETAILS="false"
  
  for arg in "$@"; do
    case $arg in
      --source=*)
        SOURCE_FILE="${arg#*=}"
        ;;
      --include-details)
        INCLUDE_DETAILS="true"
        ;;
      --help)
        show_help
        ;;
    esac
  done
  
  # Afficher l'en-tête
  header "Chaîne de traitement pour l'extraction des emails"
  echo -e "Date: $(date)"
  echo -e "Source: $SOURCE_FILE"
  echo -e "Détails inclus: $INCLUDE_DETAILS"
  
  # Vérifier les prérequis
  check_scripts
  SOURCE_FILE=$(check_source_file "$SOURCE_FILE")
  
  # Exécuter les étapes
  extract_schools_with_emails "$SOURCE_FILE" "$INCLUDE_DETAILS"
  export_to_odoo
  create_import_guide
  
  # Afficher le résumé
  show_summary
}

# Exécuter le script
main "$@" 