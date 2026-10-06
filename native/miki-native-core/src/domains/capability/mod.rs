use crate::remaining_shared;
pub fn analyze_json(source:&str)->Result<String,String>{remaining_shared::analyze("capability",&["component_index","compatibility","dependency","duplicate_capability","capability_gap","adoption_rank"],source)}
