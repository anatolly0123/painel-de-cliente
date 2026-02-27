import { useState, useEffect } from 'react';
import { Customer, Server, Plan, Renewal, ManualAddition } from './types';
import { v4 as uuidv4 } from 'uuid';

export const useStore = () => {
  const [customers, setCustomers] = useState<Customer[]>(() => {
    const saved = localStorage.getItem('arf_customers');
    return saved ? JSON.parse(saved) : [];
  });

  const [servers, setServers] = useState<Server[]>(() => {
    const saved = localStorage.getItem('arf_servers');
    return saved ? JSON.parse(saved) : [];
  });

  const [plans, setPlans] = useState<Plan[]>(() => {
    const saved = localStorage.getItem('arf_plans');
    const defaultPlans = [
      { id: '1', name: 'Mensal', months: 1, defaultPrice: 30 },
      { id: '2', name: 'Trimestral', months: 3, defaultPrice: 80 },
      { id: 'gratuito', name: 'Gratuito', months: 1, defaultPrice: 0 }
    ];
    if (!saved) return defaultPlans;
    const loaded = JSON.parse(saved);
    // Ensure 'Gratuito' is always there
    if (!loaded.find((p: Plan) => p.id === 'gratuito')) {
      return [...loaded, { id: 'gratuito', name: 'Gratuito', months: 1, defaultPrice: 0 }];
    }
    return loaded;
  });

  const [renewals, setRenewals] = useState<Renewal[]>(() => {
    const saved = localStorage.getItem('arf_renewals');
    return saved ? JSON.parse(saved) : [];
  });

  const [manualAdditions, setManualAdditions] = useState<ManualAddition[]>(() => {
    const saved = localStorage.getItem('arf_manual_additions');
    return saved ? JSON.parse(saved) : [];
  });

  const [whatsappMessage, setWhatsappMessage] = useState<string>(() => {
    return localStorage.getItem('arf_message_v2') ||
      'Olá {nome}! Seu acesso está vencendo {dias} ({vencimento}). O valor para renovação é {valor}. Como deseja prosseguir?';
  });

  // Persistence
  useEffect(() => {
    localStorage.setItem('arf_customers', JSON.stringify(customers));
  }, [customers]);

  useEffect(() => {
    localStorage.setItem('arf_servers', JSON.stringify(servers));
  }, [servers]);

  useEffect(() => {
    localStorage.setItem('arf_plans', JSON.stringify(plans));
  }, [plans]);

  useEffect(() => {
    localStorage.setItem('arf_renewals', JSON.stringify(renewals));
  }, [renewals]);

  useEffect(() => {
    localStorage.setItem('arf_manual_additions', JSON.stringify(manualAdditions));
  }, [manualAdditions]);

  useEffect(() => {
    localStorage.setItem('arf_message_v2', whatsappMessage);
  }, [whatsappMessage]);

  // Actions
  const addCustomer = (c: Omit<Customer, 'id'>) => {
    setCustomers(prev => [...prev, { ...c, id: uuidv4() }]);
  };

  const updateCustomer = (id: string, c: Partial<Customer>) => {
    setCustomers(prev => prev.map(item => item.id === id ? { ...item, ...c } : item));
  };

  const deleteCustomer = (id: string) => {
    setCustomers(prev => prev.filter(item => item.id !== id));
  };

  const bulkUpdateCustomers = (updater: (prev: Customer[]) => Customer[]) => {
    setCustomers(updater);
  };

  const addServer = (s: Omit<Server, 'id'>) => {
    setServers(prev => [...prev, { ...s, id: uuidv4() }]);
  };

  const updateServer = (id: string, s: Partial<Server>) => {
    setServers(prev => prev.map(item => item.id === id ? { ...item, ...s } : item));
  };

  const deleteServer = (id: string) => {
    setServers(prev => prev.filter(item => item.id !== id));
  };

  const addPlan = (p: Omit<Plan, 'id'>) => {
    setPlans(prev => [...prev, { ...p, id: uuidv4() }]);
  };

  const updatePlan = (id: string, p: Partial<Plan>) => {
    setPlans(prev => prev.map(item => item.id === id ? { ...item, ...p } : item));
  };

  const deletePlan = (id: string) => {
    if (id === 'gratuito') return;
    setPlans(prev => prev.filter(item => item.id !== id));
  };

  const addRenewal = (r: Omit<Renewal, 'id'>) => {
    setRenewals(prev => [...prev, { ...r, id: uuidv4() }]);
  };

  const addManualAddition = (a: Omit<ManualAddition, 'id'>) => {
    setManualAdditions(prev => [...prev, { ...a, id: uuidv4() }]);
  };

  const updateManualAddition = (id: string, a: Partial<ManualAddition>) => {
    setManualAdditions(prev => prev.map(item => item.id === id ? { ...item, ...a } : item));
  };

  const deleteManualAddition = (id: string) => {
    setManualAdditions(prev => prev.filter(item => item.id !== id));
  };

  return {
    customers, addCustomer, updateCustomer, deleteCustomer, bulkUpdateCustomers,
    servers, addServer, updateServer, deleteServer, setServers,
    plans, addPlan, updatePlan, deletePlan, setPlans,
    renewals, addRenewal, setRenewals,
    manualAdditions, addManualAddition, updateManualAddition, deleteManualAddition, setManualAdditions,
    whatsappMessage, setWhatsappMessage,
    loading: false,
    authLoading: false
  };
};
