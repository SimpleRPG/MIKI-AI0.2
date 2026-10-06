use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet};

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct GraphNode { pub node_id:String, pub semantic_kind:String, pub owner_domain:String, pub participant_domains:Vec<String>, pub subject_id:String, pub confidence:f64, pub uncertainty:f64 }
#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct GraphEdge { pub edge_id:String, pub from:String, pub to:String, pub edge_type:String, pub confidence:f64 }
#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct GraphRequest { pub task_id:String, pub seed_node_ids:Vec<String>, pub nodes:Vec<GraphNode>, pub edges:Vec<GraphEdge>, pub max_nodes:usize }
#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct GraphContext { pub task_id:String, pub node_ids:Vec<String>, pub semantic_index:BTreeMap<String,Vec<String>>, pub subjects:Vec<String>, pub bounded:bool, pub receipt_sha256:String }
#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct RecoveryDecision { pub mode:String, pub render_shell_immediately:bool, pub load_manifest_only:bool, pub quarantine_corrupt_shard:bool, pub allow_limited_mode:bool }

fn sha(value:&serde_json::Value)->String { Sha256::digest(serde_json::to_vec(value).unwrap_or_default()).iter().map(|b|format!("{b:02x}")).collect() }
pub fn build_context_json(input:&str)->Result<String,String>{let request:GraphRequest=serde_json::from_str(input).map_err(|e|format!("GRAPH_REQUEST_JSON:{e}"))?;let by_id:BTreeMap<_,_>=request.nodes.iter().map(|n|(n.node_id.clone(),n)).collect();let mut selected:BTreeSet<String>=request.seed_node_ids.iter().filter(|id|by_id.contains_key(*id)).cloned().collect();
let mut frontier:Vec<String>=selected.iter().cloned().collect();while let Some(id)=frontier.pop(){if selected.len()>=request.max_nodes{break;}for e in &request.edges{let next=if e.from==id{Some(&e.to)}else if e.to==id{Some(&e.from)}else{None};if let Some(next)=next{if by_id.contains_key(next)&&selected.insert(next.clone()){frontier.push(next.clone());if selected.len()>=request.max_nodes{break;}}}}}let mut semantic_index:BTreeMap<String,Vec<String>>=BTreeMap::new();let mut subjects=BTreeSet::new();for id in &selected{if let Some(n)=by_id.get(id){semantic_index.entry(n.semantic_kind.clone()).or_default().push(id.clone());subjects.insert(n.subject_id.clone());}}let node_ids:Vec<String>=selected.into_iter().collect();let seed=serde_json::json!({"task_id":request.task_id,"node_ids":node_ids,"semantic_index":semantic_index,"subjects":subjects,"bounded":true});let result=GraphContext{task_id:request.task_id,node_ids,semantic_index,subjects:subjects.into_iter().collect(),bounded:true,receipt_sha256:sha(&seed)};serde_json::to_string(&result).map_err(|e|format!("GRAPH_CONTEXT_JSON:{e}"))}
pub fn startup_recovery(manifest_ok:bool,native_ok:bool)->RecoveryDecision{RecoveryDecision{mode:if manifest_ok&&native_ok{"FULL".into()}else{"LIMITED".into()},render_shell_immediately:true,load_manifest_only:true,quarantine_corrupt_shard:!manifest_ok,allow_limited_mode:true}}
#[cfg(test)] mod tests{use super::*;#[test]fn bounded_context(){let input=r#"{"task_id":"t","seed_node_ids":["a"],"nodes":[{"node_id":"a","semantic_kind":"MEMORY","owner_domain":"memory","participant_domains":["conversation"],"subject_id":"s","confidence":1.0,"uncertainty":0.0},{"node_id":"b","semantic_kind":"EXPERIENCE","owner_domain":"experience","participant_domains":["memory"],"subject_id":"s","confidence":0.9,"uncertainty":0.1}],"edges":[{"edge_id":"e","from":"a","to":"b","edge_type":"RELATES","confidence":1.0}],"max_nodes":2}"#;let out=build_context_json(input).unwrap();let c:GraphContext=serde_json::from_str(&out).unwrap();assert_eq!(c.node_ids.len(),2);assert!(c.bounded);assert_eq!(c.receipt_sha256.len(),64);}#[test]fn startup_never_blocks_shell(){let d=startup_recovery(false,false);assert!(d.render_shell_immediately);assert!(d.allow_limited_mode);assert_eq!(d.mode,"LIMITED");}}
