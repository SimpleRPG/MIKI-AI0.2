use crate::remaining_shared;
pub fn analyze_json(source:&str)->Result<String,String>{remaining_shared::analyze("safety",&["rule_match","prohibition","permission_gate","path_safety","operation_risk","confirmation_required"],source)}
