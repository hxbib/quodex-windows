mod openai;
mod shell;
mod vault;

use openai::{as_account_id, expiration_from_token, is_device_login_url};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{
  AppHandle, Emitter, LogicalPosition, Manager, PhysicalPosition, WebviewWindow, WindowEvent,
};
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_notification::NotificationExt;

const AUTO_REFRESH_MS: u64 = 30 * 60 * 1000;

struct Prefs {
  minimize_to_tray: bool,
  first_hide_done: bool,
  flyout_pinned: bool,
}

struct Alarms {
  items: HashMap<String, Alarm>,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Alarm {
  id: String,
  fire_at: u64,
  title: String,
  body: String,
}

struct AppState {
  prefs: Mutex<Prefs>,
  quitting: AtomicBool,
  flyout_pinned: AtomicBool,
  alarms: Mutex<Alarms>,
  tray_click: Mutex<Option<u64>>,
}

fn now_ms() -> u64 {
  SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|d| d.as_millis() as u64)
    .unwrap_or(0)
}

fn load_prefs() -> Prefs {
  let raw = fs::read_to_string(vault::prefs_path()).ok();
  let parsed = raw.and_then(|text| serde_json::from_str::<serde_json::Value>(&text).ok());
  Prefs {
    minimize_to_tray: parsed
      .as_ref()
      .and_then(|v| v.get("minimizeToTray"))
      .and_then(|v| v.as_bool())
      .unwrap_or(false),
    first_hide_done: parsed
      .as_ref()
      .and_then(|v| v.get("firstHideDone"))
      .and_then(|v| v.as_bool())
      .unwrap_or(false),
    flyout_pinned: parsed
      .as_ref()
      .and_then(|v| v.get("flyoutPinned"))
      .and_then(|v| v.as_bool())
      .unwrap_or(false),
  }
}

fn save_prefs(prefs: &Prefs) {
  let _ = fs::create_dir_all(vault::data_dir());
  let _ = fs::write(
    vault::prefs_path(),
    serde_json::json!({
      "minimizeToTray": prefs.minimize_to_tray,
      "firstHideDone": prefs.first_hide_done,
      "flyoutPinned": prefs.flyout_pinned,
    })
    .to_string(),
  );
}

fn broadcast(app: &AppHandle, command: &str) {
  let _ = app.emit("quodex-command", command);
}

fn main_window(app: &AppHandle) -> Option<WebviewWindow> {
  app.get_webview_window("main")
}

fn flyout_window(app: &AppHandle) -> Option<WebviewWindow> {
  app.get_webview_window("flyout")
}

fn apply_effects(window: &WebviewWindow, mica: bool) {
  use tauri::window::{Effect, EffectState, EffectsBuilder};
  let effect = if mica { Effect::MicaDark } else { Effect::Acrylic };
  let _ = window.set_effects(
    EffectsBuilder::new()
      .effect(effect)
      .state(EffectState::Active)
      .build(),
  );
}

fn show_main(app: &AppHandle) {
  if let Some(flyout) = flyout_window(app) {
    let _ = flyout.hide();
  }
  if let Some(win) = main_window(app) {
    let _ = win.set_skip_taskbar(false);
    let _ = win.unminimize();
    let _ = win.show();
    let _ = win.set_focus();
  }
  rebuild_tray_menu(app);
}

fn hide_to_tray(app: &AppHandle) {
  if let Some(flyout) = flyout_window(app) {
    let _ = flyout.hide();
  }
  if let Some(win) = main_window(app) {
    if win.is_minimized().unwrap_or(false) {
      let _ = win.unminimize();
    }
    let _ = win.set_skip_taskbar(true);
    let _ = win.hide();
  }
  rebuild_tray_menu(app);
  maybe_first_hide_toast(app);
}

fn minimize_main(app: &AppHandle) {
  let to_tray = app
    .try_state::<AppState>()
    .map(|s| s.prefs.lock().ok().map(|p| p.minimize_to_tray).unwrap_or(false))
    .unwrap_or(false);
  if to_tray {
    hide_to_tray(app);
    return;
  }
  if let Some(win) = main_window(app) {
    let _ = win.set_skip_taskbar(false);
    let _ = win.minimize();
  }
  rebuild_tray_menu(app);
}

