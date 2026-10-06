use crate::remaining_shared;
pub fn analyze_json(source:&str)->Result<String,String>{remaining_shared::analyze("conversation",&["morpheme_candidate","negation","quantity","causality","coreference","multi_sentence_context","history_index"],source)}
