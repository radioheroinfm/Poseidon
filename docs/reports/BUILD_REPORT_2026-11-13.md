# Build report — cathedral host

**Date:** 2026-11-13  
**Commit tested:** `aca12f4` (R1 ownership + R5 SIGKILL)  
**Host:** Linux cathedral (x86_64)

## Toolchain (verbatim)

```
rustc 1.99.1 (58cf8f9c3 2026-10-13)
cargo 1.99.1 (5f94df478 2026-08-27)
node v24.21.0
```

## cargo test

```
running 8 tests
test bridge::tests::external_url_allows_http_https_mailto ... ok
test bridge::tests::external_url_blocks_dangerous_schemes ... ok
test bridge::tests::open_path_rejects_empty_and_schemes ... ok
test gateway::tests::parse_ready_backend ... ok
test gateway::tests::parse_ready_dashboard_legacy ... ok
test gateway::tests::parse_ready_ignores_noise ... ok
test gateway::tests::new_manager_is_not_owned ... ok
test gateway::tests::stop_without_ownership_is_safe ... ok

test result: ok. 8 passed; 0 failed
```

## tauri build --debug

```
Built application at: .../debug/poseidon-desktop
Finished 3 bundles:
  Poseidon_0.1.0_amd64.deb          53.99 MiB
  Poseidon-0.1.0-1.x86_64.rpm       54.00 MiB
  Poseidon_0.1.0_amd64.AppImage    127.24 MiB
```

## tauri dev

Window opens. GTK note (non-fatal):
`gtk_window_set_titlebar() called on a realized window`

## Notes

- R1/R5 changes compile and pass unit tests.
- CI still not enabled in `.github/workflows/` (ADR-012 open).
- Release build and Electron baseline not measured in this report.
