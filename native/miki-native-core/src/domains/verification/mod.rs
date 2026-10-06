use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet};

#[derive(Deserialize)]
pub struct VbaVerificationRequest {
    pub code: String,
    #[serde(default)]
    pub delivery_mode: Option<String>,
    #[serde(default)]
    pub baseline_code: Option<String>,
    #[serde(default)]
    pub expected_code_sha256: Option<String>,
    #[serde(default)]
    pub expected_code_length: Option<usize>,
    #[serde(default)]
    pub expected_code_line_count: Option<usize>,
}

#[derive(Serialize)]
pub struct VbaProcedure {
    pub name: String,
    pub kind: String,
    pub visibility: String,
    pub start_line: usize,
    pub end_line: Option<usize>,
    pub signature: String,
}

#[derive(Serialize)]
pub struct VbaIssue {
    pub code: &'static str,
    pub line: usize,
    pub detail: String,
}

#[derive(Serialize)]
pub struct VbaDependencies {
    pub worksheets: Vec<String>,
    pub ranges: Vec<String>,
    pub external_calls: Vec<String>,
    pub api_declarations: Vec<String>,
}

#[derive(Serialize)]
pub struct VbaSignatureDifference { pub procedure:String, pub code:&'static str, pub baseline:String, pub candidate:Option<String> }

#[derive(Serialize)]
pub struct VbaDeliveryChecks {
    pub mode: String,
    pub code_region_count: usize,
    pub has_management_tags: bool,
    pub has_hash_metadata: bool,
    pub begins_with_option_explicit: bool,
    pub code_only: bool,
}

#[derive(Serialize)]
pub struct VbaVerificationResult {
    pub passed: bool,
    pub line_count: usize,
    pub sha256: String,
    pub option_explicit: bool,
    pub procedures: Vec<VbaProcedure>,
    pub issues: Vec<VbaIssue>,
    pub block_balance: BTreeMap<String, i64>,
    pub dependencies: VbaDependencies,
    pub delivery: VbaDeliveryChecks,
    pub engine: &'static str,
    pub owner_domain: &'static str,
    pub receipt_version: u32,
    pub signature_differences: Vec<VbaSignatureDifference>,
    pub duplicate_procedures: Vec<String>,
    pub declared_identifiers: Vec<String>,
    pub undeclared_candidates: Vec<String>,
    pub dependency_differences: Vec<String>,
    pub analyzed_region: String,
}

#[derive(Clone)]
struct LogicalLine {
    start_line: usize,
    text: String,
}

fn mask_vba_line(source: &str) -> String {
    let mut output = String::with_capacity(source.len());
    let mut in_string = false;
    let chars: Vec<char> = source.chars().collect();
    let mut index = 0;
    while index < chars.len() {
        let ch = chars[index];
        if ch == '"' {
            if in_string && index + 1 < chars.len() && chars[index + 1] == '"' {
                output.push(' ');
                output.push(' ');
                index += 2;
                continue;
            }
            in_string = !in_string;
            output.push(' ');
            index += 1;
            continue;
        }
        if ch == '\'' && !in_string {
            break;
        }
        output.push(if in_string { ' ' } else { ch });
        index += 1;
    }
    output
}

fn logical_lines(source: &str) -> Vec<LogicalLine> {
    let mut output = Vec::new();
    let mut current = String::new();
    let mut start_line = 1;
    for (index, raw) in source.lines().enumerate() {
        let line_no = index + 1;
        let masked = mask_vba_line(raw);
        let trimmed = masked.trim_end();
        if current.is_empty() {
            start_line = line_no;
        }
        let continued = trimmed.ends_with(" _");
        let fragment = if continued {
            trimmed.trim_end_matches(" _").trim_end()
        } else {
            trimmed
        };
        if !current.is_empty() {
            current.push(' ');
        }
        current.push_str(fragment);
        if !continued {
            output.push(LogicalLine {
                start_line,
                text: current.trim().to_string(),
            });
            current.clear();
        }
    }
    if !current.is_empty() {
        output.push(LogicalLine {
            start_line,
            text: current.trim().to_string(),
        });
    }
    output
}

fn is_label(line: &str) -> bool {
    let value = line.trim();
    if !value.ends_with(':') {
        return false;
    }
    let name = value.trim_end_matches(':').trim();
    !name.is_empty()
        && name
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || character == '_')
}

