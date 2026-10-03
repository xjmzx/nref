// nref — a reference browser for Nostr event kinds and NIPs.
//
// The data is two git checkouts the user already has: nostr-protocol/nips
// (NN.md files + the README's kind table) and nostr-protocol/registry-of-kinds
// (schema.yaml). This side only finds them, reads them as text and runs git;
// all parsing happens in the webview, so the raw files stay the single source
// and nothing is cached or stored. No keys, no relays, no database.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::Manager;

// Dev/install isolation (SUITE.md): a debug build keeps its own config file, so
// `make dev` never re-points the installed app's checkouts.
#[cfg(debug_assertions)]
const CONFIG_FILE: &str = "nref.dev.json";
#[cfg(not(debug_assertions))]
const CONFIG_FILE: &str = "nref.json";

#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase", default)]
struct Config {
    nips_path: Option<String>,
    kinds_path: Option<String>,
}

#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "lowercase")]
enum Which {
    Nips,
    Kinds,
}

fn config_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    Ok(dir.join(CONFIG_FILE))
}

fn read_config(app: &tauri::AppHandle) -> Config {
    config_path(app)
        .ok()
        .and_then(|p| fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn write_config(app: &tauri::AppHandle, cfg: &Config) -> Result<(), String> {
    let path = config_path(app)?;
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(cfg).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())
}

/// Where a checkout is looked for when none has been picked: `~/code/nostr/<repo>`.
fn default_path(app: &tauri::AppHandle, which: Which) -> Option<String> {
    let home = app.path().home_dir().ok()?;
    let name = match which {
        Which::Nips => "nips",
        Which::Kinds => "registry-of-kinds",
    };
    Some(home.join("code").join("nostr").join(name).to_string_lossy().into_owned())
}

fn repo_path(app: &tauri::AppHandle, cfg: &Config, which: Which) -> String {
    let set = match which {
        Which::Nips => cfg.nips_path.clone(),
        Which::Kinds => cfg.kinds_path.clone(),
    };
    set.or_else(|| default_path(app, which)).unwrap_or_default()
}

fn git(path: &str, args: &[&str]) -> Result<String, String> {
    let out = Command::new("git")
        .arg("-C")
        .arg(path)
        .args(args)
        // A reference viewer must never sit waiting on a credential prompt
        // nobody can see.
        .env("GIT_TERMINAL_PROMPT", "0")
        .output()
        .map_err(|e| format!("could not run git: {e}"))?;
    let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if out.status.success() {
        Ok(stdout)
    } else {
        let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
        Err(if stderr.is_empty() { stdout } else { stderr })
    }
}

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
struct RepoState {
    path: String,
    exists: bool,
    is_git: bool,
    /// Short hash, committer date (ISO 8601) and subject of HEAD.
    head: Option<String>,
    date: Option<String>,
    subject: Option<String>,
    branch: Option<String>,
    /// As stored, not as rewritten by `url.*.insteadOf` (SUITE.md: audit with
    /// `git config --get`, never `git remote get-url`).
    remote: Option<String>,
}

fn repo_state(path: String) -> RepoState {
    let mut st = RepoState { exists: Path::new(&path).is_dir(), path, ..Default::default() };
    if !st.exists {
        return st;
    }
    if let Ok(log) = git(&st.path, &["log", "-1", "--format=%h%x1f%cI%x1f%s"]) {
        let mut parts = log.split('\u{1f}');
        st.head = parts.next().map(str::to_string);
        st.date = parts.next().map(str::to_string);
        st.subject = parts.next().map(str::to_string);
        st.is_git = true;
    }
    st.branch = git(&st.path, &["rev-parse", "--abbrev-ref", "HEAD"]).ok();
    st.remote = git(&st.path, &["config", "--get", "remote.origin.url"]).ok();
    st
}

#[derive(Serialize)]
struct NipFile {
    /// File stem: "01", "5A", "EE".
    id: String,
    text: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Loaded {
    nips: RepoState,
    kinds: RepoState,
    nip_files: Vec<NipFile>,
    readme: Option<String>,
    schema: Option<String>,
}

/// A NIP file is exactly two characters of 0-9/A-Z plus `.md` — numbered
/// (01.md … 99.md) or lettered (5A.md, EE.md). README.md and anything else in
/// the checkout is not a NIP.
fn nip_id(name: &str) -> Option<String> {
    let stem = name.strip_suffix(".md")?;
    let ok = stem.len() == 2 && stem.bytes().all(|b| b.is_ascii_digit() || b.is_ascii_uppercase());
    ok.then(|| stem.to_string())
}

fn load_blocking(app: &tauri::AppHandle) -> Loaded {
    let cfg = read_config(app);
    let nips = repo_state(repo_path(app, &cfg, Which::Nips));
    let kinds = repo_state(repo_path(app, &cfg, Which::Kinds));

    let mut nip_files = Vec::new();
    if let Ok(dir) = fs::read_dir(&nips.path) {
        for entry in dir.flatten() {
            let name = entry.file_name().to_string_lossy().into_owned();
            if let Some(id) = nip_id(&name) {
                if let Ok(text) = fs::read_to_string(entry.path()) {
                    nip_files.push(NipFile { id, text });
                }
            }
        }
    }
    nip_files.sort_by(|a, b| a.id.cmp(&b.id));

    let readme = fs::read_to_string(Path::new(&nips.path).join("README.md")).ok();
    let schema = fs::read_to_string(Path::new(&kinds.path).join("schema.yaml")).ok();
    Loaded { nips, kinds, nip_files, readme, schema }
}

// Async + spawn_blocking throughout: a synchronous Tauri command runs on the
// main thread, and a slow disk or a git pull there reads as "not responding".

/// Both checkouts, read fresh from disk.
#[tauri::command]
async fn load(app: tauri::AppHandle) -> Result<Loaded, String> {
    tauri::async_runtime::spawn_blocking(move || load_blocking(&app))
        .await
        .map_err(|e| e.to_string())
}

/// `git pull --ff-only` in one checkout. Fast-forward only: this is somebody's
/// working checkout, so it is never merged or rebased from here.
#[tauri::command]
async fn pull(app: tauri::AppHandle, which: Which) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let cfg = read_config(&app);
        let path = repo_path(&app, &cfg, which);
        git(&path, &["pull", "--ff-only"])
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Re-point one checkout through a native folder dialog. `Ok(false)` if the
/// dialog was cancelled.
#[tauri::command]
async fn pick_path(app: tauri::AppHandle, which: Which) -> Result<bool, String> {
    use tauri_plugin_dialog::DialogExt;
    let mut cfg = read_config(&app);
    let current = repo_path(&app, &cfg, which);
    let mut dialog = app.dialog().file();
    if Path::new(&current).is_dir() {
        dialog = dialog.set_directory(&current);
    }
    let Some(fp) = dialog.blocking_pick_folder() else {
        return Ok(false);
    };
    let path = fp.into_path().map_err(|e| e.to_string())?.to_string_lossy().into_owned();
    match which {
        Which::Nips => cfg.nips_path = Some(path),
        Which::Kinds => cfg.kinds_path = Some(path),
    }
    write_config(&app, &cfg)?;
    Ok(true)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![load, pull, pick_path])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
