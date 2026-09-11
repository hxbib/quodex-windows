use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::Duration;

const CLIENT_ID: &str = "app_EMoamEEZ73f0CkXaXp7hrann";
const ISSUER: &str = "https://auth.openai.com";
const USER_AGENT: &str = "Quodex";

fn allowed_path(host: &str, path: &str) -> bool {
  match host {
    "auth.openai.com" => matches!(
      path,
      "/api/accounts/deviceauth/usercode" | "/api/accounts/deviceauth/token" | "/oauth/token"
    ),
    "chatgpt.com" => matches!(
      path,
      "/backend-api/wham/usage" | "/backend-api/wham/rate-limit-reset-credits"
    ),
    _ => false,
  }
}

pub fn assert_allowed(url: &str) -> Result<reqwest::Url, String> {
  let parsed = reqwest::Url::parse(url).map_err(|_| "Quodex refused an unapproved network endpoint.".to_string())?;
  if parsed.scheme() != "https"
    || !parsed.username().is_empty()
    || parsed.password().is_some()
    || parsed.port().is_some()
    || parsed.query().is_some()
    || parsed.fragment().is_some()
  {
    return Err("Quodex refused an unapproved network endpoint.".into());
  }
  let host = parsed.host_str().unwrap_or("").to_ascii_lowercase();
  if !allowed_path(&host, parsed.path()) {
    return Err("Quodex refused an unapproved network endpoint.".into());
  }
  Ok(parsed)
}

pub fn is_device_login_url(url: &str) -> bool {
  let Ok(parsed) = reqwest::Url::parse(url) else {
    return false;
  };
  parsed.scheme() == "https"
    && parsed.username().is_empty()
    && parsed.password().is_none()
    && parsed.port().is_none()
    && parsed.host_str().map(|h| h.eq_ignore_ascii_case("auth.openai.com")).unwrap_or(false)
    && parsed.path() == "/codex/device"
}

fn client() -> Result<reqwest::Client, String> {
  reqwest::Client::builder()
    .redirect(reqwest::redirect::Policy::none())
    .timeout(Duration::from_secs(20))
    .user_agent(USER_AGENT)
    .https_only(true)
    .build()
    .map_err(|e| e.to_string())
}