fn is_single_line_if(line: &str) -> bool {
    let lower = line.trim().to_ascii_lowercase();
    lower.starts_with("if ")
        && lower.contains(" then ")
        && !lower.ends_with(" then")
        && !lower.starts_with("#if")
}

fn quoted_arguments(source: &str) -> Vec<String> {
    let mut values = Vec::new();
    let chars: Vec<char> = source.chars().collect();
    let mut index = 0;
    while index < chars.len() {
        if chars[index] != '"' {
            index += 1;
            continue;
        }
        index += 1;
        let mut value = String::new();
        while index < chars.len() {
            if chars[index] == '"' {
                if index + 1 < chars.len() && chars[index + 1] == '"' {
                    value.push('"');
                    index += 2;
                    continue;
                }
                break;
            }
            value.push(chars[index]);
            index += 1;
        }
        values.push(value);
        index += 1;
    }
    values
}

fn procedure_declaration(text: &str) -> Option<(String, String, String, String)> {
    let lower = text.to_ascii_lowercase();
    if lower.starts_with("end ") {
        return None;
    }
    let tokens: Vec<&str> = text.split_whitespace().collect();
    let position = tokens.iter().position(|token| {
        matches!(
            token.to_ascii_lowercase().as_str(),
            "sub" | "function" | "property"
        )
    })?;
    if position + 1 >= tokens.len() {
        return None;
    }
    let kind = if tokens[position].eq_ignore_ascii_case("property") && position + 1 < tokens.len() {
        let accessor = tokens[position + 1].to_ascii_uppercase();
        if matches!(accessor.as_str(), "GET" | "LET" | "SET") {
            format!("PROPERTY_{accessor}")
        } else {
            "PROPERTY".to_string()
        }
    } else {
        tokens[position].to_ascii_uppercase()
    };
    let name_position = if kind.starts_with("PROPERTY_") {
        position + 2
    } else {
        position + 1
    };
    if name_position >= tokens.len() {
        return None;
    }
    let name = tokens[name_position]
        .split('(')
        .next()
        .unwrap_or("")
        .trim()
        .to_string();
    if name.is_empty() {
        return None;
    }
    let visibility = if lower.starts_with("public ") {
        "PUBLIC"
    } else if lower.starts_with("private ") {
        "PRIVATE"
    } else if lower.starts_with("friend ") {
        "FRIEND"
    } else {
        "DEFAULT"
    };
    Some((name, kind, visibility.to_string(), text.trim().to_string()))
}

fn push_block(stack: &mut Vec<(String, usize)>, balances: &mut BTreeMap<String, i64>, kind: &str, line: usize) {
    stack.push((kind.to_string(), line));
    *balances.entry(kind.to_string()).or_insert(0) += 1;
}

fn close_block(
    stack: &mut Vec<(String, usize)>,
    balances: &mut BTreeMap<String, i64>,
    issues: &mut Vec<VbaIssue>,
    expected: &str,
    line: usize,
    detail: &str,
) {
    match stack.pop() {
        Some((kind, _)) if kind == expected => {
            *balances.entry(expected.to_string()).or_insert(0) -= 1;
        }
        Some((kind, start)) => {
            issues.push(VbaIssue {
                code: "BLOCK_NESTING_MISMATCH",
                line,
                detail: format!("expected {expected}, found {kind} opened at line {start}: {detail}"),
            });
        }
        None => issues.push(VbaIssue {
            code: "ORPHAN_BLOCK_END",
            line,
            detail: detail.to_string(),
        }),
    }
}

