import React, { useState } from 'react';
import { Sprout, Lock, Mail, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('admin@gmail.com');
  const [password, setPassword] = useState('AZERTY12345');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email.trim(), password.trim());
    } catch (err) {
      setError(err.response?.data?.error || 'Identifiants invalides. Vérifiez votre email et mot de passe.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-hydra-darkest relative overflow-hidden">
      {/* Background Decorative Gradients */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-hydra-neon/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-hydra-neonGlow/5 rounded-full blur-3xl pointer-events-none" />

      {/* Login Card */}
      <div className="w-full max-w-md glass-panel rounded-3xl p-8 border border-hydra-borderHighlight shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-300">
        {/* Top Brand Logo */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-hydra-neon to-hydra-neonDim flex items-center justify-center text-hydra-darkest shadow-[0_0_30px_rgba(0,255,136,0.4)] mb-4">
            <Sprout className="w-9 h-9" />
          </div>
          <h1 className="text-2xl font-extrabold text-hydra-textMain tracking-wider flex items-center gap-2">
            HYDRIVIA
            <span className="w-2 h-2 rounded-full bg-hydra-neon animate-pulse shadow-[0_0_8px_#00ff88]" />
          </h1>
          <p className="text-xs text-hydra-textMuted font-mono mt-1 uppercase tracking-widest">
            SUPERVISION & CONTRÔLE D'IRRIGATION
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-3.5 bg-hydra-alert/15 border border-hydra-alert/30 rounded-xl text-hydra-alert text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-hydra-textMuted uppercase tracking-wider mb-2">
              Adresse Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-hydra-textDim absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@gmail.com"
                className="w-full bg-hydra-dark/80 border border-hydra-border focus:border-hydra-neon focus:ring-1 focus:ring-hydra-neon rounded-xl pl-10 pr-4 py-3 text-sm text-hydra-textMain placeholder-hydra-textDim outline-none transition font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-hydra-textMuted uppercase tracking-wider mb-2">
              Mot de passe
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-hydra-textDim absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-hydra-dark/80 border border-hydra-border focus:border-hydra-neon focus:ring-1 focus:ring-hydra-neon rounded-xl pl-10 pr-4 py-3 text-sm text-hydra-textMain placeholder-hydra-textDim outline-none transition font-mono"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-4 neon-button py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 group"
          >
            <span>{loading ? 'Connexion en cours...' : 'Se connecter'}</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </button>
        </form>

        {/* Security badge */}
        <div className="mt-8 pt-4 border-t border-hydra-border/60 flex items-center justify-center gap-2 text-[11px] text-hydra-textDim font-mono">
          <ShieldCheck className="w-4 h-4 text-hydra-neon" />
          <span>Accès Sécurisé — Terminal Administrateur</span>
        </div>
      </div>
    </div>
  );
}
