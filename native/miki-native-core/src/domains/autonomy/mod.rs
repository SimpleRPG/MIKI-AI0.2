use crate::remaining_shared;
pub fn analyze_json(source:&str)->Result<String,String>{remaining_shared::analyze("autonomy",&["goal_compare","deadline","conflict","stop_condition","continue_condition","user_intervention"],source)}
