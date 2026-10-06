mod graph_store;
mod cognitive_graph;
mod semantic_graph;
#[path = "domains/remaining_shared.rs"]
mod remaining_shared;
#[path = "domains/promotion/mod.rs"]
mod promotion_domain;
#[path = "domains/unknown/mod.rs"]
mod unknown_domain;
#[path = "domains/research/mod.rs"]
mod research_domain;
#[path = "domains/learning/mod.rs"]
mod learning_domain;
#[path = "domains/strategy/mod.rs"]
mod strategy_domain;
#[path = "domains/capability/mod.rs"]
mod capability_domain;
#[path = "domains/improvement/mod.rs"]
mod improvement_domain;
#[path = "domains/autonomy/mod.rs"]
mod autonomy_domain;
#[path = "domains/self_awareness/mod.rs"]
mod self_awareness_domain;
#[path = "domains/experience/mod.rs"]
mod experience_domain;
#[path = "domains/safety/mod.rs"]
mod safety_domain;
#[path = "domains/conversation/mod.rs"]
mod conversation_domain;
#[path = "domains/self_development/mod.rs"]
mod self_development_domain;
#[path = "domains/memory/mod.rs"]
mod memory_domain;
#[path = "domains/execution/mod.rs"]
mod execution_domain;
#[path = "domains/data/mod.rs"]
mod data_domain;
#[path = "domains/verification/mod.rs"]
mod verification_domain;
use jni::objects::{JClass, JString};
use jni::sys::{jint, jlong, jstring};
use jni::JNIEnv;
use serde::Serialize;
use sha1::Sha1;
use sha2::{Digest, Sha256};
use std::fs::File;
use std::io::{BufRead, BufReader, Read};
use std::path::Path;
use std::ptr;
use walkdir::WalkDir;

const API_VERSION: jint = 8;
const ABI_MAGIC: jint = 0x4D49_4B49;
const HASH_BUFFER_BYTES: usize = 1024 * 1024;

#[no_mangle]
pub extern "C" fn miki_native_api_version() -> jint { API_VERSION }

#[no_mangle]
pub extern "C" fn miki_native_abi_magic() -> jint { ABI_MAGIC }

#[no_mangle]
pub extern "system" fn Java_com_miki_ai_MIKINativeCore_nativeApiVersion(
    _env: JNIEnv,
    _class: JClass,
) -> jint { miki_native_api_version() }

#[no_mangle]
pub extern "system" fn Java_com_miki_ai_MIKINativeCore_nativeAbiMagic(
    _env: JNIEnv,
    _class: JClass,
) -> jint { miki_native_abi_magic() }

#[no_mangle]
pub extern "system" fn Java_com_miki_ai_MIKINativeCore_nativeSha256File(
    mut env: JNIEnv,
    _class: JClass,
    path: JString,
) -> jstring {
    let result = (|| -> Result<String, String> {
        let path_value: String = env.get_string(&path).map_err(|error| format!("JNI_PATH:{error}"))?.into();
        let file = File::open(&path_value).map_err(|error| format!("OPEN:{error}"))?;
        let mut reader = BufReader::with_capacity(HASH_BUFFER_BYTES, file);
        let mut hasher = Sha256::new();
        let mut buffer = vec![0_u8; HASH_BUFFER_BYTES];
        loop {
            let read = reader.read(&mut buffer).map_err(|error| format!("READ:{error}"))?;
            if read == 0 { break; }
            hasher.update(&buffer[..read]);
        }
        Ok(hasher.finalize().iter().map(|byte| format!("{byte:02x}")).collect())
    })();

    match result {
        Ok(value) => env.new_string(value).map(|text| text.into_raw()).unwrap_or(ptr::null_mut()),
        Err(error) => {
            let _ = env.throw_new("java/io/IOException", format!("RUST_SHA256_FILE_FAILED:{error}"));
            ptr::null_mut()
        }
    }
}


#[derive(Serialize)]
struct SearchHit {
    path: String,
    line: usize,
    column: usize,
    preview: String,
}

fn character_window(line: &str, byte_index: usize, query: &str, radius: usize) -> (usize, String) {
    let column = line[..byte_index].chars().count() + 1;
    let query_chars = query.chars().count();
    let characters: Vec<char> = line.chars().collect();
    let match_start = column - 1;
    let start = match_start.saturating_sub(radius);
    let end = (match_start + query_chars + radius).min(characters.len());
    (column, characters[start..end].iter().collect())
}

