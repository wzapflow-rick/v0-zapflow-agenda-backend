"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  Users,
  Building2,
  Calendar,
  Briefcase,
  UserCheck,
  CreditCard,
  MessageSquare,
  FileText,
  LogOut,
  RefreshCw,
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Filter
} from "lucide-react"

interface Metrics {
  overview: {
    totalUsers: number
    totalEstablishments: number
    totalBookings: number
    totalServices: number
    totalProfessionals: number
    activeSubscriptions: number
    newUsersLast30Days: number
  }
  bookings: {
    today: number
    thisWeek: number
    thisMonth: number
    byStatus: Array<{ status: string; count: number }>
  }
  messages: {
    total: number
    byStatus: Array<{ status: string; count: number }>
  }
  subscriptions: {
    active: number
    byPlan: Array<{ planId: string; planName: string; count: number }>
  }
  audit: {
    totalLogs: number
  }
  timestamp: string
}

interface AuditLog {
  id: string
  action: string
  entityType: string
  entityId: string
  details: Record<string, unknown>
  timestamp: string
  user?: {
    id: string
    name: string
    email: string
  }
}

interface MessageLog {
  id: string
  channel: string
  messageType: string
  status: string
  content: string
  sentAt: string
  booking?: {
    id: string
    clientName: string
    clientPhone: string
  }
  establishment?: {
    id: string
    name: string
  }
}

interface PaginationData {
  page: number
  limit: number
  total: number
  totalPages: number
}

type TabType = "overview" | "audit" | "messages"

