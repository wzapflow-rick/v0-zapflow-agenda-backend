"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  CheckCircle,
  Power,
  QrCode,
  RefreshCw,
  Send,
  Smartphone,
  XCircle,
  AlertTriangle,
  Save,
} from "lucide-react"

interface SystemStatus {
  instanceName: string
  connected: boolean
  enabled: boolean
  configured: boolean
}

interface AvailableInstance {
  name: string
  state: string
  number?: string | null
}

export default function AdminWhatsAppPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [instances, setInstances] = useState<AvailableInstance[]>([])
  const [instanceInput, setInstanceInput] = useState("")
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [testPhone, setTestPhone] = useState("")
  const [busy, setBusy] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ type: "ok" | "error"; text: string } | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings/whatsapp", { credentials: "include" })
      if (res.status === 401) {
        router.push("/admin")
        return
      }
      const data = await res.json()
      setStatus(data.system)
      setInstances(data.availableInstances || [])
      setInstanceInput(data.system?.instanceName || "")
    } catch {
      setFeedback({ type: "error", text: "Erro ao carregar configuração" })
    } finally {
      setIsLoading(false)
    }
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  // Enquanto o QR Code estiver na tela, verifica a conexão periodicamente.
  useEffect(() => {
    if (!qrCode) return
    const interval = setInterval(async () => {
      const res = await fetch("/api/admin/settings/whatsapp/connection", {
        credentials: "include",
      })
      if (res.ok) {
        const data: SystemStatus = await res.json()
        setStatus(data)
        if (data.connected) {
          setQrCode(null)
          setFeedback({ type: "ok", text: "WhatsApp conectado com sucesso" })
        }
      }
    }, 4000)
    return () => clearInterval(interval)
  }, [qrCode])

  const saveInstance = async () => {
    setBusy("save")
    setFeedback(null)
    try {
      const res = await fetch("/api/admin/settings/whatsapp", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ instanceName: instanceInput }),
      })
      const data = await res.json()
      if (!res.ok) {
        setFeedback({ type: "error", text: data.error || "Erro ao salvar" })
      } else {
        setStatus(data.system)
        setFeedback({ type: "ok", text: "Instância atualizada" })
      }
    } finally {
      setBusy(null)
    }
  }

  const toggleEnabled = async () => {
    if (!status) return
    setBusy("toggle")
    try {
      const res = await fetch("/api/admin/settings/whatsapp", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ enabled: !status.enabled }),
      })
      const data = await res.json()
      if (res.ok) setStatus(data.system)
    } finally {
      setBusy(null)
    }
  }

  const runAction = async (action: "connect" | "disconnect" | "restart") => {
    setBusy(action)
    setFeedback(null)
    setQrCode(null)
    try {
      const res = await fetch("/api/admin/settings/whatsapp/connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) {
        setFeedback({ type: "error", text: data.error || "Falha na ação" })
      } else if (data.qrCode) {
        setQrCode(data.qrCode)
        setFeedback({ type: "ok", text: "Leia o QR Code com o WhatsApp" })
      } else {
        setFeedback({ type: "ok", text: data.message || "Ação executada" })
        await load()
      }
    } finally {
      setBusy(null)
    }
  }

  const sendTest = async () => {
    setBusy("test")
    setFeedback(null)
    try {
      const res = await fetch("/api/admin/settings/whatsapp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phone: testPhone }),
      })
      const data = await res.json()
      setFeedback({
        type: res.ok ? "ok" : "error",
        text: res.ok ? "Mensagem de teste enviada" : data.error || "Falha no envio",
      })
    } finally {
      setBusy(null)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <header className="bg-slate-800/50 border-b border-slate-700/50 sticky top-0 z-10 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/admin/dashboard")}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
              aria-label="Voltar ao painel"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold text-white">Mensagens Gerais (WhatsApp)</h1>
          </div>
          <button
            onClick={load}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
            aria-label="Atualizar"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
        {feedback && (
          <div
            className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm ${
              feedback.type === "ok"
                ? "bg-emerald-400/10 text-emerald-400"
                : "bg-red-400/10 text-red-400"
            }`}
          >
            {feedback.type === "ok" ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <XCircle className="w-4 h-4" />
            )}
            {feedback.text}
          </div>
        )}

        {status && !status.configured && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm bg-amber-400/10 text-amber-400">
            <AlertTriangle className="w-4 h-4" />
            EVOLUTION_API_URL / EVOLUTION_API_KEY não configuradas no ambiente.
          </div>
        )}

        {/* Status */}
        <section className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div
                className={`p-3 rounded-lg ${
                  status?.connected
                    ? "bg-emerald-400/10 text-emerald-400"
                    : "bg-red-400/10 text-red-400"
                }`}
              >
                <Smartphone className="w-6 h-6" />
              </div>
              <div>
                <p className="text-white font-semibold">
                  {status?.connected ? "Conectada" : "Desconectada"}
                </p>
                <p className="text-sm text-slate-400 font-mono">{status?.instanceName}</p>
              </div>
            </div>
            <button
              onClick={toggleEnabled}
              disabled={busy === "toggle"}
              className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors disabled:opacity-50 ${
                status?.enabled
                  ? "bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30"
                  : "bg-slate-700/50 text-slate-400 hover:bg-slate-700"
              }`}
            >
              <Power className="w-4 h-4" />
              {status?.enabled ? "Envio ativado" : "Envio desativado"}
            </button>
          </div>

          <div className="flex flex-wrap gap-3 mt-6">
            <button
              onClick={() => runAction("connect")}
              disabled={!!busy}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 rounded-lg transition-colors disabled:opacity-50"
            >
              <QrCode className="w-4 h-4" />
              Conectar / Gerar QR
            </button>
            <button
              onClick={() => runAction("restart")}
              disabled={!!busy}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-cyan-600/20 text-cyan-400 hover:bg-cyan-600/30 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className="w-4 h-4" />
              Reiniciar
            </button>
            <button
              onClick={() => runAction("disconnect")}
              disabled={!!busy}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded-lg transition-colors disabled:opacity-50"
            >
              <XCircle className="w-4 h-4" />
              Desconectar
            </button>
          </div>

          {qrCode && (
            <div className="mt-6 flex flex-col items-center gap-3 p-4 bg-slate-900/50 rounded-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`}
                alt="QR Code para conectar o WhatsApp"
                className="w-56 h-56 rounded-lg bg-white p-2"
              />
              <p className="text-sm text-slate-400 text-center text-pretty">
                WhatsApp {">"} Aparelhos conectados {">"} Conectar aparelho
              </p>
            </div>
          )}
        </section>

        {/* Alterar instância */}
        <section className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
          <h2 className="text-white font-semibold mb-1">Nome da instância</h2>
          <p className="text-sm text-slate-400 mb-4 text-pretty">
            Instância da Evolution API usada para mensagens gerais da plataforma, como o código de
            recuperação de senha.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              value={instanceInput}
              onChange={(e) => setInstanceInput(e.target.value)}
              placeholder="ZapFlow-Sistema"
              className="flex-1 px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
            />
            <button
              onClick={saveInstance}
              disabled={busy === "save" || !instanceInput.trim()}
              className="flex items-center justify-center gap-2 px-4 py-2 text-sm bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              Salvar
            </button>
          </div>

          {instances.length > 0 && (
            <div className="mt-5">
              <p className="text-sm text-slate-400 mb-2">Instâncias existentes na Evolution API:</p>
              <div className="flex flex-col gap-2">
                {instances.map((inst) => (
                  <button
                    key={inst.name}
                    onClick={() => setInstanceInput(inst.name)}
                    className="flex items-center justify-between gap-3 px-3 py-2 bg-slate-700/20 hover:bg-slate-700/40 rounded-lg text-left transition-colors"
                  >
                    <span className="text-sm text-slate-300 font-mono">{inst.name}</span>
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        inst.state === "open"
                          ? "text-emerald-400 bg-emerald-400/10"
                          : "text-slate-400 bg-slate-400/10"
                      }`}
                    >
                      {inst.state}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Teste */}
        <section className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
          <h2 className="text-white font-semibold mb-1">Enviar mensagem de teste</h2>
          <p className="text-sm text-slate-400 mb-4">
            Confirme se a instância realmente está enviando.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="11999999999"
              inputMode="numeric"
              className="flex-1 px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
            />
            <button
              onClick={sendTest}
              disabled={busy === "test" || testPhone.replace(/\D/g, "").length < 10}
              className="flex items-center justify-center gap-2 px-4 py-2 text-sm bg-cyan-600 text-white hover:bg-cyan-700 rounded-lg transition-colors disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              Enviar teste
            </button>
          </div>
        </section>
      </main>
    </div>
  )
}