#[no_mangle]
pub extern "system" fn Java_com_miki_ai_MIKINativeCore_nativeSearchWorkspaceText(
    mut env: JNIEnv,
    _class: JClass,
    root: JString,
    query: JString,
    limit: jint,
) -> jstring {
    let result = (|| -> Result<String, String> {
        let root_value: String = env.get_string(&root).map_err(|error| format!("JNI_ROOT:{error}"))?.into();
        let query_value: String = env.get_string(&query).map_err(|error| format!("JNI_QUERY:{error}"))?.into();
        if query_value.is_empty() || !(1..=5000).contains(&limit) {
            return Err("SEARCH_REQUEST_INVALID".to_string());
        }
        let root_path = Path::new(&root_value).canonicalize().map_err(|error| format!("ROOT:{error}"))?;
        let mut paths = Vec::new();
        for entry in WalkDir::new(&root_path).follow_links(false) {
            let entry = entry.map_err(|error| format!("WALK:{error}"))?;
            if entry.file_type().is_file() && !entry.file_type().is_symlink() {
                paths.push(entry.path().to_path_buf());
            }
        }
        paths.sort();
        let mut hits = Vec::new();
        for path in paths {
            let relative = path.strip_prefix(&root_path).map_err(|error| format!("PREFIX:{error}"))?.to_string_lossy().replace('\\', "/");
            let input = File::open(&path).map_err(|error| format!("OPEN:{error}"))?;
            let reader = BufReader::with_capacity(HASH_BUFFER_BYTES, input);
            for (index, line_result) in reader.lines().enumerate() {
                let line = match line_result {
                    Ok(value) => value,
                    Err(error) if error.kind() == std::io::ErrorKind::InvalidData => break,
                    Err(error) => return Err(format!("READ_LINE:{error}")),
                };
                if let Some(byte_index) = line.find(&query_value) {
                    let (column, preview) = character_window(&line, byte_index, &query_value, 80);
                    hits.push(SearchHit { path: relative.clone(), line: index + 1, column, preview });
                    if hits.len() >= limit as usize {
                        return serde_json::to_string(&hits).map_err(|error| format!("JSON:{error}"));
                    }
                }
            }
        }
        serde_json::to_string(&hits).map_err(|error| format!("JSON:{error}"))
    })();
    match result {
        Ok(value) => env.new_string(value).map(|text| text.into_raw()).unwrap_or(ptr::null_mut()),
        Err(error) => { let _ = env.throw_new("java/io/IOException", format!("RUST_SEARCH_TEXT_FAILED:{error}")); ptr::null_mut() }
    }
}

#[derive(Serialize)]
struct ArtifactVerification {
    byte_length: u64,
    sha256: String,
    matched: bool,
}

#[no_mangle]
pub extern "system" fn Java_com_miki_ai_MIKINativeCore_nativeVerifyArtifact(
    mut env: JNIEnv,
    _class: JClass,
    path: JString,
    expected_sha: JString,
    expected_bytes: jlong,
) -> jstring {
    let result = (|| -> Result<String, String> {
        let path_value: String = env.get_string(&path).map_err(|error| format!("JNI_PATH:{error}"))?.into();
        let expected: String = env.get_string(&expected_sha).map_err(|error| format!("JNI_SHA:{error}"))?.into();
        if expected.len() != 64 || !expected.bytes().all(|value| value.is_ascii_hexdigit() && !value.is_ascii_uppercase()) || expected_bytes < 0 {
            return Err("EXPECTATION_INVALID".to_string());
        }
        let file = File::open(&path_value).map_err(|error| format!("OPEN:{error}"))?;
        let byte_length = file.metadata().map_err(|error| format!("META:{error}"))?.len();
        let mut reader = BufReader::with_capacity(HASH_BUFFER_BYTES, file);
        let mut hasher = Sha256::new();
        let mut buffer = vec![0_u8; HASH_BUFFER_BYTES];
        loop {
            let read = reader.read(&mut buffer).map_err(|error| format!("READ:{error}"))?;
            if read == 0 { break; }
            hasher.update(&buffer[..read]);
        }
        let sha256: String = hasher.finalize().iter().map(|byte| format!("{byte:02x}")).collect();
        serde_json::to_string(&ArtifactVerification { byte_length, matched: byte_length == expected_bytes as u64 && sha256 == expected, sha256 }).map_err(|error| format!("JSON:{error}"))
    })();
    match result {
        Ok(value) => env.new_string(value).map(|text| text.into_raw()).unwrap_or(ptr::null_mut()),
        Err(error) => { let _ = env.throw_new("java/io/IOException", format!("RUST_VERIFY_ARTIFACT_FAILED:{error}")); ptr::null_mut() }
    }
}

