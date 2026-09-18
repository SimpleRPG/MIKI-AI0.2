import fs from 'node:fs';
const app=fs.readFileSync('src/App.tsx','utf8');
const home=fs.readFileSync('src/components/HomeDashboard.tsx','utf8');
const lib=fs.readFileSync('src/components/LibraryHub.tsx','utf8');
const checks=[
 ['five tabs', ['ホーム','会話','改善','ライブラリ','設定'].every(x=>app.includes(`label: '${x}'`))],
 ['home route', app.includes("mobileTab === 'home'") && app.includes('<HomeDashboard')],
 ['library route', app.includes("mobileTab === 'library'") && app.includes('<LibraryHub')],
 ['workspace reachable', home.includes('onOpenWorkspace')],
 ['connections reachable', home.includes('onOpenConnections')],
 ['package library reused', lib.includes('<ReviewPackageLibrary')],
 ['memory reachable', lib.includes('onOpenMemory')],
 ['safe area bottom', app.includes('env(safe-area-inset-bottom)')],
 ['touch targets', app.includes('min-h-12') && home.includes('min-h-24')],
 ['old six tab comment removed', !app.includes('Exactly 6 tabs')],
];
let fail=0; for(const [n,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${n}`); if(!ok)fail++;} process.exit(fail?1:0);
