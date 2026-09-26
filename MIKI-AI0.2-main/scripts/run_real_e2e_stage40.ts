import { realE2EProofSuiteService } from '../src/miki/selfDevelopment/services/realE2EProofSuiteService';
const result=await realE2EProofSuiteService.run();console.log(JSON.stringify(result,null,2));if(!result.passed)process.exit(1);
