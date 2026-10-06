use crate::remaining_shared;
pub fn analyze_json(source:&str)->Result<String,String>{remaining_shared::analyze("research",&["candidate_merge","evidence_deduplicate","evidence_score","counterevidence_classify","missing_information","research_hash"],source)}
