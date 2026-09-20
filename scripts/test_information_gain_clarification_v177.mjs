import fs from 'node:fs';
const conv=fs.readFileSync('src/miki/conversation/services/conversationStateService.ts','utf8');
const core=fs.readFileSync('src/miki/safety/services/nonLlmCoreService.ts','utf8');
const checks={function:conv.includes('selectInformationGainQuestion'),entropy:conv.includes('informationGainBits')&&conv.includes('Math.log2'),twoChoice:conv.includes('二択は1問'),split:conv.includes('最も均等に分割'),coreUses:core.includes('selectInformationGainQuestion(anaphora.candidates)'),questionForwarded:core.includes('nextActions: [clarification.question]')};
console.log(JSON.stringify({version:'v177',checks},null,2));if(!Object.values(checks).every(Boolean))process.exit(1);
