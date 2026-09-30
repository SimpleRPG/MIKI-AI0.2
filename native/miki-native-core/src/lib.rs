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
