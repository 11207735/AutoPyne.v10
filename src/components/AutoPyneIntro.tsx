import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Laptop, ChevronRight, UserPlus, Zap, ArrowLeft } from 'lucide-react';

export interface ManagerData {
  id: string;
  name: string;
  lastname: string;
  schoolLevel: string;
  skill: string;
  createdAt?: string;
  startDate?: string;
  startedFrom?: string;
  email?: string;
  phone?: string;
  location?: string;
  employeeId?: string;
  shift?: string;
  status?: string;
  paymentPin?: string;
}

interface AutoPyneIntroProps {
  onStartWork: () => void;
  currentManager: ManagerData | null;
  onOpenAddManager: () => void;
}

export const AutoPyneLogo: React.FC<{ className?: string; animate?: boolean }> = ({ 
  className = "w-36 h-36", 
  animate = true 
}) => {
  return (
    <div className={`relative flex flex-col items-center justify-center ${className}`}>
      <svg 
        viewBox="0 0 400 370" 
        className="w-full h-full drop-shadow-[0_0_35px_rgba(0,230,168,0.35)]" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="200" cy="180" r="140" fill="url(#logoGlow)" opacity="0.3" />

        <defs>
          <radialGradient id="logoGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#00e6a8" stopOpacity="0.8" />
            <stop offset="60%" stopColor="#008b68" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#030c10" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="legGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#00e6a8" />
          </linearGradient>
        </defs>

        {/* Left diagonal leg of 'A' */}
        <motion.path
          d="M 68 250 L 210 25"
          stroke="url(#legGradient)"
          strokeWidth="18"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={animate ? { pathLength: 0, opacity: 0 } : { pathLength: 1, opacity: 1 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        />

        {/* Right diagonal leg of 'A' */}
        <motion.path
          d="M 210 25 L 285 272"
          stroke="url(#legGradient)"
          strokeWidth="18"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={animate ? { pathLength: 0, opacity: 0 } : { pathLength: 1, opacity: 1 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.15, ease: "easeOut" }}
        />

        {/* Middle sharp crease crossbar extending far out to the right */}
        <motion.path
          d="M 128 195 L 144 212 L 365 105"
          stroke="#00e6a8"
          strokeWidth="16"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={animate ? { pathLength: 0, opacity: 0 } : { pathLength: 1, opacity: 1 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
        />

        {/* AutoPyne Text */}
        <motion.text
          x="200"
          y="348"
          textAnchor="middle"
          fill="#FFFFFF"
          fontSize="56"
          fontWeight="800"
          fontFamily="system-ui, -apple-system, sans-serif"
          letterSpacing="2"
          initial={animate ? { opacity: 0, y: 10 } : { opacity: 1, y: 0 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          AutoPyne
        </motion.text>
      </svg>
    </div>
  );
};

export const AutoPyneIcon: React.FC<{ className?: string }> = ({ className = "w-6 h-6" }) => {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <svg 
        viewBox="0 0 400 370" 
        className="w-full h-full drop-shadow-[0_0_12px_rgba(0,230,168,0.5)]" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        <path 
          d="M 68 250 L 210 25" 
          stroke="#FFFFFF" 
          strokeWidth="28" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
        />
        <path 
          d="M 210 25 L 285 272" 
          stroke="#00e6a8" 
          strokeWidth="28" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
        />
        <path 
          d="M 128 195 L 144 212 L 365 105" 
          stroke="#00e6a8" 
          strokeWidth="24" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
        />
      </svg>
    </div>
  );
};

export const AutoPyneHeaderBrand: React.FC<{ onClick?: () => void; className?: string }> = ({ onClick, className = "" }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex items-center gap-3 text-left p-1 rounded-xl hover:bg-[#0d2028]/80 transition-all cursor-pointer select-none ${className}`}
      title="AutoPyne System - Click to view Opening Intro Page"
    >
      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-[#07242c] via-[#04141a] to-[#020b0e] border border-[#00c896]/60 group-hover:border-[#00e6a8] flex items-center justify-center p-1.5 shadow-[0_0_20px_rgba(0,200,150,0.3)] group-hover:shadow-[0_0_28px_rgba(0,230,168,0.6)] group-hover:scale-105 transition-all shrink-0">
        <AutoPyneIcon className="w-6 h-6 sm:w-7 sm:h-7" />
      </div>
      <div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs sm:text-sm font-black text-white tracking-wide group-hover:text-[#00e6a8] transition-colors">
            AutoPyne
          </span>
          <span className="text-[9px] bg-[#00c896]/20 text-[#00e6a8] border border-[#00c896]/40 px-1.5 py-0.2 rounded font-mono font-black uppercase tracking-wider">
            SYSTEM
          </span>
        </div>
        <p className="text-[9px] sm:text-[10px] text-teal-400/85 font-mono tracking-wider uppercase font-semibold">
          AGM AGAFAY OPERATIONS
        </p>
      </div>
    </button>
  );
};

export const AgmWorkspaceLogo: React.FC<{ className?: string }> = ({ className = "" }) => {
  return (
    <div className={`flex flex-col items-center justify-center select-none ${className}`}>
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Triangle AutoPyne Icon Mark */}
        <div className="w-10 h-10 sm:w-14 sm:h-14 relative shrink-0">
          <svg viewBox="0 0 400 370" className="w-full h-full drop-shadow-[0_0_20px_rgba(0,230,168,0.5)]" fill="none">
            <path d="M 68 250 L 210 25" stroke="#FFFFFF" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M 210 25 L 285 272" stroke="#00e6a8" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M 128 195 L 144 212 L 365 105" stroke="#00e6a8" strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" />
            <text x="200" y="348" textAnchor="middle" fill="#FFFFFF" fontSize="62" fontWeight="800" fontFamily="sans-serif">AutoPyne</text>
          </svg>
        </div>

        {/* AgmWorkSpace. Typography Logo matching company banner */}
        <div className="text-2xl sm:text-4xl md:text-5xl font-sans tracking-tight flex items-baseline">
          <span className="font-light text-zinc-200">Agm</span>
          <span className="font-extrabold text-white">WorkSpace</span>
          <span className="font-extrabold text-[#00e6a8] drop-shadow-[0_0_12px_#00e6a8]">.</span>
        </div>
      </div>

      {/* Decorative separator line & Amzil Groups Morocco subtitle */}
      <div className="w-full max-w-md sm:max-w-lg mt-2 flex items-center justify-between gap-3 px-1">
        <div className="h-[1.5px] flex-1 bg-gradient-to-r from-transparent via-[#00c896]/60 to-transparent"></div>
        <span className="text-[11px] sm:text-xs font-mono tracking-widest text-[#00e6a8] font-bold uppercase whitespace-nowrap drop-shadow-[0_0_8px_rgba(0,230,168,0.4)]">
          Amzil Groups Morocco &bull; Agafay Workstation
        </span>
        <div className="h-[1.5px] flex-1 bg-gradient-to-r from-transparent via-[#00c896]/60 to-transparent"></div>
      </div>
    </div>
  );
};

export const AutoPyneIntro: React.FC<AutoPyneIntroProps> = ({ 
  onStartWork, 
  currentManager,
  onOpenAddManager
}) => {
  // Global listener for Enter / Space key press to open the main system page
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onStartWork();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onStartWork]);

  return (
    <div 
      onClick={onStartWork}
      className="fixed inset-0 z-50 w-screen min-h-screen bg-[#03090d] text-white flex flex-col justify-between p-4 sm:p-8 overflow-hidden font-sans select-none cursor-pointer"
    >
      {/* Dynamic Background Ambient Lighting */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-gradient-to-tr from-[#00c896]/20 via-[#00e6a8]/10 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#00e6a8_1px,transparent_1px)] [background-size:32px_32px] opacity-[0.04] pointer-events-none" />

      {/* Top Header Information Tag */}
      <div className="w-full max-w-5xl mx-auto flex items-center justify-between text-xs font-mono border-b border-[#142e38] pb-3 z-10 shrink-0">
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-[#00e6a8] shadow-[0_0_12px_#00e6a8] animate-pulse" />
          <span className="text-zinc-200 font-bold uppercase tracking-wider text-xs sm:text-sm">
            AGM Agafay Workstation
          </span>
          <span className="bg-[#00c896]/20 text-[#00e6a8] border border-[#00c896]/40 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase">
            System Online
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="bg-[#091a21] text-teal-300 border border-[#173a46] px-3 py-1 rounded-full text-[11px] font-mono flex items-center gap-1.5 shadow-inner">
            <Zap className="w-3.5 h-3.5 text-[#00e6a8]" />
            <span>AutoPyne Core Engine</span>
          </span>
        </div>
      </div>

      {/* Center Stage: AutoPyne Logo in the Middle with Click & Press Enter Callouts */}
      <div className="my-auto flex flex-col items-center justify-center text-center max-w-2xl mx-auto z-10 w-full px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.88, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center justify-center w-full"
        >
          {/* Main AutoPyne Animated Logo */}
          <div className="relative group">
            <div className="absolute -inset-4 bg-gradient-to-r from-[#00e6a8]/20 to-[#00c896]/20 rounded-full blur-2xl opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-pulse" />
            <AutoPyneLogo className="w-56 h-56 sm:w-72 sm:h-72 md:w-80 md:h-80 drop-shadow-[0_0_45px_rgba(0,230,168,0.45)]" animate={true} />
          </div>

          {/* Subtitle / Department Branding */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.6 }}
            className="mt-4 flex flex-col items-center"
          >
            <div className="flex items-center gap-2 text-xs sm:text-sm font-mono tracking-widest text-[#00e6a8] font-bold uppercase drop-shadow-[0_0_10px_rgba(0,230,168,0.4)]">
              <span>Amzil Groups Morocco</span>
              <span className="text-zinc-600">&bull;</span>
              <span>Agafay Operations</span>
            </div>
          </motion.div>

          {/* Primary Action: Click or Press Enter Button */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="mt-8 w-full max-w-md space-y-4"
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onStartWork();
              }}
              className="w-full group bg-gradient-to-r from-[#00c896] to-[#00e6a8] hover:from-[#00e6a8] hover:to-[#00ffd0] text-[#03090d] font-black text-base sm:text-lg py-4 px-6 rounded-2xl shadow-[0_0_35px_rgba(0,200,150,0.4)] hover:shadow-[0_0_55px_rgba(0,230,168,0.7)] transition-all transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex items-center justify-between border border-[#00ffd0]/60"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#03090d] text-[#00e6a8] flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                  <Play className="w-5 h-5 fill-current ml-0.5" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="tracking-wider uppercase font-mono font-black text-sm sm:text-base leading-tight">
                    Enter System
                  </span>
                  <span className="text-[10px] font-mono font-bold text-teal-950/80 uppercase tracking-widest">
                    Open Main Operations Panel
                  </span>
                </div>
              </div>

              {/* Enter Keyboard Key Badge */}
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline-flex items-center gap-1 bg-[#03090d]/80 text-[#00e6a8] border border-[#00e6a8]/50 px-2.5 py-1 rounded-lg text-xs font-mono font-bold shadow-sm">
                  Press ↵ Enter
                </span>
                <ChevronRight className="w-5 h-5 text-[#03090d] group-hover:translate-x-1 transition-transform" />
              </div>
            </button>

            {/* Click Anywhere Hint */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ delay: 0.8, duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              className="flex items-center justify-center gap-2 text-xs font-mono text-zinc-400 tracking-wider uppercase"
            >
              <span>Click anywhere on screen or press</span>
              <kbd className="bg-[#091a21] text-[#00e6a8] border border-[#173a46] px-2 py-0.5 rounded text-[11px] font-mono font-bold shadow-inner">
                Enter ↵
              </kbd>
            </motion.div>

            {/* Manager Session Status / Switch Profile Chip */}
            <div 
              onClick={(e) => e.stopPropagation()}
              className="pt-2"
            >
              {currentManager ? (
                <div className="bg-[#091b22]/90 border border-[#183c48] p-3 rounded-xl flex items-center justify-between gap-3 font-mono">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-[#00c896]/20 text-[#00e6a8] border border-[#00c896]/50 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                      {currentManager.name.charAt(0)}{currentManager.lastname ? currentManager.lastname.charAt(0) : ''}
                    </div>
                    <div className="text-left truncate">
                      <p className="text-xs font-bold text-white truncate">
                        Manager: <span className="text-[#00e6a8]">{currentManager.name} {currentManager.lastname}</span>
                      </p>
                      <span className="text-[10px] text-teal-400/70 block truncate">
                        {currentManager.skill || 'Administrator'} &bull; Ready
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={onOpenAddManager}
                    className="shrink-0 text-[11px] bg-[#14313b] hover:bg-[#1d4452] text-teal-200 px-3 py-1.5 rounded-lg border border-[#235666] transition-all cursor-pointer font-bold flex items-center gap-1.5 hover:text-white"
                  >
                    <UserPlus className="w-3 h-3 text-[#00e6a8]" />
                    <span>Switch</span>
                  </button>
                </div>
              ) : (
                <div className="bg-[#091b22]/90 border border-[#183c48] p-3 rounded-xl flex items-center justify-between gap-3 font-mono text-xs">
                  <div className="text-left text-zinc-300">
                    <span className="font-bold text-white block">Manager Session</span>
                    <span className="text-[10px] text-teal-400/70">Full Access Active</span>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenAddManager}
                    className="shrink-0 text-[11px] bg-[#14313b] hover:bg-[#1d4452] text-teal-200 px-3 py-1.5 rounded-lg border border-[#235666] transition-all cursor-pointer font-bold flex items-center gap-1.5 hover:text-white"
                  >
                    <UserPlus className="w-3 h-3 text-[#00e6a8]" />
                    <span>Set Manager</span>
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Bottom Footer Credits */}
      <div className="w-full max-w-5xl mx-auto flex items-center justify-between text-[11px] font-mono text-zinc-400 border-t border-[#132c35] pt-3 z-10 shrink-0">
        <div className="flex items-center gap-2 text-zinc-300">
          <Laptop className="w-3.5 h-3.5 text-[#00e6a8]" />
          <span>AutoPyne Systems &copy; 2026</span>
        </div>
        <div className="flex items-center gap-3 text-zinc-400">
          <span className="text-teal-400 font-bold">Marrakech - Agafay Desert</span>
          <span>&bull;</span>
          <span className="text-zinc-300">Amzil Groups Morocco</span>
        </div>
      </div>

    </div>
  );
};