#[derive(serde::Deserialize)]
struct RevisionEntry {
    path: String,
    sha256: String,
}

#[derive(serde::Deserialize)]
struct RevisionCompareRequest {
    baseline: Vec<RevisionEntry>,
    candidate: Vec<RevisionEntry>,
}

#[derive(Serialize)]
struct RevisionCompareReceipt {
    added: Vec<String>,
    changed: Vec<String>,
    deleted: Vec<String>,
    unchanged_count: usize,
}

#[no_mangle]
pub extern "system" fn Java_com_miki_ai_MIKINativeCore_nativeCompareRevisions(
    mut env: JNIEnv,
    _class: JClass,
    request_json: JString,
) -> jstring {
    let result = (|| -> Result<String, String> {
        let request_value: String = env.get_string(&request_json).map_err(|error| format!("JNI_REQUEST:{error}"))?.into();
        let request: RevisionCompareRequest = serde_json::from_str(&request_value).map_err(|error| format!("REQUEST_JSON:{error}"))?;
        let normalize = |rows: Vec<RevisionEntry>| -> Result<std::collections::BTreeMap<String,String>,String> {
            let mut map = std::collections::BTreeMap::new();
            for row in rows {
                if row.path.is_empty() || row.path.starts_with('/') || row.path.split('/').any(|part| part == ".." || part.is_empty()) || row.sha256.len() != 64 || !row.sha256.bytes().all(|byte| byte.is_ascii_hexdigit() && !byte.is_ascii_uppercase()) { return Err("REVISION_ENTRY_INVALID".to_string()); }
                if map.insert(row.path, row.sha256).is_some() { return Err("REVISION_PATH_DUPLICATE".to_string()); }
            }
            Ok(map)
        };
        let baseline = normalize(request.baseline)?;
        let candidate = normalize(request.candidate)?;
        let mut added=Vec::new();let mut changed=Vec::new();let mut deleted=Vec::new();let mut unchanged_count=0_usize;
        for (path,sha) in &candidate { match baseline.get(path) { None=>added.push(path.clone()),Some(previous) if previous!=sha=>changed.push(path.clone()),Some(_)=>unchanged_count+=1 } }
        for path in baseline.keys() { if !candidate.contains_key(path) { deleted.push(path.clone()); } }
        serde_json::to_string(&RevisionCompareReceipt{added,changed,deleted,unchanged_count}).map_err(|error|format!("RECEIPT_JSON:{error}"))
    })();
    match result { Ok(value)=>env.new_string(value).map(|text|text.into_raw()).unwrap_or(ptr::null_mut()),Err(error)=>{let _=env.throw_new("java/lang/IllegalArgumentException",format!("RUST_COMPARE_REVISIONS_FAILED:{error}"));ptr::null_mut()} }
}

#[derive(serde::Deserialize)]
struct ZipEntryRequest {
    source_relative_path: String,
    zip_entry_path: String,
}

#[derive(serde::Deserialize)]
struct ZipBuildRequest {
    entries: Vec<ZipEntryRequest>,
}

#[derive(Serialize)]
struct ZipBuildReceipt {
    schema_version: u32,
    file_count: usize,
    total_input_bytes: u64,
    output_bytes: u64,
    entries: Vec<String>,
}