export default function AdminDashboardPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [messageLogs, setMessageLogs] = useState<MessageLog[]>([])
  const [activeTab, setActiveTab] = useState<TabType>("overview")
  const [auditPagination, setAuditPagination] = useState<PaginationData | null>(null)
  const [messagePagination, setMessagePagination] = useState<PaginationData | null>(null)
  const [auditFilters, setAuditFilters] = useState({ actions: [] as string[], entityTypes: [] as string[] })
  const [messageFilters, setMessageFilters] = useState({ statuses: [] as string[], channels: [] as string[] })
  const [selectedAuditAction, setSelectedAuditAction] = useState("")
  const [selectedAuditEntity, setSelectedAuditEntity] = useState("")
  const [selectedMessageStatus, setSelectedMessageStatus] = useState("")
  const [selectedMessageChannel, setSelectedMessageChannel] = useState("")
  const [adminName, setAdminName] = useState("")

  const checkSession = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/session")
      const data = await res.json()
      if (!data.authenticated) {
        router.push("/admin")
        return false
      }
      setAdminName(data.admin?.name || "Admin")
      return true
    } catch {
      router.push("/admin")
      return false
    }
  }, [router])

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/metrics")
      if (res.ok) {
        const data = await res.json()
        setMetrics(data)
      }
    } catch (error) {
      console.error("Error fetching metrics:", error)
    }
  }, [])

  const fetchAuditLogs = useCallback(async (page = 1) => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" })
      if (selectedAuditAction) params.set("action", selectedAuditAction)
      if (selectedAuditEntity) params.set("entityType", selectedAuditEntity)
      
      const res = await fetch(`/api/admin/audit-logs?${params}`)
      if (res.ok) {
        const data = await res.json()
        setAuditLogs(data.logs)
        setAuditPagination(data.pagination)
        setAuditFilters(data.filters)
      }
    } catch (error) {
      console.error("Error fetching audit logs:", error)
    }
  }, [selectedAuditAction, selectedAuditEntity])

  const fetchMessageLogs = useCallback(async (page = 1) => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" })
      if (selectedMessageStatus) params.set("status", selectedMessageStatus)
      if (selectedMessageChannel) params.set("channel", selectedMessageChannel)
      
      const res = await fetch(`/api/admin/message-logs?${params}`)
      if (res.ok) {
        const data = await res.json()
        setMessageLogs(data.logs)
        setMessagePagination(data.pagination)
        setMessageFilters(data.filters)
      }
    } catch (error) {
      console.error("Error fetching message logs:", error)
    }
  }, [selectedMessageStatus, selectedMessageChannel])

  useEffect(() => {
    const init = async () => {
      const isAuth = await checkSession()
      if (isAuth) {
        await fetchMetrics()
        setIsLoading(false)
      }
    }
    init()
  }, [checkSession, fetchMetrics])

  useEffect(() => {
    if (activeTab === "audit") {
      fetchAuditLogs()
    } else if (activeTab === "messages") {
      fetchMessageLogs()
    }
  }, [activeTab, fetchAuditLogs, fetchMessageLogs])

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" })
    router.push("/admin")
  }

  const handleRefresh = async () => {
    setIsLoading(true)
    await fetchMetrics()
    if (activeTab === "audit") await fetchAuditLogs()
    if (activeTab === "messages") await fetchMessageLogs()
    setIsLoading(false)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      sent: "text-emerald-400 bg-emerald-400/10",
      delivered: "text-blue-400 bg-blue-400/10",
      failed: "text-red-400 bg-red-400/10",
      pending: "text-yellow-400 bg-yellow-400/10",
      confirmed: "text-emerald-400 bg-emerald-400/10",
      cancelled: "text-red-400 bg-red-400/10",
      completed: "text-blue-400 bg-blue-400/10"
    }
    return colors[status.toLowerCase()] || "text-slate-400 bg-slate-400/10"
  }

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case "sent":
      case "delivered":
      case "confirmed":
      case "completed":
        return <CheckCircle className="w-4 h-4" />
      case "failed":
      case "cancelled":
        return <XCircle className="w-4 h-4" />
      case "pending":
        return <Clock className="w-4 h-4" />
      default:
        return <AlertTriangle className="w-4 h-4" />
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
          <p className="text-slate-400">Carregando painel...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="bg-slate-800/50 border-b border-slate-700/50 sticky top-0 z-10 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-white">ZapFlow Admin</h1>
              <span className="text-sm text-slate-400 hidden sm:block">|</span>
              <span className="text-sm text-slate-400 hidden sm:block">{adminName}</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleRefresh}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
                title="Atualizar"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sair</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-slate-800/30 border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-1 overflow-x-auto">
            {[
              { id: "overview" as TabType, label: "Visão Geral", icon: TrendingUp },
              { id: "audit" as TabType, label: "Logs de Auditoria", icon: FileText },
              { id: "messages" as TabType, label: "Logs de Mensagens", icon: MessageSquare }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-emerald-500 text-emerald-400"
                    : "border-transparent text-slate-400 hover:text-white hover:border-slate-600"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === "overview" && metrics && (
          <div className="space-y-8">
            {/* Overview Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {[
                { label: "Usuários", value: metrics.overview.totalUsers, icon: Users, color: "text-blue-400" },
                { label: "Estabelecimentos", value: metrics.overview.totalEstablishments, icon: Building2, color: "text-purple-400" },
                { label: "Agendamentos", value: metrics.overview.totalBookings, icon: Calendar, color: "text-emerald-400" },
                { label: "Serviços", value: metrics.overview.totalServices, icon: Briefcase, color: "text-orange-400" },
                { label: "Profissionais", value: metrics.overview.totalProfessionals, icon: UserCheck, color: "text-pink-400" },
                { label: "Assinaturas Ativas", value: metrics.overview.activeSubscriptions, icon: CreditCard, color: "text-yellow-400" },
                { label: "Mensagens Enviadas", value: metrics.messages.total, icon: MessageSquare, color: "text-cyan-400" },
                { label: "Novos Usuários (30d)", value: metrics.overview.newUsersLast30Days, icon: TrendingUp, color: "text-emerald-400" }
              ].map((card) => (
                <div
                  key={card.label}
                  className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 hover:border-slate-600/50 transition-colors"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`p-2 rounded-lg bg-slate-700/50 ${card.color}`}>
                      <card.icon className="w-5 h-5" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-white">{card.value.toLocaleString("pt-BR")}</p>
                  <p className="text-sm text-slate-400 mt-1">{card.label}</p>
                </div>
              ))}
            </div>

            {/* Booking Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-emerald-400" />
                  Agendamentos
                </h3>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="text-center p-3 bg-slate-700/30 rounded-lg">
                    <p className="text-2xl font-bold text-white">{metrics.bookings.today}</p>
                    <p className="text-xs text-slate-400">Hoje</p>
                  </div>
                  <div className="text-center p-3 bg-slate-700/30 rounded-lg">
                    <p className="text-2xl font-bold text-white">{metrics.bookings.thisWeek}</p>
                    <p className="text-xs text-slate-400">Esta Semana</p>
                  </div>
                  <div className="text-center p-3 bg-slate-700/30 rounded-lg">
                    <p className="text-2xl font-bold text-white">{metrics.bookings.thisMonth}</p>
                    <p className="text-xs text-slate-400">Este Mês</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-slate-400 mb-2">Por Status:</p>
                  {metrics.bookings.byStatus.map((item) => (
                    <div key={item.status} className="flex items-center justify-between py-2 px-3 bg-slate-700/20 rounded-lg">
                      <span className="text-sm text-slate-300 capitalize">{item.status}</span>
                      <span className={`text-sm font-medium px-2 py-1 rounded ${getStatusColor(item.status)}`}>
                        {item.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-yellow-400" />
                  Assinaturas por Plano
                </h3>
                <div className="space-y-3">
                  {metrics.subscriptions.byPlan.length > 0 ? (
                    metrics.subscriptions.byPlan.map((plan) => (
                      <div key={plan.planId} className="flex items-center justify-between py-3 px-4 bg-slate-700/20 rounded-lg">
                        <span className="text-sm text-slate-300">{plan.planName}</span>
                        <span className="text-lg font-bold text-emerald-400">{plan.count}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-400 text-sm text-center py-4">Nenhuma assinatura ativa</p>
                  )}
                </div>
                <div className="mt-6 pt-4 border-t border-slate-700/50">
                  <h4 className="text-sm text-slate-400 mb-3">Status das Mensagens:</h4>
                  <div className="flex flex-wrap gap-2">
                    {metrics.messages.byStatus.map((item) => (
                      <div
                        key={item.status}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${getStatusColor(item.status)}`}
                      >
                        {getStatusIcon(item.status)}
                        <span className="capitalize">{item.status}</span>
                        <span className="font-medium">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Last Update */}
            <p className="text-center text-sm text-slate-500">
              Última atualização: {formatDate(metrics.timestamp)}
            </p>
          </div>
        )}

        {activeTab === "audit" && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 p-4 bg-slate-800/50 border border-slate-700/50 rounded-xl">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={selectedAuditAction}
                onChange={(e) => setSelectedAuditAction(e.target.value)}
                className="px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              >
                <option value="">Todas as Ações</option>
                {auditFilters.actions.map((action) => (
                  <option key={action} value={action}>{action}</option>
                ))}
              </select>
              <select
                value={selectedAuditEntity}
                onChange={(e) => setSelectedAuditEntity(e.target.value)}
                className="px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              >
                <option value="">Todas as Entidades</option>
                {auditFilters.entityTypes.map((entity) => (
                  <option key={entity} value={entity}>{entity}</option>
                ))}
              </select>
            </div>

            {/* Logs Table */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700/50">
                      <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Data/Hora</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Ação</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Entidade</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Usuário</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Detalhes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.length > 0 ? (
                      auditLogs.map((log) => (
                        <tr key={log.id} className="border-b border-slate-700/30 hover:bg-slate-700/20">
                          <td className="px-4 py-3 text-sm text-slate-300 whitespace-nowrap">
                            {formatDate(log.timestamp)}
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 bg-slate-700/50 rounded text-sm text-slate-300">
                              {log.action}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-300">{log.entityType}</td>
                          <td className="px-4 py-3 text-sm text-slate-300">
                            {log.user?.name || log.user?.email || "Sistema"}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-400 max-w-xs truncate">
                            {JSON.stringify(log.details).slice(0, 50)}...
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                          Nenhum log de auditoria encontrado
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {auditPagination && auditPagination.totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700/50">
                  <p className="text-sm text-slate-400">
                    Página {auditPagination.page} de {auditPagination.totalPages} ({auditPagination.total} registros)
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => fetchAuditLogs(auditPagination.page - 1)}
                      disabled={auditPagination.page === 1}
                      className="p-2 text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => fetchAuditLogs(auditPagination.page + 1)}
                      disabled={auditPagination.page === auditPagination.totalPages}
                      className="p-2 text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "messages" && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 p-4 bg-slate-800/50 border border-slate-700/50 rounded-xl">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={selectedMessageStatus}
                onChange={(e) => setSelectedMessageStatus(e.target.value)}
                className="px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              >
                <option value="">Todos os Status</option>
                {messageFilters.statuses.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
              <select
                value={selectedMessageChannel}
                onChange={(e) => setSelectedMessageChannel(e.target.value)}
                className="px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              >
                <option value="">Todos os Canais</option>
                {messageFilters.channels.map((channel) => (
                  <option key={channel} value={channel}>{channel}</option>
                ))}
              </select>
            </div>

            {/* Messages Table */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700/50">
                      <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Data/Hora</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Canal</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Tipo</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Status</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Estabelecimento</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Cliente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {messageLogs.length > 0 ? (
                      messageLogs.map((log) => (
                        <tr key={log.id} className="border-b border-slate-700/30 hover:bg-slate-700/20">
                          <td className="px-4 py-3 text-sm text-slate-300 whitespace-nowrap">
                            {formatDate(log.sentAt)}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-300 capitalize">{log.channel}</td>
                          <td className="px-4 py-3 text-sm text-slate-300">{log.messageType}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${getStatusColor(log.status)}`}>
                              {getStatusIcon(log.status)}
                              {log.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-300">
                            {log.establishment?.name || "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-300">
                            {log.booking?.clientName || "-"}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                          Nenhum log de mensagem encontrado
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {messagePagination && messagePagination.totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700/50">
                  <p className="text-sm text-slate-400">
                    Página {messagePagination.page} de {messagePagination.totalPages} ({messagePagination.total} registros)
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => fetchMessageLogs(messagePagination.page - 1)}
                      disabled={messagePagination.page === 1}
                      className="p-2 text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => fetchMessageLogs(messagePagination.page + 1)}
                      disabled={messagePagination.page === messagePagination.totalPages}
                      className="p-2 text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
