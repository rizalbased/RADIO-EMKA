import React, { useState, useRef, useEffect } from 'react';
import { Radio, Headphones, Shield, Sparkles, ArrowRight, ArrowLeft, AlertCircle, CheckCircle2, Lock } from 'lucide-react';

interface AccessLandingViewProps {
  onSelectStudent: () => void;
  onAdminLoginSuccess: () => void;
}

export const AccessLandingView: React.FC<AccessLandingViewProps> = ({
  onSelectStudent,
  onAdminLoginSuccess
}) => {
  const [viewState, setViewState] = useState<'select' | 'admin-pin'>('select');
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const pinInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (viewState === 'admin-pin') {
      setTimeout(() => {
        pinInputRef.current?.focus();
      }, 100);
    }
  }, [viewState]);

  const handleAdminPinSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setPinError('');

    const cleanPin = pin.trim();

    if (!cleanPin) {
      setPinError('Masukkan PIN terlebih dahulu.');
      return;
    }

    if (cleanPin.length < 4) {
      setPinError('PIN harus terdiri dari 4 digit.');
      return;
    }

    if (cleanPin === '1902') {
      setIsSuccess(true);
      setTimeout(() => {
        onAdminLoginSuccess();
      }, 450);
    } else {
      setPinError('PIN admin salah. Silakan coba lagi.');
      setPin('');
      pinInputRef.current?.focus();
    }
  };

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
    setPin(val);
    if (pinError) setPinError('');
    if (val.length === 4) {
      if (val === '1902') {
        setIsSuccess(true);
        setTimeout(() => {
          onAdminLoginSuccess();
        }, 400);
      } else {
        setPinError('PIN admin salah. Silakan coba lagi.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF7EC] text-[#0B0B0B] font-sans flex flex-col justify-between relative overflow-hidden select-none">
      {/* Decorative background visual elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-[#B6FF00]/25 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-24 w-96 h-96 bg-[#FF4F91]/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 left-1/4 w-96 h-96 bg-[#35B9FF]/20 rounded-full blur-3xl" />
      </div>

      {/* Top Header */}
      <header className="relative z-10 w-full max-w-6xl mx-auto px-6 py-8 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-2xl bg-[#B6FF00] border-2 border-[#0B0B0B] flex items-center justify-center text-[#0B0B0B] shadow-pop">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5 leading-none">
              <span className="font-display font-black text-3xl tracking-tight text-[#0B0B0B] uppercase">
                EMKA
              </span>
              <span className="font-display font-black text-3xl tracking-tight text-[#FF4F91] uppercase">
                RADIO
              </span>
            </div>
            <p className="text-[11px] font-black text-[#6B4E3D] tracking-widest uppercase mt-0.5 font-mono">
              RADIO MULTI KARYA
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center space-x-2 bg-white/80 backdrop-blur-sm border-2 border-[#0B0B0B] px-3.5 py-1.5 rounded-full shadow-xs">
          <span className="w-2.5 h-2.5 rounded-full bg-[#B6FF00] animate-ping" />
          <span className="text-xs font-black uppercase tracking-wider text-[#0B0B0B]">ON-AIR 24/7</span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-6 py-6">
        <div className="max-w-4xl w-full">
          {viewState === 'select' ? (
            <div className="space-y-8">
              {/* Heading Title */}
              <div className="text-center space-y-3 max-w-2xl mx-auto">
                <div className="inline-flex items-center space-x-2 bg-[#FF4F91]/15 text-[#FF4F91] border border-[#FF4F91]/30 px-4 py-1.5 rounded-full text-xs font-black tracking-wider uppercase">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Stasiun Radio Sekolah Terlengkap</span>
                </div>
                <h1 className="text-4xl sm:text-6xl font-black text-[#0B0B0B] font-display uppercase tracking-tight leading-none">
                  Selamat Datang di EMKA RADIO
                </h1>
                <p className="text-sm sm:text-base font-semibold text-[#6B4E3D] max-w-md mx-auto">
                  Pilih akses untuk melanjutkan ke portal siaran dan request lagu.
                </p>
              </div>

              {/* Two Main Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto pt-2">
                {/* CARD SISWA */}
                <div
                  onClick={onSelectStudent}
                  className="bg-white border-3 border-[#0B0B0B] rounded-[32px] p-7 sm:p-9 shadow-pop hover:-translate-y-1.5 transition-all duration-200 cursor-pointer group flex flex-col justify-between relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-[#B6FF00]/20 rounded-full blur-2xl pointer-events-none group-hover:bg-[#B6FF00]/40 transition" />
                  
                  <div className="space-y-4 relative z-10">
                    <div className="w-16 h-16 rounded-2xl bg-[#B6FF00] border-2 border-[#0B0B0B] flex items-center justify-center text-2xl shadow-sm group-hover:scale-105 group-hover:rotate-3 transition-transform">
                      <Headphones className="w-8 h-8 text-[#0B0B0B]" />
                    </div>
                    
                    <div>
                      <span className="text-[10px] font-black tracking-widest text-[#6B4E3D] uppercase font-mono">
                        AKSES UMUM
                      </span>
                      <h2 className="text-2xl sm:text-3xl font-black text-[#0B0B0B] font-display uppercase tracking-tight leading-tight">
                        MASUK SEBAGAI SISWA
                      </h2>
                    </div>

                    <p className="text-xs sm:text-sm font-semibold text-[#6B4E3D] leading-relaxed">
                      Request lagu dan nikmati siaran EMKA Radio. Kirim pesan confession dan pantau antrean lagu favoritmu.
                    </p>
                  </div>

                  <div className="pt-6 relative z-10">
                    <button
                      type="button"
                      onClick={onSelectStudent}
                      className="w-full py-4 px-6 rounded-2xl bg-[#B6FF00] hover:brightness-105 text-[#0B0B0B] font-black text-sm font-display uppercase tracking-wider transition flex items-center justify-between border-2 border-[#0B0B0B] shadow-sm group-hover:shadow-md"
                    >
                      <span>Request Lagu & Siaran</span>
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>

                {/* CARD ADMIN */}
                <div
                  onClick={() => {
                    setViewState('admin-pin');
                    setPin('');
                    setPinError('');
                  }}
                  className="bg-[#2C1E16] border-3 border-[#0B0B0B] rounded-[32px] p-7 sm:p-9 shadow-pop-dark hover:-translate-y-1.5 transition-all duration-200 cursor-pointer group flex flex-col justify-between relative overflow-hidden text-white"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-[#FF4F91]/20 rounded-full blur-2xl pointer-events-none group-hover:bg-[#FF4F91]/40 transition" />

                  <div className="space-y-4 relative z-10">
                    <div className="w-16 h-16 rounded-2xl bg-[#FF4F91] border-2 border-white/40 flex items-center justify-center text-2xl shadow-sm group-hover:scale-105 group-hover:-rotate-3 transition-transform text-[#0B0B0B]">
                      <Shield className="w-8 h-8 text-[#0B0B0B]" />
                    </div>

                    <div>
                      <span className="text-[10px] font-black tracking-widest text-[#FF4F91] uppercase font-mono">
                        PENGELOLA RADIO
                      </span>
                      <h2 className="text-2xl sm:text-3xl font-black text-white font-display uppercase tracking-tight leading-tight">
                        MASUK SEBAGAI ADMIN
                      </h2>
                    </div>

                    <p className="text-xs sm:text-sm font-semibold text-[#FFF7EC]/70 leading-relaxed">
                      Kelola siaran, antrean FIFO, request siswa, DJ Studio, Google Sheet, dan Radio Player utama.
                    </p>
                  </div>

                  <div className="pt-6 relative z-10">
                    <button
                      type="button"
                      onClick={() => {
                        setViewState('admin-pin');
                        setPin('');
                        setPinError('');
                      }}
                      className="w-full py-4 px-6 rounded-2xl bg-white hover:bg-[#FFF7EC] text-[#0B0B0B] font-black text-sm font-display uppercase tracking-wider transition flex items-center justify-between border-2 border-black shadow-sm group-hover:shadow-md"
                    >
                      <span>Kelola Radio (Admin)</span>
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ADMIN PIN SCREEN */
            <div className="max-w-md mx-auto">
              <div className="bg-white border-3 border-[#0B0B0B] rounded-[36px] p-7 sm:p-10 shadow-pop relative overflow-hidden space-y-6">
                {/* Back button */}
                <button
                  onClick={() => {
                    setViewState('select');
                    setPin('');
                    setPinError('');
                  }}
                  className="inline-flex items-center space-x-1.5 text-xs font-black uppercase text-[#6B4E3D] hover:text-[#0B0B0B] transition"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Kembali ke Pilih Akses</span>
                </button>

                <div className="text-center space-y-2">
                  <div className="w-16 h-16 rounded-2xl bg-[#FF4F91] text-[#0B0B0B] border-2 border-[#0B0B0B] mx-auto flex items-center justify-center shadow-pop">
                    <Lock className="w-8 h-8" />
                  </div>
                  <h2 className="text-3xl font-black text-[#0B0B0B] font-display uppercase tracking-tight">
                    ADMIN EMKA RADIO
                  </h2>
                  <p className="text-xs sm:text-sm font-semibold text-[#6B4E3D]">
                    Masukkan PIN admin untuk melanjutkan
                  </p>
                </div>

                {pinError && (
                  <div className="p-3.5 rounded-2xl bg-rose-500/10 border-2 border-rose-500/30 text-rose-700 text-xs font-black flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                    <span>{pinError}</span>
                  </div>
                )}

                {isSuccess && (
                  <div className="p-3.5 rounded-2xl bg-[#B6FF00]/25 border-2 border-[#0B0B0B] text-[#0B0B0B] text-xs font-black flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#0B0B0B] flex-shrink-0" />
                    <span>PIN Benar! Membuka Dashboard Admin...</span>
                  </div>
                )}

                <form onSubmit={handleAdminPinSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <label className="block text-center text-xs font-black text-[#6B4E3D] uppercase font-mono tracking-wider">
                      PIN ADMIN (4 DIGIT)
                    </label>

                    {/* Numeric PIN Input */}
                    <div className="relative">
                      <input
                        ref={pinInputRef}
                        type="password"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={4}
                        placeholder="• • • •"
                        value={pin}
                        onChange={handlePinChange}
                        disabled={isSuccess}
                        className="w-full bg-[#FFF7EC] border-3 border-[#0B0B0B] focus:border-[#FF4F91] rounded-2xl py-4 px-4 text-center text-3xl font-black font-mono tracking-[0.6em] text-[#0B0B0B] placeholder:text-[#6B4E3D]/40 focus:outline-none transition shadow-inner"
                        autoFocus
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSuccess}
                    className="w-full py-4 px-6 rounded-2xl bg-[#0B0B0B] hover:bg-slate-800 disabled:opacity-50 text-[#B6FF00] font-black text-sm font-display uppercase tracking-wider transition flex items-center justify-center space-x-2 border-2 border-black shadow-pop-dark active:scale-98"
                  >
                    <span>MASUK ADMIN</span>
                    <ArrowRight className="w-4 h-4 text-[#B6FF00]" />
                  </button>
                </form>

                <div className="pt-2 text-center">
                  <p className="text-[11px] font-bold text-[#6B4E3D]">
                    Gunakan PIN pengelola studio untuk mengakses kontrol pemutar & antrean.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-6xl mx-auto px-6 py-6 text-center text-xs font-bold text-[#6B4E3D] border-t border-[#6B4E3D]/10">
        <p>© {new Date().getFullYear()} EMKA RADIO — SMK Multi Karya. Suara Karya & Inspirasi Sekolah.</p>
      </footer>
    </div>
  );
};
