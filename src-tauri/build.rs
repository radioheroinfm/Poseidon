fn main() {
    // Recompile when the injected renderer bootstrap changes (include_str! is compile-time).
    println!("cargo:rerun-if-changed=../src/desktop-bridge/poseidon-bootstrap.js");
    tauri_build::build()
}
