import React, { useState } from 'react';
import { X, FileSpreadsheet, ExternalLink, Check, Plus, AlertCircle, Link, RefreshCw, Download } from 'lucide-react';
import { SheetConfig, SongRequest } from '../types';
import { exportRequestsToCsv } from '../services/api';

interface GoogleSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  sheetConfig: SheetConfig;
  onConnectSheet: (payload: { spreadsheetId?: string; spreadsheetUrl?: string }) => Promise<void>;
  onRefresh: () => void;
  requests?: SongRequest[];
}

export const GoogleSheetModal: React.FC<GoogleSheetModalProps> = ({
  isOpen,
  onClose,
  sheetConfig,
  onConnectSheet,
  onRefresh,
  requests = []
}) => {
  const [inputUrl, setInputUrl] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setIsConnecting(true);

    try {
      await onConnectSheet({ spreadsheetUrl: inputUrl });
      setSuccessMsg('Berhasil menghubungkan Google Sheet!');
      setInputUrl('');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menghubungkan Google Sheet');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleCreateNew = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    setIsConnecting(true);

    try {
      await onConnectSheet({});
      setSuccessMsg('Google Sheet baru berhasil dibuat dan terhubung!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal membuat Google Sheet baru');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl rounded-[28px] bg-white border-2 border-[#0B0B0B] p-6 sm:p-8 shadow-pop space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl bg-[#F5F5F0] hover:bg-slate-200 text-[#0B0B0B] transition border border-[#E2E2DC]"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-2xl bg-[#B8FF00] text-[#0B0B0B] border-2 border-[#0B0B0B] flex items-center justify-center shadow-sm">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-black text-[#0B0B0B] font-display">Google Sheet Monitoring Station</h3>
            <p className="text-xs font-semibold text-slate-500">Hubungkan atau buat Google Sheet untuk pantau request lagu secara otomatis</p>
          </div>
        </div>

        {errorMsg && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center gap-2">
            <Check className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Current Connection Status */}
        <div className="bg-[#F5F5F0] rounded-2xl p-4 border border-[#E2E2DC] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-[#0B0B0B] uppercase tracking-wider">Status Google Sheet saat ini:</span>
            <span className={`text-xs font-black px-3 py-1 rounded-full border flex items-center space-x-1.5 ${
              sheetConfig.connected
                ? 'bg-[#B8FF00] text-[#0B0B0B] border-[#0B0B0B]/20'
                : 'bg-[#FFF000] text-[#0B0B0B] border-[#0B0B0B]/20'
            }`}>
              <span className={`w-2 h-2 rounded-full ${sheetConfig.connected ? 'bg-emerald-600 animate-pulse' : 'bg-amber-600'}`}></span>
              <span>{sheetConfig.connected ? 'Terhubung (Active Sync)' : 'Belum Terhubung'}</span>
            </span>
          </div>

          {sheetConfig.spreadsheetUrl && (
            <div className="p-3.5 rounded-xl bg-white border border-[#E2E2DC] flex items-center justify-between">
              <div className="truncate mr-3">
                <p className="text-xs font-black text-[#0B0B0B] truncate">{sheetConfig.title || 'Google Sheet Radio Request'}</p>
                <p className="text-[11px] text-slate-500 font-semibold truncate">{sheetConfig.spreadsheetUrl}</p>
              </div>

              <a
                href={sheetConfig.spreadsheetUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition flex items-center space-x-1 flex-shrink-0 shadow-sm"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Buka Sheet ↗</span>
              </a>
            </div>
          )}
        </div>

        {/* Action 1: Create New Sheet via Google Workspace API */}
        <div className="p-5 rounded-2xl bg-[#F5F5F0] border-2 border-[#0B0B0B] space-y-3 shadow-soft">
          <div className="flex items-center space-x-2">
            <Plus className="w-5 h-5 text-[#FF4F8B]" />
            <h4 className="text-sm font-black text-[#0B0B0B] font-display">Buat Google Sheet Baru Otomatis</h4>
          </div>
          <p className="text-xs text-slate-600 font-semibold">
            Sistem akan otomatis membuat Google Spreadsheet khusus bertajuk <strong>"🎵 Request Lagu & Confession EMKA Radio"</strong> lengkap dengan header kolom standar.
          </p>
          <button
            onClick={handleCreateNew}
            disabled={isConnecting}
            className="w-full py-3.5 rounded-xl bg-[#0B0B0B] hover:bg-slate-800 text-[#B8FF00] font-black text-xs transition flex items-center justify-center space-x-2 shadow-pop-dark disabled:opacity-50"
          >
            {isConnecting ? (
              <RefreshCw className="w-4 h-4 animate-spin text-[#B8FF00]" />
            ) : (
              <FileSpreadsheet className="w-4 h-4 text-[#B8FF00]" />
            )}
            <span>{isConnecting ? 'Membuat Google Sheet...' : 'Buat Google Sheet Baru Sekarang ✨'}</span>
          </button>
        </div>

        {/* Action 2: Connect Existing Google Sheet URL */}
        <form onSubmit={handleConnect} className="p-5 rounded-2xl bg-[#F5F5F0] border border-[#E2E2DC] space-y-3">
          <div className="flex items-center space-x-2">
            <Link className="w-4 h-4 text-[#FF4F8B]" />
            <h4 className="text-sm font-black text-[#0B0B0B] font-display">Atau Sambungkan Link Google Sheet yang Ada</h4>
          </div>
          <p className="text-xs text-slate-600 font-semibold">
            Tempelkan link Google Spreadsheet yang sudah ada (pastikan spreadsheet sudah diberi akses edit/publik):
          </p>
          <input
            type="url"
            placeholder="https://docs.google.com/spreadsheets/d/1ABCXYZ.../edit"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            className="w-full bg-white border border-[#E2E2DC] focus:border-[#0B0B0B] rounded-xl px-4 py-3 text-xs font-bold text-[#0B0B0B] placeholder-slate-400 focus:outline-none"
          />
          <button
            type="submit"
            disabled={isConnecting || !inputUrl.trim()}
            className="w-full py-3 rounded-xl bg-[#FF4F8B] hover:bg-pink-600 text-white font-black text-xs transition disabled:opacity-50 shadow-sm"
          >
            Hubungkan Link Google Sheet
          </button>
        </form>

        {/* Action 3: Download CSV / Excel Backup */}
        <div className="p-5 rounded-2xl bg-[#F5F5F0] border border-[#E2E2DC] flex items-center justify-between gap-4">
          <div>
            <h4 className="text-sm font-black text-[#0B0B0B] flex items-center gap-1.5 font-display">
              <Download className="w-4 h-4 text-[#35B9FF]" />
              <span>Unduh Spreadsheet (.CSV / Excel)</span>
            </h4>
            <p className="text-xs text-slate-600 font-semibold">
              Download seluruh data request lagu & confession langsung ke file CSV/Excel.
            </p>
          </div>
          <button
            onClick={() => exportRequestsToCsv(requests)}
            className="px-4 py-2.5 rounded-xl bg-[#35B9FF] hover:bg-sky-500 text-[#0B0B0B] font-black text-xs transition flex items-center space-x-1.5 flex-shrink-0 shadow-sm border border-[#0B0B0B]/20 cursor-pointer active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>Download CSV</span>
          </button>
        </div>

        {/* Structure Preview Table */}
        <div className="border-t border-[#E2E2DC] pt-4 text-xs text-slate-500 space-y-2">
          <p className="font-black text-[#0B0B0B]">Format Kolom Google Sheet Otomatis:</p>
          <div className="p-3 bg-[#F5F5F0] border border-[#E2E2DC] rounded-xl font-mono text-[11px] font-bold text-[#0B0B0B] overflow-x-auto">
            ID | Waktu Request | Nama Siswa | Kelas | Judul Lagu | Penyanyi | Target Confess | Pesan Confession | Mood Tag | Cover Art URL | Audio Preview URL | Status | Likes
          </div>
        </div>
      </div>
    </div>
  );
};
