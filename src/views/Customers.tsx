import React, { useState, useMemo, useRef } from 'react';
import { Customer, Server, Plan, Renewal } from '../types';
import { Plus, Edit2, Trash2, Search, Filter, Calendar, Phone, CheckCircle, XCircle, RefreshCw, Upload, Download } from 'lucide-react';
import { format, parseISO, addMonths, isAfter, differenceInDays } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx';

interface CustomersProps {
  customers: Customer[];
  servers: Server[];
  plans: Plan[];
  whatsappMessage: string;
  addCustomer: (c: Customer) => void;
  updateCustomer: (id: string, c: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;
  bulkUpdateCustomers: (updater: (prev: Customer[]) => Customer[]) => void;
  addRenewal: (r: Omit<Renewal, 'id'>) => void;
}

// Utility to parse YYYY-MM-DD safely as local midnight
const parseLocalDate = (dateStr: string) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export function Customers({
  customers, servers, plans, whatsappMessage,
  addCustomer, updateCustomer, deleteCustomer,
  bulkUpdateCustomers, addRenewal
}: CustomersProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete Confirmation State
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);

  // Renew State
  const [renewData, setRenewData] = useState<{
    customerId: string;
    serverId: string;
    planId: string;
    amountPaid: string;
  } | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [serverFilter, setServerFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    serverId: servers.length > 0 ? servers[0].id : '',
    planId: plans.length > 0 ? plans[0].id : '',
    amountPaid: plans.length > 0 ? plans[0].defaultPrice.toString() : '0',
    dueDate: format(addMonths(new Date(), plans.length > 0 ? plans[0].months : 1), 'yyyy-MM-dd')
  });

  const today = new Date();

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  // Handle plan change to auto-fill price and date
  const handlePlanChange = (planId: string) => {
    const plan = plans.find(p => p.id === planId);
    if (plan) {
      setFormData({
        ...formData,
        planId,
        amountPaid: plan.defaultPrice.toString(),
        dueDate: format(addMonths(new Date(), plan.months), 'yyyy-MM-dd')
      });
    }
  };

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(formData.amountPaid.replace(',', '.'));
    if (isNaN(amount)) return;

    const data = {
      name: formData.name,
      phone: formData.phone,
      serverId: formData.serverId,
      planId: formData.planId,
      amountPaid: amount,
      dueDate: formData.dueDate,
    };

    if (editingCustomer) {
      updateCustomer(editingCustomer.id, data);
    } else {
      const newId = uuidv4();
      addCustomer({ ...data, id: newId });

      const server = servers.find(s => s.id === data.serverId);
      const plan = plans.find(p => p.id === data.planId);
      const cost = (server?.costPerActive || 0) * (plan?.months || 1);

      addRenewal({
        customerId: newId,
        serverId: data.serverId,
        planId: data.planId,
        amount: data.amountPaid,
        cost: cost,
        date: new Date().toISOString()
      });
    }
    closeModal();
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Nome', 'Telefone', 'Servidor', 'Plano', 'Valor', 'Vencimento (DD/MM/AAAA)'],
      ['João Silva', '5511999999999', servers[0]?.name || 'Servidor 1', plans[0]?.name || 'Mensal', plans[0]?.defaultPrice || '35', format(addMonths(new Date(), 1), 'dd/MM/yyyy')]
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
    XLSX.writeFile(wb, 'modelo_clientes.xlsx');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Use raw objects to allow flexible parsing of both strings and numbers
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' }) as any[];

        const newCustomers: Customer[] = [];
        const newRenewals: Omit<Renewal, 'id'>[] = [];

        jsonData.forEach((row) => {
          // Flexible header matching in case user slightly changes case
          const getFieldValue = (possibleNames: string[]) => {
            for (const name of possibleNames) {
              for (const key in row) {
                if (key.toLowerCase().includes(name.toLowerCase())) {
                  return row[key];
                }
              }
            }
            return '';
          };

          const nome = String(getFieldValue(['Nome']) || '').trim();
          const telefoneRaw = String(getFieldValue(['Telefone', 'Celular', 'WhatsApp']) || '').trim();
          const servidorNome = String(getFieldValue(['Servidor']) || '').trim();
          const planoNome = String(getFieldValue(['Plano']) || '').trim();
          const valorRaw = String(getFieldValue(['Valor', 'Preço']) || '').trim();
          const vencimentoRaw = getFieldValue(['Vencimento', 'Data', 'Vence']);

          if (!nome) return; // Skip empty rows

          // Clean phone
          const phone = telefoneRaw.replace(/\D/g, '');

          // Match Server
          let serverId = servers[0]?.id || '';
          const matchedServer = servers.find(s => s.name.toLowerCase() === servidorNome.toLowerCase());
          if (matchedServer) serverId = matchedServer.id;

          // Match Plan
          let planId = plans[0]?.id || '';
          let planMonths = plans[0]?.months || 1;
          const matchedPlan = plans.find(p => p.name.toLowerCase() === planoNome.toLowerCase());
          if (matchedPlan) {
            planId = matchedPlan.id;
            planMonths = matchedPlan.months;
          }

          // Parse Value
          let amountPaid = matchedPlan ? matchedPlan.defaultPrice : 0;
          if (valorRaw) {
            const parsedVal = parseFloat(valorRaw.replace(',', '.').replace(/[^\d.-]/g, ''));
            if (!isNaN(parsedVal)) amountPaid = parsedVal;
          }

          // Parse Date
          let dueDate = format(addMonths(new Date(), planMonths), 'yyyy-MM-dd');

          if (vencimentoRaw instanceof Date) {
            // SheetJS dates can have timezone offsets. For "due dates", we just want the calendar date.
            // We use the Date object properties to get the actual numbers.
            const day = vencimentoRaw.getDate();
            const month = vencimentoRaw.getMonth() + 1;
            const year = vencimentoRaw.getFullYear();
            dueDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          } else if (vencimentoRaw) {
            const vencStr = String(vencimentoRaw).trim();
            // Handle DD/MM/YYYY format string
            const parts = vencStr.split('/');
            if (parts.length === 3) {
              const day = String(parts[0]).padStart(2, '0');
              const month = String(parts[1]).padStart(2, '0');
              const year = parts[2];
              dueDate = `${year}-${month}-${day}`;
            } else if (!isNaN(Number(vencStr))) {
              // Handle Excel serial date (number)
              const parsedDate = XLSX.SSF.parse_date_code(Number(vencStr));
              const day = String(parsedDate.d).padStart(2, '0');
              const month = String(parsedDate.m).padStart(2, '0');
              const year = parsedDate.y;
              dueDate = `${year}-${month}-${day}`;
            }
          }

          const customerId = uuidv4();
          newCustomers.push({
            id: customerId,
            name: nome,
            phone,
            serverId,
            planId,
            amountPaid,
            dueDate
          });

          // Generate corresponding renewal history
          const cost = (matchedServer?.costPerActive || servers[0]?.costPerActive || 0) * planMonths;
          newRenewals.push({
            customerId,
            serverId,
            planId,
            amount: amountPaid,
            cost: cost,
            date: new Date().toISOString()
          });
        });

        if (newCustomers.length > 0) {
          bulkUpdateCustomers(prev => [...prev, ...newCustomers]);
          newRenewals.forEach(addRenewal);
          alert(`${newCustomers.length} clientes importados com sucesso!`);
        } else {
          alert('Nenhum cliente válido encontrado na planilha.');
        }
      } catch (error) {
        console.error('Erro ao processar arquivo:', error);
        alert('Erro ao ler o arquivo Excel. Verifique o formato e tente novamente.');
      }

      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const openModal = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer);
      setFormData({
        name: customer.name,
        phone: customer.phone,
        serverId: customer.serverId,
        planId: customer.planId,
        amountPaid: customer.amountPaid.toString(),
        dueDate: customer.dueDate
      });
    } else {
      setEditingCustomer(null);
      const defaultPlan = plans[0];
      setFormData({
        name: '',
        phone: '',
        serverId: servers.length > 0 ? servers[0].id : '',
        planId: defaultPlan?.id || '',
        amountPaid: defaultPlan?.defaultPrice.toString() || '0',
        dueDate: format(addMonths(new Date(), defaultPlan?.months || 1), 'yyyy-MM-dd')
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCustomer(null);
  };

  const confirmDelete = () => {
    if (customerToDelete) {
      deleteCustomer(customerToDelete.id);
      setCustomerToDelete(null);
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

  // Filter and sort customers
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone.includes(searchQuery);
      const matchesServer = serverFilter === 'all' || c.serverId === serverFilter;

      const dueDate = parseLocalDate(c.dueDate);
      const isActive = isAfter(dueDate, today) || differenceInDays(dueDate, today) === 0;
      const status = isActive ? 'Ativo' : 'Vencido';
      const matchesStatus = statusFilter === 'all' || status.toLowerCase() === statusFilter;

      return matchesSearch && matchesServer && matchesStatus;
    }).sort((a, b) => parseISO(a.dueDate).getTime() - parseISO(b.dueDate).getTime());
  }, [customers, searchQuery, serverFilter, statusFilter, today]);

  return (
    <div className="pb-24 space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-white uppercase tracking-widest">Clientes</h2>
        <div className="flex space-x-2 relative">
          <input
            type="file"
            accept=".xlsx, .xls"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={downloadTemplate}
            title="Baixar Modelo Excel"
            className="bg-[#1a1a1a] text-[#c8a646] p-2 rounded-full border border-white/10 hover:bg-white/5 transition-colors"
          >
            <Download size={20} />
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            title="Importar Excel"
            className="bg-[#1a1a1a] text-green-400 p-2 rounded-full border border-white/10 hover:bg-white/5 transition-colors"
          >
            <Upload size={20} />
          </button>
          <button
            onClick={() => openModal()}
            title="Adicionar Novo"
            className="bg-[#c8a646] text-[#0f0f0f] p-2 rounded-full hover:bg-[#e8c666] transition-colors shadow-lg shadow-[#c8a646]/20"
          >
            <Plus size={24} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={18} />
          <input
            type="text"
            placeholder="Buscar por nome..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:border-[#c8a646] transition-colors"
          />
        </div>

        <div className="flex space-x-2">
          <div className="relative flex-1">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={16} />
            <select
              value={serverFilter}
              onChange={e => setServerFilter(e.target.value)}
              className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:outline-none appearance-none"
            >
              <option value="all">Todos Servidores</option>
              {servers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="flex-1 bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none appearance-none"
          >
            <option value="all">Todos Status</option>
            <option value="ativo">Ativos</option>
            <option value="vencido">Vencidos</option>
          </select>
        </div>
      </div>

      {/* Customer List */}
      <div className="space-y-3">
        {filteredCustomers.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>Nenhum cliente encontrado.</p>
          </div>
        ) : (
          filteredCustomers.map(customer => {
            const server = servers.find(s => s.id === customer.serverId);
            const plan = plans.find(p => p.id === customer.planId);
            const dueDate = parseISO(customer.dueDate);
            const daysDiff = differenceInDays(dueDate, today);
            const isActive = isAfter(dueDate, today) || daysDiff === 0;

            return (
              <div key={customer.id} className="bg-[#1a1a1a] rounded-2xl border border-white/5 p-4 shadow-lg">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                      <span>{customer.name}</span>
                      {isActive ? (
                        <CheckCircle size={14} className="text-green-500" />
                      ) : (
                        <XCircle size={14} className="text-red-500" />
                      )}
                      {daysDiff === 7 && customer.lastNotifiedDate !== format(today, 'yyyy-MM-dd') && (
                        <span className="bg-[#c8a646] text-[#0f0f0f] text-[10px] font-bold px-1.5 py-0.5 rounded">
                          NOTIFICAR
                        </span>
                      )}
                    </h3>
                    <div className="text-xs text-[#c8a646] uppercase tracking-wider mt-1">{server?.name} • {plan?.name}</div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => {
                        const message = whatsappMessage
                          .replace('{nome}', customer.name)
                          .replace('{valor}', formatCurrency(customer.amountPaid))
                          .replace('{dias}', daysDiff === 0 ? 'hoje' : `${daysDiff} dias`)
                          .replace('{vencimento}', (() => {
                            try {
                              const d = parseLocalDate(customer.dueDate);
                              return isNaN(d.getTime()) ? 'Data Inválida' : format(d, 'dd/MM/yyyy');
                            } catch {
                              return 'Data Inválida';
                            }
                          })());

                        updateCustomer(customer.id, { lastNotifiedDate: format(today, 'yyyy-MM-dd') });
                        window.open(`https://wa.me/${customer.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank');
                      }}
                      className={`p-2 rounded-full transition-colors ${daysDiff === 7 && customer.lastNotifiedDate !== format(today, 'yyyy-MM-dd') ? 'bg-green-600/30 text-green-400 animate-pulse' : 'bg-white/5 text-gray-400 hover:text-white'}`}
                      title="WhatsApp"
                    >
                      <Phone size={16} />
                    </button>
                    <button onClick={() => openRenewModal(customer)} className="p-2 text-green-400 hover:text-green-300 transition-colors bg-green-500/10 rounded-full" title="Renovar">
                      <RefreshCw size={16} />
                    </button>
                    <button onClick={() => openModal(customer)} className="p-2 text-gray-400 hover:text-white transition-colors bg-white/5 rounded-full" title="Editar">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => setCustomerToDelete(customer)} className="p-2 text-red-400 hover:text-red-300 transition-colors bg-red-500/10 rounded-full" title="Excluir">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-4">
                  <div className="flex items-center space-x-2 text-sm text-gray-400">
                    <Calendar size={14} />
                    <span className={!isActive ? 'text-red-400 font-medium' : daysDiff <= 7 ? 'text-yellow-500 font-medium' : ''}>
                      {(() => {
                        try {
                          const d = parseLocalDate(customer.dueDate);
                          return isNaN(d.getTime()) ? 'Data Inválida' : format(d, 'dd/MM/yyyy');
                        } catch {
                          return 'Data Inválida';
                        }
                      })()}
                    </span>
                  </div>
                  <div className="flex items-center justify-end space-x-2 text-sm font-medium text-white">
                    {formatCurrency(customer.amountPaid)}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {customerToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#1a1a1a] rounded-3xl border border-white/10 p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-2 uppercase tracking-widest">
              Excluir Cliente
            </h3>
            <p className="text-gray-400 text-sm mb-6">
              Tem certeza que deseja excluir o cliente <span className="text-white font-bold">{customerToDelete.name}</span>? Esta ação não pode ser desfeita.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setCustomerToDelete(null)}
                className="flex-1 py-3 rounded-xl border border-white/10 text-white font-medium hover:bg-white/5 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-3 rounded-xl bg-red-500/20 text-red-500 font-bold hover:bg-red-500/30 transition-colors"
              >
                Excluir
              </button>
            </div>
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

      {/* Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-[#1a1a1a] rounded-3xl border border-white/10 p-6 w-full max-w-sm shadow-2xl my-8">
            <h3 className="text-xl font-bold text-white mb-6 uppercase tracking-widest">
              {editingCustomer ? 'Editar Cliente' : 'Novo Cliente'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Nome</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-[#0f0f0f] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#c8a646]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">WhatsApp</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={18} />
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="5511999999999"
                    className="w-full bg-[#0f0f0f] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:border-[#c8a646]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Servidor</label>
                <select
                  required
                  value={formData.serverId}
                  onChange={e => setFormData({ ...formData, serverId: e.target.value })}
                  className="w-full bg-[#0f0f0f] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#c8a646] appearance-none"
                >
                  <option value="" disabled>Selecione um servidor</option>
                  {servers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Plano</label>
                <select
                  required
                  value={formData.planId}
                  onChange={e => handlePlanChange(e.target.value)}
                  className="w-full bg-[#0f0f0f] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#c8a646] appearance-none"
                >
                  {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Valor (R$)</label>
                  <input
                    type="text"
                    required
                    value={formData.amountPaid}
                    onChange={e => setFormData({ ...formData, amountPaid: e.target.value })}
                    className="w-full bg-[#0f0f0f] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#c8a646]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Vencimento</label>
                  <input
                    type="date"
                    required
                    value={formData.dueDate}
                    onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
                    className="w-full bg-[#0f0f0f] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#c8a646]"
                  />
                </div>
              </div>

              <div className="flex space-x-3 mt-8 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-3 rounded-xl border border-white/10 text-white font-medium hover:bg-white/5 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-[#c8a646] text-[#0f0f0f] font-bold hover:bg-[#e8c666] transition-colors shadow-lg shadow-[#c8a646]/20"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


