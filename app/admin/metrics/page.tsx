"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface RedisMetrics {
  cache: {
    hits: number
    misses: number
    stale: number
    hitRatio: number
  }
  performance: {
    avgQueryTimeMs: number
    minQueryTimeMs: number
    maxQueryTimeMs: number
    totalQueries: number
  }
  whatsapp: {
    sent: number
    failed: number
    successRate: number
  }
  rateLimit: {
    exceeded: number
  }
  errors: {
    booking: number
    whatsapp: number
    webhook: number
    auth: number
  }
}

interface Metrics {
  users: { total: number; active: number; new: number }
  establishments: { total: number; active: number; new: number }
  subscriptions: { total: number; active: number; trialing: number; cancelled: number; byPlan: Array<{ planId: string; planName: string; count: number }> }
  appointments: { total: number; today: number; thisWeek: number; thisMonth: number; cancelled: number }
  revenue: { mrr: number; arr: number }
  redis: RedisMetrics | null
  timestamp: string
}

export default function MetricsPage() {
  const router = useRouter()
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [autoRefresh, setAutoRefresh] = useState(false)

  const fetchMetrics = async () => {
    try {
      const res = await fetch("/api/admin/metrics", { credentials: "include" })
      if (res.status === 401) {
        router.push("/admin")
        return
      }
      const data = await res.json()
      if (res.ok) {
        setMetrics(data)
        setError("")
      } else {
        setError(data.error || "Erro ao buscar metricas")
      }
    } catch (err) {
      setError("Erro de conexao")
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchMetrics()
  }, [])

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(fetchMetrics, 30000)
    return () => clearInterval(interval)
  }, [autoRefresh])

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST", credentials: "include" })
    router.push("/admin")
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    )
  }

  const redis = metrics?.redis

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin/dashboard" className="text-emerald-500 font-bold text-xl">
              ZapAgenda Admin
            </Link>
            <span className="text-slate-500">/</span>
            <span className="text-slate-300">Metricas de Performance</span>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-400">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-slate-700 bg-slate-800"
              />
              Auto-refresh (30s)
            </label>
            <button
              onClick={fetchMetrics}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-sm transition"
            >
              Atualizar
            </button>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded text-sm transition"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-slate-900 border-b border-slate-800 px-6">
        <div className="flex gap-1">
          <Link href="/admin/dashboard" className="px-4 py-3 text-sm text-slate-400 hover:text-white transition">
            Dashboard
          </Link>
          <Link href="/admin/trials" className="px-4 py-3 text-sm text-slate-400 hover:text-white transition">
            Trials
          </Link>
          <Link href="/admin/metrics" className="px-4 py-3 text-sm text-emerald-400 border-b-2 border-emerald-400">
            Metricas
          </Link>
        </div>
      </nav>

      <main className="p-6">
        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 mb-6">
            {error}
          </div>
        )}

        {!redis ? (
          <div className="bg-amber-900/50 border border-amber-700 rounded-lg p-6 mb-6">
            <h3 className="font-medium text-amber-400 mb-2">Redis nao disponivel</h3>
            <p className="text-sm text-slate-300">
              As metricas de performance requerem Upstash Redis conectado. 
              Configure as variaveis KV_REST_API_URL e KV_REST_API_TOKEN.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Cache Performance */}
            <section className="bg-slate-900 rounded-lg border border-slate-800 p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                </svg>
                Cache de Slots
              </h2>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-slate-800 rounded-lg p-4">
                  <div className="text-2xl font-bold text-emerald-400">{redis.cache.hits}</div>
                  <div className="text-sm text-slate-400">Cache Hits</div>
                </div>
                <div className="bg-slate-800 rounded-lg p-4">
                  <div className="text-2xl font-bold text-red-400">{redis.cache.misses}</div>
                  <div className="text-sm text-slate-400">Cache Misses</div>
                </div>
                <div className="bg-slate-800 rounded-lg p-4">
                  <div className="text-2xl font-bold text-amber-400">{redis.cache.stale}</div>
                  <div className="text-sm text-slate-400">Stale Served</div>
                </div>
                <div className="bg-slate-800 rounded-lg p-4">
                  <div className="text-2xl font-bold text-blue-400">{redis.cache.hitRatio}%</div>
                  <div className="text-sm text-slate-400">Hit Ratio</div>
                </div>
              </div>

              {/* Cache Hit Ratio Bar */}
              <div className="mb-2 text-sm text-slate-400">Taxa de Acerto do Cache</div>
              <div className="h-4 bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-500"
                  style={{ width: `${redis.cache.hitRatio}%` }}
                />
              </div>
              <div className="mt-1 text-xs text-slate-500 text-right">{redis.cache.hitRatio}% dos requests servidos do cache</div>
            </section>

            {/* Query Performance */}
            <section className="bg-slate-900 rounded-lg border border-slate-800 p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Performance de Queries
              </h2>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-800 rounded-lg p-4">
                  <div className="text-2xl font-bold text-blue-400">{redis.performance.avgQueryTimeMs}ms</div>
                  <div className="text-sm text-slate-400">Tempo Medio</div>
                </div>
                <div className="bg-slate-800 rounded-lg p-4">
                  <div className="text-2xl font-bold text-emerald-400">{redis.performance.minQueryTimeMs}ms</div>
                  <div className="text-sm text-slate-400">Tempo Minimo</div>
                </div>
                <div className="bg-slate-800 rounded-lg p-4">
                  <div className="text-2xl font-bold text-amber-400">{redis.performance.maxQueryTimeMs}ms</div>
                  <div className="text-sm text-slate-400">Tempo Maximo</div>
                </div>
                <div className="bg-slate-800 rounded-lg p-4">
                  <div className="text-2xl font-bold text-slate-300">{redis.performance.totalQueries}</div>
                  <div className="text-sm text-slate-400">Total de Queries</div>
                </div>
              </div>

              {/* Performance Indicator */}
              <div className="mt-4 p-3 rounded-lg bg-slate-800">
                <div className="flex items-center gap-2">
                  {redis.performance.avgQueryTimeMs < 100 ? (
                    <>
                      <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                      <span className="text-emerald-400 text-sm">Excelente - Queries rapidas</span>
                    </>
                  ) : redis.performance.avgQueryTimeMs < 500 ? (
                    <>
                      <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                      <span className="text-amber-400 text-sm">Bom - Performance aceitavel</span>
                    </>
                  ) : (
                    <>
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <span className="text-red-400 text-sm">Lento - Considere otimizar indices</span>
                    </>
                  )}
                </div>
              </div>
            </section>

            {/* WhatsApp & Rate Limit */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* WhatsApp */}
              <section className="bg-slate-900 rounded-lg border border-slate-800 p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  WhatsApp
                </h2>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-slate-800 rounded-lg p-4">
                    <div className="text-2xl font-bold text-green-400">{redis.whatsapp.sent}</div>
                    <div className="text-sm text-slate-400">Enviadas</div>
                  </div>
                  <div className="bg-slate-800 rounded-lg p-4">
                    <div className="text-2xl font-bold text-red-400">{redis.whatsapp.failed}</div>
                    <div className="text-sm text-slate-400">Falharam</div>
                  </div>
                </div>

                <div className="mb-2 text-sm text-slate-400">Taxa de Sucesso</div>
                <div className="h-4 bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 ${
                      redis.whatsapp.successRate >= 90 ? 'bg-emerald-500' :
                      redis.whatsapp.successRate >= 70 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${redis.whatsapp.successRate}%` }}
                  />
                </div>
                <div className="mt-1 text-xs text-slate-500 text-right">{redis.whatsapp.successRate}%</div>
              </section>

              {/* Rate Limit & Errors */}
              <section className="bg-slate-900 rounded-lg border border-slate-800 p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Erros e Rate Limits
                </h2>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
                    <span className="text-slate-300">Rate Limit Excedido</span>
                    <span className={`font-bold ${redis.rateLimit.exceeded > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                      {redis.rateLimit.exceeded}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
                    <span className="text-slate-300">Erros de Booking</span>
                    <span className={`font-bold ${redis.errors.booking > 0 ? 'text-red-400' : 'text-slate-500'}`}>
                      {redis.errors.booking}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
                    <span className="text-slate-300">Erros de WhatsApp</span>
                    <span className={`font-bold ${redis.errors.whatsapp > 0 ? 'text-red-400' : 'text-slate-500'}`}>
                      {redis.errors.whatsapp}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
                    <span className="text-slate-300">Erros de Webhook</span>
                    <span className={`font-bold ${redis.errors.webhook > 0 ? 'text-red-400' : 'text-slate-500'}`}>
                      {redis.errors.webhook}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
                    <span className="text-slate-300">Erros de Auth</span>
                    <span className={`font-bold ${redis.errors.auth > 0 ? 'text-red-400' : 'text-slate-500'}`}>
                      {redis.errors.auth}
                    </span>
                  </div>
                </div>
              </section>
            </div>

            {/* System Health */}
            <section className="bg-slate-900 rounded-lg border border-slate-800 p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Saude do Sistema
              </h2>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className={`p-4 rounded-lg border ${
                  redis.cache.hitRatio >= 50 ? 'bg-emerald-900/30 border-emerald-700' : 'bg-red-900/30 border-red-700'
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-2 h-2 rounded-full ${redis.cache.hitRatio >= 50 ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                    <span className="text-sm font-medium">Cache</span>
                  </div>
                  <div className={`text-xs ${redis.cache.hitRatio >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {redis.cache.hitRatio >= 50 ? 'Funcionando bem' : 'Verificar configuracao'}
                  </div>
                </div>

                <div className={`p-4 rounded-lg border ${
                  redis.performance.avgQueryTimeMs < 500 ? 'bg-emerald-900/30 border-emerald-700' : 'bg-red-900/30 border-red-700'
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-2 h-2 rounded-full ${redis.performance.avgQueryTimeMs < 500 ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                    <span className="text-sm font-medium">Database</span>
                  </div>
                  <div className={`text-xs ${redis.performance.avgQueryTimeMs < 500 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {redis.performance.avgQueryTimeMs < 500 ? 'Queries rapidas' : 'Queries lentas'}
                  </div>
                </div>

                <div className={`p-4 rounded-lg border ${
                  redis.whatsapp.successRate >= 90 ? 'bg-emerald-900/30 border-emerald-700' : 'bg-amber-900/30 border-amber-700'
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-2 h-2 rounded-full ${redis.whatsapp.successRate >= 90 ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                    <span className="text-sm font-medium">WhatsApp</span>
                  </div>
                  <div className={`text-xs ${redis.whatsapp.successRate >= 90 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {redis.whatsapp.successRate >= 90 ? 'Estavel' : 'Alguns erros'}
                  </div>
                </div>

                <div className={`p-4 rounded-lg border ${
                  redis.rateLimit.exceeded < 10 ? 'bg-emerald-900/30 border-emerald-700' : 'bg-amber-900/30 border-amber-700'
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-2 h-2 rounded-full ${redis.rateLimit.exceeded < 10 ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                    <span className="text-sm font-medium">Rate Limit</span>
                  </div>
                  <div className={`text-xs ${redis.rateLimit.exceeded < 10 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {redis.rateLimit.exceeded < 10 ? 'Normal' : 'Alto volume'}
                  </div>
                </div>
              </div>
            </section>

            {/* Last Update */}
            <div className="text-center text-sm text-slate-500">
              Ultima atualizacao: {metrics?.timestamp ? new Date(metrics.timestamp).toLocaleString('pt-BR') : '-'}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
