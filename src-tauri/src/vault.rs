use crate::openai::{as_account_id, identity_from_id_token, Identity, Tokens};
use serde_json::{Map, Value};
use std::fs;
use std::path::{Path, PathBuf};

const MAGIC: &[u8] = b"QDX1";
const ELECTRON: &[u8] = b"DPAPI";

pub fn data_dir() -> PathBuf {
  dirs::data_dir()
    .unwrap_or_else(|| PathBuf::from("."))
    .join("Quodex")
}

pub fn vault_path() -> PathBuf {
  data_dir().join("oauth-tokens.dpapi")
}

pub fn prefs_path() -> PathBuf {
  data_dir().join("window-prefs.json")
}

#[cfg(windows)]
mod dpapi {
  use windows::Win32::Foundation::{LocalFree, HLOCAL};
  use windows::Win32::Security::Cryptography::{CryptProtectData, CryptUnprotectData, CRYPT_INTEGER_BLOB};

  fn release(output: &CRYPT_INTEGER_BLOB) {
    if !output.pbData.is_null() {
      let _ = unsafe { LocalFree(HLOCAL(output.pbData.cast())) };
    }
  }

  pub fn protect(plain: &[u8]) -> Result<Vec<u8>, String> {
    let input = CRYPT_INTEGER_BLOB {
      cbData: plain.len() as u32,
      pbData: plain.as_ptr() as *mut u8,
    };
    let mut output = CRYPT_INTEGER_BLOB::default();
    unsafe {
      CryptProtectData(&input, None, None, None, None, 0, &mut output).map_err(|e| e.to_string())?;
      let bytes = std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec();
      release(&output);
      Ok(bytes)
    }
  }

  pub fn unprotect(blob: &[u8]) -> Result<Vec<u8>, String> {
    let mut input = CRYPT_INTEGER_BLOB {
      cbData: blob.len() as u32,
      pbData: blob.as_ptr() as *mut u8,
    };
    let mut output = CRYPT_INTEGER_BLOB::default();
    unsafe {
      CryptUnprotectData(&mut input, None, None, None, None, 0, &mut output).map_err(|e| e.to_string())?;
      let bytes = std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec();
      release(&output);
      Ok(bytes)
    }
  }

  pub fn available() -> bool {
    protect(b"quodex").is_ok()
  }
}

#[cfg(not(windows))]
mod dpapi {
  pub fn protect(_: &[u8]) -> Result<Vec<u8>, String> {
    Err("Windows DPAPI is unavailable. Quodex will not store ChatGPT sessions in plaintext.".into())
  }
  pub fn unprotect(_: &[u8]) -> Result<Vec<u8>, String> {
    Err("Windows DPAPI is unavailable. Quodex will not store ChatGPT sessions in plaintext.".into())
  }
  pub fn available() -> bool {
    false
  }
}

fn assert_secure() -> Result<(), String> {
  if dpapi::available() {
    Ok(())
  } else {
    Err("Windows DPAPI is unavailable. Quodex will not store ChatGPT sessions in plaintext.".into())
  }
}

fn unwrap_blob(bytes: &[u8]) -> Result<Vec<u8>, String> {
  if bytes.starts_with(MAGIC) {
    return dpapi::unprotect(&bytes[MAGIC.len()..]);
  }
  if bytes.starts_with(ELECTRON) {
    return dpapi::unprotect(&bytes[ELECTRON.len()..]);
  }
  dpapi::unprotect(bytes)
}

pub type Vault = Map<String, Value>;

pub fn load() -> Result<Vault, String> {
  let file = vault_path();
  if !file.exists() {
    return Ok(Map::new());
  }
  assert_secure()?;
  let raw = fs::read(&file).map_err(|_| "The session vault could not be decrypted. Quodex will not overwrite it.")?;
  let plain = unwrap_blob(&raw).map_err(|_| "The session vault could not be decrypted. Quodex will not overwrite it.")?;
  let parsed: Value = serde_json::from_slice(&plain).map_err(|_| "The session vault is not a valid object.")?;
  let obj = parsed.as_object().ok_or("The session vault is not a valid object.")?;
  let mut vault = Map::new();
  for (key, value) in obj {
    if as_account_id(key).is_err() || !value.is_object() {
      continue;
    }
    let id_token = value.get("idToken").and_then(Value::as_str);
    let access_token = value.get("accessToken").and_then(Value::as_str);
    if let (Some(id_token), Some(access_token)) = (id_token, access_token) {
      vault.insert(
        key.clone(),
        serde_json::json!({ "idToken": id_token, "accessToken": access_token }),
      );
    }
  }
  Ok(vault)
}

pub fn save(vault: &Vault) -> Result<(), String> {
  assert_secure()?;
  fs::create_dir_all(data_dir()).map_err(|e| e.to_string())?;
  let file = vault_path();
  let tmp = file.with_extension("dpapi.tmp");
  let bak = file.with_extension("dpapi.bak");
  let json = serde_json::to_vec(vault).map_err(|e| e.to_string())?;
  let mut blob = MAGIC.to_vec();
  blob.extend(dpapi::protect(&json)?);
  fs::write(&tmp, blob).map_err(|e| e.to_string())?;
  if file.exists() {
    let _ = fs::copy(&file, &bak);
  }
  fs::rename(&tmp, &file).map_err(|e| e.to_string())?;
  Ok(())
}

pub fn put_tokens(account_id: &str, tokens: &Tokens) -> Result<(), String> {
  let id = as_account_id(account_id)?;
  let mut vault = load()?;
  vault.insert(
    id,
    serde_json::json!({ "idToken": tokens.id_token, "accessToken": tokens.access_token }),
  );
  save(&vault)
}

pub fn delete_tokens(account_id: &str) -> Result<(), String> {
  let id = as_account_id(account_id)?;
  let mut vault = load()?;
  vault.remove(&id);
  save(&vault)
}

pub fn tokens_for(account_id: &str) -> Result<Option<Tokens>, String> {
  let id = as_account_id(account_id)?;
  let vault = load()?;
  Ok(vault.get(&id).and_then(|value| {
    Some(Tokens {
      id_token: value.get("idToken")?.as_str()?.to_string(),
      access_token: value.get("accessToken")?.as_str()?.to_string(),
    })
  }))
}

pub fn identities() -> Result<Vec<Identity>, String> {
  let vault = load()?;
  let mut out = Vec::new();
  for (_id, value) in vault {
    if let Some(token) = value.get("idToken").and_then(Value::as_str) {
      if let Ok(identity) = identity_from_id_token(token) {
        out.push(identity);
      }
    }
  }
  Ok(out)
}

pub fn encrypted() -> bool {
  dpapi::available()
}

#[allow(dead_code)]
pub fn ensure_dir(path: &Path) -> Result<(), String> {
  fs::create_dir_all(path).map_err(|e| e.to_string())
}