fn maybe_first_hide_toast(app: &AppHandle) {
  let Some(state) = app.try_state::<AppState>() else {
    return;
  };
  {
    let mut prefs = match state.prefs.lock() {
      Ok(p) => p,
      Err(_) => return,
    };
    if prefs.first_hide_done {
      return;
    }
    prefs.first_hide_done = true;
    save_prefs(&prefs);
  }
  let _ = app
    .notification()
    .builder()
    .title("Quodex is still running")
    .body("It's by the clock in the system tray. Click for usage, double-click to reopen, right-click to quit.")
    .show();
}

fn quit_quodex(app: &AppHandle) {
  if let Some(state) = app.try_state::<AppState>() {
    state.quitting.store(true, Ordering::SeqCst);
  }
  app.exit(0);
}

fn main_visible(app: &AppHandle) -> bool {
  main_window(app)
    .map(|w| w.is_visible().unwrap_or(false) && !w.is_minimized().unwrap_or(false))
    .unwrap_or(false)
}

fn rebuild_tray_menu(app: &AppHandle) {
  let Some(tray) = app.tray_by_id("quodex") else {
    return;
  };
  let visible = main_visible(app);
  let pinned = app
    .try_state::<AppState>()
    .map(|s| s.flyout_pinned.load(Ordering::SeqCst))
    .unwrap_or(false);
  let minimize_to_tray = app
    .try_state::<AppState>()
    .and_then(|s| s.prefs.lock().ok().map(|p| p.minimize_to_tray))
    .unwrap_or(false);
  let autostart = app.autolaunch().is_enabled().unwrap_or(false);
  let open_item = MenuItem::with_id(
    app,
    "open",
    if visible { "Hide to tray" } else { "Open Quodex" },
    true,
    None::<&str>,
  )
  .ok();
  let refresh = MenuItem::with_id(app, "refresh", "Refresh usage", true, None::<&str>).ok();
  let login = CheckMenuItem::with_id(app, "autostart", "Open at login", true, autostart, None::<&str>).ok();
  let pin = CheckMenuItem::with_id(app, "pin", "Pin flyout", true, pinned, None::<&str>).ok();
  let min_tray =
    CheckMenuItem::with_id(app, "min-tray", "Minimize to tray", true, minimize_to_tray, None::<&str>).ok();
  let quit = MenuItem::with_id(app, "quit", "Quit Quodex", true, None::<&str>).ok();
  let sep = PredefinedMenuItem::separator(app).ok();
  let sep2 = PredefinedMenuItem::separator(app).ok();
  let mut items: Vec<&dyn tauri::menu::IsMenuItem<tauri::Wry>> = Vec::new();
  if let Some(i) = open_item.as_ref() {
    items.push(i);
  }
  if let Some(i) = refresh.as_ref() {
    items.push(i);
  }
  if let Some(i) = sep.as_ref() {
    items.push(i);
  }
  if let Some(i) = login.as_ref() {
    items.push(i);
  }
  if let Some(i) = pin.as_ref() {
    items.push(i);
  }
  if let Some(i) = min_tray.as_ref() {
    items.push(i);
  }
  if let Some(i) = sep2.as_ref() {
    items.push(i);
  }
  if let Some(i) = quit.as_ref() {
    items.push(i);
  }
  if let Ok(menu) = Menu::with_items(app, &items) {
    let _ = tray.set_menu(Some(menu));
  }
}

fn position_flyout(app: &AppHandle, x: f64, y: f64) {
  let Some(win) = flyout_window(app) else {
    return;
  };
  let size = win.outer_size().ok();
  let width = size.map(|s| s.width as f64).unwrap_or(420.0);
  let height = size.map(|s| s.height as f64).unwrap_or(640.0);
  let monitor = win.monitor_from_point(x, y).ok().flatten().or_else(|| win.current_monitor().ok().flatten());
  let (area_x, area_y, area_w, area_h) = if let Some(m) = monitor {
    let pos = m.work_area().position;
    let size = m.work_area().size;
    (pos.x as f64, pos.y as f64, size.width as f64, size.height as f64)
  } else {
    (0.0, 0.0, 1920.0, 1080.0)
  };
  let taskbar_top = y < area_y + area_h / 2.0;
  let mut px = x - width / 2.0;
  let mut py = if taskbar_top { y + 8.0 } else { y - height - 8.0 };
  px = px.max(area_x + 8.0).min(area_x + area_w - width - 8.0);
  py = py.max(area_y + 8.0).min(area_y + area_h - height - 8.0);
  let scale = win.scale_factor().unwrap_or(1.0);
  let _ = win.set_position(LogicalPosition::new(px / scale, py / scale));
}

