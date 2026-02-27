import { useState, useEffect, useCallback } from 'react';
import { Server, Plan, Customer, Renewal, ManualAddition } from './types';
import { supabase } from './lib/supabase';

const DEFAULT_PLANS: Plan[] = [
  { id: '0', name: 'Gratuito', defaultPrice: 0, months: 1 },
  { id: '1', name: 'Mensal', defaultPrice: 35, months: 1 },
  { id: '2', name: 'Trimestral', defaultPrice: 90, months: 3 },
  { id: '3', name: 'Semestral', defaultPrice: 160, months: 6 },
  { id: '4', name: 'Anual', defaultPrice: 300, months: 12 },
];

export function useStore(userId: string | undefined) {
  const [servers, setServers] = useState<Server[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [renewals, setRenewals] = useState<Renewal[]>([]);
  const [manualAdditions, setManualAdditions] = useState<ManualAddition[]>([]);
  const [whatsappMessage, setWhatsappMessage] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [
        { data: srv },
        { data: pln },
        { data: cust },
        { data: ren },
        { data: manual },
        { data: settings }
      ] = await Promise.all([
        supabase.from('servers').select('*').order('created_at'),
        supabase.from('plans').select('*').order('created_at'),
        supabase.from('customers').select('*').order('created_at'),
        supabase.from('renewals').select('*').order('created_at'),
        supabase.from('manual_additions').select('*').order('created_at'),
        supabase.from('settings').select('whatsapp_message').eq('user_id', userId).single()
      ]);

      setServers(srv || []);
      
      let finalPlans = pln || [];
      if (finalPlans.length === 0) {
        // If no plans in cloud, use default and sync if needed
        finalPlans = DEFAULT_PLANS;
      }
      setPlans(finalPlans);
      
      setCustomers(cust || []);
      setRenewals(ren || []);
      setManualAdditions(manual || []);
      
      const defaultMsg = 'Olá *{nome}*! 👋\n\nPassando para lembrar que seu acesso vence em *{dias}* (dia *{vencimento}*).\n\nO valor para renovação é de *{valor}*.\n\nPodemos confirmar sua renovação para garantir que você não fique sem sinal? 😊';
      setWhatsappMessage(settings?.whatsapp_message || defaultMsg);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Server Actions
  const addServer = async (server: Omit<Server, 'id'>) => {
    const { data, error } = await supabase.from('servers').insert([{ ...server, user_id: userId }]).select();
    if (data) setServers(prev => [...prev, data[0]]);
    return { data, error };
  };

  const updateServer = async (id: string, updates: Partial<Server>) => {
    const { error } = await supabase.from('servers').update(updates).eq('id', id);
    if (!error) setServers(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const deleteServer = async (id: string) => {
    const { error } = await supabase.from('servers').delete().eq('id', id);
    if (!error) setServers(prev => prev.filter(s => s.id !== id));
  };

  // Plan Actions
  const updatePlan = async (id: string, defaultPrice: number) => {
    const { error } = await supabase.from('plans').update({ default_price: defaultPrice }).eq('id', id);
    if (!error) setPlans(prev => prev.map(p => p.id === id ? { ...p, defaultPrice } : p));
  };

  // Customer Actions
  const addCustomer = async (customer: Customer) => {
    // Mapping frontend fields to DB snake_case
    const dbCustomer = {
      id: customer.id,
      user_id: userId,
      name: customer.name,
      phone: customer.phone,
      server_id: customer.serverId,
      plan_id: customer.planId,
      amount_paid: customer.amountPaid,
      due_date: customer.dueDate,
      last_notified_date: customer.lastNotifiedDate
    };
    const { data, error } = await supabase.from('customers').insert([dbCustomer]).select();
    if (data) setCustomers(prev => [...prev, customer]);
    return { data, error };
  };

  const updateCustomer = async (id: string, data: Partial<Customer>) => {
    const dbUpdates: any = {};
    if (data.name !== undefined) dbUpdates.name = data.name;
    if (data.phone !== undefined) dbUpdates.phone = data.phone;
    if (data.serverId !== undefined) dbUpdates.server_id = data.serverId;
    if (data.planId !== undefined) dbUpdates.plan_id = data.planId;
    if (data.amountPaid !== undefined) dbUpdates.amount_paid = data.amountPaid;
    if (data.dueDate !== undefined) dbUpdates.due_date = data.dueDate;
    if (data.lastNotifiedDate !== undefined) dbUpdates.last_notified_date = data.lastNotifiedDate;

    const { error } = await supabase.from('customers').update(dbUpdates).eq('id', id);
    if (!error) setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
  };

  const deleteCustomer = async (id: string) => {
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (!error) setCustomers(prev => prev.filter(c => c.id !== id));
  };

  const bulkUpdateCustomers = async (updater: (prev: Customer[]) => Customer[]) => {
    const next = updater(customers);
    // This is simplified, real bulk update would need more care
    setCustomers(next);
  };

  // Renewal Actions
  const addRenewal = async (renewal: Omit<Renewal, 'id'>) => {
    const dbRenewal = {
      user_id: userId,
      customer_id: renewal.customerId,
      server_id: renewal.serverId,
      plan_id: renewal.planId,
      amount: renewal.amount,
      cost: renewal.cost,
      date: renewal.date
    };
    const { data, error } = await supabase.from('renewals').insert([dbRenewal]).select();
    if (data) {
      const newRenewal = { ...renewal, id: data[0].id } as Renewal;
      setRenewals(prev => [...prev, newRenewal]);
    }
  };

  // Manual Addition Actions
  const addManualAddition = async (addition: Omit<ManualAddition, 'id'>) => {
    const { data, error } = await supabase.from('manual_additions').insert([{ ...addition, user_id: userId }]).select();
    if (data) {
      const newAddition = { ...addition, id: data[0].id } as ManualAddition;
      setManualAdditions(prev => [...prev, newAddition]);
    }
  };

  // Settings Actions
  const updateWhatsappMessage = async (message: string) => {
    const { error } = await supabase.from('settings').upsert({
      user_id: userId,
      whatsapp_message: message,
      updated_at: new Date().toISOString()
    });
    if (!error) setWhatsappMessage(message);
  };

  // Bulk migration helpers (for Storage.tsx)
  const bulkUpdateServers = useCallback(async (newServers: Server[]) => {
    setServers(newServers);
  }, []);

  const bulkUpdatePlans = useCallback(async (newPlans: Plan[]) => {
    setPlans(newPlans);
  }, []);

  const bulkUpdateRenewals = useCallback(async (newRenewals: Renewal[]) => {
    setRenewals(newRenewals);
  }, []);

  const bulkUpdateManualAdditions = useCallback(async (newManualAdditions: ManualAddition[]) => {
    setManualAdditions(newManualAdditions);
  }, []);

  return {
    servers, addServer, updateServer, deleteServer, bulkUpdateServers,
    plans, updatePlan, bulkUpdatePlans,
    customers, addCustomer, updateCustomer, deleteCustomer, bulkUpdateCustomers,
    renewals, addRenewal, bulkUpdateRenewals,
    manualAdditions, addManualAddition, bulkUpdateManualAdditions,
    whatsappMessage, setWhatsappMessage: updateWhatsappMessage,
    loading, refreshData: fetchData
  };
}


