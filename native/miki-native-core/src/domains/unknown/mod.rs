use crate::remaining_shared;
pub fn analyze_json(source:&str)->Result<String,String>{remaining_shared::analyze("unknown",&["unknown_term_extract","abbreviation_split","candidate_generate","particle_split","candidate_rank","confidence","known_conflict"],source)}
