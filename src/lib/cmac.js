// AES-CMAC (RFC 4493) の最小実装。
// SesameのWeb APIは「タイムスタンプ由来の3バイトメッセージ」に対する
// 128bit AES-CMAC の署名（16バイト = 32桁hex）を要求する。
// メッセージが常に16バイト未満（1ブロック未満）で終わるため、
// 実装は「最終ブロック(パディングあり)のみ」のケースに単純化できる。
import aesjs from "aes-js";

const BLOCK_SIZE = 16;
const RB = 0x87; // AES(128bit)用の定数

function xorBytes(a, b) {
  const out = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] ^ b[i];
  return out;
}

// 16バイト配列を1ビット左シフトする
function shiftLeft1(input) {
  const output = new Uint8Array(BLOCK_SIZE);
  let overflow = 0;
  for (let i = BLOCK_SIZE - 1; i >= 0; i--) {
    output[i] = ((input[i] << 1) | overflow) & 0xff;
    overflow = (input[i] & 0x80) >> 7;
  }
  return output;
}

function generateSubkeys(aes) {
  const zero = new Uint8Array(BLOCK_SIZE);
  const L = aes.encrypt(zero);

  let K1 = shiftLeft1(L);
  if (L[0] & 0x80) {
    K1[BLOCK_SIZE - 1] ^= RB;
  }

  let K2 = shiftLeft1(K1);
  if (K1[0] & 0x80) {
    K2[BLOCK_SIZE - 1] ^= RB;
  }

  return { K1, K2 };
}

/**
 * AES-CMAC を計算し、16バイトのタグ(Uint8Array)を返す。
 * @param {Uint8Array} keyBytes 128bit(16バイト)鍵
 * @param {Uint8Array} message 任意長メッセージ（このアプリでは常に16バイト未満）
 */
export function aesCmac(keyBytes, message) {
  const aes = new aesjs.AES(keyBytes);
  const { K1, K2 } = generateSubkeys(aes);

  // 今回のユースケースではメッセージは常に1ブロック未満 = パディングありの最終ブロックのみ
  if (message.length >= BLOCK_SIZE) {
    throw new Error("このアプリの用途では16バイト以上のメッセージは想定していません");
  }

  const padded = new Uint8Array(BLOCK_SIZE);
  padded.set(message);
  padded[message.length] = 0x80; // パディング開始マーカー
  // 残りは0のまま

  const lastBlock = xorBytes(padded, K2);
  const X = new Uint8Array(BLOCK_SIZE); // 初期値0
  const T = aes.encrypt(xorBytes(X, lastBlock));

  return T;
}

export function bytesToHex(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function hexToBytes(hex) {
  const clean = hex.trim();
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return out;
}
