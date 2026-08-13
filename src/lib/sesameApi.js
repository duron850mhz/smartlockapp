import { aesCmac, bytesToHex, hexToBytes } from "./cmac.js";

const BASE_URL = "https://app.candyhouse.co/api/sesame2";

export const CMD = {
  LOCK: 82,
  UNLOCK: 83,
  TOGGLE: 88,
};

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

// Python版と同じ手順: 現在時刻(秒)をリトルエンディアン4バイト化し、
// 先頭1バイトを捨てた残り3バイトをAES-CMACで署名する。
function buildSign(secretKeyHex) {
  const ts = Math.floor(Date.now() / 1000);
  const b0 = ts & 0xff;
  const b1 = (ts >>> 8) & 0xff;
  const b2 = (ts >>> 16) & 0xff;
  const b3 = (ts >>> 24) & 0xff;
  const message = new Uint8Array([b1, b2, b3]);

  const keyBytes = hexToBytes(secretKeyHex);
  const tag = aesCmac(keyBytes, message);
  return bytesToHex(tag);
}

/**
 * ロックの現在状態を取得する。
 * 戻り値: { ok, data } または { ok:false, error }
 */
export async function fetchStatus(uuid, apiKey) {
  try {
    const res = await fetch(`${BASE_URL}/${uuid}`, {
      method: "GET",
      headers: { "x-api-key": apiKey },
    });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    const data = await res.json();
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e.message || "ネットワークエラー" };
  }
}

/**
 * 施錠/解錠/トグルコマンドを送信する。
 * cmd: CMD.LOCK | CMD.UNLOCK | CMD.TOGGLE
 */
export async function sendCommand(uuid, apiKey, secretKeyHex, cmd, historyText = "smart-lock-app") {
  try {
    const sign = buildSign(secretKeyHex);
    const body = {
      cmd,
      history: utf8ToBase64(historyText),
      sign,
    };
    const res = await fetch(`${BASE_URL}/${uuid}/cmd`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}${text ? `: ${text}` : ""}` };
    }
    return { ok: true, raw: text };
  } catch (e) {
    return { ok: false, error: e.message || "ネットワークエラー" };
  }
}