fn show_flyout_at(app: &AppHandle, x: f64, y: f64) {
  let Some(win) = flyout_window(app) else {
    return;
  };
  let pinned = app
    .try_state::<AppState>()
    .map(|s| s.flyout_pinned.load(Ordering::SeqCst))
    .unwrap_or(false);
  if win.is_visible().unwrap_or(false) {
    if pinned {
      let _ = win.set_focus();
      return;
    }
    let _ = win.hide();
    return;
  }
  broadcast(app, "reload");
  position_flyout(app, x, y);
  let _ = win.show();
  let _ = win.set_focus();
}

fn handle_tray_event(app: &AppHandle, event: TrayIconEvent) {
  match event {
    TrayIconEvent::Click {
      button: MouseButton::Left,
      button_state: MouseButtonState::Up,
      position: PhysicalPosition { x, y },
      ..
    } => {
      let now = now_ms();
      if let Some(state) = app.try_state::<AppState>() {
        if let Ok(mut slot) = state.tray_click.lock() {
          *slot = Some(now);
        }
      }
      let app = app.clone();
      std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(220));
        if let Some(state) = app.try_state::<AppState>() {
          let fire = state
            .tray_click
            .lock()
            .ok()
            .and_then(|g| *g)
            .map(|t| t == now)
            .unwrap_or(false);
          if fire {
            show_flyout_at(&app, x, y);
          }
        }
      });
    }
    TrayIconEvent::DoubleClick {
      button: MouseButton::Left,
      ..
    } => {
      if let Some(state) = app.try_state::<AppState>() {
        if let Ok(mut slot) = state.tray_click.lock() {
          *slot = None;
        }
      }
      show_main(app);
    }
    TrayIconEvent::Click {
      button: MouseButton::Middle,
      button_state: MouseButtonState::Up,
      ..
    } => broadcast(app, "refresh"),
    _ => {}
  }
}

fn handle_menu(app: &AppHandle, id: &str) {
  match id {
    "open" => {
      if main_visible(app) {
        hide_to_tray(app);
      } else {
        show_main(app);
      }
    }
    "refresh" => broadcast(app, "refresh"),
    "autostart" => {
      let enabled = app.autolaunch().is_enabled().unwrap_or(false);
      if enabled {
        let _ = app.autolaunch().disable();
      } else {
        let _ = app.autolaunch().enable();
      }
      rebuild_tray_menu(app);
    }
    "pin" => {
      if let Some(state) = app.try_state::<AppState>() {
        let next = !state.flyout_pinned.load(Ordering::SeqCst);
        state.flyout_pinned.store(next, Ordering::SeqCst);
        if let Ok(mut prefs) = state.prefs.lock() {
          prefs.flyout_pinned = next;
          save_prefs(&prefs);
        }
        broadcast(app, "flyout-pin");
        if next {
          if let Some(win) = flyout_window(app) {
            let _ = win.show();
          }
        }
      }
      rebuild_tray_menu(app);
    }
    "min-tray" => {
      if let Some(state) = app.try_state::<AppState>() {
        if let Ok(mut prefs) = state.prefs.lock() {
          prefs.minimize_to_tray = !prefs.minimize_to_tray;
          save_prefs(&prefs);
        }
      }
      rebuild_tray_menu(app);
    }
    "quit" => quit_quodex(app),
    _ => {}
  }
}

#[tauri::command]
async fn start_device_login() -> Result<openai::DeviceLoginStart, String> {
  openai::start_device_login().await
}

