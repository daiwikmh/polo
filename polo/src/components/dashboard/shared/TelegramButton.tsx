"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import { Send, Loader2, Check, Copy, ExternalLink, X } from "lucide-react";

type TelegramState = {
  linked: boolean;
  linkedAt: string | null;
  deepLink: string | null;
  token: string | null;
  polling: boolean;
};

export default function TelegramButton() {
  const { address, isConnected } = useAccount();
  const [open, setOpen] = useState(false);
  const [tg, setTg] = useState<TelegramState>({
    linked: false, linkedAt: null, deepLink: null, token: null, polling: false,
  });
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fetch link status
  useEffect(() => {
    if (!address) return;
    fetch(`/api/telegram/status?address=${address}`)
      .then((r) => r.json())
      .then((data) => setTg((prev) => ({ ...prev, linked: data.linked, linkedAt: data.linkedAt })))
      .catch(() => {});
  }, [address, open]);

  // Poll for link completion
  useEffect(() => {
    if (!tg.polling || !address) return;
    const poll = setInterval(() => {
      fetch(`/api/telegram/status?address=${address}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.linked) {
            setTg((prev) => ({
              ...prev, linked: true, linkedAt: data.linkedAt,
              polling: false, deepLink: null, token: null,
            }));
          }
        })
        .catch(() => {});
    }, 3000);
    const timeout = setTimeout(() => {
      setTg((prev) => ({ ...prev, polling: false }));
    }, 10 * 60 * 1000);
    return () => { clearInterval(poll); clearTimeout(timeout); };
  }, [tg.polling, address]);

  const handleConnect = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      const res = await fetch("/api/telegram/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eoaAddress: address }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTg((prev) => ({
        ...prev, deepLink: data.deepLink, token: data.token, polling: true,
      }));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [address]);

  const handleDisconnect = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      await fetch("/api/telegram/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eoaAddress: address }),
      });
      setTg({ linked: false, linkedAt: null, deepLink: null, token: null, polling: false });
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [address]);

  if (!isConnected) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 14px",
          background: "none",
          border: "none",
          cursor: "pointer",
          transition: "background 0.12s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,136,204,0.04)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
      >
        <div style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          background: tg.linked ? "rgba(0,136,204,0.1)" : "#0a0a08",
          border: `1px solid ${tg.linked ? "rgba(0,136,204,0.2)" : "#1a1a18"}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <Send className="w-3.5 h-3.5" style={{ color: tg.linked ? "#0088CC" : "#525252" }} />
        </div>
        <div style={{ textAlign: "left", minWidth: 0 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: tg.linked ? "#0088CC" : "#a0a0a0", margin: 0 }}>
            {tg.linked ? "Telegram On" : "Telegram"}
          </p>
          <p style={{ fontSize: 9, color: "#363634", margin: 0, marginTop: 1 }}>
            {tg.linked ? "Alerts active" : "Connect alerts"}
          </p>
        </div>
      </button>

      {/* Modal */}
      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 380,
              background: "#0a0a08",
              border: "1px solid #1a1a18",
              borderRadius: 16,
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div style={{
              padding: "16px 20px",
              borderBottom: "1px solid #1a1a18",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: 0 }}>
                  Telegram Alerts
                </h3>
                <p style={{ fontSize: 10, color: "#525252", margin: "2px 0 0" }}>
                  Trade alerts and vault updates
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#525252", padding: 4 }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: 20 }}>
              {tg.linked ? (
                <div>
                  <div style={{
                    padding: "14px",
                    background: "rgba(0,136,204,0.04)",
                    border: "1px solid rgba(0,136,204,0.15)",
                    borderRadius: 10,
                    marginBottom: 16,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <Check className="w-4 h-4" style={{ color: "#0088CC" }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#0088CC" }}>Connected</span>
                    </div>
                    <p style={{ fontSize: 10, color: "#a0a0a0", margin: 0, lineHeight: 1.5 }}>
                      You will receive trade alerts, evacuation warnings, and best yield updates each cycle.
                      {tg.linkedAt && (
                        <span style={{ color: "#525252" }}>
                          {" "}Linked {new Date(tg.linkedAt).toLocaleDateString()}
                        </span>
                      )}
                    </p>
                  </div>

                  <div style={{
                    padding: "12px 14px",
                    background: "#050504",
                    borderRadius: 10,
                    border: "1px solid #111",
                    marginBottom: 16,
                  }}>
                    <p style={{ fontSize: 10, fontWeight: 600, color: "#a0a0a0", margin: "0 0 6px" }}>You will receive</p>
                    {[
                      "Trade executed (deposit, redeem, bridge)",
                      "Guardian evacuation alerts",
                      "Best vault yields each scan cycle",
                      "Agent start/stop events",
                    ].map((item, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0" }}>
                        <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#0088CC", opacity: 0.6 }} />
                        <span style={{ fontSize: 10, color: "#525252" }}>{item}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={handleDisconnect}
                    disabled={loading}
                    style={{
                      width: "100%",
                      padding: "10px",
                      borderRadius: 8,
                      fontSize: 11,
                      fontWeight: 700,
                      border: "1px solid rgba(255,85,85,0.2)",
                      background: "rgba(255,85,85,0.06)",
                      color: "#FF5555",
                      cursor: loading ? "not-allowed" : "pointer",
                      opacity: loading ? 0.5 : 1,
                    }}
                  >
                    {loading ? "..." : "Disconnect Telegram"}
                  </button>
                </div>
              ) : tg.deepLink ? (
                <div>
                  <p style={{ fontSize: 10, color: "#a0a0a0", margin: "0 0 12px", lineHeight: 1.5 }}>
                    Open the link below and press Start in Telegram to connect:
                  </p>

                  <a
                    href={tg.deepLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      width: "100%",
                      padding: "10px",
                      borderRadius: 8,
                      fontSize: 11,
                      fontWeight: 700,
                      border: "1px solid rgba(0,136,204,0.3)",
                      background: "rgba(0,136,204,0.08)",
                      color: "#0088CC",
                      textDecoration: "none",
                      marginBottom: 10,
                    }}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open in Telegram
                  </a>

                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 10px",
                    background: "rgba(0,0,0,0.3)",
                    borderRadius: 6,
                  }}>
                    <span style={{ fontSize: 10, color: "#525252", flex: 1 }}>
                      Code: <code style={{ color: "#D6FF34", fontFamily: "var(--font-mono)" }}>{tg.token}</code>
                    </span>
                    <button
                      onClick={() => {
                        if (tg.token) navigator.clipboard.writeText(tg.token);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: copied ? "#00FF8B" : "#525252", padding: 2 }}
                    >
                      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>

                  {tg.polling && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10 }}>
                      <Loader2 className="w-3 h-3 animate-spin" style={{ color: "#D6FF34" }} />
                      <span style={{ fontSize: 9, color: "#525252" }}>Waiting for confirmation...</span>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: 10, color: "#525252", margin: "0 0 12px", lineHeight: 1.5 }}>
                    Get trade alerts, vault updates, and best yield notifications delivered to your Telegram.
                  </p>

                  <div style={{
                    padding: "12px 14px",
                    background: "#050504",
                    borderRadius: 10,
                    border: "1px solid #111",
                    marginBottom: 16,
                  }}>
                    <p style={{ fontSize: 10, fontWeight: 600, color: "#a0a0a0", margin: "0 0 6px" }}>You will receive</p>
                    {[
                      "Trade executed (deposit, redeem, bridge)",
                      "Guardian evacuation alerts",
                      "Best vault yields each scan cycle",
                      "Agent start/stop events",
                    ].map((item, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0" }}>
                        <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#0088CC", opacity: 0.6 }} />
                        <span style={{ fontSize: 10, color: "#525252" }}>{item}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={handleConnect}
                    disabled={loading}
                    style={{
                      width: "100%",
                      padding: "10px",
                      borderRadius: 8,
                      fontSize: 11,
                      fontWeight: 700,
                      border: "1px solid rgba(0,136,204,0.3)",
                      background: "rgba(0,136,204,0.08)",
                      color: "#0088CC",
                      cursor: loading ? "not-allowed" : "pointer",
                      opacity: loading ? 0.5 : 1,
                    }}
                  >
                    {loading ? "..." : "Connect Telegram"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
