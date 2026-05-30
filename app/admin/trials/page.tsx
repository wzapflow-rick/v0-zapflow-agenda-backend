"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"

interface TrialSettings {
  trialEnabledGlobal: boolean
  trialDaysGlobal: number
  notifyBefore3Days: boolean
  notifyBefore1Day: boolean
}

interface TrialStats {
  activeTrials: number
  expiredTrials: number
  convertedTrials: number
  totalTrialHistory: number
  conversionRate: string
}

interface Plan {
  id: string
  name: string
  price: number
  trialEnabled: boolean
  trialDays: number
}

interface Trial {
  id: string
  status: string
  user: {
    id: string
    name: string
    email: string
    phone: string | null
  }
  plan: {
    id: string
    name: string
    price: number
  }
  startDate: string | null
  trialEndsAt: string | null
  trialNotified3Days: boolean
  trialNotified1Day: boolean
  convertedToPaid: boolean
  createdAt: string
}

export default function AdminTrialsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<"settings" | "plans" | "trials">("settings")
  
  // Settings state
  const [settings, setSettings] = useState<TrialSettings>({
    trialEnabledGlobal: true,
    trialDaysGlobal: 7,
    notifyBefore3Days: true,
    notifyBefore1Day: true,
  })
  const [stats, setStats] = useState<TrialStats | null>(null)
  
  // Plans state
  const [plans, setPlans] = useState<Plan[]>([])
  const [editingPlan, setEditingPlan] = useState<string | null>(null)
  const [planSettings, setPlanSettings] = useState<Record<string, { trialEnabled: boolean; trialDays: number }>>({})
  
  // Trials list state
  const [trials, setTrials] = useState<Trial[]>([])
  const [trialsFilter, setTrialsFilter] = useState<"all" | "active" | "expired">("all")
  const [trialsPagination, setTrialsPagination] = useState({ page: 1, total: 0, totalPages: 0 })

  const checkSession = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/session", { credentials: "include" })
      const data = await res.json()
      if (!data.authenticated) {
        router.push("/admin")
        return false
      }
      return true
    } catch {
      router.push("/admin")
      return false
    }
  }, [router])

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings/trial", { credentials: "include" })
      if (res.ok) {
        const data = await res.json()
        setSettings(data.settings)
        setStats(data.stats)
      }
    } catch (error) {
      console.error("Error fetching trial settings:", error)
    }
  }, [])

  const fetchPlans = useCallback(async () => {
    try {
      const res = await fetch("/api/plans", { credentials: "include" })
      if (res.ok) {
        const data = await res.json()
        const plansData = data.data || []
        setPlans(plansData)
        
        // Fetch trial settings for each plan
        const planSettingsData: Record<string, { trialEnabled: boolean; trialDays: number }> = {}
        for (const plan of plansData) {
          const planRes = await fetch(`/api/admin/plans/${plan.id}/trial`, { credentials: "include" })
          if (planRes.ok) {
            const planData = await planRes.json()
            planSettingsData[plan.id] = {
              trialEnabled: planData.plan.trialEnabled,
              trialDays: planData.plan.trialDays || 7,
            }
          }
        }
        setPlanSettings(planSettingsData)
      }
    } catch (error) {
      console.error("Error fetching plans:", error)
    }
  }, [])

  const fetchTrials = useCallback(async (page = 1) => {
    try {
      const res = await fetch(`/api/admin/trials?status=${trialsFilter}&page=${page}&limit=10`, { 
        credentials: "include" 
      })
      if (res.ok) {
        const data = await res.json()
        setTrials(data.trials)
        setTrialsPagination(data.pagination)
      }
    } catch (error) {
      console.error("Error fetching trials:", error)
    }
  }, [trialsFilter])

  useEffect(() => {
    const init = async () => {
      const isAuth = await checkSession()
      if (isAuth) {
        await Promise.all([fetchSettings(), fetchPlans()])
        setLoading(false)
      }
    }
    init()
  }, [checkSession, fetchSettings, fetchPlans])

  useEffect(() => {
    if (activeTab === "trials") {
      fetchTrials()
    }
  }, [activeTab, trialsFilter, fetchTrials])

  const saveSettings = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/admin/settings/trial", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
        credentials: "include",
      })
      if (res.ok) {
        await fetchSettings()
        alert("Configurações salvas com sucesso!")
      } else {
        alert("Erro ao salvar configurações")
      }
    } catch (error) {
      console.error("Error saving settings:", error)
      alert("Erro ao salvar configurações")
    }
    setSaving(false)
  }

  const savePlanSettings = async (planId: string) => {
    setSaving(true)
    try {
      const planSetting = planSettings[planId]
      const res = await fetch(`/api/admin/plans/${planId}/trial`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trialEnabled: planSetting.trialEnabled,
          trialDays: planSetting.trialDays,
        }),
        credentials: "include",
      })
      if (res.ok) {
        setEditingPlan(null)
        alert("Configurações do plano salvas!")
      } else {
        alert("Erro ao salvar configurações do plano")
      }
    } catch (error) {
      console.error("Error saving plan settings:", error)
      alert("Erro ao salvar configurações do plano")
    }
    setSaving(false)
  }

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST", credentials: "include" })
    router.push("/admin")
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-"
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getDaysRemaining = (trialEndsAt: string | null) => {
    if (!trialEndsAt) return null
    const now = new Date()
    const end = new Date(trialEndsAt)
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return diff
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-emerald-400 text-lg">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/admin/dashboard")}
              className="text-slate-400 hover:text-white transition"
            >
              &larr; Voltar
            </button>
            <h1 className="text-xl font-semibold text-white">Gestão de Trials</h1>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm text-slate-400 hover:text-white transition"
          >
            Sair
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-slate-800">
        <div className="px-6 flex gap-4">
          {[
            { id: "settings", label: "Configurações Globais" },
            { id: "plans", label: "Configurar por Plano" },
            { id: "trials", label: "Lista de Trials" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-4 py-3 text-sm font-medium transition border-b-2 ${
                activeTab === tab.id
                  ? "border-emerald-500 text-emerald-400"
                  : "border-transparent text-slate-400 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <main className="p-6">
        {/* Settings Tab */}
        {activeTab === "settings" && (
          <div className="max-w-2xl space-y-6">
            {/* Stats Cards */}
            {stats && (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="bg-slate-900 rounded-lg p-4 border border-slate-800">
                  <div className="text-2xl font-bold text-emerald-400">{stats.activeTrials}</div>
                  <div className="text-sm text-slate-400">Trials Ativos</div>
                </div>
                <div className="bg-slate-900 rounded-lg p-4 border border-slate-800">
                  <div className="text-2xl font-bold text-amber-400">{stats.expiredTrials}</div>
                  <div className="text-sm text-slate-400">Trials Expirados</div>
                </div>
                <div className="bg-slate-900 rounded-lg p-4 border border-slate-800">
                  <div className="text-2xl font-bold text-blue-400">{stats.convertedTrials}</div>
                  <div className="text-sm text-slate-400">Convertidos</div>
                </div>
                <div className="bg-slate-900 rounded-lg p-4 border border-slate-800">
                  <div className="text-2xl font-bold text-purple-400">{stats.conversionRate}%</div>
                  <div className="text-sm text-slate-400">Taxa Conversão</div>
                </div>
              </div>
            )}

            {/* Settings Form */}
            <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
              <h2 className="text-lg font-semibold mb-6">Configurações Globais de Trial</h2>
              
              <div className="space-y-6">
                {/* Trial Enabled */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Habilitar Trial</div>
                    <div className="text-sm text-slate-400">Permite que novos usuários testem os planos gratuitamente</div>
                  </div>
                  <button
                    onClick={() => setSettings({ ...settings, trialEnabledGlobal: !settings.trialEnabledGlobal })}
                    className={`w-14 h-8 rounded-full transition ${
                      settings.trialEnabledGlobal ? "bg-emerald-500" : "bg-slate-700"
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-full bg-white transition-transform ${
                        settings.trialEnabledGlobal ? "translate-x-7" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>

                {/* Trial Days */}
                <div>
                  <label className="block font-medium mb-2">Dias de Trial Padrão</label>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={settings.trialDaysGlobal}
                    onChange={(e) => setSettings({ ...settings, trialDaysGlobal: Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                  <div className="text-sm text-slate-400 mt-1">Quantidade de dias que o trial ficará ativo</div>
                </div>

                {/* Notifications */}
                <div className="space-y-4">
                  <div className="font-medium">Notificações</div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm">Notificar 3 dias antes</div>
                      <div className="text-xs text-slate-400">Envia alerta quando faltam 3 dias para expirar</div>
                    </div>
                    <button
                      onClick={() => setSettings({ ...settings, notifyBefore3Days: !settings.notifyBefore3Days })}
                      className={`w-12 h-6 rounded-full transition ${
                        settings.notifyBefore3Days ? "bg-emerald-500" : "bg-slate-700"
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white transition-transform ${
                          settings.notifyBefore3Days ? "translate-x-6" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm">Notificar 1 dia antes</div>
                      <div className="text-xs text-slate-400">Envia alerta no último dia antes de expirar</div>
                    </div>
                    <button
                      onClick={() => setSettings({ ...settings, notifyBefore1Day: !settings.notifyBefore1Day })}
                      className={`w-12 h-6 rounded-full transition ${
                        settings.notifyBefore1Day ? "bg-emerald-500" : "bg-slate-700"
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white transition-transform ${
                          settings.notifyBefore1Day ? "translate-x-6" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Save Button */}
                <button
                  onClick={saveSettings}
                  disabled={saving}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium py-3 rounded-lg transition"
                >
                  {saving ? "Salvando..." : "Salvar Configurações"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Plans Tab */}
        {activeTab === "plans" && (
          <div className="space-y-4">
            <p className="text-slate-400">Configure o trial individualmente para cada plano. As configurações aqui sobrescrevem as configurações globais.</p>
            
            <div className="grid gap-4">
              {plans.map((plan) => (
                <div key={plan.id} className="bg-slate-900 rounded-lg p-6 border border-slate-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">{plan.name}</h3>
                      <p className="text-slate-400">R$ {Number(plan.price).toFixed(2)}/mês</p>
                    </div>
                    
                    {editingPlan === plan.id ? (
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <label className="text-sm text-slate-400">Trial:</label>
                          <button
                            onClick={() => setPlanSettings({
                              ...planSettings,
                              [plan.id]: {
                                ...planSettings[plan.id],
                                trialEnabled: !planSettings[plan.id]?.trialEnabled,
                              },
                            })}
                            className={`w-12 h-6 rounded-full transition ${
                              planSettings[plan.id]?.trialEnabled ? "bg-emerald-500" : "bg-slate-700"
                            }`}
                          >
                            <div
                              className={`w-5 h-5 rounded-full bg-white transition-transform ${
                                planSettings[plan.id]?.trialEnabled ? "translate-x-6" : "translate-x-0.5"
                              }`}
                            />
                          </button>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <label className="text-sm text-slate-400">Dias:</label>
                          <input
                            type="number"
                            min={1}
                            max={90}
                            value={planSettings[plan.id]?.trialDays || 7}
                            onChange={(e) => setPlanSettings({
                              ...planSettings,
                              [plan.id]: {
                                ...planSettings[plan.id],
                                trialDays: Number(e.target.value),
                              },
                            })}
                            className="w-20 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white text-center"
                          />
                        </div>
                        
                        <button
                          onClick={() => savePlanSettings(plan.id)}
                          disabled={saving}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded text-sm font-medium transition"
                        >
                          Salvar
                        </button>
                        <button
                          onClick={() => setEditingPlan(null)}
                          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm font-medium transition"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-4">
                        <div className="text-sm">
                          <span className={planSettings[plan.id]?.trialEnabled ? "text-emerald-400" : "text-slate-500"}>
                            {planSettings[plan.id]?.trialEnabled ? "Trial Ativo" : "Trial Inativo"}
                          </span>
                          {planSettings[plan.id]?.trialEnabled && (
                            <span className="text-slate-400 ml-2">
                              ({planSettings[plan.id]?.trialDays || 7} dias)
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => setEditingPlan(plan.id)}
                          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm font-medium transition"
                        >
                          Editar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Trials List Tab */}
        {activeTab === "trials" && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex gap-2">
              {[
                { id: "all", label: "Todos" },
                { id: "active", label: "Ativos" },
                { id: "expired", label: "Expirados" },
              ].map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setTrialsFilter(filter.id as typeof trialsFilter)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    trialsFilter === filter.id
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {/* Trials Table */}
            <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Usuário</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Plano</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Início</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Expira</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Notificações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {trials.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        Nenhum trial encontrado
                      </td>
                    </tr>
                  ) : (
                    trials.map((trial) => {
                      const daysRemaining = getDaysRemaining(trial.trialEndsAt)
                      return (
                        <tr key={trial.id} className="hover:bg-slate-800/50">
                          <td className="px-4 py-3">
                            <div className="font-medium">{trial.user.name}</div>
                            <div className="text-sm text-slate-400">{trial.user.email}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium">{trial.plan.name}</div>
                            <div className="text-sm text-slate-400">R$ {Number(trial.plan.price).toFixed(2)}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                                trial.status === "TRIALING"
                                  ? "bg-emerald-500/20 text-emerald-400"
                                  : trial.status === "TRIAL_EXPIRED"
                                  ? "bg-red-500/20 text-red-400"
                                  : trial.convertedToPaid
                                  ? "bg-blue-500/20 text-blue-400"
                                  : "bg-slate-500/20 text-slate-400"
                              }`}
                            >
                              {trial.status === "TRIALING"
                                ? `Ativo (${daysRemaining}d)`
                                : trial.convertedToPaid
                                ? "Convertido"
                                : "Expirado"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-400">
                            {formatDate(trial.startDate)}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-400">
                            {formatDate(trial.trialEndsAt)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <span
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                                  trial.trialNotified3Days
                                    ? "bg-emerald-500/20 text-emerald-400"
                                    : "bg-slate-700 text-slate-500"
                                }`}
                                title="Notificação 3 dias"
                              >
                                3d
                              </span>
                              <span
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                                  trial.trialNotified1Day
                                    ? "bg-emerald-500/20 text-emerald-400"
                                    : "bg-slate-700 text-slate-500"
                                }`}
                                title="Notificação 1 dia"
                              >
                                1d
                              </span>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {trialsPagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => fetchTrials(trialsPagination.page - 1)}
                  disabled={trialsPagination.page === 1}
                  className="px-3 py-1 bg-slate-800 rounded disabled:opacity-50"
                >
                  Anterior
                </button>
                <span className="text-slate-400">
                  Página {trialsPagination.page} de {trialsPagination.totalPages}
                </span>
                <button
                  onClick={() => fetchTrials(trialsPagination.page + 1)}
                  disabled={trialsPagination.page === trialsPagination.totalPages}
                  className="px-3 py-1 bg-slate-800 rounded disabled:opacity-50"
                >
                  Próxima
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
