use crate::remaining_shared;
pub fn analyze_json(source:&str)->Result<String,String>{remaining_shared::analyze("improvement",&["before_after_compare","effect_measure","regression_diff","candidate_rank","plateau_detect","stop_condition"],source)}
