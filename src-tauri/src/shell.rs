use std::path::PathBuf;

const AUMID: &str = "com.quodex.Quodex";

#[cfg(windows)]
pub fn set_aumid() {
  use windows::core::HSTRING;
  use windows::Win32::UI::Shell::SetCurrentProcessExplicitAppUserModelID;
  let _ = unsafe { SetCurrentProcessExplicitAppUserModelID(&HSTRING::from(AUMID)) };
}

#[cfg(not(windows))]
pub fn set_aumid() {}

#[cfg(windows)]
fn apply_link_props(link: &windows::Win32::UI::Shell::IShellLinkW, title: Option<&str>) {
  use windows::core::{Interface, GUID, PROPVARIANT};
  use windows::Win32::UI::Shell::PropertiesSystem::{IPropertyStore, PROPERTYKEY};
  const PKEY_APPUSERMODEL_ID: PROPERTYKEY = PROPERTYKEY {
    fmtid: GUID::from_u128(0x9f4c2855_9f79_4b39_a8d0_e1d42de1d5f3),
    pid: 5,
  };
  const PKEY_TITLE: PROPERTYKEY = PROPERTYKEY {
    fmtid: GUID::from_u128(0xf29f85e0_4ff9_1068_ab91_08002b27b3d9),
    pid: 2,
  };
  let Ok(store) = link.cast::<IPropertyStore>() else {
    return;
  };
  let aumid = PROPVARIANT::from(AUMID);
  let _ = unsafe { store.SetValue(&PKEY_APPUSERMODEL_ID, &aumid) };
  if let Some(title) = title {
    let value = PROPVARIANT::from(title);
    let _ = unsafe { store.SetValue(&PKEY_TITLE, &value) };
  }
  let _ = unsafe { store.Commit() };
}

#[cfg(windows)]
fn write_shortcut(dest: PathBuf, exe: &str) {
  use windows::core::{HSTRING, Interface, PCWSTR};
  use windows::Win32::Foundation::TRUE;
  use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CLSCTX_INPROC_SERVER, COINIT_APARTMENTTHREADED, IPersistFile,
  };
  use windows::Win32::UI::Shell::{IShellLinkW, ShellLink};
  unsafe {
    let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
    let Ok(link) = CoCreateInstance::<_, IShellLinkW>(&ShellLink, None, CLSCTX_INPROC_SERVER) else {
      return;
    };
    let exe_h = HSTRING::from(exe);
    let _ = link.SetPath(&exe_h);
    if let Some(dir) = PathBuf::from(exe).parent() {
      let _ = link.SetWorkingDirectory(&HSTRING::from(dir.to_string_lossy().as_ref()));
    }
    let _ = link.SetIconLocation(&exe_h, 0);
    let _ = link.SetDescription(&HSTRING::from("ChatGPT usage tracker"));
    apply_link_props(&link, Some("Quodex"));
    let Ok(file) = link.cast::<IPersistFile>() else {
      return;
    };
    let dest_h = HSTRING::from(dest.to_string_lossy().as_ref());
    let _ = file.Save(PCWSTR(dest_h.as_ptr()), TRUE);
  }
}

#[cfg(not(windows))]
fn write_shortcut(_: PathBuf, _: &str) {}

pub fn install_shortcuts(exe: &str) {
  if let Some(desktop) = dirs::desktop_dir() {
    write_shortcut(desktop.join("Quodex.lnk"), exe);
  }
  if let Some(roaming) = dirs::data_dir() {
    let programs = roaming.join("Microsoft/Windows/Start Menu/Programs");
    let _ = std::fs::create_dir_all(&programs);
    write_shortcut(programs.join("Quodex.lnk"), exe);
  }
  install_jump_list(exe);
}

#[cfg(windows)]
fn install_jump_list(exe: &str) {
  use windows::core::{HSTRING, Interface};
  use windows::Win32::System::Com::{CoCreateInstance, CoInitializeEx, CLSCTX_INPROC_SERVER, COINIT_APARTMENTTHREADED};
  use windows::Win32::UI::Shell::Common::{IObjectArray, IObjectCollection};
  use windows::Win32::UI::Shell::{
    DestinationList, EnumerableObjectCollection, ICustomDestinationList, IShellLinkW, ShellLink,
  };
  unsafe {
    let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
    let Ok(list) = CoCreateInstance::<_, ICustomDestinationList>(&DestinationList, None, CLSCTX_INPROC_SERVER) else {
      return;
    };
    if list.SetAppID(&HSTRING::from(AUMID)).is_err() {
      return;
    }
    let mut min_slots = 0u32;
    if list.BeginList::<IObjectArray>(&mut min_slots).is_err() {
      let _ = list.AbortList();
      return;
    }
    let Ok(tasks) = CoCreateInstance::<_, IObjectCollection>(&EnumerableObjectCollection, None, CLSCTX_INPROC_SERVER) else {
      let _ = list.AbortList();
      return;
    };
    let Ok(link) = CoCreateInstance::<_, IShellLinkW>(&ShellLink, None, CLSCTX_INPROC_SERVER) else {
      let _ = list.AbortList();
      return;
    };
    let exe_h = HSTRING::from(exe);
    let _ = link.SetPath(&exe_h);
    if let Some(dir) = PathBuf::from(exe).parent() {
      let _ = link.SetWorkingDirectory(&HSTRING::from(dir.to_string_lossy().as_ref()));
    }
    let _ = link.SetArguments(&HSTRING::from("--refresh"));
    let _ = link.SetIconLocation(&exe_h, 0);
    let _ = link.SetDescription(&HSTRING::from("Refresh ChatGPT usage for every saved account"));
    apply_link_props(&link, Some("Refresh usage"));
    if tasks.AddObject(&link).is_err() {
      let _ = list.AbortList();
      return;
    }
    let Ok(array) = tasks.cast::<IObjectArray>() else {
      let _ = list.AbortList();
      return;
    };
    if list.AddUserTasks(&array).is_err() {
      let _ = list.AbortList();
      return;
    }
    let _ = list.CommitList();
  }
}

#[cfg(not(windows))]
fn install_jump_list(_: &str) {}

pub fn is_ephemeral(exe: &str) -> bool {
  let path = exe.replace('/', "\\").to_ascii_lowercase();
  path.contains("\\downloads\\")
    || path.contains("\\temp\\")
    || path.contains("\\appdata\\local\\temp")
    || path.contains("\\tmp\\")
}
