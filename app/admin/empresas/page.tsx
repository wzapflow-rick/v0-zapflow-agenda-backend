"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  Building2,
  Search,
  RefreshCw,
  ArrowLeft,
  Calendar,
  CreditCard,
  Gift,
  Clock,
  Power,
  Plus,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  Mail,
  Phone,
  Trash2,
  AlertTriangle,
} from "lucide-react"

interface Plan {
  id: string
  name: string
  price: number
  interval: string
}

interface Subscription {
  id: string
  status: string
  startDate: string | null
  endDate: string | null
  trialEndsAt: string | null
  isTrial: boolean
  cancelledAt: string | null
  plan: Plan
}

interface Company {
  establishmentId: string
  establishmentName: string
  slug: string
  userId: string
  ownerName: string
  ownerEmail: string
  ownerPhone: string | null
  createdAt: string
  subscription: Subscription | null
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: "Ativo", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  INACTIVE: { label: "Inativo", color: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
  CANCELLED: { label: "Cancelado", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  PAST_DUE: { label: "Atrasado", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  TRIALING: { label: "Em Trial", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  TRIAL_EXPIRED: { label: "Trial Expirado", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
}

export default function EmpresasPage() {
  const router = useRouter()
  const [companies, setCompanies] = useState<Company[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [planFilter, setPlanFilter] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)

  const fetchCompanies = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set("search", search)
      if (statusFilter) params.set("status", statusFilter)
      if (planFilter) params.set("planId", planFilter)
      params.set("page", String(page))

      const res = await fetch(`/api/admin/companies?${params.toString()}`)
      if (res.status === 401) {
        router.push("/admin")
        return
      }
      const data = await res.json()
      setCompanies(data.companies || [])
      setPlans(data.plans || [])
      setTotalPages(data.pagination?.totalPages || 1)
    } catch (error) {
      console.error("Erro ao buscar empresas:", error)
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, planFilter, page, router])

  useEffect(() => {
    const timer = setTimeout(() => fetchCompanies(), 300)
    return () => clearTimeout(timer)
  }, [fetchCompanies])

  const formatDate = (date: string | null) => {
    if (!date) return "—"
    return new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  }

  const getDaysRemaining = (date: string | null) => {
    if (!date) return null
    const diff = new Date(date).getTime() - new Date().getTime()
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
    return days
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="bg-slate-800/50 border-b border-slate-700/50 sticky top-0 z-10 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/admin/dashboard")}
              className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
              aria-label="Voltar"
            >
              <ArrowLeft className="w-5 h-5 text-slate-400" />
            </button>
            <div className="flex items-center gap-2">
              <Building2 className="w-6 h-6 text-cyan-400" />
              <h1 className="text-xl font-bold text-white">Gestao de Empresas</h1>
            </div>
          </div>
          <button
            onClick={fetchCompanies}
            className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
            aria-label="Atualizar"
          >
            <RefreshCw className={`w-5 h-5 text-slate-400 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Filtros */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar por nome ou email..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                className="w-full pl-10 pr-4 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
              className="px-4 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:border-cyan-500/50"
            >
              <option value="">Todos os status</option>
              {Object.entries(STATUS_LABELS).map(([value, { label }]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              value={planFilter}
              onChange={(e) => {
                setPlanFilter(e.target.value)
                setPage(1)
              }}
              className="px-4 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:border-cyan-500/50"
            >
              <option value="">Todos os planos</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Lista de empresas */}
        {loading ? (
          <div className="text-center py-12">
            <RefreshCw className="w-8 h-8 text-slate-600 mx-auto animate-spin" />
            <p className="text-slate-500 mt-2">Carregando empresas...</p>
          </div>
        ) : companies.length === 0 ? (
          <div className="text-center py-12 bg-slate-800/30 rounded-xl border border-slate-700/50">
            <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">Nenhuma empresa encontrada</p>
          </div>
        ) : (
          <div className="space-y-3">
            {companies.map((company) => {
              const sub = company.subscription
              const statusInfo = sub ? STATUS_LABELS[sub.status] : null
              const daysRemaining = sub ? getDaysRemaining(sub.endDate) : null

              return (
                <div
                  key={company.establishmentId}
                  className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 hover:border-slate-600/50 transition-colors"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Info da empresa */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-semibold text-white truncate">
                          {company.establishmentName}
                        </h3>
                        {statusInfo && (
                          <span className={`px-2 py-0.5 text-xs rounded-full border ${statusInfo.color}`}>
                            {statusInfo.label}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-400">
                        <span className="flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5" />
                          {company.ownerEmail}
                        </span>
                        {company.ownerPhone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5" />
                            {company.ownerPhone}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Info da assinatura */}
                    <div className="flex flex-wrap items-center gap-4">
                      {sub ? (
                        <>
                          <div className="text-sm">
                            <p className="text-slate-500">Plano</p>
                            <p className="text-white font-medium">{sub.plan.name}</p>
                          </div>
                          <div className="text-sm">
                            <p className="text-slate-500">Vencimento</p>
                            <p className="text-white font-medium">
                              {formatDate(sub.endDate)}
                              {daysRemaining !== null && daysRemaining >= 0 && (
                                <span className="text-xs text-slate-400 ml-1">
                                  ({daysRemaining}d)
                                </span>
                              )}
                              {daysRemaining !== null && daysRemaining < 0 && (
                                <span className="text-xs text-red-400 ml-1">(vencido)</span>
                              )}
                            </p>
                          </div>
                        </>
                      ) : (
                        <span className="text-sm text-slate-500">Sem assinatura</span>
                      )}
                      <button
                        onClick={() => setSelectedCompany(company)}
                        className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        Gerenciar
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Paginacao */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 disabled:opacity-50 hover:bg-slate-700 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-slate-400">
              Pagina {page} de {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 disabled:opacity-50 hover:bg-slate-700 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </main>

      {/* Modal de gerenciamento */}
      {selectedCompany && (
        <ManageModal
          company={selectedCompany}
          plans={plans}
          onClose={() => setSelectedCompany(null)}
          onSuccess={() => {
            setSelectedCompany(null)
            fetchCompanies()
          }}
        />
      )}
    </div>
  )
}

function ManageModal({
  company,
  plans,
  onClose,
  onSuccess,
}: {
  company: Company
  plans: Plan[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Estados dos formularios
  const [selectedPlan, setSelectedPlan] = useState(company.subscription?.plan.id || "")
  const [trialDays, setTrialDays] = useState("7")
  const [endDate, setEndDate] = useState(
    company.subscription?.endDate
      ? new Date(company.subscription.endDate).toISOString().split("T")[0]
      : ""
  )
  const [newStatus, setNewStatus] = useState(company.subscription?.status || "ACTIVE")
  const [extendDays, setExtendDays] = useState("30")

  // Estado da exclusao
  const [showDelete, setShowDelete] = useState(false)
  const [confirmName, setConfirmName] = useState("")
  const [deleting, setDeleting] = useState(false)

  const callApi = async (action: string, payload: Record<string, unknown>) => {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/admin/companies/${company.establishmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Erro ao salvar" })
      } else {
        setMessage({ type: "success", text: data.message || "Salvo com sucesso!" })
        setTimeout(() => onSuccess(), 1000)
      }
    } catch {
      setMessage({ type: "error", text: "Erro de conexao" })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/admin/companies/${company.establishmentId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmName }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Erro ao excluir" })
      } else {
        setMessage({ type: "success", text: data.message || "Empresa excluida!" })
        setTimeout(() => onSuccess(), 1000)
      }
    } catch {
      setMessage({ type: "error", text: "Erro de conexao" })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header do modal */}
        <div className="flex items-center justify-between p-5 border-b border-slate-700 sticky top-0 bg-slate-800">
          <div>
            <h2 className="text-lg font-bold text-white">{company.establishmentName}</h2>
            <p className="text-sm text-slate-400">{company.ownerEmail}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Mensagem de feedback */}
          {message && (
            <div
              className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
                message.type === "success"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "bg-red-500/20 text-red-400 border border-red-500/30"
              }`}
            >
              {message.type === "success" ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
              {message.text}
            </div>
          )}

          {/* Trocar plano */}
          <div className="bg-slate-700/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <CreditCard className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-white">Trocar Plano</h3>
            </div>
            <div className="flex gap-2">
              <select
                value={selectedPlan}
                onChange={(e) => setSelectedPlan(e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500/50"
              >
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} - R$ {Number(plan.price).toFixed(2)}/{plan.interval === "MONTHLY" ? "mes" : "ano"}
                  </option>
                ))}
              </select>
              <button
                onClick={() => callApi("change_plan", { planId: selectedPlan })}
                disabled={saving || selectedPlan === company.subscription?.plan.id}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
              >
                Aplicar
              </button>
            </div>
          </div>

          {/* Conceder trial */}
          <div className="bg-slate-700/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Gift className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-semibold text-white">Conceder Trial</h3>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="number"
                  min="1"
                  value={trialDays}
                  onChange={(e) => setTrialDays(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500/50"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                  dias
                </span>
              </div>
              <button
                onClick={() => callApi("grant_trial", { days: trialDays })}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
              >
                Conceder
              </button>
            </div>
          </div>

          {/* Mudar data de vencimento */}
          <div className="bg-slate-700/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-semibold text-white">Data de Vencimento</h3>
            </div>
            <div className="flex gap-2">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500/50"
              />
              <button
                onClick={() => callApi("set_end_date", { endDate })}
                disabled={saving || !endDate}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
              >
                Definir
              </button>
            </div>
          </div>

          {/* Estender assinatura */}
          <div className="bg-slate-700/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-semibold text-white">Estender Assinatura</h3>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="number"
                  min="1"
                  value={extendDays}
                  onChange={(e) => setExtendDays(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500/50"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                  dias
                </span>
              </div>
              <button
                onClick={() => callApi("extend", { days: extendDays })}
                disabled={saving}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
              >
                Estender
              </button>
            </div>
          </div>

          {/* Mudar status */}
          <div className="bg-slate-700/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Power className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-white">Alterar Status</h3>
            </div>
            <div className="flex gap-2">
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500/50"
              >
                {Object.entries(STATUS_LABELS).map(([value, { label }]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <button
                onClick={() => callApi("set_status", { status: newStatus })}
                disabled={saving}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
              >
                Aplicar
              </button>
            </div>
          </div>

          {/* Zona de perigo - excluir empresa */}
          <div className="bg-red-500/5 border border-red-500/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <h3 className="text-sm font-semibold text-red-400">Zona de Perigo</h3>
            </div>

            {!showDelete ? (
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-slate-400">
                  Exclui a empresa, o dono e todos os dados (agendamentos, clientes, servicos). Acao irreversivel.
                </p>
                <button
                  onClick={() => setShowDelete(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
                >
                  <Trash2 className="w-4 h-4" />
                  Excluir
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-300">
                  Para confirmar, digite o nome exato da empresa:{" "}
                  <span className="font-semibold text-white">{company.establishmentName}</span>
                </p>
                <input
                  type="text"
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                  placeholder="Nome da empresa"
                  className="w-full px-3 py-2 bg-slate-700 border border-red-500/40 rounded-lg text-white text-sm focus:outline-none focus:border-red-500"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowDelete(false)
                      setConfirmName("")
                    }}
                    disabled={deleting}
                    className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting || confirmName !== company.establishmentName}
                    className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    {deleting ? "Excluindo..." : "Excluir definitivamente"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
