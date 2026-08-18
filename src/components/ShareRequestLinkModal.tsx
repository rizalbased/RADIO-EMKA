import React, { useState } from 'react';
import { X, Copy, Check, QrCode, Share2, Send, ExternalLink, Sparkles } from 'lucide-react';

interface ShareRequestLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShareRequestLinkModal: React.FC<ShareRequestLinkModalProps> = ({
  isOpen,
  onClose
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedWaText, setCopiedWaText] = useState(false);

  if (!isOpen) return null;

  // Generate user request portal share link
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const userShareUrl = `${currentOrigin}?mode=user`;

  const waBroadcastText = `📻 *REQUEST LAGU & CONFESSION - EMKA RADIO app by rizal* 🎶

Mau request lagu favoritmu atau titip salam/confess rahasia ke gebetan?
Yuk kirim request lagu kamu sekarang lewat link resmi di bawah ini:
👉 ${userShareUrl}

Lagu & pesan kamu bakal masuk antrean & diputar di EMKA RADIO! 🔥✨`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(userShareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopyWaText = () => {
    navigator.clipboard.writeText(waBroadcastText);
    setCopiedWaText(true);
    setTimeout(() => setCopiedWaText(false), 2500);
  };

  const handleShareWa = () => {
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(waBroadcastText)}`;
    window.open(waUrl, '_blank');
  };

  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(userShareUrl)}&color=000000&bgcolor=ffffff`;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white border-2 border-[#0B0B0B] rounded-[28px] max-w-lg w-full p-6 sm:p-8 shadow-pop relative space-y-6">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl bg-[#F5F5F0] hover:bg-slate-200 text-[#0B0B0B] transition border border-[#E2E2DC]"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-2xl bg-[#FF4F8B] text-white border-2 border-[#0B0B0B] flex items-center justify-center shadow-sm">
            <Share2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-black text-[#0B0B0B] flex items-center gap-1.5 font-display">
              <span>Bagikan Link Request Lagu</span>
              <Sparkles className="w-4 h-4 text-[#FF4F8B] animate-pulse" />
            </h3>
            <p className="text-xs font-semibold text-slate-500">
              Sebarkan link ini ke siswa/teman sekolah untuk kirim lagu & confession.
            </p>
          </div>
        </div>

        {/* Direct Link Copy Box */}
        <div className="space-y-2">
          <label className="block text-xs font-black text-[#0B0B0B]">
            🔗 Link Khusus Request User (Publik - Semua Perangkat & Email):
          </label>
          <div className="flex items-center space-x-2 bg-[#F5F5F0] border border-[#E2E2DC] rounded-2xl p-2">
            <input
              type="text"
              readOnly
              value={userShareUrl}
              className="bg-transparent flex-1 px-3 py-1.5 text-xs text-[#0B0B0B] font-mono font-bold focus:outline-none truncate"
            />
            <button
              onClick={handleCopyLink}
              className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center space-x-1.5 ${
                copiedLink
                  ? 'bg-emerald-600 text-white'
                  : 'bg-[#0B0B0B] text-[#B8FF00] hover:bg-slate-800'
              }`}
            >
              {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedLink ? 'Tersalin!' : 'Salin Link'}</span>
            </button>
          </div>
          <p className="text-[11px] text-[#0B0B0B] font-semibold bg-[#FFF000]/30 border border-[#0B0B0B]/20 p-2.5 rounded-xl">
            💡 <strong>Akses Publik Bebas Login:</strong> Link ini dapat langsung dibuka oleh seluruh siswa dari HP, laptop, atau tablet tanpa perlu login akun Google.
          </p>
        </div>

        {/* QR Code Section */}
        <div className="bg-[#F5F5F0] border border-[#E2E2DC] rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-4">
          <div className="bg-white p-2.5 rounded-xl shadow-md border-2 border-[#0B0B0B] flex-shrink-0">
            <img
              src={qrApiUrl}
              alt="QR Code Request Lagu"
              className="w-28 h-28 object-contain"
            />
          </div>
          <div className="text-center sm:text-left space-y-1.5">
            <h4 className="text-xs font-black text-[#0B0B0B] flex items-center justify-center sm:justify-start gap-1 font-display">
              <QrCode className="w-4 h-4 text-[#FF4F8B]" />
              <span>Scan QR Code untuk Request</span>
            </h4>
            <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
              Tampilkan QR Code ini di mading sekolah, flyer, atau layar proyektor agar siswa tinggal scan dengan kamera HP.
            </p>
            <a
              href={userShareUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center text-xs font-black text-[#FF4F8B] hover:underline gap-1 pt-1"
            >
              <span>Uji Coba Tampilan User</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* WhatsApp Broadcast Template Box */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-black text-[#0B0B0B] flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5 text-emerald-600" />
              <span>Template Pesan Broadcast WhatsApp:</span>
            </label>
            <button
              onClick={handleCopyWaText}
              className="text-[11px] font-black text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
            >
              {copiedWaText ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-600" />}
              <span>{copiedWaText ? 'Pesan Tersalin!' : 'Salin Teks WA'}</span>
            </button>
          </div>

          <div className="bg-[#F5F5F0] border border-[#E2E2DC] rounded-2xl p-3.5 text-[11px] font-mono text-[#0B0B0B] font-bold whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">
            {waBroadcastText}
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={handleShareWa}
            className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition flex items-center justify-center space-x-2 shadow-sm"
          >
            <Send className="w-4 h-4" />
            <span>Kirim via WhatsApp Group</span>
          </button>

          <button
            onClick={onClose}
            className="px-6 py-3 rounded-xl bg-[#F5F5F0] hover:bg-slate-200 text-[#0B0B0B] border border-[#E2E2DC] font-black text-xs transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
