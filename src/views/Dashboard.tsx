import { useState, useMemo } from 'react';
import { Customer, Server, Plan, Renewal, ManualAddition } from '../types';
import { differenceInDays, isAfter, format, addMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { TrendingUp, TrendingDown, DollarSign, AlertCircle, MessageCircle, RefreshCw } from 'lucide-react';

interface DashboardProps {
  customers: Customer[];
  servers: Server[];
  plans: Plan[];
  whatsappMessage: string;
  updateCustomer: (id: string, c: Partial<Customer>) => void;
  renewals: Renewal[];
  addRenewal: (r: Omit<Renewal, 'id'>) => void;
  manualAdditions: ManualAddition[];
}

// Utility to parse YYYY-MM-DD safely as local midnight
const parseLocalDate = (dateStr: string | undefined | null) => {
  if (!dateStr || typeof dateStr !== 'string') return new Date(NaN);
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length !== 3) return new Date(dateStr);
  const [y, m, d] = parts.map(Number);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return new Date(NaN);
  return new Date(y, m - 1, d);
};

export function Dashboard({ customers, servers, plans, whatsappMessage, updateCustomer, renewals, addRenewal, manualAdditions }: DashboardProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Renew State
  const [renewData, setRenewData] = useState<{
    customerId: string;
    serverId: string;
    planId: string;
    amountPaid: string;
  } | null>(null);

  // Calculate stats
  const { grossValue, totalPaidToServers, netValue, serverStats, expiringCustomers } = useMemo(() => {
    // 1. Total Gross (from all renewals)
    const totalGross = renewals.reduce((acc, r) => acc + r.amount, 0);

    // 2. Total Server Cost (from all renewals)
    const totalCost = renewals.reduce((acc, r) => acc + (r.cost || 0), 0);

    // 3. Total Manual Additions
    const totalManualAdditions = manualAdditions.reduce((acc, a) => acc + a.amount, 0);

    const stats: Record<string, { name: string; active: number; monthlyGross: number; monthlyCost: number; accumulatedTotal: number }> = {};
    const expiring: Customer[] = [];

    servers.forEach(s => {
      // Calculate accumulated total for this server (all-time)
      const serverRenewals = renewals.filter(r => r.serverId === s.id);
      const accumulatedTotal = serverRenewals.reduce((acc, r) => acc + r.amount, 0);

      // Calculate total gross for this server
      const serverTotalGross = serverRenewals.reduce((acc, r) => acc + r.amount, 0);

      // Calculate total cost for this server
      const serverTotalCost = serverRenewals.reduce((acc, r) => acc + (r.cost || 0), 0);

      stats[s.id] = {
        name: s.name,
        active: 0,
        monthlyGross: serverTotalGross,
        monthlyCost: serverTotalCost,
        accumulatedTotal
      };
    });

    customers.forEach(c => {
      try {
        const dueDate = parseLocalDate(c.dueDate);
        if (isNaN(dueDate.getTime())) return;

        const isActive = isAfter(dueDate, today) || differenceInDays(dueDate, today) === 0;

        if (isActive) {
          if (stats[c.serverId]) {
            stats[c.serverId].active += 1;
          }
        }

        // Expiring in next 7 days or expired in last 7 days
        const daysUntilDue = differenceInDays(dueDate, today);
        if (daysUntilDue >= -7 && daysUntilDue <= 7) {
          expiring.push(c);
        }
      } catch (e) {
        console.error('Erro ao processar cliente no dashboard:', c.name, e);
      }
    });

    // Sort expiring by closest
    expiring.sort((a, b) => {
      const dateA = parseLocalDate(a.dueDate).getTime();
      const dateB = parseLocalDate(b.dueDate).getTime();
      if (isNaN(dateA)) return 1;
      if (isNaN(dateB)) return -1;
      return dateA - dateB;
    });

    return {
      grossValue: totalGross,
      totalPaidToServers: totalCost,
      netValue: (totalGross - totalCost) + totalManualAdditions,
      serverStats: Object.values(stats),
      expiringCustomers: expiring
    };
  }, [customers, servers, renewals, manualAdditions, today]);

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const handleRenewPlanChange = (planId: string) => {
    if (!renewData) return;
    const plan = plans.find(p => p.id === planId);
    if (plan) {
      setRenewData({
        ...renewData,
        planId,
        amountPaid: plan.defaultPrice.toString()
      });
    }
  };

  const openRenewModal = (customer: Customer) => {
    setRenewData({
      customerId: customer.id,
      serverId: customer.serverId,
      planId: customer.planId,
      amountPaid: customer.amountPaid.toString()
    });
  };

  const confirmRenew = () => {
    if (renewData) {
      const customer = customers.find(c => c.id === renewData.customerId);
      const plan = plans.find(p => p.id === renewData.planId);
      if (customer && plan) {
        const currentDueDate = parseLocalDate(customer.dueDate);
        const isActive = isAfter(currentDueDate, today) || differenceInDays(currentDueDate, today) === 0;

        // If active, add to current due date. If expired, add to today.
        const baseDate = isActive ? currentDueDate : today;
        const newDueDate = format(addMonths(baseDate, plan.months), 'yyyy-MM-dd');

        updateCustomer(customer.id, {
          serverId: renewData.serverId,
          planId: renewData.planId,
          amountPaid: parseFloat(renewData.amountPaid.replace(',', '.')),
          dueDate: newDueDate
        });

        const server = servers.find(s => s.id === renewData.serverId);
        const cost = (server?.costPerActive || 0) * (plan?.months || 1);

        addRenewal({
          customerId: customer.id,
          serverId: renewData.serverId,
          planId: renewData.planId,
          amount: parseFloat(renewData.amountPaid.replace(',', '.')),
          cost: cost,
          date: new Date().toISOString()
        });
      }
      setRenewData(null);
    }
  };

  const pendingNotifications = useMemo(() => {
    return expiringCustomers.filter(c => {
      const days = differenceInDays(parseLocalDate(c.dueDate), today);
      return days === 7 && c.lastNotifiedDate !== format(today, 'yyyy-MM-dd');
    });
  }, [expiringCustomers, today]);

  return (
    <div className="space-y-6 pb-24">
      {/* Pending Notifications Banner */}
      {pendingNotifications.length > 0 && (
        <div className="bg-[#c8a646] p-4 rounded-2xl flex items-center justify-between shadow-lg animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex items-center space-x-3">
            <div className="bg-[#0f0f0f] p-2 rounded-full">
              <MessageCircle size={20} className="text-[#c8a646]" />
            </div>
            <div>
              <div className="text-[#0f0f0f] font-bold text-sm">Notificações Pendentes</div>
              <div className="text-[#0f0f0f]/70 text-xs font-medium">{pendingNotifications.length} avisos pendentes para hoje</div>
            </div>
          </div>
          <button
            onClick={() => {
              const first = pendingNotifications[0];
              const days = differenceInDays(parseLocalDate(first.dueDate), today);
              const message = whatsappMessage
                .replace('{nome}', first.name)
                .replace('{valor}', formatCurrency(first.amountPaid))
                .replace('{dias}', days === 0 ? 'hoje' : `${days} dias`)
                .replace('{vencimento}', (() => {
                  try {
                    const d = parseLocalDate(first.dueDate);
                    return isNaN(d.getTime()) ? 'Data Inválida' : format(d, 'dd/MM/yyyy');
                  } catch {
                    return 'Data Inválida';
                  }
                })());

              updateCustomer(first.id, { lastNotifiedDate: format(today, 'yyyy-MM-dd') });
              window.open(`https://wa.me/${first.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank');
            }}
            className="bg-[#0f0f0f] text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-black/80 transition-colors"
          >
            Notificar Agora
          </button>
        </div>
      )}

      {/* Main Cards */}
      <div className="bg-gradient-to-br from-[#c8a646]/20 to-[#1a1a1a] p-6 rounded-3xl border border-[#c8a646]/30 shadow-xl relative overflow-hidden mb-4">
        <div className="absolute top-0 right-0 p-4 opacity-20">
          <DollarSign size={64} className="text-[#c8a646]" />
        </div>
        <div className="relative z-10">
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#c8a646] mb-1">Líquido Total</div>
          <div className="text-4xl font-black text-white">{formatCurrency(netValue)}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-[#1a1a1a] p-4 rounded-2xl border border-white/5 shadow-lg">
          <div className="flex items-center space-x-2 text-gray-400 mb-2">
            <TrendingUp size={16} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Bruto Total</span>
          </div>
          <div className="text-xl font-bold text-white">{formatCurrency(grossValue)}</div>
        </div>

        <div className="bg-[#1a1a1a] p-4 rounded-2xl border border-white/5 shadow-lg">
          <div className="flex items-center space-x-2 text-gray-400 mb-2">
            <TrendingDown size={16} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Custo Servidor Total</span>
          </div>
          <div className="text-xl font-bold text-red-400">{formatCurrency(totalPaidToServers)}</div>
        </div>
      </div>

      {/* Server List */}
      {serverStats.length > 0 && (
        <div className="bg-[#1a1a1a] rounded-2xl border border-white/5 overflow-hidden shadow-lg">
          <div className="p-4 border-b border-white/5">
            <h3 className="text-sm font-medium uppercase tracking-wider text-gray-400">Resumo por Servidor</h3>
          </div>
          <div className="divide-y divide-white/5">
            {serverStats.map((stat, idx) => (
              <div key={idx} className="p-4">
                <div className="flex justify-between items-center mb-3">
                  <div className="font-bold text-white">{stat.name}</div>
                  <div className="text-xs text-gray-400 bg-white/5 px-2 py-1 rounded-md">{stat.active} ativos</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#0f0f0f] p-3 rounded-xl border border-white/5">
                    <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Custo Servidor</div>
                    <div className="text-sm font-bold text-red-400">{formatCurrency(stat.monthlyCost)}</div>
                  </div>
                  <div className="bg-[#0f0f0f] p-3 rounded-xl border border-[#c8a646]/20">
                    <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Bruto Total</div>
                    <div className="text-sm font-bold text-white">{formatCurrency(stat.monthlyGross)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expiring Customers */}
      {expiringCustomers.length > 0 && (
        <div className="bg-[#1a1a1a] rounded-2xl border border-white/5 overflow-hidden shadow-lg">
          <div className="p-4 border-b border-white/5 flex items-center space-x-2">
            <AlertCircle size={18} className="text-yellow-500" />
            <h3 className="text-sm font-medium uppercase tracking-wider text-white">Clientes vencendo</h3>
          </div>
          <div className="divide-y divide-white/5">
            {expiringCustomers.map(c => {
              const server = servers.find(s => s.id === c.serverId);
              const dRaw = parseLocalDate(c.dueDate);
              const customerDueDate = isNaN(dRaw.getTime()) ? today : dRaw;
              const days = differenceInDays(customerDueDate, today);
              const isSevenDayMark = days === 7;
              const alreadyNotified = c.lastNotifiedDate === format(today, 'yyyy-MM-dd');

              const message = whatsappMessage
                .replace('{nome}', c.name)
                .replace('{valor}', formatCurrency(c.amountPaid))
                .replace('{dias}', days === 0 ? 'hoje' : `${days} dias`)
                .replace('{vencimento}', (() => {
                  try {
                    return isNaN(customerDueDate.getTime()) ? 'Data Inválida' : format(customerDueDate, 'dd/MM/yyyy');
                  } catch {
                    return 'Data Inválida';
                  }
                })());

              const encodedMessage = encodeURIComponent(message);

              const handleWhatsAppClick = () => {
                updateCustomer(c.id, { lastNotifiedDate: format(today, 'yyyy-MM-dd') });
                window.open(`https://wa.me/${c.phone.replace(/\D/g, '')}?text=${encodedMessage}`, '_blank');
              };

              return (
                <div key={c.id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-white flex items-center space-x-2">
                      <span>{c.name}</span>
                      {isSevenDayMark && !alreadyNotified && (
                        <span className="bg-[#c8a646] text-[#0f0f0f] text-[10px] font-bold px-1.5 py-0.5 rounded animate-pulse">
                          NOTIFICAR
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 mt-1 flex items-center space-x-2">
                      <span>{server?.name}</span>
                      <span>•</span>
                      <span className={days === 0 ? 'text-red-400' : days < 0 ? 'text-red-500 font-bold' : days === 7 ? 'text-[#c8a646] font-bold' : 'text-yellow-500'}>
                        {days === 0 ? 'Vence hoje' : days < 0 ? `Vencido há ${Math.abs(days)} ${Math.abs(days) === 1 ? 'dia' : 'dias'}` : days === 7 ? 'Vence em 1 semana' : `Vence em ${days} dias`}
                      </span>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => openRenewModal(c)}
                      className="p-2 bg-green-500/10 text-green-400 rounded-full hover:bg-green-500/20 transition-colors"
                      title="Renovar"
                    >
                      <RefreshCw size={20} />
                    </button>
                    <button
                      onClick={handleWhatsAppClick}
                      className={`p-2 rounded-full transition-colors ${alreadyNotified ? 'bg-gray-500/20 text-gray-500' : 'bg-green-600/20 text-green-500 hover:bg-green-600/30'}`}
                      title="WhatsApp"
                    >
                      <MessageCircle size={20} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Renew Modal */}
      {renewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#1a1a1a] rounded-3xl border border-white/10 p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-6 uppercase tracking-widest">
              Renovar Plano
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Servidor</label>
                <select
                  value={renewData.serverId}
                  onChange={e => setRenewData({ ...renewData, serverId: e.target.value })}
                  className="w-full bg-[#0f0f0f] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#c8a646] appearance-none"
                >
                  {servers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Plano</label>
                <select
                  value={renewData.planId}
                  onChange={e => handleRenewPlanChange(e.target.value)}
                  className="w-full bg-[#0f0f0f] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#c8a646] appearance-none"
                >
                  {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Valor (R$)</label>
                <input
                  type="text"
                  value={renewData.amountPaid}
                  onChange={e => setRenewData({ ...renewData, amountPaid: e.target.value })}
                  className="w-full bg-[#0f0f0f] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#c8a646]"
                />
              </div>

              <div className="flex space-x-3 mt-8 pt-4">
                <button
                  onClick={() => setRenewData(null)}
                  className="flex-1 py-3 rounded-xl border border-white/10 text-white font-medium hover:bg-white/5 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmRenew}
                  className="flex-1 py-3 rounded-xl bg-[#c8a646] text-[#0f0f0f] font-bold hover:bg-[#e8c666] transition-colors shadow-lg shadow-[#c8a646]/20"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
