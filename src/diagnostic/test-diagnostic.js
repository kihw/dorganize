/**
 * SCRIPT DE TEST - Pour lancer le diagnostic des processus
 * À lancer avec: node src/diagnostic/test-diagnostic.js
 */

const ProcessDiagnostic = require('./ProcessDiagnostic');

console.log('🔍 LANCEMENT DU DIAGNOSTIC DES PROCESSUS...\n');
console.log('Assurez-vous que Dofus/Steamer/Boulonix est ouvert!\n');

ProcessDiagnostic.diagnoseAllProcesses().then(() => {
  console.log('\n✅ Diagnostic terminé!');
  console.log('\n📋 ACTIONS À FAIRE:');
  console.log('1. Cherchez dans les résultats le processus avec le titre "Boulonix - Steamer"');
  console.log('2. Notez le nom exact du processus (ProcessName)');
  console.log('3. Si trouvé, testez l\'activation avec le handle affiché');
  console.log('4. Partagez les résultats pour que je puisse corriger le code\n');
}).catch(error => {
  console.error('❌ Erreur lors du diagnostic:', error);
});
