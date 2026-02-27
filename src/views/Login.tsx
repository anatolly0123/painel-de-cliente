import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { LogIn, Mail, Lock, AlertCircle, Loader2, UserPlus } from 'lucide-react';

export function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(null);

        if (isSignUp) {
            const { error } = await supabase.auth.signUp({
                email,
                password,
            });

            if (error) {
                setError(error.message);
            } else {
                setSuccess('Conta criada com sucesso! Verifique seu e-mail se necessário.');
            }
        } else {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                setError(error.message);
            }
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center p-4">
            <div className="w-full max-w-md space-y-8">
                <div className="text-center">
                    <div className="inline-block p-4 rounded-3xl bg-[#1a1a1a] shadow-2xl border border-[#c8a646]/20 mb-6">
                        <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#c8a646] to-[#e8c666] tracking-tighter uppercase">
                            ARF
                        </h1>
                    </div>
                    <h2 className="text-2xl font-bold text-white uppercase tracking-widest mb-2">
                        {isSignUp ? 'Criar Acesso' : 'Painel Admin'}
                    </h2>
                    <p className="text-gray-500 text-sm">Canais, Filmes e Séries</p>
                </div>

                <form onSubmit={handleSubmit} className="mt-8 space-y-4">
                    <div className="space-y-4">
                        <div className="relative group">
                            <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 group-focus-within:text-[#c8a646] transition-colors" size={20} />
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="E-mail"
                                className="w-full bg-[#1a1a1a] border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white placeholder-gray-600 focus:outline-none focus:border-[#c8a646] focus:ring-1 focus:ring-[#c8a646] transition-all"
                            />
                        </div>

                        <div className="relative group">
                            <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 group-focus-within:text-[#c8a646] transition-colors" size={20} />
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Senha"
                                className="w-full bg-[#1a1a1a] border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white placeholder-gray-600 focus:outline-none focus:border-[#c8a646] focus:ring-1 focus:ring-[#c8a646] transition-all"
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="flex items-center space-x-2 text-red-500 text-sm bg-red-500/10 p-4 rounded-xl border border-red-500/20">
                            <AlertCircle size={18} />
                            <span>{error}</span>
                        </div>
                    )}

                    {success && (
                        <div className="flex items-center space-x-2 text-green-500 text-sm bg-green-500/10 p-4 rounded-xl border border-green-500/20">
                            <UserPlus size={18} />
                            <span>{success}</span>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-[#c8a646] to-[#e8c666] text-[#0f0f0f] font-bold py-4 rounded-2xl shadow-lg shadow-[#c8a646]/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:hover:scale-100"
                    >
                        {loading ? (
                            <Loader2 className="animate-spin" size={20} />
                        ) : (
                            <>
                                {isSignUp ? <UserPlus size={20} /> : <LogIn size={20} />}
                                <span>{isSignUp ? 'Criar minha conta' : 'Entrar no Sistema'}</span>
                            </>
                        )}
                    </button>
                </form>

                <div className="text-center">
                    <button
                        onClick={() => {
                            setIsSignUp(!isSignUp);
                            setError(null);
                            setSuccess(null);
                        }}
                        className="text-[#c8a646] text-sm hover:underline transition-all"
                    >
                        {isSignUp ? 'Já tenho uma conta? Entrar' : 'Não tem acesso? Criar conta'}
                    </button>
                </div>

                <p className="text-center text-gray-600 text-xs uppercase tracking-widest mt-8">
                    Acesso Restrito
                </p>
            </div>
        </div>
    );
}

