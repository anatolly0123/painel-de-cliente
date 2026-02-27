import { useState, useEffect, ChangeEvent, useMemo } from 'react';
import { Database, Download, Upload, Trash2, HardDrive, Calendar as CalendarIcon, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { Customer, Server, Plan, Renewal, ManualAddition } from '../types';
import { format, parseISO, isWithinInterval, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '../lib/supabase';

interface StorageProps {
  customers: Customer[];
  servers: Server[];
  plans: Plan[];
  renewals: Renewal[];
  manualAdditions: ManualAddition[];
  bulkUpdateCustomers: (updater: (prev: Customer[]) => Customer[]) => void;
  setServers: (servers: Server[]) => void;
  setPlans: (plans: Plan[]) => void;
  setRenewals: (renewals: Renewal[]) => void;
  setManualAdditions: (additions: ManualAddition[]) => void;
}

export function Storage({ customers, servers, plans, renewals, manualAdditions, bulkUpdateCustomers, setServers, setPlans, setRenewals, setManualAdditions }: StorageProps) {
  const [storageSize, setStorageSize] = useState<string>('0 KB');

  useEffect(() => {
    const calculateSize = () => {
      let total = 0;
      for (const key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          total += (localStorage[key].length + key.length) * 2;
        }
      }
      setStorageSize((total / 1024).toFixed(2) + ' KB');
    };
    calculateSize();
  }, [customers, servers, plans]);

  const handleExportAll = () => {
    const data = {
      customers,
      servers,
      plans,
      renewals,
      manualAdditions,
      version: '1.2',
      exportDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_arf_${new Date().getTime()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportAll = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const json = JSON.parse(evt.target?.result as string);
        if (json.customers && Array.isArray(json.customers)) {
          bulkUpdateCustomers(() => json.customers);
        }
        if (json.servers && Array.isArray(json.servers)) {
          setServers(json.servers);
        }
        if (json.plans && Array.isArray(json.plans)) {
          setPlans(json.plans);
        }
        if (json.renewals && Array.isArray(json.renewals)) {
          setRenewals(json.renewals);
        }
        if (json.manualAdditions && Array.isArray(json.manualAdditions)) {
          setManualAdditions(json.manualAdditions);
        }
        alert('Backup restaurado com sucesso!');
      } catch (err) {
        alert('Erro ao importar backup. Verifique o arquivo.');
      }
    };
    reader.readAsText(file);
  };

  const handleClearAll = () => {
    if (confirm('TEM CERTEZA? Isso apagará TODOS os seus dados (Clientes, Servidores e Planos). Esta ação não pode ser desfeita.')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  const [isSyncing, setIsSyncing] = useState(false);

  const syncLocalToCloud = async () => {
    if (!confirm('Deseja enviar seus dados locais para a nuvem? Isso pode sobrescrever dados existentes.')) return;

    setIsSyncing(true);
    try {
      // 1. Servers
      const localServers = JSON.parse(localStorage.getItem('arf_servers') || '[]');
      for (const s of localServers) {
        // Remove internal ID if it's not a UUID or if we want Supabase to generate it
        const { id, ...data } = s;
        await supabase.from('servers').upsert([{ ...data, user_id: (await supabase.auth.getUser()).data.user?.id }]);
      }

      // 2. Plans
      const localPlans = JSON.parse(localStorage.getItem('arf_plans') || '[]');
      for (const p of localPlans) {
        const { id, ...data } = p;
        await supabase.from('plans').upsert([{ ...data, user_id: (await supabase.auth.getUser()).data.user?.id }]);
      }

      // 3. Customers
      const localCustomers = JSON.parse(localStorage.getItem('arf_customers') || '[]');
      for (const c of localCustomers) {
        const dbCustomer = {
          user_id: (await supabase.auth.getUser()).data.user?.id,
          name: c.name,
          phone: c.phone,
          server_id: c.serverId,
          plan_id: c.planId,
          amount_paid: c.amountPaid,
          due_date: c.dueDate,
          last_notified_date: c.lastNotifiedDate
        };
        await supabase.from('customers').upsert([dbCustomer]);
      }

      // 4. Renewals
      const localRenewals = JSON.parse(localStorage.getItem('arf_renewals') || '[]');
      for (const r of localRenewals) {
        const dbRenewal = {
          user_id: (await supabase.auth.getUser()).data.user?.id,
          customer_id: r.customerId,
          server_id: r.serverId,
          plan_id: r.planId,
          amount: r.amount,
          cost: r.cost,
          date: r.date
        };
        await supabase.from('renewals').upsert([dbRenewal]);
      }

      // 5. Manual Additions
      const localAdditions = JSON.parse(localStorage.getItem('arf_manual_additions') || '[]');
      for (const a of localAdditions) {
        const { id, ...data } = a;
        await supabase.from('manual_additions').upsert([{ ...data, user_id: (await supabase.auth.getUser()).data.user?.id }]);
      }

      // 6. Settings
      const localMsg = localStorage.getItem('arf_message_v2');
      if (localMsg) {
        await supabase.from('settings').upsert({
          user_id: (await supabase.auth.getUser()).data.user?.id,
          whatsapp_message: localMsg
        });
      }

      alert('Dados sincronizados com a nuvem com sucesso!');
      window.location.reload();
    } catch (error) {
      console.error('Migration error:', error);
      alert('Erro ao sincronizar dados. Tente novamente.');
    } finally {
      setIsSyncing(false);
    }
  };

  const [showRawData, setShowRawData] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const monthlyStats = useMemo(() => {
    const start = startOfMonth(selectedMonth);
    const end = endOfMonth(selectedMonth);

    const monthRenewals = renewals.filter(r => {
      const rDate = parseISO(r.date);
      return isWithinInterval(rDate, { start, end });
    });

    const monthAdditions = manualAdditions.filter(a => {
      const aDate = parseISO(a.date);
      return isWithinInterval(aDate, { start, end });
    });

    const gross = monthRenewals.reduce((acc, r) => acc + r.amount, 0) +
      monthAdditions.filter(a => a.amount > 0).reduce((acc, a) => acc + a.amount, 0);

    const cost = monthRenewals.reduce((acc, r) => acc + (r.cost || 0), 0) +
      Math.abs(monthAdditions.filter(a => a.amount < 0).reduce((acc, a) => acc + a.amount, 0));

    return {
      gross,
      cost,
      net: gross - cost
    };
  }, [selectedMonth, renewals, manualAdditions]);

  return (
    <div className="space-y-6 pb-24">
      {/* Monthly Stats Section */}
      <div className="bg-[#1a1a1a] p-6 rounded-3xl border border-white/5 shadow-lg">
        <div className="flex flex-col space-y-4 mb-6">
          <div className="flex items-center space-x-3">
            <CalendarIcon size={24} className="text-[#c8a646]" />
            <h2 className="text-xl font-bold text-white uppercase tracking-widest">Faturamento</h2>
          </div>
          <div className="bg-[#0f0f0f] rounded-xl px-4 py-3 border border-white/5 w-full">
            <input
              type="month"
              value={format(selectedMonth, 'yyyy-MM')}
              onChange={(e) => {
                if (e.target.value) {
                  const [year, month] = e.target.value.split('-');
                  setSelectedMonth(new Date(parseInt(year), parseInt(month) - 1));
                }
              }}
              className="bg-transparent text-base font-bold text-white uppercase tracking-wider outline-none cursor-pointer w-full [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
              style={{ colorScheme: 'dark' }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div className="bg-[#0f0f0f] p-4 rounded-2xl border border-white/5 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-500/10 rounded-xl">
                <TrendingUp size={20} className="text-green-400" />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Entrou (Bruto)</div>
                <div className="text-lg font-bold text-white">{formatCurrency(monthlyStats.gross)}</div>
              </div>
            </div>
          </div>

          <div className="bg-[#0f0f0f] p-4 rounded-2xl border border-white/5 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-red-500/10 rounded-xl">
                <TrendingDown size={20} className="text-red-400" />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Saiu (Custo)</div>
                <div className="text-lg font-bold text-white">{formatCurrency(monthlyStats.cost)}</div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-[#c8a646]/20 to-[#0f0f0f] p-4 rounded-2xl border border-[#c8a646]/30 flex items-center justify-between mt-2">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-[#c8a646]/20 rounded-xl">
                <DollarSign size={20} className="text-[#c8a646]" />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[#c8a646] mb-1">Sobrou (Líquido)</div>
                <div className="text-xl font-black text-white">{formatCurrency(monthlyStats.net)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-[#c8a646]/20 to-[#1a1a1a] p-6 rounded-3xl border border-[#c8a646]/30 shadow-xl">
        <div className="flex items-center space-x-4 mb-6">
          <div className="bg-[#c8a646] p-3 rounded-2xl">
            <HardDrive size={24} className="text-[#0f0f0f]" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white uppercase tracking-widest">Armazenamento</h2>
            <p className="text-xs text-gray-400 font-medium">Gerencie seus dados locais</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-[#0f0f0f] p-4 rounded-2xl border border-white/5">
            <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Espaço Usado</div>
            <div className="text-lg font-bold text-white">{storageSize}</div>
          </div>
          <div className="bg-[#0f0f0f] p-4 rounded-2xl border border-white/5">
            <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Total Registros</div>
            <div className="text-lg font-bold text-[#c8a646]">{customers.length + servers.length + plans.length + renewals.length + manualAdditions.length}</div>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={syncLocalToCloud}
            disabled={isSyncing}
            className={`w-full flex items-center justify-between p-4 bg-[#c8a646]/10 border border-[#c8a646]/20 rounded-2xl hover:bg-[#c8a646]/20 transition-colors group ${isSyncing ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-center space-x-3">
              <Upload size={20} className="text-[#c8a646]" />
              <div className="text-left">
                <div className="text-sm font-bold text-white">{isSyncing ? 'Sincronizando...' : 'Sincronizar com Nuvem'}</div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider">Enviar dados locais para o Supabase</div>
              </div>
            </div>
          </button>

          <button
            onClick={handleExportAll}
            className="w-full flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-colors group"
          >
            <div className="flex items-center space-x-3">
              <Download size={20} className="text-[#c8a646]" />
              <div className="text-left">
                <div className="text-sm font-bold text-white">Exportar Backup</div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider">Salvar tudo em arquivo .json</div>
              </div>
            </div>
          </button>

          <label className="w-full flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-colors cursor-pointer group">
            <div className="flex items-center space-x-3">
              <Upload size={20} className="text-blue-400" />
              <div className="text-left">
                <div className="text-sm font-bold text-white">Importar Backup</div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider">Restaurar de um arquivo .json</div>
              </div>
            </div>
            <input type="file" accept=".json" onChange={handleImportAll} className="hidden" />
          </label>

          <button
            onClick={() => setShowRawData(!showRawData)}
            className="w-full flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-colors group"
          >
            <div className="flex items-center space-x-3">
              <Database size={20} className="text-purple-400" />
              <div className="text-left">
                <div className="text-sm font-bold text-white">{showRawData ? 'Esconder Dados Brutos' : 'Ver Dados Brutos'}</div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider">Inspecionar JSON local</div>
              </div>
            </div>
          </button>

          <button
            onClick={handleClearAll}
            className="w-full flex items-center justify-between p-4 bg-red-500/10 border border-red-500/20 rounded-2xl hover:bg-red-500/20 transition-colors group"
          >
            <div className="flex items-center space-x-3">
              <Trash2 size={20} className="text-red-500" />
              <div className="text-left">
                <div className="text-sm font-bold text-red-500">Limpar Tudo</div>
                <div className="text-[10px] text-red-500/70 uppercase tracking-wider">Apagar permanentemente</div>
              </div>
            </div>
          </button>
        </div>
      </div>

      {showRawData && (
        <div className="bg-[#0f0f0f] p-4 rounded-2xl border border-white/10 overflow-x-auto">
          <pre className="text-[10px] text-gray-400 font-mono">
            {JSON.stringify({ customers, servers, plans, renewals, manualAdditions }, null, 2)}
          </pre>
        </div>
      )}

      <div className="bg-[#1a1a1a] p-6 rounded-3xl border border-white/5 shadow-lg">
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center space-x-2">
          <Database size={16} />
          <span>Detalhes Técnicos</span>
        </h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-500">Clientes</span>
            <span className="text-white font-mono">{customers.length}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-500">Servidores</span>
            <span className="text-white font-mono">{servers.length}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-500">Planos</span>
            <span className="text-white font-mono">{plans.length}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-500">Renovações</span>
            <span className="text-white font-mono">{renewals.length}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-500">Adições Manuais</span>
            <span className="text-white font-mono">{manualAdditions.length}</span>
          </div>
          <div className="pt-4 border-t border-white/5 text-[10px] text-gray-600 leading-relaxed">
            Os dados são armazenados localmente no seu navegador (LocalStorage).
            Recomendamos exportar um backup regularmente para evitar perda de dados se o cache do navegador for limpo.
          </div>
        </div>
      </div>
    </div>
  );
}