#[no_mangle]
pub extern "system" fn Java_com_miki_ai_MIKINativeCore_nativeBuildZip(
    mut env: JNIEnv,
    _class: JClass,
    workspace_root: JString,
    output_path: JString,
    request_json: JString,
) -> jstring {
    let result = (|| -> Result<String, String> {
        let root_value: String = env.get_string(&workspace_root).map_err(|error| format!("JNI_ROOT:{error}"))?.into();
        let output_value: String = env.get_string(&output_path).map_err(|error| format!("JNI_OUTPUT:{error}"))?.into();
        let request_value: String = env.get_string(&request_json).map_err(|error| format!("JNI_REQUEST:{error}"))?.into();
        let root = Path::new(&root_value).canonicalize().map_err(|error| format!("ROOT:{error}"))?;
        let output = Path::new(&output_value);
        let request: ZipBuildRequest = serde_json::from_str(&request_value).map_err(|error| format!("REQUEST_JSON:{error}"))?;
        if request.entries.is_empty() || request.entries.len() > 5000 { return Err("ZIP_ENTRY_COUNT_INVALID".to_string()); }
        if let Some(parent) = output.parent() { std::fs::create_dir_all(parent).map_err(|error| format!("MKDIR:{error}"))?; }
        let temporary = output.with_extension("zip.miki-tmp");
        let file = File::create(&temporary).map_err(|error| format!("CREATE_TEMP:{error}"))?;
        let mut writer = zip::ZipWriter::new(std::io::BufWriter::with_capacity(HASH_BUFFER_BYTES, file));
        let options = zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated).unix_permissions(0o644);
        let mut entries = request.entries;
        entries.sort_by(|left, right| left.zip_entry_path.cmp(&right.zip_entry_path));
        let mut observed = std::collections::HashSet::new();
        let mut total_input_bytes = 0_u64;
        let mut names = Vec::new();
        for entry in entries {
            if entry.source_relative_path.is_empty() || entry.zip_entry_path.is_empty() || entry.zip_entry_path.starts_with('/') || entry.zip_entry_path.split('/').any(|part| part == ".." || part.is_empty()) { return Err("ZIP_ENTRY_PATH_INVALID".to_string()); }
            if !observed.insert(entry.zip_entry_path.clone()) { return Err("ZIP_ENTRY_DUPLICATE".to_string()); }
            let source = root.join(&entry.source_relative_path).canonicalize().map_err(|error| format!("SOURCE:{error}"))?;
            if !source.starts_with(&root) || !source.is_file() { return Err("ZIP_SOURCE_OUTSIDE_WORKSPACE".to_string()); }
            let mut input = BufReader::with_capacity(HASH_BUFFER_BYTES, File::open(&source).map_err(|error| format!("OPEN:{error}"))?);
            total_input_bytes = total_input_bytes.saturating_add(source.metadata().map_err(|error| format!("META:{error}"))?.len());
            writer.start_file(&entry.zip_entry_path, options).map_err(|error| format!("START_ENTRY:{error}"))?;
            std::io::copy(&mut input, &mut writer).map_err(|error| format!("ZIP_COPY:{error}"))?;
            names.push(entry.zip_entry_path);
        }
        let output_writer = writer.finish().map_err(|error| format!("ZIP_FINISH:{error}"))?;
        use std::io::Write;
        let output_file = output_writer.into_inner().map_err(|error| format!("BUFFER_FINISH:{error}"))?;
        output_file.sync_all().map_err(|error| format!("SYNC:{error}"))?;
        std::fs::rename(&temporary, output).map_err(|error| format!("RENAME:{error}"))?;
        let output_bytes = output.metadata().map_err(|error| format!("OUTPUT_META:{error}"))?.len();
        serde_json::to_string(&ZipBuildReceipt { schema_version: 1, file_count: names.len(), total_input_bytes, output_bytes, entries: names }).map_err(|error| format!("RECEIPT_JSON:{error}"))
    })();
    match result {
        Ok(value) => env.new_string(value).map(|text| text.into_raw()).unwrap_or(ptr::null_mut()),
        Err(error) => { let _ = env.throw_new("java/io/IOException", format!("RUST_BUILD_ZIP_FAILED:{error}")); ptr::null_mut() }
    }
}

#[no_mangle]
pub extern "system" fn Java_com_miki_ai_MIKINativeCore_nativeCopyFile(
    mut env: JNIEnv,
    _class: JClass,
    source: JString,
    destination: JString,
) -> jstring {
    let result = (|| -> Result<String, String> {
        let source_value: String = env.get_string(&source).map_err(|error| format!("JNI_SOURCE:{error}"))?.into();
        let destination_value: String = env.get_string(&destination).map_err(|error| format!("JNI_DESTINATION:{error}"))?.into();
        let source_path = Path::new(&source_value);
        let destination_path = Path::new(&destination_value);
        if !source_path.is_file() { return Err("SOURCE_NOT_FILE".to_string()); }
        if let Some(parent) = destination_path.parent() { std::fs::create_dir_all(parent).map_err(|error| format!("MKDIR:{error}"))?; }
        let mut input = BufReader::with_capacity(HASH_BUFFER_BYTES, File::open(source_path).map_err(|error| format!("OPEN_SOURCE:{error}"))?);
        let temporary = destination_path.with_extension(format!("{}.miki-tmp", destination_path.extension().and_then(|value| value.to_str()).unwrap_or("file")));
        let mut output = std::io::BufWriter::with_capacity(HASH_BUFFER_BYTES, File::create(&temporary).map_err(|error| format!("CREATE_TEMP:{error}"))?);
        std::io::copy(&mut input, &mut output).map_err(|error| format!("COPY:{error}"))?;
        use std::io::Write;
        output.flush().map_err(|error| format!("FLUSH:{error}"))?;
        output.get_ref().sync_all().map_err(|error| format!("SYNC:{error}"))?;
        std::fs::rename(&temporary, destination_path).map_err(|error| format!("RENAME:{error}"))?;
        Ok(destination_path.metadata().map_err(|error| format!("META:{error}"))?.len().to_string())
    })();
    match result {
        Ok(value) => env.new_string(value).map(|text| text.into_raw()).unwrap_or(ptr::null_mut()),
        Err(error) => { let _ = env.throw_new("java/io/IOException", format!("RUST_COPY_FILE_FAILED:{error}")); ptr::null_mut() }
    }
}