#[tauri::command]
async fn poll_device_login(device_auth_id: String, user_code: String) -> Result<serde_json::Value, String> {
  let (result, tokens) = openai::poll_device_login(&device_auth_id, &user_code).await?;
  if let Some(tokens) = tokens {
    let identity = match &result {
      openai::PollResult::Complete { identity } => identity.account_id.clone(),
      _ => String::new(),
    };
    if !identity.is_empty() {
      vault::put_tokens(&identity, &tokens)?;
    }
    return serde_json::to_value(&result).map_err(|e| e.to_string());
  }
  serde_json::to_value(&result).map_err(|e| e.to_string())
}

#[tauri::command]
async fn fetch_usage(account_id: String) -> Result<serde_json::Value, String> {
  let id = as_account_id(&account_id)?;
  let Some(tokens) = vault::tokens_for(&id)? else {
    return Ok(serde_json::json!({
      "ok": false,
      "code": "login_required",
      "message": "This session expired or was rejected. Sign in again; Quodex never retries expired tokens."
    }));
  };
  if let Some(exp) = expiration_from_token(&tokens.access_token) {
    if exp <= now_ms() {
      return Ok(serde_json::json!({
        "ok": false,
        "code": "login_required",
        "message": "This session expired or was rejected. Sign in again; Quodex never retries expired tokens."
      }));
    }
  }
  openai::fetch_account_usage(&tokens.access_token, &id).await
}

#[tauri::command]
fn delete_tokens(account_id: String) -> Result<(), String> {
  vault::delete_tokens(&account_id)
}

#[tauri::command]
fn has_token(account_id: String) -> Result<bool, String> {
  Ok(vault::tokens_for(&account_id)?.is_some())
}

#[tauri::command]
fn list_identities() -> Result<Vec<openai::Identity>, String> {
  vault::identities()
}

#[tauri::command]
fn show_toast(app: AppHandle, title: String, body: String) -> Result<(), String> {
  let _ = app
    .notification()
    .builder()
    .title(title.chars().take(120).collect::<String>())
    .body(body.chars().take(280).collect::<String>())
    .show();
  Ok(())
}

#[tauri::command]
fn autostart_get(app: AppHandle) -> Result<bool, String> {
  app.autolaunch().is_enabled().map_err(|e| e.to_string())
}

#[tauri::command]
fn autostart_set(app: AppHandle, enabled: bool) -> Result<bool, String> {
  if enabled {
    app.autolaunch().enable().map_err(|e| e.to_string())?;
  } else {
    app.autolaunch().disable().map_err(|e| e.to_string())?;
  }
  rebuild_tray_menu(&app);
  app.autolaunch().is_enabled().map_err(|e| e.to_string())
}

#[tauri::command]
fn window_hide(app: AppHandle) {
  hide_to_tray(&app);
}

#[tauri::command]
fn window_show(app: AppHandle) {
  show_main(&app);
}

#[tauri::command]
fn window_minimize(app: AppHandle) {
  minimize_main(&app);
}

#[tauri::command]
fn window_maximize(app: AppHandle) -> Result<bool, String> {
  let win = main_window(&app).ok_or("missing window")?;
  if win.is_maximized().unwrap_or(false) {
    let _ = win.unmaximize();
    broadcast(&app, "window:restored");
  } else {
    let _ = win.maximize();
    broadcast(&app, "window:maximized");
  }
  Ok(win.is_maximized().unwrap_or(false))
}

