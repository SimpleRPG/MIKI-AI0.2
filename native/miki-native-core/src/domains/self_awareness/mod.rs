use crate::remaining_shared;
pub fn analyze_json(source:&str)->Result<String,String>{remaining_shared::analyze("selfAwareness",&["state_summary","capability_boundary","contradiction","unverified_capability","current_constraint","self_assessment_hash"],source)}
