import { supabase } from '../lib/supabase';
import { LogOut } from 'lucide-react';

export function Header() {
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <header className="sticky top-0 z-50 bg-[#0f0f0f]/90 backdrop-blur-md border-b border-[#c8a646]/20 py-4 px-6">
      <div className="max-w-md mx-auto flex items-center justify-between">
        <div className="w-8"></div> {/* Spacer for centering */}
        <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#c8a646] to-[#e8c666] uppercase tracking-widest text-center">
          ARF Canais
        </h1>
        <button
          onClick={handleLogout}
          className="p-2 text-gray-500 hover:text-red-500 transition-colors"
          title="Sair"
        >
          <LogOut size={20} />
        </button>
      </div>
    </header>
  );
}
