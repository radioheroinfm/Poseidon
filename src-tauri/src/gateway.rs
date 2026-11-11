//! Управление жизненным циклом Python Gateway (hermes serve)
//! 
//! Цель: никаких зомби-процессов и блокировок SQLite.
//! Реализация RAII + платформо-специфичные защиты (Job Objects / signals).

// TODO: Реализовать GatewayManager
