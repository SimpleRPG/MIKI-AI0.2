use serde::{Deserialize,Serialize};use serde_json::Value;use sha2::{Digest,Sha256};use std::collections::{BTreeMap,BTreeSet};
#[derive(Deserialize)]pub struct Request{#[serde(default)]pub items:Vec<Value>,#[serde(default)]pub baseline:Vec<Value>,#[serde(default)]pub context:Value,#[serde(default)]pub required:Vec<String>,#[serde(default)]pub receipts:Vec<String>}
#[derive(Serialize)]pub struct ResultData{pub domain:String,pub features:BTreeMap<String,Value>,pub issues:Vec<String>,pub result_sha256:String,pub engine:&'static str,pub owner_domain:String,pub receipt_version:u32}
fn hash(v:&Value)->String{Sha256::digest(serde_json::to_vec(v).unwrap_or_default()).iter().map(|b|format!("{b:02x}")).collect()}
pub fn analyze(domain:&str,features:&[&str],source:&str)->Result<String,String>{let r:Request=serde_json::from_str(source).map_err(|e|format!("DOMAIN_REQUEST_JSON:{e}"))?;if r.items.len()>500000{return Err("DOMAIN_ITEM_LIMIT".into())}let current:BTreeSet<_>=r.items.iter().map(hash).collect();let base:BTreeSet<_>=r.baseline.iter().map(hash).collect();let mut out=BTreeMap::new();let item_count=r.items.len();for(name)in features{let score=if item_count==0{0.0}else{((*name).bytes().map(|b|b as usize).sum::<usize>()%100)as f64/100.0};out.insert((*name).into(),serde_json::json!({"score":score,"count":item_count,"added":current.difference(&base).count(),"removed":base.difference(&current).count()}));}let available:BTreeSet<_>=r.receipts.into_iter().collect();let issues=r.required.into_iter().filter(|x|!available.contains(x)).map(|x|format!("REQUIRED_EVIDENCE_MISSING:{x}")).collect::<Vec<_>>();let canonical=serde_json::json!({"domain":domain,"features":out,"issues":issues,"context":r.context});let result=ResultData{domain:domain.into(),features:out,issues,result_sha256:hash(&canonical),engine:"RUST",owner_domain:domain.into(),receipt_version:1};serde_json::to_string(&result).map_err(|e|format!("DOMAIN_RESULT_JSON:{e}"))}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn owned_domain_result_is_deterministic() {
        let input=r#"{"items":[{"id":1}],"baseline":[],"context":{},"required":[],"receipts":[]}"#;
        let first=analyze("promotion", &["manifest_check"], input).unwrap();
        let second=analyze("promotion", &["manifest_check"], input).unwrap();
        assert_eq!(first,second);
        assert!(first.contains("\"owner_domain\":\"promotion\""));
    }
    #[test]
    fn required_evidence_is_reported() {
        let input=r#"{"items":[],"baseline":[],"context":{},"required":["R1"],"receipts":[]}"#;
        let result=analyze("safety", &["rule_match"], input).unwrap();
        assert!(result.contains("REQUIRED_EVIDENCE_MISSING:R1"));
    }
}
