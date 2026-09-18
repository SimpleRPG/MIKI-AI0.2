import fs from 'node:fs';
const modal=fs.readFileSync('src/components/SelfImprovementModal.tsx','utf8');
const settings=fs.readFileSync('src/components/self_improvement/AutonomousImprovementSettingsPanel.tsx','utf8');
const search=fs.readFileSync('src/components/self_improvement/AutonomousSearchTab.tsx','utf8');
const home=fs.readFileSync('src/components/AutonomousImprovementHome.tsx','utf8');
const checks={settingsTab:modal.includes("setActiveTab('autonomous_settings')")&&modal.includes("activeTab === 'autonomous_settings' && <AutonomousImprovementSettingsPanel />"),searchTab:modal.includes("activeTab === 'autonomous_search' && <AutonomousSearchTab />"),typedImprovement:settings.includes('startSpecifiedImprovement')&&settings.includes('discoverImprovementTarget'),noLegacyImprovement:!settings.includes('initializeImprovementRuntime')&&!settings.includes('submitImprovementRequest'),searxngUrl:search.includes('handleSaveSearxngUrl')&&search.includes('saveSearxngUrl'),searxngSearch:search.includes('executeSearch')&&search.includes("setPreferredProvider('searxng')"),contentDisplay:search.includes('searchOutput.summary')&&search.includes('searchOutput.results.map'),noDuplicatePanel:!home.includes('SelfImprovementSearxngPanel')&&!fs.existsSync('src/components/SelfImprovementSearxngPanel.tsx')};
for(const [name,ok] of Object.entries(checks))console.log(`${ok?'PASS':'FAIL'} ${name}`);
if(Object.values(checks).some(ok=>!ok))process.exit(1);
