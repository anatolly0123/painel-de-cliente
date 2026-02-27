/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { useStore } from './store';
import { Tab } from './types';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { Dashboard } from './views/Dashboard';
import { Customers } from './views/Customers';
import { Servers } from './views/Servers';
import { Plans } from './views/Plans';
import { Storage } from './views/Storage';
import { Login } from './views/Login';
import { supabase } from './lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { Session } from '@supabase/supabase-js';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const store = useStore();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <div className="text-[#c8a646] animate-pulse font-bold tracking-widest uppercase">Carregando...</div>
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <Dashboard
            customers={store.customers}
            servers={store.servers}
            plans={store.plans}
            whatsappMessage={store.whatsappMessage}
            updateCustomer={store.updateCustomer}
            renewals={store.renewals}
            addRenewal={store.addRenewal}
            manualAdditions={store.manualAdditions}
          />
        );
      case 'customers':
        return (
          <Customers
            customers={store.customers}
            servers={store.servers}
            plans={store.plans}
            whatsappMessage={store.whatsappMessage}
            addCustomer={store.addCustomer}
            updateCustomer={store.updateCustomer}
            deleteCustomer={store.deleteCustomer}
            bulkUpdateCustomers={store.bulkUpdateCustomers}
            addRenewal={store.addRenewal}
          />
        );
      case 'servers':
        return (
          <Servers
            servers={store.servers}
            customers={store.customers}
            plans={store.plans}
            addServer={store.addServer}
            updateServer={store.updateServer}
            deleteServer={store.deleteServer}
          />
        );
      case 'plans':
        return (
          <Plans
            plans={store.plans}
            updatePlan={store.updatePlan}
            whatsappMessage={store.whatsappMessage}
            setWhatsappMessage={store.setWhatsappMessage}
            addManualAddition={store.addManualAddition}
            manualAdditions={store.manualAdditions}
          />
        );
      case 'storage':
        return (
          <Storage
            customers={store.customers}
            servers={store.servers}
            plans={store.plans}
            renewals={store.renewals}
            manualAdditions={store.manualAdditions}
            bulkUpdateCustomers={store.bulkUpdateCustomers}
            setServers={store.bulkUpdateServers}
            setPlans={store.bulkUpdatePlans}
            setRenewals={store.bulkUpdateRenewals}
            setManualAdditions={store.bulkUpdateManualAdditions}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white font-sans selection:bg-[#c8a646]/30 pb-20">
      <Header />
      <main className="max-w-md mx-auto p-4 sm:p-6 overflow-x-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </main>
      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}




