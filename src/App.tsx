// VERSÃO: 2.1 - LIMPEZA DEFINITIVA (Vercel Fix)
import { useState } from 'react';
import { Customer, Server, Plan } from './types';
import { Dashboard } from './views/Dashboard';
import { Customers } from './views/Customers';
import { Servers } from './views/Servers';
import { Plans } from './views/Plans';
import { Storage } from './views/Storage';
import { Layout, Users, Server as ServerIcon, Receipt, LayoutDashboard, Database } from 'lucide-react';
import { useStore } from './store';
import { AnimatePresence, motion } from 'framer-motion';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const {
    customers, addCustomer, updateCustomer, deleteCustomer, bulkUpdateCustomers,
    servers, addServer, updateServer, deleteServer, setServers,
    plans, addPlan, updatePlan, deletePlan, setPlans,
    renewals, addRenewal, setRenewals,
    manualAdditions, addManualAddition, updateManualAddition, deleteManualAddition, setManualAdditions,
    whatsappMessage, setWhatsappMessage
  } = useStore();

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <Dashboard
            customers={customers}
            servers={servers}
            plans={plans}
            whatsappMessage={whatsappMessage}
            updateCustomer={updateCustomer}
            renewals={renewals}
            addRenewal={addRenewal}
            manualAdditions={manualAdditions}
          />
        );
      case 'customers':
        return (
          <Customers
            customers={customers}
            servers={servers}
            plans={plans}
            whatsappMessage={whatsappMessage}
            addCustomer={addCustomer}
            updateCustomer={updateCustomer}
            deleteCustomer={deleteCustomer}
            bulkUpdateCustomers={bulkUpdateCustomers}
            addRenewal={addRenewal}
          />
        );
      case 'servers':
        return (
          <Servers
            servers={servers}
            customers={customers}
            plans={plans}
            addServer={addServer}
            updateServer={updateServer}
            deleteServer={deleteServer}
          />
        );
      case 'plans':
        return (
          <Plans
            plans={plans}
            updatePlan={(id, price) => updatePlan(id, { defaultPrice: price })}
            whatsappMessage={whatsappMessage}
            setWhatsappMessage={setWhatsappMessage}
            addManualAddition={addManualAddition}
            manualAdditions={manualAdditions}
          />
        );
      case 'storage':
        return (
          <Storage
            customers={customers}
            servers={servers}
            plans={plans}
            renewals={renewals}
            manualAdditions={manualAdditions}
            bulkUpdateCustomers={bulkUpdateCustomers}
            setServers={setServers}
            setPlans={setPlans}
            setRenewals={setRenewals}
            setManualAdditions={setManualAdditions}
          />
        );
      default:
        return <Dashboard customers={customers} servers={servers} plans={plans} whatsappMessage={whatsappMessage} updateCustomer={updateCustomer} renewals={renewals} addRenewal={addRenewal} manualAdditions={manualAdditions} />;
    }
  };

  const menuItems = [
    { id: 'dashboard', label: 'Início', icon: LayoutDashboard },
    { id: 'customers', label: 'Clientes', icon: Users },
    { id: 'servers', label: 'Servidores', icon: ServerIcon },
    { id: 'plans', label: 'Planos/Setup', icon: Receipt },
    { id: 'storage', label: 'Dados', icon: Database },
  ];

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white">
      {/* Sidebar Desktop */}
      <div className="hidden md:flex fixed left-0 top-0 h-full w-64 bg-[#1a1a1a] border-r border-white/5 flex-col p-6 z-20">
        <div className="flex items-center space-x-3 mb-12">
          <div className="bg-[#c8a646] p-2 rounded-xl">
            <Layout className="text-[#0f0f0f]" size={24} />
          </div>
          <span className="text-xl font-bold tracking-tighter uppercase italic">ARF Canais</span>
        </div>

        <nav className="flex-1 space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-2xl transition-all duration-300 ${activeTab === item.id
                ? 'bg-[#c8a646] text-[#0f0f0f] font-bold shadow-lg shadow-[#c8a646]/20'
                : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
            >
              <item.icon size={20} />
              <span className="text-sm">{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className="md:ml-64 min-h-screen">
        <header className="fixed top-0 right-0 left-0 md:left-64 h-16 bg-[#0f0f0f]/80 backdrop-blur-xl border-b border-white/5 z-10 p-4 flex items-center justify-between">
          <h1 className="text-lg font-bold tracking-tight uppercase">
            {menuItems.find(i => i.id === activeTab)?.label}
          </h1>
          <div className="bg-[#1a1a1a] px-3 py-1 rounded-full border border-white/10 text-[10px] uppercase font-bold text-[#c8a646]">
            Versão Local 1.5
          </div>
        </header>

        <main className="p-4 md:p-8 pt-24 max-w-5xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Bottom Nav Mobile */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#1a1a1a]/80 backdrop-blur-2xl border-t border-white/10 flex justify-around p-4 z-20">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center space-y-1 transition-all duration-300 ${activeTab === item.id ? 'text-[#c8a646] scale-110' : 'text-gray-500'
              }`}
          >
            <item.icon size={20} />
            <span className="text-[10px] font-bold uppercase tracking-tighter">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default App;
