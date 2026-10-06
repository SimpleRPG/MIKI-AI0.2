use crate::remaining_shared;
pub fn analyze_json(source:&str)->Result<String,String>{remaining_shared::analyze("experience",&["success_rate","failure_rate","frequency","history_pattern","similar_experience","recurrence_risk"],source)}
