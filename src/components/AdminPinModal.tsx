import React, { useState, useRef, useEffect } from 'react';
import { X, Lock, KeyRound, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';

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
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setError('');
      setSuccess(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');

    const cleanPin = pin.trim();

    if (!cleanPin) {
      setError('Masukkan PIN terlebih dahulu.');
      return;
    }

    if (cleanPin.length < 4) {
      setError('PIN harus terdiri dari 4 digit.');
      return;
    }

    if (cleanPin === '1902') {
      setSuccess(true);
      setTimeout(() => {
        onSuccessAdmin();
        setSuccess(false);
        setPin('');
        onClose();
      }, 450);
    } else {
      setError('PIN admin salah. Silakan coba lagi.');
      setPin('');
      inputRef.current?.focus();
    }
  };

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
    setPin(val);
    if (error) setError('');
    if (val.length === 4) {
      if (val === '1902') {
        setSuccess(true);
        setTimeout(() => {
          onSuccessAdmin();
          setSuccess(false);
          setPin('');
          onClose();
        }, 400);
      } else {
        setError('PIN admin salah. Silakan coba lagi.');
      }
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
            Masukkan PIN admin untuk melanjutkan
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
            <span>PIN Benar! Membuka Dashboard Admin...</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-black text-primary mb-2 flex items-center justify-center gap-1.5 uppercase tracking-wider font-mono">
              <KeyRound className="w-3.5 h-3.5 text-[#FF4F91]" />
              <span>PIN ADMIN (4 DIGIT)</span>
            </label>
            <input
              ref={inputRef}
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              placeholder="• • • •"
              value={pin}
              onChange={handlePinChange}
              disabled={success}
              className="w-full bg-elevated border-3 border-primary focus:border-[#FF4F91] rounded-2xl px-4 py-3.5 text-center text-2xl font-black font-mono tracking-[0.5em] text-primary placeholder:text-secondary/40 focus:outline-none transition shadow-inner"
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={success}
            className="w-full py-3.5 rounded-2xl bg-[#0B0B0B] dark:bg-[#B6FF00] hover:bg-slate-800 dark:hover:bg-[#a6eb00] text-[#B6FF00] dark:text-black font-black text-xs font-display uppercase tracking-wider shadow-pop-dark transition border-2 border-black flex items-center justify-center space-x-2"
          >
            <span>MASUK ADMIN</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