fn delivery_checks(code: &str, mode: &str, option_explicit: bool, issues: &mut Vec<VbaIssue>) -> VbaDeliveryChecks {
    let upper = code.to_ascii_uppercase();
    let code_open_count = upper.matches("[CODE]").count();
    let code_close_count = upper.matches("[/CODE]").count();
    let code_region_count = code_open_count.min(code_close_count);
    let has_management_tags = ["[DELIVERY]", "[/DELIVERY]", "[CODE]", "[/CODE]", "[VALIDATION]", "[/VALIDATION]"]
        .iter()
        .any(|tag| upper.contains(tag));
    let has_hash_metadata = upper.contains("CODE_SHA256") || upper.contains("FILE_SHA256");
    let first_code_line = code
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .unwrap_or("");
    let begins_with_option_explicit = first_code_line.eq_ignore_ascii_case("Option Explicit");
    let normalized_mode = mode.to_ascii_uppercase();
    let code_only = !has_management_tags && !has_hash_metadata && begins_with_option_explicit;

    if normalized_mode == "VBE_CODE_ONLY" {
        if has_management_tags {
            issues.push(VbaIssue { code: "VBE_MANAGEMENT_TAG_FORBIDDEN", line: 1, detail: "VBE code-only delivery contains management tags".into() });
        }
        if has_hash_metadata {
            issues.push(VbaIssue { code: "VBE_HASH_METADATA_FORBIDDEN", line: 1, detail: "VBE code-only delivery contains hash metadata".into() });
        }
        if !begins_with_option_explicit {
            issues.push(VbaIssue { code: "VBE_OPTION_EXPLICIT_NOT_FIRST", line: 1, detail: "VBE code-only delivery must begin with Option Explicit".into() });
        }
    } else if normalized_mode == "AUTO_APPLY" {
        if code_open_count != 1 || code_close_count != 1 {
            issues.push(VbaIssue { code: "AUTO_APPLY_CODE_REGION_INVALID", line: 1, detail: format!("[CODE]={code_open_count}, [/CODE]={code_close_count}") });
        }
        if !upper.contains("DELIVERY_TYPE=FULL_MODULE") {
            issues.push(VbaIssue { code: "AUTO_APPLY_FULL_MODULE_REQUIRED", line: 1, detail: "DELIVERY_TYPE=FULL_MODULE is required".into() });
        }
    }

    if !option_explicit {
        issues.push(VbaIssue { code: "OPTION_EXPLICIT_MISSING", line: 1, detail: "Option Explicit is required".into() });
    }

    VbaDeliveryChecks {
        mode: normalized_mode,
        code_region_count,
        has_management_tags,
        has_hash_metadata,
        begins_with_option_explicit,
        code_only,
    }
}

