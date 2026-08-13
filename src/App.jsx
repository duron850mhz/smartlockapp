import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  Settings,
  ChevronLeft,
  Lock,
  Unlock,
  HelpCircle,
  RefreshCw,
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  ShieldCheck,
  BatteryWarning,
  BatteryFull,
  BatteryMedium,
  KeyRound,
  AlertTriangle,
} from "lucide-react";
import { fetchStatus, sendCommand, CMD } from "./lib/sesameApi.js";
import {
  loadLocks,
  saveLocks,
  loadApiKey,
  saveApiKey,
  loadStatusCache,
  updateStatusCacheEntry,
} from "./lib/storage.js";

// ---- 表示ヘルパー ----
function formatRelativeTime(ts) {
  if (!ts) return "未確認";
  const diffSec = Math.floor((Date.now() - ts) / 1000);
  if (diffSec < 10) return "たった今";
  if (diffSec < 60) return `${diffSec}秒前`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}分前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}時間前`;
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
}

function mergeLockWithCache(lock, cache) {
  const entry = cache[lock.id];
  return {
    ...lock,
    status: entry?.status ?? "unknown",
    battery: entry?.battery,
    position: entry?.position,
    updatedAt: entry?.updatedAt,
    checking: false,
  };
}

function LockDial({ status }) {
  const rotation = status === "locked" ? 0 : status === "unlocked" ? -62 : 0;
  const ring =
    status === "locked"
      ? "border-red-200 bg-red-50"
      : status === "unlocked"
      ? "border-blue-200 bg-blue-50"
      : "border-gray-200 bg-gray-50";
  const needle =
    status === "locked" ? "bg-red-600" : status === "unlocked" ? "bg-blue-500" : "bg-gray-300";

  return (
    <div
      className={`relative w-14 h-14 rounded-full border-2 flex items-center justify-center shrink-0 ${ring}`}
    >
      {(status === "locked" || status === "unlocked") && (
        <div
          className={`absolute w-1 h-5 rounded-full top-1.5 transition-transform duration-500 ease-out ${needle}`}
          style={{
            transform: `rotate(${rotation}deg)`,
            transformOrigin: "50% 26px",
          }}
        />
      )}
      {status === "moving" && (
        <div className="absolute w-1 h-5 rounded-full top-1.5 bg-gray-400 animate-spin" />
      )}
      <div className="w-2 h-2 rounded-full bg-white border border-gray-300 z-10" />
      <div className="absolute">
        {status === "locked" && <Lock className="w-4 h-4 text-red-600" strokeWidth={2.5} />}
        {status === "unlocked" && <Unlock className="w-4 h-4 text-blue-500" strokeWidth={2.5} />}
        {status === "unknown" && <HelpCircle className="w-4 h-4 text-gray-300" strokeWidth={2.5} />}
      </div>
    </div>
  );
}

function BatteryBadge({ level }) {
  if (level == null) {
    return <span className="text-xs text-gray-300 font-mono">--%</span>;
  }
  if (level <= 20) {
    return (
      <span className="inline-flex items-center gap-1 text-amber-600 text-xs font-mono">
        <BatteryWarning className="w-3.5 h-3.5" />
        {level}%
      </span>
    );
  }
  if (level <= 60) {
    return (
      <span className="inline-flex items-center gap-1 text-gray-500 text-xs font-mono">
        <BatteryMedium className="w-3.5 h-3.5" />
        {level}%
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-gray-500 text-xs font-mono">
      <BatteryFull className="w-3.5 h-3.5" />
      {level}%
    </span>
  );
}

function LockCard({ lock, canOperate, onToggle }) {
  const statusLabel =
    lock.status === "locked"
      ? "施錠中"
      : lock.status === "unlocked"
      ? "解錠中"
      : lock.status === "moving"
      ? "操作中…"
      : "未確認";
  const statusColor =
    lock.status === "locked"
      ? "text-red-700"
      : lock.status === "unlocked"
      ? "text-blue-600"
      : lock.status === "moving"
      ? "text-gray-400"
      : "text-gray-400";

  const disabledReason = !canOperate ? "設定でAPIキーとシークレットキーを登録してください" : null;
  const busy = lock.status === "moving";

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4">
      <LockDial status={lock.status} />

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-[15px] font-medium text-gray-900 truncate tracking-tight">
            {lock.name}
          </h3>
          <BatteryBadge level={lock.battery} />
        </div>
        <p className={`text-sm font-medium mt-0.5 ${statusColor}`}>{statusLabel}</p>
        <p className="text-[11px] text-gray-400 font-mono mt-1 flex items-center gap-1">
          更新: {lock.checking ? "確認中…" : formatRelativeTime(lock.updatedAt)}
        </p>
        {lock.error && (
          <p className="text-[11px] text-red-500 mt-1 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            {lock.error}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1 shrink-0" title={disabledReason || undefined}>
        <button
          disabled={!canOperate || busy || lock.status === "locked"}
          onClick={() => onToggle(lock, CMD.LOCK, "locked")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            canOperate && !busy && lock.status !== "locked"
              ? "border-red-600 text-red-600 hover:bg-red-50"
              : "border-gray-200 text-gray-300 cursor-not-allowed"
          }`}
        >
          施錠
        </button>
        <button
          disabled={!canOperate || busy || lock.status === "unlocked"}
          onClick={() => onToggle(lock, CMD.UNLOCK, "unlocked")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            canOperate && !busy && lock.status !== "unlocked"
              ? "border-blue-600 text-blue-600 hover:bg-blue-50"
              : "border-gray-200 text-gray-300 cursor-not-allowed"
          }`}
        >
          解錠
        </button>
      </div>
    </div>
  );
}

function SettingsView({ locks, apiKey, onSaveApiKey, onBack, onEdit, onDelete, onAdd }) {
  const [showApi, setShowApi] = useState(false);
  const [apiDraft, setApiDraft] = useState(apiKey);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        <button onClick={onBack} className="p-1 -ml-1 text-gray-500 hover:text-gray-900">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="text-[15px] font-medium text-gray-900 tracking-tight">設定</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        <div>
          <label className="text-xs font-medium text-gray-500 flex items-center gap-1">
            <KeyRound className="w-3 h-3" />
            APIキー（全ロック共通）
          </label>
          <div className="relative mt-1">
            <input
              type={showApi ? "text" : "password"}
              value={apiDraft}
              onChange={(e) => setApiDraft(e.target.value)}
              onBlur={() => onSaveApiKey(apiDraft)}
              placeholder="CandyHouse Web API Key"
              className="w-full border border-gray-200 rounded-lg pl-3 pr-9 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              type="button"
              onClick={() => setShowApi((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showApi ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs font-medium text-gray-500 mb-2">ロック一覧</p>
          <div className="space-y-2">
            {locks.map((lock) => (
              <div
                key={lock.id}
                className="flex items-center justify-between border border-gray-200 rounded-lg px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{lock.name}</p>
                  <p className="text-[11px] text-gray-400 font-mono truncate">{lock.uuid}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <button
                    onClick={() => onEdit(lock)}
                    className="p-1.5 text-gray-400 hover:text-gray-700"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDelete(lock.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={onAdd}
            className="w-full flex items-center justify-center gap-1.5 border border-dashed border-gray-300 rounded-lg py-2.5 text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 mt-2"
          >
            <Plus className="w-4 h-4" />
            ロックを追加
          </button>
        </div>
      </div>

      <div className="px-4 py-3 border-t border-gray-100 flex items-start gap-2 text-[11px] text-gray-400 leading-relaxed">
        <ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        UUID・シークレットキーはロックごとに、APIキーは共通で、すべてこの端末のブラウザ内にのみ保存されます。サーバーには送信されません。
      </div>
    </div>
  );
}

function LockForm({ initial, onCancel, onSave }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [uuid, setUuid] = useState(initial?.uuid ?? "");
  const [secretKey, setSecretKey] = useState(initial?.secretKey ?? "");
  const [showSecret, setShowSecret] = useState(false);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        <button onClick={onCancel} className="p-1 -ml-1 text-gray-500 hover:text-gray-900">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="text-[15px] font-medium text-gray-900 tracking-tight">
          {initial ? "ロックを編集" : "ロックを追加"}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div>
          <label className="text-xs font-medium text-gray-500">名前</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: 玄関"
            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-500">UUID</label>
          <input
            value={uuid}
            onChange={(e) => setUuid(e.target.value)}
            placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-500">シークレットキー</label>
          <div className="relative mt-1">
            <input
              type={showSecret ? "text" : "password"}
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              placeholder="HEX形式の秘密鍵"
              className="w-full border border-gray-200 rounded-lg pl-3 pr-9 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              type="button"
              onClick={() => setShowSecret((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50"
        >
          キャンセル
        </button>
        <button
          onClick={() => onSave({ name, uuid, secretKey })}
          disabled={!name || !uuid || !secretKey}
          className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-gray-900 text-white hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400"
        >
          保存
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [locks, setLocks] = useState([]);
  const [apiKey, setApiKey] = useState("");
  const [view, setView] = useState("list");
  const [editingLock, setEditingLock] = useState(null);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const timers = useRef({});

  // 初回マウント時にlocalStorageから復元。ここではAPIは一切叩かない。
  useEffect(() => {
    const storedLocks = loadLocks();
    const storedApiKey = loadApiKey();
    const cache = loadStatusCache();
    setLocks(storedLocks.map((l) => mergeLockWithCache(l, cache)));
    setApiKey(storedApiKey);
    setLoaded(true);
  }, []);

  const persistLocks = useCallback((updater) => {
    setLocks((prev) => {
      const next = updater(prev);
      // localStorageには秘匿情報+設定のみ保存（statusはキャッシュ側で別管理）
      saveLocks(next.map(({ id, name, uuid, secretKey }) => ({ id, name, uuid, secretKey })));
      return next;
    });
  }, []);

  const refreshLock = useCallback(
    async (lock) => {
      if (!apiKey || !lock.uuid) return;
      setLocks((prev) =>
        prev.map((l) => (l.id === lock.id ? { ...l, checking: true, error: null } : l))
      );
      const result = await fetchStatus(lock.uuid, apiKey);
      setLocks((prev) =>
        prev.map((l) => {
          if (l.id !== lock.id) return l;
          if (!result.ok) {
            return { ...l, checking: false, error: result.error };
          }
          const entry = {
            status: result.data.CHSesame2Status,
            battery: result.data.batteryPercentage,
            position: result.data.position,
            updatedAt: Date.now(),
          };
          updateStatusCacheEntry(lock.id, entry);
          return { ...l, ...entry, checking: false, error: null };
        })
      );
    },
    [apiKey]
  );

  const handleRefreshAll = async () => {
    if (!apiKey || locks.length === 0) return;
    setRefreshingAll(true);
    await Promise.all(locks.map((l) => refreshLock(l)));
    setRefreshingAll(false);
  };

  const handleToggle = async (lock, cmd, targetStatus) => {
    if (!apiKey || !lock.secretKey) return;
    clearTimeout(timers.current[lock.id]);
    setLocks((prev) =>
      prev.map((l) => (l.id === lock.id ? { ...l, status: "moving", error: null } : l))
    );

    const result = await sendCommand(lock.uuid, apiKey, lock.secretKey, cmd, "smart-lock-app");

    setLocks((prev) =>
      prev.map((l) => {
        if (l.id !== lock.id) return l;
        if (!result.ok) {
          // 失敗した場合は直前の状態に戻す（不明な場合はunknownへ）
          return { ...l, status: l.status === "moving" ? "unknown" : l.status, error: result.error };
        }
        // コマンド受理=成功として楽観的に状態を更新。
        // 実際に動いたかどうかまでは追加のGETをしない限り確認できないため、
        // 心配な場合は手動で「更新」を押してもらう運用とする。
        const entry = { status: targetStatus, battery: l.battery, position: l.position, updatedAt: Date.now() };
        updateStatusCacheEntry(lock.id, entry);
        return { ...l, ...entry, error: null };
      })
    );
  };

  const canOperate = (lock) => Boolean(apiKey && lock.secretKey && lock.uuid);

  if (!loaded) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center py-6 px-3">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col min-h-[560px]">
        {view === "list" && (
          <>
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100">
              <h1 className="text-base font-semibold text-gray-900 tracking-tight">
                スマートロック
              </h1>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleRefreshAll}
                  disabled={!apiKey || locks.length === 0}
                  className="p-2 text-gray-400 hover:text-gray-700 disabled:text-gray-200"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshingAll ? "animate-spin" : ""}`} />
                </button>
                <button
                  onClick={() => setView("settings")}
                  className="p-2 text-gray-400 hover:text-gray-700"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            </div>

            {!apiKey && locks.length > 0 && (
              <div className="mx-4 mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded-lg px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                APIキーが未設定です。設定画面から登録してください。
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {locks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-6 py-10">
                  <Lock className="w-8 h-8 text-gray-300 mb-3" />
                  <p className="text-sm text-gray-500 mb-4">ロックが登録されていません</p>
                  <button
                    onClick={() => setView("settings")}
                    className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium"
                  >
                    ロックを追加
                  </button>
                </div>
              ) : (
                locks.map((lock) => (
                  <LockCard
                    key={lock.id}
                    lock={lock}
                    canOperate={canOperate(lock)}
                    onToggle={handleToggle}
                  />
                ))
              )}
            </div>
          </>
        )}

        {view === "settings" && (
          <SettingsView
            locks={locks}
            apiKey={apiKey}
            onSaveApiKey={(key) => {
              setApiKey(key);
              saveApiKey(key);
            }}
            onBack={() => setView("list")}
            onEdit={(lock) => {
              setEditingLock(lock);
              setView("form");
            }}
            onDelete={(id) => persistLocks((prev) => prev.filter((l) => l.id !== id))}
            onAdd={() => {
              setEditingLock(null);
              setView("form");
            }}
          />
        )}

        {view === "form" && (
          <LockForm
            initial={editingLock}
            onCancel={() => setView("settings")}
            onSave={({ name, uuid, secretKey }) => {
              if (editingLock) {
                persistLocks((prev) =>
                  prev.map((l) => (l.id === editingLock.id ? { ...l, name, uuid, secretKey } : l))
                );
              } else {
                persistLocks((prev) => [
                  ...prev,
                  {
                    id: `l${Date.now()}`,
                    name,
                    uuid,
                    secretKey,
                    status: "unknown",
                    battery: undefined,
                    position: undefined,
                    updatedAt: undefined,
                    checking: false,
                  },
                ]);
              }
              setView("settings");
            }}
          />
        )}
      </div>
    </div>
  );
}
