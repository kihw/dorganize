#!/usr/bin/env python3
"""
Script de renommage automatique du projet Dofus Organizer vers Dorganize
Version 0.4.0
"""

import os
import re
import json
import subprocess
import sys
from pathlib import Path

# Configuration des remplacements
REPLACEMENTS = {
    # Noms complets
    "Dofus Organizer": "Dorganize",
    "dofus-organizer": "dorganize",
    "dofus_organizer": "dorganize",
    "DOFUS_ORGANIZER": "DORGANIZE",
    "DofusOrganizer": "Dorganize",
    
    # Descriptions et textes
    "A modern cross-platform Dofus Window Organizer": "A modern cross-platform window organizer for Dofus",
    "Window organizer for Dofus multi-accounting": "Window organizer for Dofus multi-accounting",
    "Dofus Organizer Team": "Dorganize Team",
    "support@dofus-organizer.com": "support@dorganize.com",
    
    # IDs et identifiants
    "com.dofus.organizer": "com.dorganize.app",
    "StartupWMClass\": \"dofus-organizer\"": "StartupWMClass\": \"dorganize\"",
    
    # Chemins et URLs
    "https://github.com/kihw/organizer": "https://github.com/kihw/dorganize",
    "organizer.git": "dorganize.git",
    "organizer/issues": "dorganize/issues",
    
    # Fichiers et assets
    "organizer.ico": "dorganize.ico",
    "organizer.png": "dorganize.png", 
    "organizer.icns": "dorganize.icns",
}

# Extensions de fichiers à traiter
FILE_EXTENSIONS = ['.js', '.json', '.md', '.txt', '.html', '.css', '.yml', '.yaml', '.xml', '.desktop', '.nsi']

# Fichiers et dossiers à ignorer
IGNORE_PATTERNS = [
    'node_modules',
    '.git',
    'dist',
    'build',
    '__pycache__',
    '.electron-builder',
    '*.log',
    'rename_to_dorganize.py'
]

def should_ignore(path):
    """Vérifie si un fichier/dossier doit être ignoré"""
    path_str = str(path)
    for pattern in IGNORE_PATTERNS:
        if pattern in path_str:
            return True
    return False

def replace_in_file(file_path, replacements):
    """Remplace les occurrences dans un fichier"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        
        # Appliquer tous les remplacements
        for old, new in replacements.items():
            content = content.replace(old, new)
        
        # Sauvegarder seulement si des changements ont été faits
        if content != original_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"✓ Modifié: {file_path}")
            return True
        
    except Exception as e:
        print(f"✗ Erreur avec {file_path}: {e}")
        return False
    
    return False

def update_package_json_version(file_path):
    """Met à jour la version dans package.json vers 0.4.0"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        data['version'] = '0.4.0'
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        print(f"✓ Version mise à jour vers 0.4.0 dans {file_path}")
        return True
        
    except Exception as e:
        print(f"✗ Erreur lors de la mise à jour de la version: {e}")
        return False

def rename_files_and_folders():
    """Renomme les fichiers et dossiers contenant l'ancien nom"""
    root_path = Path('.')
    renamed_items = []
    
    # Chercher les fichiers à renommer
    for item in root_path.rglob('*'):
        if should_ignore(item):
            continue
            
        old_name = item.name
        new_name = old_name
        
        # Appliquer les remplacements au nom
        for old, new in REPLACEMENTS.items():
            if old in old_name:
                new_name = new_name.replace(old, new)
        
        if new_name != old_name:
            new_path = item.parent / new_name
            try:
                item.rename(new_path)
                renamed_items.append((str(item), str(new_path)))
                print(f"✓ Renommé: {item} → {new_path}")
            except Exception as e:
                print(f"✗ Erreur lors du renommage de {item}: {e}")
    
    return renamed_items

def process_files():
    """Traite tous les fichiers pour remplacer les occurrences"""
    root_path = Path('.')
    modified_files = []
    
    for file_path in root_path.rglob('*'):
        if file_path.is_file() and not should_ignore(file_path):
            if file_path.suffix in FILE_EXTENSIONS or file_path.name in ['LICENSE', 'README']:
                if replace_in_file(file_path, REPLACEMENTS):
                    modified_files.append(str(file_path))
    
    return modified_files

def git_operations():
    """Effectue les opérations Git"""
    try:
        # Vérifier si on est dans un repo Git
        result = subprocess.run(['git', 'status'], capture_output=True, text=True)
        if result.returncode != 0:
            print("⚠ Pas de repository Git détecté")
            return False
        
        print("\n📁 Opérations Git:")
        
        # Ajouter tous les changements
        subprocess.run(['git', 'add', '.'], check=True)
        print("✓ Fichiers ajoutés à Git")
        
        # Commit avec message
        commit_message = "feat: rename project to Dorganize v0.4.0\n\n- Updated all references from 'Dofus Organizer' to 'Dorganize'\n- Bumped version to 0.4.0\n- Updated package.json, documentation and asset references"
        subprocess.run(['git', 'commit', '-m', commit_message], check=True)
        print("✓ Commit créé")
        
        # Créer un tag pour la version
        subprocess.run(['git', 'tag', 'v0.4.0'], check=True)
        print("✓ Tag v0.4.0 créé")
        
        # Push avec tags
        subprocess.run(['git', 'push'], check=True)
        subprocess.run(['git', 'push', '--tags'], check=True)
        print("✓ Push effectué avec les tags")
        
        return True
        
    except subprocess.CalledProcessError as e:
        print(f"✗ Erreur Git: {e}")
        return False
    except FileNotFoundError:
        print("✗ Git n'est pas installé ou pas dans le PATH")
        return False

def main():
    """Fonction principale"""
    print("🚀 Début du renommage de 'Dofus Organizer' vers 'Dorganize'")
    print("=" * 60)
    
    # 1. Traiter les fichiers
    print("\n📝 Traitement des fichiers:")
    modified_files = process_files()
    
    # 2. Mettre à jour la version dans package.json
    package_json_path = Path('package.json')
    if package_json_path.exists():
        update_package_json_version(package_json_path)
    
    # 3. Renommer les fichiers et dossiers
    print("\n📁 Renommage des fichiers et dossiers:")
    renamed_items = rename_files_and_folders()
    
    # 4. Résumé
    print("\n" + "=" * 60)
    print("📊 RÉSUMÉ:")
    print(f"✓ {len(modified_files)} fichiers modifiés")
    print(f"✓ {len(renamed_items)} éléments renommés")
    print("✓ Version mise à jour vers 0.4.0")
    
    if modified_files:
        print("\nFichiers modifiés:")
        for file in modified_files[:10]:  # Afficher les 10 premiers
            print(f"  - {file}")
        if len(modified_files) > 10:
            print(f"  ... et {len(modified_files) - 10} autres")
    
    if renamed_items:
        print("\nÉléments renommés:")
        for old, new in renamed_items:
            print(f"  - {old} → {new}")
    
    # 5. Opérations Git
    print("\n🔄 Voulez-vous effectuer les opérations Git (add, commit, push) ? (y/N): ", end="")
    response = input().strip().lower()
    
    if response in ['y', 'yes', 'o', 'oui']:
        git_operations()
    else:
        print("⚠ Opérations Git ignorées. Vous pouvez les faire manuellement:")
        print("  git add .")
        print("  git commit -m 'feat: rename project to Dorganize v0.4.0'")
        print("  git tag v0.4.0")
        print("  git push && git push --tags")
    
    print("\n🎉 Renommage terminé! Le projet s'appelle maintenant 'Dorganize' v0.4.0")

if __name__ == "__main__":
    main()