fn extract_code_region(source:&str)->Result<String,String>{let upper=source.to_ascii_uppercase();let open:Vec<usize>=upper.match_indices("[CODE]").map(|(i,_)|i).collect();let close:Vec<usize>=upper.match_indices("[/CODE]").map(|(i,_)|i).collect();if open.len()!=1||close.len()!=1||close[0]<=open[0]{return Err("AUTO_APPLY_CODE_REGION_INVALID".into())}let start=open[0]+"[CODE]".len();Ok(source[start..close[0]].trim_matches(|c|c=='\r'||c=='\n').to_string())}
fn identifier_tokens(text:&str)->Vec<String>{text.split(|c:char|!(c.is_ascii_alphanumeric()||c=='_')).filter(|v|!v.is_empty()).map(str::to_string).collect()}
fn declaration_index(code:&str,procedures:&[VbaProcedure])->BTreeSet<String>{let mut declared=BTreeSet::new();for procedure in procedures{declared.insert(procedure.name.to_ascii_lowercase());let signature=&procedure.signature;if let(Some(start),Some(end))=(signature.find('('),signature.rfind(')')){for part in signature[start+1..end].split(','){let tokens=identifier_tokens(part);for token in tokens{let lower=token.to_ascii_lowercase();if !matches!(lower.as_str(),"byval"|"byref"|"optional"|"paramarray"|"as"|"new"){declared.insert(lower);break}}}}}for line in logical_lines(code){let lower=line.text.to_ascii_lowercase();let start=lower.trim_start();let declaration=starts_with_any(start,&["dim ","const ","static ","private ","public ","global "]);if declaration{let body=start.split_once(' ').map(|(_,v)|v).unwrap_or("");for part in body.split(','){let tokens=identifier_tokens(part);if let Some(token)=tokens.first(){let l=token.to_ascii_lowercase();if !matches!(l.as_str(),"sub"|"function"|"property"|"declare"|"type"|"enum"){declared.insert(l);}}}}}declared}
fn starts_with_any(text:&str,values:&[&str])->bool{values.iter().any(|value|text.starts_with(value))}
fn undeclared_candidates(code:&str,declared:&BTreeSet<String>)->BTreeSet<String>{let keywords:BTreeSet<&str>=["option","explicit","public","private","friend","sub","function","property","get","let","set","end","if","then","else","elseif","select","case","for","each","next","do","loop","while","wend","with","dim","const","static","as","byval","byref","optional","true","false","nothing","new","on","error","resume","exit","call","and","or","not","mod","to","step","is","like","me","application","worksheet","workbook","range","cells","long","string","boolean","integer","double","single","variant","object","date","byte","currency","longptr","longlong"].into_iter().collect();let mut used=BTreeSet::new();for line in logical_lines(code){let lower=line.text.to_ascii_lowercase();if starts_with_any(lower.trim_start(),&["option ","attribute ","declare ","' "]){continue}for token in identifier_tokens(&lower){if token.len()<2||token.chars().next().map(|c|c.is_ascii_digit()).unwrap_or(true)||keywords.contains(token.as_str())||declared.contains(&token){continue}if line.text.contains(&format!(".{token}")){continue}used.insert(token);}}used}
fn dependency_set(code:&str)->BTreeSet<String>{let mut out=BTreeSet::new();for line in logical_lines(code){let lower=line.text.to_ascii_lowercase();if lower.contains("worksheets(")||lower.contains("sheets(")||lower.contains("range(")||lower.contains("createobject(")||lower.contains("getobject(")||lower.contains("declare "){out.insert(line.text);}}out}
fn dependency_diff(baseline:&str,candidate:&str)->Vec<String>{let base=dependency_set(baseline);let current=dependency_set(candidate);let mut result=Vec::new();for value in base.difference(&current){result.push(format!("REMOVED:{value}"));}for value in current.difference(&base){result.push(format!("ADDED:{value}"));}result}
fn api_compatibility_issues(code:&str)->Vec<VbaIssue>{let mut issues=Vec::new();for line in logical_lines(code){let lower=line.text.to_ascii_lowercase();if lower.contains(" declare ")||lower.starts_with("declare "){if !lower.contains("ptrsafe"){issues.push(VbaIssue{code:"PTRSAFE_MISSING",line:line.start_line,detail:line.text.clone()});}if lower.contains(" as long")&&contains_pointer_hint(&lower)&&!lower.contains("longptr"){issues.push(VbaIssue{code:"POINTER_LONGPTR_REQUIRED",line:line.start_line,detail:line.text.clone()});}}}issues}
fn contains_pointer_hint(text:&str)->bool{[" hwnd"," handle"," pointer"," ptr"," callback"," address"," lparam"," wparam"].iter().any(|value|text.contains(value))}

fn public_signature_map(code:&str)->BTreeMap<String,String>{let mut result=BTreeMap::new();for line in logical_lines(code){if let Some((name,_kind,visibility,signature))=procedure_declaration(&line.text){if visibility=="PUBLIC"||visibility=="DEFAULT"{result.insert(name.to_ascii_lowercase(),signature);}}}result}
fn normalize_signature(value:&str)->String{value.split_whitespace().collect::<Vec<_>>().join(" ").to_ascii_lowercase()}