async fn request_json(
  url: &str,
  method: reqwest::Method,
  body: Option<(String, &'static str)>,
  authorization: Option<&str>,
  account_id: Option<&str>,
  accepted: &[u16],
) -> Result<(u16, Value, String), String> {
  let parsed = assert_allowed(url)?;
  let http = client()?;
  let mut req = http.request(method, parsed);
  req = req.header("Accept", "application/json");
  if let Some((payload, content_type)) = &body {
    req = req.header("Content-Type", *content_type).body(payload.clone());
  }
  if let Some(token) = authorization {
    req = req.header("Authorization", token);
  }
  if let Some(id) = account_id {
    req = req.header("ChatGPT-Account-ID", id);
  }
  let response = req.send().await.map_err(|e| e.to_string())?;
  let status = response.status().as_u16();
  let content_type = response
    .headers()
    .get(reqwest::header::CONTENT_TYPE)
    .and_then(|v| v.to_str().ok())
    .unwrap_or("")
    .to_string();
  let text = response.text().await.map_err(|e| e.to_string())?;
  if text.len() > 2 * 1024 * 1024 {
    return Err("The service response was unexpectedly large.".into());
  }
  if !accepted.contains(&status) {
    if status == 429 {
      return Err("OpenAI temporarily rate-limited this usage check. Try again later.".into());
    }
    return Err(format!("The service returned HTTP {status}."));
  }
  let json = if !text.is_empty() && content_type.to_ascii_lowercase().contains("application/json") {
    serde_json::from_str(&text).unwrap_or(Value::Null)
  } else {
    Value::Null
  };
  Ok((status, json, text))
}

fn ok_range() -> Vec<u16> {
  (200..300).collect()
}

#[derive(Serialize)]
pub struct DeviceLoginStart {
  #[serde(rename = "verificationURL")]
  pub verification_url: String,
  #[serde(rename = "userCode")]
  pub user_code: String,
  #[serde(rename = "deviceAuthID")]
  pub device_auth_id: String,
  #[serde(rename = "intervalSeconds")]
  pub interval_seconds: u32,
}

pub async fn start_device_login() -> Result<DeviceLoginStart, String> {
  let body = json!({ "client_id": CLIENT_ID }).to_string();
  let (_, payload, _) = request_json(
    &format!("{ISSUER}/api/accounts/deviceauth/usercode"),
    reqwest::Method::POST,
    Some((body, "application/json")),
    None,
    None,
    &ok_range(),
  )
  .await?;
  let device_auth_id = payload
    .get("device_auth_id")
    .and_then(Value::as_str)
    .unwrap_or("")
    .to_string();
  let user_code = payload
    .get("user_code")
    .or_else(|| payload.get("usercode"))
    .and_then(Value::as_str)
    .unwrap_or("")
    .to_string();
  if device_auth_id.is_empty() || user_code.is_empty() {
    return Err("The service returned an invalid response.".into());
  }
  let interval = payload
    .get("interval")
    .and_then(|v| v.as_u64().or_else(|| v.as_str().and_then(|s| s.parse().ok())))
    .unwrap_or(5)
    .max(1) as u32;
  Ok(DeviceLoginStart {
    verification_url: format!("{ISSUER}/codex/device"),
    user_code,
    device_auth_id,
    interval_seconds: interval,
  })
}

#[derive(Serialize)]
pub struct Identity {
  #[serde(rename = "accountID")]
  pub account_id: String,
  pub email: String,
  pub plan: String,
}

#[derive(Serialize)]
#[serde(tag = "status")]
pub enum PollResult {
  #[serde(rename = "pending")]
  Pending,
  #[serde(rename = "complete")]
  Complete { identity: Identity },
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Tokens {
  pub id_token: String,
  pub access_token: String,
}

fn b64url_decode(value: &str) -> Option<Vec<u8>> {
  let mut padded = value.replace('-', "+").replace('_', "/");
  let rem = padded.len() % 4;
  if rem != 0 {
    padded.push_str(&"=".repeat(4 - rem));
  }
  base64::Engine::decode(&base64::engine::general_purpose::STANDARD, padded).ok()
}

fn claims(token: &str) -> Option<Value> {
  let mut parts = token.split('.');
  let _ = parts.next()?;
  let payload = parts.next()?;
  if parts.next().is_none() || parts.next().is_some() {
    return None;
  }
  let bytes = b64url_decode(payload)?;
  serde_json::from_slice(&bytes).ok()
}

fn non_empty(value: Option<&Value>) -> Option<String> {
  let text = value.and_then(Value::as_str)?.trim();
  if text.is_empty() {
    None
  } else {
    Some(text.to_string())
  }
}

pub fn identity_from_id_token(id_token: &str) -> Result<Identity, String> {
  let parsed = claims(id_token).ok_or("The sign-in token could not be read.")?;
  let profile = parsed.get("https://api.openai.com/profile").cloned().unwrap_or(Value::Null);
  let auth = parsed.get("https://api.openai.com/auth").cloned().unwrap_or(Value::Null);
  let account_id = non_empty(auth.get("chatgpt_account_id")).ok_or("The sign-in did not include a ChatGPT account identifier.")?;
  if !regex_account(&account_id) {
    return Err("Invalid account.".into());
  }
  let email = non_empty(parsed.get("email"))
    .or_else(|| non_empty(profile.get("email")))
    .unwrap_or_else(|| format!("Account {}", &account_id[account_id.len().saturating_sub(6)..]));
  let plan = non_empty(auth.get("chatgpt_plan_type")).unwrap_or_else(|| "ChatGPT".into());
  Ok(Identity {
    account_id,
    email,
    plan,
  })
}

pub fn expiration_from_token(token: &str) -> Option<u64> {
  claims(token)?
    .get("exp")
    .and_then(Value::as_u64)
    .map(|exp| exp.saturating_mul(1000))
}

pub fn regex_account(value: &str) -> bool {
  if value.len() < 4 || value.len() > 128 {
    return false;
  }
  value
    .chars()
    .all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '_' || c == '-')
}

pub fn as_account_id(value: &str) -> Result<String, String> {
  if regex_account(value) {
    Ok(value.to_string())
  } else {
    Err("Invalid account.".into())
  }
}

pub async fn poll_device_login(device_auth_id: &str, user_code: &str) -> Result<(PollResult, Option<Tokens>), String> {
  if device_auth_id.is_empty() || user_code.is_empty() {
    return Err("Invalid sign-in request.".into());
  }
  let mut accepted = ok_range();
  accepted.extend([403, 404]);
  let body = json!({
    "device_auth_id": device_auth_id,
    "user_code": user_code
  })
  .to_string();
  let (status, payload, _) = request_json(
    &format!("{ISSUER}/api/accounts/deviceauth/token"),
    reqwest::Method::POST,
    Some((body, "application/json")),
    None,
    None,
    &accepted,
  )
  .await?;
  if status != 200 {
    return Ok((PollResult::Pending, None));
  }
  let code = payload.get("authorization_code").and_then(Value::as_str).unwrap_or("");
  let verifier = payload.get("code_verifier").and_then(Value::as_str).unwrap_or("");
  if code.is_empty() || verifier.is_empty() {
    return Err("The service returned an invalid response.".into());
  }
  let form = format!(
    "grant_type=authorization_code&code={}&redirect_uri={}/deviceauth/callback&client_id={}&code_verifier={}",
    urlencoding(code),
    ISSUER,
    urlencoding(CLIENT_ID),
    urlencoding(verifier)
  );
  let (_, tokens, _) = request_json(
    &format!("{ISSUER}/oauth/token"),
    reqwest::Method::POST,
    Some((form, "application/x-www-form-urlencoded")),
    None,
    None,
    &ok_range(),
  )
  .await?;
  let id_token = tokens.get("id_token").and_then(Value::as_str).unwrap_or("");
  let access_token = tokens.get("access_token").and_then(Value::as_str).unwrap_or("");
  let _refresh = tokens.get("refresh_token");
  if id_token.is_empty() || access_token.is_empty() {
    return Err("The service returned an invalid response.".into());
  }
  let identity = identity_from_id_token(id_token)?;
  Ok((
    PollResult::Complete { identity },
    Some(Tokens {
      id_token: id_token.to_string(),
      access_token: access_token.to_string(),
    }),
  ))
}

fn urlencoding(value: &str) -> String {
  let mut out = String::new();
  for b in value.bytes() {
    match b {
      b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => out.push(b as char),
      _ => out.push_str(&format!("%{b:02X}")),
    }
  }
  out
}

fn is_usage_challenge(text: &str) -> bool {
  let body = text.to_ascii_lowercase();
  if body.is_empty() {
    return false;
  }
  let markers = [
    "sign in",
    "log in",
    "login",
    "session expired",
    "authentication required",
    "unauthenticated",
    "unauthorized",
    "invalid token",
    "token expired",
  ];
  let authentication = markers.iter().any(|m| body.contains(m));
  let challenge = body.contains("<html")
    || body.contains("<!doctype")
    || body.contains("\"error\"")
    || body.contains("\"detail\"")
    || body.contains("\"message\"");
  authentication && challenge
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageOk {
  pub ok: bool,
  pub usage: Value,
  pub resets: Option<Value>,
  pub reset_lookup_failed: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageErr {
  pub ok: bool,
  pub code: &'static str,
  pub message: String,
}

pub async fn fetch_account_usage(access_token: &str, account_id: &str) -> Result<Value, String> {
  let mut accepted = ok_range();
  accepted.extend([401, 403]);
  let auth = format!("Bearer {access_token}");
  let (status, usage, text) = request_json(
    "https://chatgpt.com/backend-api/wham/usage",
    reqwest::Method::GET,
    None,
    Some(&auth),
    Some(account_id),
    &accepted,
  )
  .await?;
  if status == 401 || status == 403 {
    return Ok(serde_json::to_value(UsageErr {
      ok: false,
      code: "login_required",
      message: "This session expired or was rejected. Sign in again; Quodex never retries expired tokens.".into(),
    })
    .unwrap());
  }
  if is_usage_challenge(&text) {
    return Ok(serde_json::to_value(UsageErr {
      ok: false,
      code: "login_required",
      message: "This session is no longer valid. Sign in again; Quodex never retries expired tokens.".into(),
    })
    .unwrap());
  }
  if usage.is_null() {
    return Ok(serde_json::to_value(UsageErr {
      ok: false,
      code: "invalid",
      message: "The service returned an invalid response.".into(),
    })
    .unwrap());
  }

  let mut resets = None;
  let mut reset_lookup_failed = false;
  match request_json(
    "https://chatgpt.com/backend-api/wham/rate-limit-reset-credits",
    reqwest::Method::GET,
    None,
    Some(&auth),
    Some(account_id),
    &accepted,
  )
  .await
  {
    Ok((reset_status, _json, _)) if reset_status == 401 || reset_status == 403 => {
      return Ok(serde_json::to_value(UsageErr {
        ok: false,
        code: "login_required",
        message: "This session expired or was rejected. Sign in again; Quodex never retries expired tokens.".into(),
      })
      .unwrap());
    }
    Ok((_, json, _)) => {
      if !json.is_null() {
        resets = Some(json);
      }
    }
    Err(_) => reset_lookup_failed = true,
  }

  Ok(serde_json::to_value(UsageOk {
    ok: true,
    usage,
    resets,
    reset_lookup_failed,
  })
  .unwrap())
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn allowlist_rejects_query_and_other_hosts() {
    assert!(assert_allowed("https://auth.openai.com/api/accounts/deviceauth/usercode").is_ok());
    assert!(assert_allowed("https://chatgpt.com/backend-api/wham/usage").is_ok());
    assert!(assert_allowed("https://auth.openai.com/api/accounts/deviceauth/usercode?x=1").is_err());
    assert!(assert_allowed("https://evil.example/api/accounts/deviceauth/usercode").is_err());
    assert!(assert_allowed("http://auth.openai.com/api/accounts/deviceauth/usercode").is_err());
  }

  #[test]
  fn device_login_url_is_exact() {
    assert!(is_device_login_url("https://auth.openai.com/codex/device"));
    assert!(!is_device_login_url("https://auth.openai.com/codex/device?next=1"));
    assert!(!is_device_login_url("https://chatgpt.com/codex/device"));
  }

  #[test]
  fn account_id_shape() {
    assert!(regex_account("acct_1234"));
    assert!(!regex_account("ab"));
    assert!(!regex_account("no spaces"));
  }
}