#[no_mangle]
pub extern "system" fn Java_com_miki_ai_MIKINativeCore_nativeGitBlobSha1File(
    mut env: JNIEnv,
    _class: JClass,
    path: JString,
) -> jstring {
    let result = (|| -> Result<String, String> {
        let path_value: String = env.get_string(&path).map_err(|error| format!("JNI_PATH:{error}"))?.into();
        let metadata = std::fs::metadata(&path_value).map_err(|error| format!("META:{error}"))?;
        if !metadata.is_file() { return Err("TARGET_NOT_FILE".to_string()); }
        let file = File::open(&path_value).map_err(|error| format!("OPEN:{error}"))?;
        let mut reader = BufReader::with_capacity(HASH_BUFFER_BYTES, file);
        let mut hasher = Sha1::new();
        hasher.update(format!("blob {}\0", metadata.len()).as_bytes());
        let mut buffer = vec![0_u8; HASH_BUFFER_BYTES];
        loop {
            let read = reader.read(&mut buffer).map_err(|error| format!("READ:{error}"))?;
            if read == 0 { break; }
            hasher.update(&buffer[..read]);
        }
        Ok(hasher.finalize().iter().map(|byte| format!("{byte:02x}")).collect())
    })();
    match result {
        Ok(value) => env.new_string(value).map(|text| text.into_raw()).unwrap_or(ptr::null_mut()),
        Err(error) => { let _ = env.throw_new("java/io/IOException", format!("RUST_GIT_BLOB_SHA1_FAILED:{error}")); ptr::null_mut() }
    }
}

#[derive(Serialize)]
struct ScanEntry {
    path: String,
    byte_length: u64,
}

#[derive(Serialize)]
struct ScanReceipt {
    schema_version: u32,
    file_count: usize,
    total_bytes: u64,
    files: Vec<ScanEntry>,
}

