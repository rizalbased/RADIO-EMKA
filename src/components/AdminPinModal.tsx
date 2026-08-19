import React, { useState, useRef, useEffect } from 'react';
import { X, Lock, KeyRound, AlertCircle, CheckCircle2, ArrowRight, Mail, Key } from 'lucide-react';
import { loginAdmin } from '../services/api';

interface AdminPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessAdmin: () => void;
}

export const AdminPinModal: React.FC<AdminPinModalProps> = ({
  isOpen,
  onClose,
  onSuccessAdmin
}) => {
  const [authMode, setAuthMode] = useState<'pin' | 'email'>('pin');
  const [pin, setPin] = useState('');
  const [email, setEmail] = useState('admin@emkaradio.sch.id');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setPassword('');
      setError('');
      setSuccess(false);
      setIsLoading(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, authMode]);

  if (!isOpen) return null;

  const performLogin = async (pinValue?: string) => {
    setError('');
    setIsLoading(true);

    try {
      if (authMode === 'pin') {
        const cleanPin = (pinValue || pin).trim();
        if (!cleanPin) {
          setError('Masukkan PIN terlebih dahulu.');
          setIsLoading(false);
          return;
        }

        const res = await loginAdmin(cleanPin);
        if (res.success) {
          setSuccess(true);
          setTimeout(() => {
            onSuccessAdmin();
            setSuccess(false);
            setPin('');
            onClose();
          }, 350);
        } else {
          setError(res.error || 'PIN admin salah. Silakan coba lagi.');
          setPin('');
          inputRef.current?.focus();
        }
      } else {
        const cleanEmail = email.trim();
        const cleanPassword = password.trim();

        if (!cleanEmail || !cleanPassword) {
          setError('Email dan password Supabase harus diisi.');
          setIsLoading(false);
          return;
        }

        const res = await loginAdmin(cleanEmail, cleanPassword);
        if (res.success) {
          setSuccess(true);
          setTimeout(() => {
            onSuccessAdmin();
            setSuccess(false);
            setPassword('');
            onClose();
          }, 350);
        } else {
          setError(res.error || 'Email atau password salah.');
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Terjadi kesalahan saat autentikasi.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    performLogin();
  };

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
    setPin(val);
    if (error) setError('');
    if (val.length === 4) {
      performLogin(val);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border-3 border-primary rounded-[32px] max-w-sm w-full p-6 sm:p-7 shadow-pop relative space-y-5 transition-colors">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl bg-elevated hover:bg-secondary text-primary transition border border-subtle"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-[#FF4F91] text-[#0B0B0B] border-2 border-black mx-auto flex items-center justify-center shadow-pop">
            <Lock className="w-7 h-7" />
          </div>
          <h3 className="text-xl font-black text-primary font-display uppercase tracking-tight">ADMIN EMKA RADIO</h3>
          <p className="text-xs font-semibold text-secondary">
            {authMode === 'pin' ? 'Masukkan PIN admin untuk membuka portal siaran' : 'Masuk menggunakan Akun Admin Supabase Auth'}
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border-2 border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3 rounded-xl bg-[#B6FF00]/25 border-2 border-primary text-primary text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
            <span>Autentikasi Berhasil! Membuka Dashboard Admin...</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {authMode === 'pin' ? (
            <div>
              <label className="block text-xs font-black text-primary mb-2 flex items-center justify-center gap-1.5 uppercase tracking-wider font-mono">
                <KeyRound className="w-3.5 h-3.5 text-[#FF4F91]" />
                <span>PIN ADMIN</span>
              </label>
              <input
                ref={inputRef}
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                placeholder="• • • •"
                value={pin}
                onChange={handlePinChange}
                disabled={success || isLoading}
                className="w-full bg-elevated border-3 border-primary focus:border-[#FF4F91] rounded-2xl px-4 py-3.5 text-center text-2xl font-black font-mono tracking-[0.5em] text-primary placeholder:text-secondary/40 focus:outline-none transition shadow-inner"
                autoFocus
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-black text-primary mb-1 flex items-center gap-1">
                  <Mail className="w-3 h-3 text-[#FF4F91]" />
                  <span>EMAIL ADMIN</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@emkaradio.sch.id"
                  className="w-full bg-elevated border border-subtle focus:border-primary rounded-xl px-3.5 py-2.5 text-xs font-semibold text-primary"
                />
              </div>
              <div>
                <label className="block text-[11px] font-black text-primary mb-1 flex items-center gap-1">
                  <Key className="w-3 h-3 text-[#FF4F91]" />
                  <span>PASSWORD ADMIN</span>
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password admin"
                  className="w-full bg-elevated border border-subtle focus:border-primary rounded-xl px-3.5 py-2.5 text-xs font-semibold text-primary"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={success || isLoading}
            className="w-full py-3.5 rounded-2xl bg-[#0B0B0B] dark:bg-[#B6FF00] hover:bg-slate-800 dark:hover:bg-[#a6eb00] text-[#B6FF00] dark:text-black font-black text-xs font-display uppercase tracking-wider shadow-pop-dark transition border-2 border-black flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            <span>{isLoading ? 'MEMERIKSA...' : 'MASUK ADMIN'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="text-center pt-1">
          <button
            type="button"
            onClick={() => {
              setAuthMode(authMode === 'pin' ? 'email' : 'pin');
              setError('');
            }}
            className="text-[11px] font-bold text-secondary hover:text-primary underline"
          >
            {authMode === 'pin' ? 'Opsi: Masuk dengan Email & Password Supabase' : 'Kembali ke Masuk dengan PIN'}
          </button>
        </div>
      </div>
    </div>
  );
};

