# Local battery patch

This directory vendors `battery` 0.7.8 because it is the newest crates.io release but restricts its FreeBSD and DragonFly `nix` dependency to the vulnerable 0.19 series.

`Cargo.toml` changes that target-only requirement to `nix` 0.20.2, which contains fixes for GHSA-wgrg-5h56-jg27 and GHSA-76w9-p8mg-j927. Keep this patch only until an upstream battery release includes the fixed requirement.