#[tauri::command]
fn app_quit(app: AppHandle) {
  quit_quodex(&app);
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct WindowPrefs {
  minimize_to_tray: bool,
  flyout_pinned: bool,
}

#[tauri::command]
fn prefs_get(state: tauri::State<AppState>) -> WindowPrefs {
  let pinned = state.flyout_pinned.load(Ordering::SeqCst);
  let minimize = state.prefs.lock().ok().map(|p| p.minimize_to_tray).unwrap_or(false);
  WindowPrefs {
    minimize_to_tray: minimize,
    flyout_pinned: pinned,
  }
}

#[tauri::command]
fn prefs_set(app: AppHandle, state: tauri::State<AppState>, minimize_to_tray: Option<bool>) -> WindowPrefs {
  if let Some(value) = minimize_to_tray {
    if let Ok(mut prefs) = state.prefs.lock() {
      prefs.minimize_to_tray = value;
      save_prefs(&prefs);
    }
    rebuild_tray_menu(&app);
  }
  prefs_get(state)
}

#[tauri::command]
fn open_external(url: String) -> Result<(), String> {
  if !is_device_login_url(&url) {
    return Ok(());
  }
  let target = "https://auth.openai.com/codex/device";
  #[cfg(windows)]
  {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    let _ = std::process::Command::new("cmd")
      .args(["/C", "start", "", target])
      .creation_flags(CREATE_NO_WINDOW)
      .spawn();
  }
  let _ = target;
  Ok(())
}

#[tauri::command]
fn flyout_pin(app: AppHandle, state: tauri::State<AppState>, pinned: bool) {
  state.flyout_pinned.store(pinned, Ordering::SeqCst);
  if let Ok(mut prefs) = state.prefs.lock() {
    prefs.flyout_pinned = pinned;
    save_prefs(&prefs);
  }
  rebuild_tray_menu(&app);
}

#[tauri::command]
fn tray_tooltip(app: AppHandle, text: String) {
  if let Some(tray) = app.tray_by_id("quodex") {
    let _ = tray.set_tooltip(Some(text.chars().take(120).collect::<String>()));
  }
}

#[tauri::command]
fn title_theme(_theme: String) {}

#[tauri::command]
fn vault_status() -> serde_json::Value {
  serde_json::json!({
    "encrypted": vault::encrypted(),
    "backend": if vault::encrypted() { "dpapi" } else { "unknown" }
  })
}

#[tauri::command]
fn set_alarms(app: AppHandle, state: tauri::State<AppState>, alarms: Vec<Alarm>) {
  if let Ok(mut slot) = state.alarms.lock() {
    slot.items.clear();
    for alarm in alarms {
      slot.items.insert(alarm.id.clone(), alarm);
    }
  }
  let _ = app;
}

fn spawn_alarm_loop(app: AppHandle) {
  tauri::async_runtime::spawn(async move {
    let mut fired: HashMap<String, u64> = HashMap::new();
    loop {
      tokio::time::sleep(Duration::from_secs(2)).await;
      let Some(state) = app.try_state::<AppState>() else {
        continue;
      };
      let snapshot: Vec<Alarm> = state
        .alarms
        .lock()
        .ok()
        .map(|g| g.items.values().cloned().collect())
        .unwrap_or_default();
      let now = now_ms();
      for alarm in snapshot {
        if alarm.fire_at > now + 2000 {
          continue;
        }
        if alarm.fire_at + 30_000 < now {
          continue;
        }
        if fired.get(&alarm.id) == Some(&alarm.fire_at) {
          continue;
        }
        fired.insert(alarm.id.clone(), alarm.fire_at);
        let _ = app
          .notification()
          .builder()
          .title(alarm.title)
          .body(alarm.body)
          .show();
      }
    }
  });
}

fn spawn_refresh_loop(app: AppHandle) {
  let resume_app = app.clone();
  tauri::async_runtime::spawn(async move {
    let mut last = SystemTime::now();
    loop {
      tokio::time::sleep(Duration::from_secs(15)).await;
      if let Ok(elapsed) = SystemTime::now().duration_since(last) {
        if elapsed > Duration::from_secs(90) {
          broadcast(&resume_app, "refresh");
        }
      }
      last = SystemTime::now();
    }
  });
  tauri::async_runtime::spawn(async move {
    let mut interval = tokio::time::interval(Duration::from_millis(AUTO_REFRESH_MS));
    interval.tick().await;
    loop {
      interval.tick().await;
      broadcast(&app, "refresh");
    }
  });
}

fn enable_login_default(app: &AppHandle, exe: &str) {
  if shell::is_ephemeral(exe) {
    return;
  }
  let marker = vault::data_dir().join("login-item-initialized");
  if marker.exists() {
    return;
  }
  let _ = fs::create_dir_all(vault::data_dir());
  let _ = app.autolaunch().enable();
  let _ = fs::write(marker, "1");
}

pub fn run() {
  shell::set_aumid();
  let prefs = load_prefs();
  let flyout_pinned = prefs.flyout_pinned;
  let hidden_start = std::env::args().any(|a| a == "--hidden");
  let refresh_start = std::env::args().any(|a| a == "--refresh");

  tauri::Builder::default()
    .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
      if argv.iter().any(|a| a == "--refresh") {
        broadcast(app, "refresh");
        return;
      }
      if !argv.iter().any(|a| a == "--hidden") {
        show_main(app);
      }
    }))
    .plugin(tauri_plugin_autostart::init(
      tauri_plugin_autostart::MacosLauncher::LaunchAgent,
      Some(vec!["--hidden".into()]),
    ))
    .plugin(tauri_plugin_notification::init())
    .manage(AppState {
      prefs: Mutex::new(prefs),
      quitting: AtomicBool::new(false),
      flyout_pinned: AtomicBool::new(flyout_pinned),
      alarms: Mutex::new(Alarms { items: HashMap::new() }),
      tray_click: Mutex::new(None),
    })
    .invoke_handler(tauri::generate_handler![
      start_device_login,
      poll_device_login,
      fetch_usage,
      delete_tokens,
      has_token,
      list_identities,
      show_toast,
      autostart_get,
      autostart_set,
      window_hide,
      window_show,
      window_minimize,
      window_maximize,
      app_quit,
      prefs_get,
      prefs_set,
      open_external,
      flyout_pin,
      tray_tooltip,
      title_theme,
      vault_status,
      set_alarms
    ])
    .setup(move |app| {
      let handle = app.handle().clone();
      if let Some(main) = main_window(&handle) {
        apply_effects(&main, true);
        let app_for_main = handle.clone();
        main.on_window_event(move |event| {
          if let WindowEvent::CloseRequested { api, .. } = event {
            if !app_for_main
              .try_state::<AppState>()
              .map(|s| s.quitting.load(Ordering::SeqCst))
              .unwrap_or(false)
            {
              api.prevent_close();
              hide_to_tray(&app_for_main);
            }
          }
          if matches!(event, WindowEvent::Moved { .. } | WindowEvent::Resized { .. }) {
            if main_window(&app_for_main)
              .and_then(|w| w.is_maximized().ok())
              .unwrap_or(false)
            {
              broadcast(&app_for_main, "window:maximized");
            } else {
              broadcast(&app_for_main, "window:restored");
            }
          }
        });
      }
      if let Some(flyout) = flyout_window(&handle) {
        apply_effects(&flyout, false);
        let app_for_fly = handle.clone();
        flyout.on_window_event(move |event| {
          if let WindowEvent::Focused(false) = event {
            let pinned = app_for_fly
              .try_state::<AppState>()
              .map(|s| s.flyout_pinned.load(Ordering::SeqCst))
              .unwrap_or(false);
            if !pinned {
              if let Some(win) = flyout_window(&app_for_fly) {
                let _ = win.hide();
              }
            }
          }
        });
      }

      let icon = handle.default_window_icon().cloned();
      let mut tray = TrayIconBuilder::with_id("quodex")
        .tooltip("Quodex")
        .show_menu_on_left_click(false);
      if let Some(icon) = icon {
        tray = tray.icon(icon);
      }
      let app_for_tray = handle.clone();
      let tray = tray
        .on_tray_icon_event(move |_tray, event| handle_tray_event(&app_for_tray, event))
        .on_menu_event({
          let app_for_menu = handle.clone();
          move |_app, event| handle_menu(&app_for_menu, event.id.as_ref())
        })
        .build(&handle)?;

      let _ = tray;
      rebuild_tray_menu(&handle);

      let exe = std::env::current_exe()
        .ok()
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or_default();
      enable_login_default(&handle, &exe);
      if !exe.is_empty() {
        shell::install_shortcuts(&exe);
      }

      spawn_alarm_loop(handle.clone());
      spawn_refresh_loop(handle.clone());

      if refresh_start {
        broadcast(&handle, "refresh");
      }
      if hidden_start {
        if let Some(state) = handle.try_state::<AppState>() {
          if let Ok(mut prefs) = state.prefs.lock() {
            prefs.first_hide_done = true;
            save_prefs(&prefs);
          }
        }
        if let Some(win) = main_window(&handle) {
          let _ = win.set_skip_taskbar(true);
          let _ = win.hide();
        }
      } else {
        show_main(&handle);
      }
      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("quodex")
    .run(|_app, _event| {});
}
