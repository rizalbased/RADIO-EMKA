import React, { useState } from 'react';
import { Sparkles, Heart, RefreshCw, Copy, Check } from 'lucide-react';
import { analyzeVibeWithAi } from '../services/api';
import { AiVibeAnalysis } from '../types';

export const AiWingmanModal: React.FC = () => {
  const [songTitle, setSongTitle] = useState('Penjaga Hati');
  const [artist, setArtist] = useState('Nadhif Basalamah');
  const [targetPerson, setTargetPerson] = useState('Eza XI IPS 1 💘');
  const [message, setMessage] = useState('Makasih udah nemenin pas piket kelas kemarin, lagu ini spesial buat kamu!');
  
  const [result, setResult] = useState<AiVibeAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedCaption, setCopiedCaption] = useState(false);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!songTitle || !artist) return;
    setIsLoading(true);
    try {
      const res = await analyzeVibeWithAi({ songTitle, artist, targetPerson, message });
      setResult(res);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const copyCaption = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.storyCaption);
    setCopiedCaption(true);
    setTimeout(() => setCopiedCaption(false), 2000);
  };

  return (
    <div className="bg-card border-2 border-primary rounded-[28px] p-6 sm:p-8 shadow-soft space-y-6 transition-colors">
      <div className="flex items-center space-x-3 pb-4 border-b border-subtle">
        <div className="w-12 h-12 rounded-2xl bg-neon text-black border-2 border-black flex items-center justify-center shadow-pop">
          <Sparkles className="w-6 h-6 animate-pulse" />
        </div>
        <div>
          <h2 className="text-xl font-black text-primary font-display uppercase">Gemini AI Wingman & Vibe Check</h2>
          <p className="text-xs font-semibold text-secondary">Analisis tingkat ke-baperan, rating romance, dan buat caption estetik secara instan</p>
        </div>
      </div>

      <form onSubmit={handleAnalyze} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-black text-primary mb-1.5 uppercase tracking-wider">Judul Lagu</label>
          <input
            type="text"
            value={songTitle}
            onChange={(e) => setSongTitle(e.target.value)}
            className="w-full bg-elevated border border-subtle focus:border-primary rounded-2xl px-3.5 py-2.5 text-xs font-bold text-primary placeholder:text-secondary/50 focus:outline-none transition"
            placeholder="Judul Lagu"
          />
        </div>

        <div>
          <label className="block text-xs font-black text-primary mb-1.5 uppercase tracking-wider">Penyanyi / Artist</label>
          <input
            type="text"
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            className="w-full bg-elevated border border-subtle focus:border-primary rounded-2xl px-3.5 py-2.5 text-xs font-bold text-primary placeholder:text-secondary/50 focus:outline-none transition"
            placeholder="Penyanyi"
          />
        </div>

        <div>
          <label className="block text-xs font-black text-primary mb-1.5 uppercase tracking-wider">Target Confess (Doi)</label>
          <input
            type="text"
            value={targetPerson}
            onChange={(e) => setTargetPerson(e.target.value)}
            className="w-full bg-elevated border border-subtle focus:border-primary rounded-2xl px-3.5 py-2.5 text-xs font-bold text-primary placeholder:text-secondary/50 focus:outline-none transition"
            placeholder="Confess ke siapa?"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-black text-primary mb-1.5 uppercase tracking-wider">Pesan Confession</label>
          <textarea
            rows={2}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full bg-elevated border border-subtle focus:border-primary rounded-2xl px-3.5 py-2.5 text-xs font-bold text-primary placeholder:text-secondary/50 resize-none focus:outline-none transition"
            placeholder="Pesan baper / lucu / sahabat..."
          />
        </div>

        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 rounded-2xl bg-[#0B0B0B] dark:bg-neon hover:bg-slate-800 dark:hover:bg-[#a6eb00] text-neon dark:text-black font-black text-xs transition shadow-pop-dark hover:opacity-95 disabled:opacity-50 flex items-center justify-center space-x-2 border-2 border-black"
          >
            {isLoading ? <RefreshCw className="w-4 h-4 animate-spin text-neon dark:text-black" /> : <Sparkles className="w-4 h-4 text-neon dark:text-black" />}
            <span>{isLoading ? 'Menganalisis Vibe Gemini...' : 'Jalankan Vibe Check AI Wingman ⚡'}</span>
          </button>
        </div>
      </form>

      {/* Results Section */}
      {result && (
        <div className="p-6 rounded-[24px] bg-elevated border-2 border-primary shadow-soft space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-subtle pb-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-pink">ANALISIS GEMINI AI</span>
              <h3 className="text-xl font-black text-primary font-display uppercase">{result.vibeCategory}</h3>
            </div>

            <div className="flex items-center space-x-2 bg-card border-2 border-primary px-4 py-2 rounded-2xl shadow-sm">
              <Heart className="w-5 h-5 text-pink fill-pink" />
              <div>
                <p className="text-[10px] text-secondary font-extrabold uppercase">Romance Score</p>
                <p className="text-lg font-black text-primary font-display">{result.romanceScore}%</p>
              </div>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3.5 rounded-2xl bg-card border border-subtle">
              <span className="font-black text-primary block mb-1">💡 Tips DJ AI Radio:</span>
              <p className="text-secondary font-medium">{result.recommendation}</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-card border-2 border-pink relative">
              <div className="flex items-center justify-between mb-1">
                <span className="font-black text-pink">✨ Aesthetic Story Caption (Copy & Paste):</span>
                <button
                  onClick={copyCaption}
                  className="flex items-center space-x-1 text-[11px] bg-black text-white hover:bg-slate-800 px-3 py-1 rounded-xl transition font-bold"
                >
                  {copiedCaption ? <Check className="w-3 h-3 text-neon" /> : <Copy className="w-3 h-3 text-white" />}
                  <span>{copiedCaption ? 'Tersalin' : 'Copy'}</span>
                </button>
              </div>
              <p className="text-primary italic font-semibold">"{result.storyCaption}"</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
