#![cfg_attr(target_os = "windows", windows_subsystem = "windows")]

use glyph_lib::link_broker::validate_launch_url;
use std::ffi::OsString;
use std::path::{Path, PathBuf};
use std::process::Command;

fn main() {
    if let Err(error) = run(std::env::args_os()) {
        eprintln!("[glyph-link-broker] rejected launch: {error}");
        std::process::exit(2);
    }
}

fn run(args: impl IntoIterator<Item = OsString>) -> Result<(), String> {
    let mut args = args.into_iter();
    let broker_path = args.next().ok_or("broker executable path is missing")?;
    let raw = args.next();
    if args.next().is_some() {
        return Err("multiple launch arguments are not allowed".into());
    }

    let wallet = find_wallet_binary(Path::new(&broker_path))?;
    let mut command = Command::new(wallet);
    if let Some(raw) = raw {
        let raw = raw
            .into_string()
            .map_err(|_| "link argument is not valid Unicode")?;
        validate_launch_url(&raw)?;
        command.arg(raw);
    }
    launch_wallet(&mut command)?;
    Ok(())
}

#[cfg(target_os = "windows")]
fn launch_wallet(command: &mut Command) -> Result<(), String> {
    command
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("wallet launch failed: {error}"))
}

#[cfg(not(target_os = "windows"))]
fn launch_wallet(command: &mut Command) -> Result<(), String> {
    command
        .status()
        .map(|_| ())
        .map_err(|error| format!("wallet launch failed: {error}"))
}

fn find_wallet_binary(broker_path: &Path) -> Result<PathBuf, String> {
    let directory = broker_path
        .parent()
        .ok_or("broker executable directory is unavailable")?;

    #[cfg(target_os = "windows")]
    let candidates = ["glyph-wallet.exe", "Glyph.exe"];
    #[cfg(not(target_os = "windows"))]
    let candidates = ["glyph-wallet", "Glyph"];

    for name in candidates {
        let candidate = directory.join(name);
        if candidate.is_file() && candidate != broker_path {
            return Ok(candidate);
        }
    }

    Err("wallet executable was not found beside the broker".into())
}

#[cfg(test)]
mod tests {
    use super::find_wallet_binary;
    use std::fs;

    #[test]
    fn finds_only_a_fixed_wallet_name_beside_the_broker() {
        let root = std::env::temp_dir().join(format!(
            "glyph-link-broker-test-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();

        #[cfg(target_os = "windows")]
        let wallet_name = "glyph-wallet.exe";
        #[cfg(not(target_os = "windows"))]
        let wallet_name = "glyph-wallet";

        let broker = root.join("glyph-link-broker");
        let wallet = root.join(wallet_name);
        fs::write(&wallet, []).unwrap();

        assert_eq!(find_wallet_binary(&broker).unwrap(), wallet);
        fs::remove_dir_all(root).unwrap();
    }
}