pub fn verify_json(source: &str) -> Result<String, String> {
    let request: VbaVerificationRequest =
        serde_json::from_str(source).map_err(|error| format!("VBA_REQUEST_JSON:{error}"))?;
    if request.code.len() > 20_000_000 {
        return Err("VBA_CODE_TOO_LARGE".into());
    }
    let normalized = request.code.replace("\r\n", "\n").replace('\r', "\n");
    let baseline_code=request.baseline_code.clone();
    let expected_sha=request.expected_code_sha256.clone();
    let expected_length=request.expected_code_length;
    let expected_lines=request.expected_code_line_count;
    let mode_preview=request.delivery_mode.clone().unwrap_or_else(||"CODE".to_string()).to_ascii_uppercase();
    let analysis_code=if mode_preview=="AUTO_APPLY"{extract_code_region(&normalized)?}else{normalized.clone()};
    let analyzed_region=if mode_preview=="AUTO_APPLY"{"CODE_REGION".to_string()}else{"FULL_INPUT".to_string()};
    let physical_lines: Vec<&str> = analysis_code.lines().collect();
    let logical = logical_lines(&analysis_code);
    let mut issues = Vec::new();
    let mut procedures = Vec::new();
    let mut procedure_stack: Vec<(String, String, String, usize, String)> = Vec::new();
    let mut block_stack: Vec<(String, usize)> = Vec::new();
    let mut balances = BTreeMap::new();
    let mut option_explicit = false;
    let mut worksheets = BTreeSet::new();
    let mut ranges = BTreeSet::new();
    let mut external_calls = BTreeSet::new();
    let mut api_declarations = BTreeSet::new();

    for line in &logical {
        let text = line.text.trim();
        let lower = text.to_ascii_lowercase();
        if lower == "option explicit" {
            option_explicit = true;
        }
        if lower.contains("goto ") {
            issues.push(VbaIssue { code: "GOTO_FORBIDDEN", line: line.start_line, detail: text.into() });
        }
        if is_label(text) {
            issues.push(VbaIssue { code: "LABEL_FORBIDDEN", line: line.start_line, detail: text.into() });
        }
        if is_single_line_if(text) {
            issues.push(VbaIssue { code: "SINGLE_LINE_IF_FORBIDDEN", line: line.start_line, detail: text.into() });
        }
        if lower.starts_with("attribute ") {
            issues.push(VbaIssue { code: "ATTRIBUTE_FORBIDDEN", line: line.start_line, detail: text.into() });
        }
        if lower.contains("matchbyte:=") {
            issues.push(VbaIssue { code: "MATCHBYTE_FORBIDDEN", line: line.start_line, detail: text.into() });
        }
        if lower.contains(".autofit") && text.contains(',') {
            issues.push(VbaIssue { code: "NONCONTIGUOUS_AUTOFIT_RISK", line: line.start_line, detail: text.into() });
        }

        if let Some((name, kind, visibility, signature)) = procedure_declaration(text) {
            procedure_stack.push((name, kind, visibility, line.start_line, signature));
        }
        if lower == "end sub" || lower == "end function" || lower == "end property" {
            if let Some((name, kind, visibility, start, signature)) = procedure_stack.pop() {
                procedures.push(VbaProcedure { name, kind, visibility, start_line: start, end_line: Some(line.start_line), signature });
            } else {
                issues.push(VbaIssue { code: "ORPHAN_PROCEDURE_END", line: line.start_line, detail: text.into() });
            }
        }

        if lower.starts_with("if ") && lower.ends_with(" then") {
            push_block(&mut block_stack, &mut balances, "IF", line.start_line);
        } else if lower == "end if" {
            close_block(&mut block_stack, &mut balances, &mut issues, "IF", line.start_line, text);
        } else if lower.starts_with("select case") {
            push_block(&mut block_stack, &mut balances, "SELECT", line.start_line);
        } else if lower == "end select" {
            close_block(&mut block_stack, &mut balances, &mut issues, "SELECT", line.start_line, text);
        } else if lower.starts_with("with ") {
            push_block(&mut block_stack, &mut balances, "WITH", line.start_line);
        } else if lower == "end with" {
            close_block(&mut block_stack, &mut balances, &mut issues, "WITH", line.start_line, text);
        } else if lower.starts_with("for ") || lower.starts_with("for each ") {
            push_block(&mut block_stack, &mut balances, "FOR", line.start_line);
        } else if lower == "next" || lower.starts_with("next ") {
            close_block(&mut block_stack, &mut balances, &mut issues, "FOR", line.start_line, text);
        } else if lower == "do" || lower.starts_with("do while ") || lower.starts_with("do until ") {
            push_block(&mut block_stack, &mut balances, "DO", line.start_line);
        } else if lower == "loop" || lower.starts_with("loop while ") || lower.starts_with("loop until ") {
            close_block(&mut block_stack, &mut balances, &mut issues, "DO", line.start_line, text);
        } else if lower.starts_with("while ") {
            push_block(&mut block_stack, &mut balances, "WHILE", line.start_line);
        } else if lower == "wend" {
            close_block(&mut block_stack, &mut balances, &mut issues, "WHILE", line.start_line, text);
        }

        let quoted = quoted_arguments(text);
        if lower.contains("worksheets(") || lower.contains("sheets(") {
            for value in &quoted {
                worksheets.insert(value.clone());
            }
        }
        if lower.contains("range(") || lower.contains("cells(") {
            for value in &quoted {
                ranges.insert(value.clone());
            }
        }
        if lower.contains("declare ") && (lower.contains(" ptrsafe ") || lower.contains(" lib ")) {
            api_declarations.insert(text.to_string());
        }
        if lower.contains("createobject(") || lower.contains("getobject(") || lower.contains("application.run") {
            external_calls.insert(text.to_string());
        }
    }

    for (name, kind, visibility, start, signature) in procedure_stack {
        procedures.push(VbaProcedure { name, kind, visibility, start_line: start, end_line: None, signature });
        issues.push(VbaIssue { code: "PROCEDURE_END_MISSING", line: start, detail: "procedure is not closed".into() });
    }
    for (kind, start) in block_stack {
        issues.push(VbaIssue { code: "BLOCK_END_MISSING", line: start, detail: kind });
    }

    let mut names=BTreeMap::<String,usize>::new();for procedure in &procedures{*names.entry(procedure.name.to_ascii_lowercase()).or_insert(0)+=1;}let duplicate_procedures:Vec<String>=names.into_iter().filter(|(_,count)|*count>1).map(|(name,_)|name).collect();for name in &duplicate_procedures{issues.push(VbaIssue{code:"PROCEDURE_NAME_DUPLICATE",line:1,detail:name.clone()});}
    let mut signature_differences=Vec::new();if let Some(baseline)=baseline_code.as_deref(){let base=public_signature_map(baseline);let candidate=public_signature_map(&analysis_code);for(name,signature)in base{match candidate.get(&name){None=>signature_differences.push(VbaSignatureDifference{procedure:name,code:"PUBLIC_PROCEDURE_MISSING",baseline:signature,candidate:None}),Some(value)if normalize_signature(value)!=normalize_signature(&signature)=>signature_differences.push(VbaSignatureDifference{procedure:name,code:"PUBLIC_SIGNATURE_CHANGED",baseline:signature,candidate:Some(value.clone())}),_=>{}}}for difference in &signature_differences{issues.push(VbaIssue{code:difference.code,line:1,detail:difference.procedure.clone()});}}
    let declared=declaration_index(&analysis_code,&procedures);let undeclared=undeclared_candidates(&analysis_code,&declared);issues.extend(api_compatibility_issues(&analysis_code));let dependency_differences=baseline_code.as_deref().map(|baseline|dependency_diff(baseline,&analysis_code)).unwrap_or_default();
    let mode = request.delivery_mode.unwrap_or_else(|| "CODE".to_string());
    let delivery = delivery_checks(&normalized, &mode, option_explicit, &mut issues);
    procedures.sort_by_key(|item| item.start_line);
    let sha256 = Sha256::digest(analysis_code.as_bytes())
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect();
    if let Some(expected)=expected_sha{if expected.to_ascii_lowercase()!=sha256{issues.push(VbaIssue{code:"CODE_SHA256_MISMATCH",line:1,detail:format!("expected={expected}, actual={sha256}")});}}
    if let Some(expected)=expected_length{if expected!=analysis_code.chars().count(){issues.push(VbaIssue{code:"CODE_LENGTH_MISMATCH",line:1,detail:format!("expected={expected}, actual={}",analysis_code.chars().count())});}}
    if let Some(expected)=expected_lines{if expected!=physical_lines.len(){issues.push(VbaIssue{code:"CODE_LINE_COUNT_MISMATCH",line:1,detail:format!("expected={expected}, actual={}",physical_lines.len())});}}
    let result = VbaVerificationResult {
        passed: issues.is_empty(),
        line_count: physical_lines.len(),
        sha256,
        option_explicit,
        procedures,
        issues,
        block_balance: balances,
        dependencies: VbaDependencies {
            worksheets: worksheets.into_iter().collect(),
            ranges: ranges.into_iter().collect(),
            external_calls: external_calls.into_iter().collect(),
            api_declarations: api_declarations.into_iter().collect(),
        },
        delivery,
        engine: "RUST",
        owner_domain: "verification",
        receipt_version: 3,
        signature_differences,
        duplicate_procedures,
        declared_identifiers:declared.into_iter().collect(),
        undeclared_candidates:undeclared.into_iter().collect(),
        dependency_differences,
        analyzed_region,
    };
    serde_json::to_string(&result).map_err(|error| format!("VBA_RESULT_JSON:{error}"))
}
