// ====== CONFIG ======
const CONFIG = {
  SHEET_ID: '1WduS-Bgeab_1YTWc3pZ0WAOMEN_oE4DFmRH4OVT8D_I',
  GID: '1203093323',           // tab GID from your URL
  REFRESH_MS: 60000,           // auto-refresh every 60s
  TARGET_OEE: 85               // target line for OEE %
};

// Column mapping (zero-indexed) — based on your previous spec
const COL = {
  Performance:        20,   // U
  DATE:       1,   // B
  SHIFT:      2,   // C
  MACHINE:    3,   // D
  ITEM:       5,   // F
  CYCLE:      6,   // G
  CAVITY:     7,   // H
  AVAILABLE:  9,   // J
  DOWNTIME:   12,  // M
  REASON:     13,  // N
  CAPACITY:   14,  // O
  ACTUAL:     15,  // P
  REJECT:     18   // S
};