#[no_mangle]
pub extern "system" fn Java_com_miki_ai_MIKINativeCore_nativeScanWorkspace(
    mut env: JNIEnv,
    _class: JClass,
    root: JString,
) -> jstring {
    let result = (|| -> Result<String, String> {
        let root_value: String = env.get_string(&root).map_err(|error| format!("JNI_ROOT:{error}"))?.into();
        let root_path = Path::new(&root_value).canonicalize().map_err(|error| format!("ROOT:{error}"))?;
        let mut files = Vec::new();
        let mut total_bytes = 0_u64;
        for entry in WalkDir::new(&root_path).follow_links(false).into_iter() {
            let entry = entry.map_err(|error| format!("WALK:{error}"))?;
            if entry.file_type().is_symlink() || !entry.file_type().is_file() { continue; }
            let relative = entry.path().strip_prefix(&root_path).map_err(|error| format!("PREFIX:{error}"))?;
            let relative_text = relative.to_string_lossy().replace('\\', "/");
            if relative_text.is_empty() { continue; }
            let byte_length = entry.metadata().map_err(|error| format!("META:{error}"))?.len();
            total_bytes = total_bytes.saturating_add(byte_length);
            files.push(ScanEntry { path: relative_text, byte_length });
        }
        files.sort_by(|left, right| left.path.cmp(&right.path));
        serde_json::to_string(&ScanReceipt { schema_version: 1, file_count: files.len(), total_bytes, files }).map_err(|error| format!("JSON:{error}"))
    })();
    match result {
        Ok(value) => env.new_string(value).map(|text| text.into_raw()).unwrap_or(ptr::null_mut()),
        Err(error) => { let _ = env.throw_new("java/io/IOException", format!("RUST_SCAN_WORKSPACE_FAILED:{error}")); ptr::null_mut() }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn stable_api_contract() {
        assert_eq!(miki_native_api_version(), 8);
        assert_eq!(miki_native_abi_magic(), 0x4D49_4B49);
    }
}

#[derive(serde::Deserialize)]
struct CoreGoalInput { id:String, goal:String, priority:f64, foreground:bool, safety_required:bool, permission_granted:bool, deadline_at:Option<u64>, depends_on:Vec<String>, conflicts_with:Vec<String>, status:String }
#[derive(serde::Deserialize)] struct CoreDecisionRequest { now:u64, goals:Vec<CoreGoalInput> }
#[derive(Serialize)] struct CoreGoalDecisionRow { goal_id:String, action:&'static str, reason:String, comparison_key:String }
#[derive(Serialize)] struct CoreDecisionResult { selected_goal_id:String, selected_goal:String, conflict_detected:bool, paused_goal_ids:Vec<String>, blocked_goal_ids:Vec<String>, decisions:Vec<CoreGoalDecisionRow>, engine:&'static str, api_version:i32 }
fn core_decide_json(source:&str)->Result<String,String>{
 let request:CoreDecisionRequest=serde_json::from_str(source).map_err(|e|format!("CORE_DECISION_JSON:{e}"))?;
 if request.goals.is_empty()||request.goals.len()>10_000{return Err("CORE_GOAL_COUNT_INVALID".into())}
 let completed:std::collections::HashSet<String>=request.goals.iter().filter(|g|g.status=="COMPLETED").map(|g|g.id.clone()).collect();
 let mut blocked=Vec::new();let mut actionable:Vec<&CoreGoalInput>=Vec::new();
 for goal in &request.goals { if goal.status=="COMPLETED"||goal.status=="CANCELLED"{continue} if !goal.permission_granted || goal.depends_on.iter().any(|id|!completed.contains(id)){blocked.push(goal.id.clone())}else{actionable.push(goal)} }
 if actionable.is_empty(){return Err("CORE_NO_ACTIONABLE_GOAL".into())}
 actionable.sort_by(|a,b|{let a_deadline=a.deadline_at.unwrap_or(u64::MAX);let b_deadline=b.deadline_at.unwrap_or(u64::MAX);b.safety_required.cmp(&a.safety_required).then_with(||b.foreground.cmp(&a.foreground)).then_with(||b.priority.partial_cmp(&a.priority).unwrap_or(std::cmp::Ordering::Equal)).then_with(||a_deadline.cmp(&b_deadline)).then_with(||a.id.cmp(&b.id))});
 let selected=actionable[0];let conflict_ids:std::collections::HashSet<String>=selected.conflicts_with.iter().cloned().collect();let mut paused=Vec::new();let mut decisions=Vec::new();
 for goal in &request.goals {let action=if goal.id==selected.id{"SELECT"}else if blocked.contains(&goal.id){"BLOCK"}else if conflict_ids.contains(&goal.id)||goal.conflicts_with.contains(&selected.id){paused.push(goal.id.clone());"PAUSE"}else{"WAIT"};decisions.push(CoreGoalDecisionRow{goal_id:goal.id.clone(),action,reason:match action{"SELECT"=>"highest deterministic rank","BLOCK"=>"permission or dependency unsatisfied","PAUSE"=>"conflicts with selected goal",_=>"lower deterministic rank"}.into(),comparison_key:format!("{}|{}|{:020.6}|{:020}|{}",if goal.safety_required{1}else{0},if goal.foreground{1}else{0},goal.priority,goal.deadline_at.unwrap_or(u64::MAX),goal.id)});}
 let conflict_detected=request.goals.len()>1||!blocked.is_empty()||!paused.is_empty();
 serde_json::to_string(&CoreDecisionResult{selected_goal_id:selected.id.clone(),selected_goal:selected.goal.clone(),conflict_detected,paused_goal_ids:paused,blocked_goal_ids:blocked,decisions,engine:"RUST",api_version:API_VERSION}).map_err(|e|format!("CORE_DECISION_RESULT:{e}"))
}
#[no_mangle] pub extern "system" fn Java_com_miki_ai_MIKINativeCore_nativeDecideCoreGoals(mut env:JNIEnv,_class:JClass,request:JString)->jstring{let result=(||->Result<String,String>{let value:String=env.get_string(&request).map_err(|e|format!("JNI_CORE_DECISION:{e}"))?.into();core_decide_json(&value)})();let value=match result{Ok(v)=>v,Err(e)=>format!("ERROR:{e}")};env.new_string(value).map(|s|s.into_raw()).unwrap_or(ptr::null_mut())}

#[derive(serde::Deserialize)] struct DomainRouteInput { target:String, command:String, reason:String, priority:Option<i64>, dedupe_key:Option<String> }
#[derive(serde::Deserialize)] struct DomainRouteRequest { routes:Vec<DomainRouteInput> }
#[derive(Serialize)] struct DomainRouteOutput { selected_indexes:Vec<usize>, participating_domains:Vec<String>, skipped_duplicate_indexes:Vec<usize>, engine:&'static str, api_version:i32 }
fn domain_order(domain:&str)->usize{match domain{"autonomy"=>1,"capability"=>2,"conversation"=>3,"data"=>4,"execution"=>5,"experience"=>6,"improvement"=>7,"learning"=>8,"memory"=>9,"promotion"=>10,"research"=>11,"safety"=>12,"selfAwareness"=>13,"selfDevelopment"=>14,"strategy"=>15,"unknown"=>16,"verification"=>17,_=>usize::MAX}}
fn rank_domain_routes_json(source:&str)->Result<String,String>{let request:DomainRouteRequest=serde_json::from_str(source).map_err(|e|format!("DOMAIN_ROUTE_JSON:{e}"))?;if request.routes.len()>10000{return Err("DOMAIN_ROUTE_COUNT_INVALID".into())}let mut indexed:Vec<(usize,&DomainRouteInput)>=request.routes.iter().enumerate().collect();for(_,route)in&indexed{if domain_order(&route.target)==usize::MAX{return Err(format!("UNKNOWN_WORKER_DOMAIN:{}",route.target))}if route.command.trim().is_empty(){return Err("DOMAIN_ROUTE_COMMAND_REQUIRED".into())}}indexed.sort_by(|(ai,a),(bi,b)|{b.priority.unwrap_or(0).cmp(&a.priority.unwrap_or(0)).then_with(||domain_order(&a.target).cmp(&domain_order(&b.target))).then_with(||a.command.cmp(&b.command)).then_with(||a.reason.cmp(&b.reason)).then_with(||ai.cmp(bi))});let mut selected=Vec::new();let mut skipped=Vec::new();let mut seen=std::collections::HashSet::new();let mut domains=Vec::new();for(index,route)in indexed{let key=route.dedupe_key.clone().unwrap_or_else(||format!("{}:{}",route.target,route.command));if seen.insert(key){selected.push(index);if !domains.contains(&route.target){domains.push(route.target.clone())}}else{skipped.push(index)}}Ok(serde_json::to_string(&DomainRouteOutput{selected_indexes:selected,participating_domains:domains,skipped_duplicate_indexes:skipped,engine:"RUST",api_version:API_VERSION}).map_err(|e|format!("DOMAIN_ROUTE_RESULT:{e}"))?)}
#[no_mangle] pub extern "system" fn Java_com_miki_ai_MIKINativeCore_nativeRankDomainRoutes(mut env:JNIEnv,_class:JClass,request:JString)->jstring{let result=(||->Result<String,String>{let value:String=env.get_string(&request).map_err(|e|format!("JNI_DOMAIN_ROUTE:{e}"))?.into();rank_domain_routes_json(&value)})();let value=match result{Ok(v)=>v,Err(e)=>format!("ERROR:{e}")};env.new_string(value).map(|s|s.into_raw()).unwrap_or(ptr::null_mut())}

#[no_mangle]
pub extern "system" fn Java_com_miki_ai_MIKINativeCore_nativeVerifyVbaCode(mut env:JNIEnv,_class:JClass,request:JString)->jstring{let result=(||->Result<String,String>{let value:String=env.get_string(&request).map_err(|e|format!("JNI_VBA_VERIFY:{e}"))?.into();verification_domain::verify_json(&value)})();let value=match result{Ok(v)=>v,Err(e)=>format!("ERROR:{e}")};env.new_string(value).map(|s|s.into_raw()).unwrap_or(ptr::null_mut())}

#[no_mangle]
pub extern "system" fn Java_com_miki_ai_MIKINativeCore_nativeProcessDataRecords(mut env:JNIEnv,_class:JClass,request:JString)->jstring{let result=(||->Result<String,String>{let value:String=env.get_string(&request).map_err(|e|format!("JNI_DATA_PROCESS:{e}"))?.into();data_domain::process_json(&value)})();let value=match result{Ok(v)=>v,Err(e)=>format!("ERROR:{e}")};env.new_string(value).map(|s|s.into_raw()).unwrap_or(ptr::null_mut())}

#[no_mangle]
pub extern "system" fn Java_com_miki_ai_MIKINativeCore_nativePlanExecution(mut env:JNIEnv,_class:JClass,request:JString)->jstring{let result=(||->Result<String,String>{let value:String=env.get_string(&request).map_err(|e|format!("JNI_EXECUTION_PLAN:{e}"))?.into();execution_domain::plan_json(&value)})();let value=match result{Ok(v)=>v,Err(e)=>format!("ERROR:{e}")};env.new_string(value).map(|s|s.into_raw()).unwrap_or(ptr::null_mut())}

#[no_mangle]
pub extern "system" fn Java_com_miki_ai_MIKINativeCore_nativeSearchMemory(mut env:JNIEnv,_class:JClass,request:JString)->jstring{let result=(||->Result<String,String>{let value:String=env.get_string(&request).map_err(|e|format!("JNI_MEMORY_SEARCH:{e}"))?.into();memory_domain::search_json(&value)})();let value=match result{Ok(v)=>v,Err(e)=>format!("ERROR:{e}")};env.new_string(value).map(|s|s.into_raw()).unwrap_or(ptr::null_mut())}

#[no_mangle]
pub extern "system" fn Java_com_miki_ai_MIKINativeCore_nativeAnalyzeCandidate(mut env:JNIEnv,_class:JClass,request:JString)->jstring{let result=(||->Result<String,String>{let value:String=env.get_string(&request).map_err(|e|format!("JNI_SELF_DEVELOPMENT:{e}"))?.into();self_development_domain::analyze_json(&value)})();let value=match result{Ok(v)=>v,Err(e)=>format!("ERROR:{e}")};env.new_string(value).map(|s|s.into_raw()).unwrap_or(ptr::null_mut())}

#[no_mangle]
pub extern "system" fn Java_com_miki_ai_MIKINativeCore_nativeAnalyzeOwnedDomain(mut env:JNIEnv,_class:JClass,domain:JString,request:JString)->jstring{let result=(||->Result<String,String>{let d:String=env.get_string(&domain).map_err(|e|format!("JNI_DOMAIN:{e}"))?.into();let v:String=env.get_string(&request).map_err(|e|format!("JNI_REQUEST:{e}"))?.into();match d.as_str(){"promotion"=>promotion_domain::analyze_json(&v),"unknown"=>unknown_domain::analyze_json(&v),"research"=>research_domain::analyze_json(&v),"learning"=>learning_domain::analyze_json(&v),"strategy"=>strategy_domain::analyze_json(&v),"capability"=>capability_domain::analyze_json(&v),"improvement"=>improvement_domain::analyze_json(&v),"autonomy"=>autonomy_domain::analyze_json(&v),"selfAwareness"=>self_awareness_domain::analyze_json(&v),"experience"=>experience_domain::analyze_json(&v),"safety"=>safety_domain::analyze_json(&v),"conversation"=>conversation_domain::analyze_json(&v),_=>Err("UNKNOWN_OWNED_DOMAIN".into())}})();let value=match result{Ok(v)=>v,Err(e)=>format!("ERROR:{e}")};env.new_string(value).map(|s|s.into_raw()).unwrap_or(ptr::null_mut())}

#[no_mangle]
pub extern "C" fn miki_cognitive_graph_api_version() -> jint { 1 }

pub fn miki_cognitive_graph_context_json(input: &str) -> Result<String, String> {
    cognitive_graph::build_context_json(input)
}

pub fn miki_cognitive_graph_startup_recovery(manifest_ok: bool, native_ok: bool) -> String {
    serde_json::to_string(&cognitive_graph::startup_recovery(manifest_ok, native_ok)).unwrap_or_else(|_| "{\"mode\":\"LIMITED\"}".to_string())
}

pub fn miki_graph_store_commit_json(root: &str, input: &str) -> Result<String, String> { graph_store::commit_json(root,input) }

#[no_mangle]
pub extern "system" fn Java_com_miki_ai_MIKINativeCore_nativeGraphStoreCommit(mut env: JNIEnv, _class: JClass, root: JString, payload: JString) -> jstring {
    let result = (|| -> Result<String, String> {
        let root_value: String = env.get_string(&root).map_err(|e| format!("JNI_GRAPH_ROOT:{e}"))?.into();
        let payload_value: String = env.get_string(&payload).map_err(|e| format!("JNI_GRAPH_PAYLOAD:{e}"))?.into();
        graph_store::commit_json(&root_value, &payload_value)
    })();
    let value = match result { Ok(v) => v, Err(e) => format!("ERROR:{e}") };
    env.new_string(value).map(|s| s.into_raw()).unwrap_or(ptr::null_mut())
}
