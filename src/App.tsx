/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Gift, Heart, Stars, Clock, Calendar, Sparkles, Send, Trash2, MessageCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import { cn } from './lib/utils';

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export default function App() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);
  const [notes, setNotes] = useState<{ id: string; text: string; date: string }[]>([]);
  const [noteInput, setNoteInput] = useState("");

  const targetDate = new Date('2026-07-06T00:00:00');

  useEffect(() => {
    const savedNotes = localStorage.getItem('birthday_notes');
    if (savedNotes) {
      setNotes(JSON.parse(savedNotes));
    }
  }, []);

  const saveNote = () => {
    if (!noteInput.trim()) return;
    const newNote = {
      id: Date.now().toString(),
      text: noteInput.trim(),
      date: new Date().toLocaleDateString('az-AZ', { day: 'numeric', month: 'long' }),
    };
    const updatedNotes = [newNote, ...notes];
    setNotes(updatedNotes);
    localStorage.setItem('birthday_notes', JSON.stringify(updatedNotes));
    setNoteInput("");
  };

  const deleteNote = (id: string) => {
    const updatedNotes = notes.filter(n => n.id !== id);
    setNotes(updatedNotes);
    localStorage.setItem('birthday_notes', JSON.stringify(updatedNotes));
  };

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const difference = targetDate.getTime() - now.getTime();

      if (difference <= 0) {
        setTimeLeft(null);
        clearInterval(timer);
      } else {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleOpenGift = async () => {
    if (isOpen) return;
    
    setIsOpen(true);
    setIsLoading(true);
    
    // Launch initial confetti
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#FFD700', '#FF1493', '#00BFFF', '#32CD32']
    });

    try {
      const response = await fetch('/api/generate-greeting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Balaca' }),
      });
      const data = await response.json();
      setMessage(data.message);
    } catch (error) {
      const fallbacks = [
        "Bu gün təqvimin ən gözəl günüdür, çünki sənin günündür. Ürəyin saflıqla, ömrün nurla dolsun. AD GÜNÜN MÜBARƏK BALACA çocuk",
        "Həyat bir nağıldırsa, sənin nağılın ən xoşbəxt sonluqlarla bitsin. AD GÜNÜN MÜBARƏK BALACA çocuk",
        "Günəşin istisi, baharın rayihəsi və sevginin ən təmiz forması hər zaman səninlə olsun. AD GÜNÜN MÜBARƏK BALACA çocuk"
      ];
      setMessage(fallbacks[Math.floor(Math.random() * fallbacks.length)]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Background Ornaments */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20">
        <div className="absolute top-10 left-10 text-pink-500 animate-pulse"><Stars size={40} /></div>
        <div className="absolute bottom-10 right-10 text-yellow-500 animate-pulse delay-700"><Sparkles size={40} /></div>
        <div className="absolute top-1/2 left-10 text-blue-500 animate-bounce"><Heart size={24} /></div>
        <div className="absolute top-20 right-20 text-purple-500 animate-bounce delay-300"><Gift size={32} /></div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center z-10 max-w-2xl w-full"
      >
        <div className="mb-6 inline-flex items-center px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl">
          <Sparkles size={14} className="text-yellow-500 mr-2" />
          <span className="text-[10px] font-bold tracking-[0.3em] text-gray-300 uppercase">Gözlənilən Gün Gəldi</span>
        </div>

        <h1 className="text-5xl md:text-8xl font-black mb-6 tracking-tighter bg-gradient-to-br from-white via-yellow-200 to-pink-500 bg-clip-text text-transparent drop-shadow-2xl">
          6 İYUL
        </h1>
        
        <p className="text-gray-400 text-lg md:text-2xl mb-12 font-light tracking-wide max-w-lg mx-auto leading-relaxed">
          Zaman sənin ən gözəl hekayəni yazmaq üçün dayanır...
        </p>

        {timeLeft && (
          <div className="grid grid-cols-4 gap-4 mb-16">
            {Object.entries(timeLeft).map(([label, value]) => (
              <div key={label} className="flex flex-col items-center bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                <span className="text-3xl md:text-5xl font-mono font-bold text-yellow-500">{value}</span>
                <span className="text-[10px] md:text-xs uppercase tracking-widest text-gray-500 mt-2">{label === 'days' ? 'Gün' : label === 'hours' ? 'Saat' : label === 'minutes' ? 'Dəqiqə' : 'Saniyə'}</span>
              </div>
            ))}
          </div>
        )}

        <div className="relative h-64 flex items-center justify-center mb-8">
          <AnimatePresence mode="wait">
            {!isOpen ? (
              <motion.div
                key="gift-box"
                whileHover={{ scale: 1.05, rotate: 2 }}
                whileTap={{ scale: 0.95 }}
                className="cursor-pointer group"
                onClick={handleOpenGift}
              >
                <div className="relative">
                  <div className="absolute -inset-4 bg-yellow-500/20 rounded-full blur-3xl group-hover:bg-yellow-500/40 transition-all duration-500" />
                  <motion.div
                    animate={{ y: [0, -10, 0] }}
                    transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                  >
                    <Gift size={120} className="text-yellow-500 relative z-10" />
                  </motion.div>
                </div>
                <p className="mt-8 text-sm font-bold tracking-widest text-yellow-500/80 uppercase animate-pulse">
                  Hədiyyəni Açmaq Üçün Toxun
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="opened-content"
                initial={{ scale: 0.8, opacity: 0, y: 50 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ type: "spring", damping: 20, stiffness: 100 }}
                className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-2xl border border-white/20 p-10 rounded-[2.5rem] text-center shadow-[0_0_50px_rgba(0,0,0,0.5)] relative max-w-sm"
              >
                <div className="absolute -top-14 left-1/2 -translate-x-1/2">
                  <motion.div
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ repeat: Infinity, duration: 4 }}
                    className="bg-gradient-to-tr from-pink-500 to-rose-600 p-5 rounded-3xl shadow-xl shadow-pink-500/20"
                  >
                    <Heart className="text-white" fill="white" size={40} />
                  </motion.div>
                </div>
                
                <h2 className="text-3xl font-black mb-6 mt-6 tracking-tight bg-gradient-to-r from-pink-400 to-rose-500 bg-clip-text text-transparent">
                  Sənin Günün
                </h2>
                
                {isLoading ? (
                  <div className="flex space-x-3 justify-center py-12">
                    <motion.div animate={{ y: [0, -15, 0] }} transition={{ repeat: Infinity, duration: 0.8 }} className="w-3 h-3 bg-pink-500 rounded-full" />
                    <motion.div animate={{ y: [0, -15, 0] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.2 }} className="w-3 h-3 bg-pink-500 rounded-full" />
                    <motion.div animate={{ y: [0, -15, 0] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.4 }} className="w-3 h-3 bg-pink-500 rounded-full" />
                  </div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-4"
                  >
                    <motion.p 
                      className="italic text-xl text-white/90 leading-relaxed font-serif tracking-wide"
                    >
                      "{message}"
                    </motion.p>
                    <div className="pt-4 border-t border-white/10">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-pink-500/60 font-bold">
                        Sonsuz Sevgiylə
                      </p>
                    </div>
                  </motion.div>
                )}
                
                <button 
                  onClick={() => {
                    setIsOpen(false);
                    setMessage("");
                  }}
                  className="mt-10 px-6 py-2 rounded-full bg-white/5 hover:bg-white/10 text-[10px] uppercase tracking-widest text-gray-400 hover:text-white transition-all duration-300 border border-white/5"
                >
                  Yenidən Yaşa
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-center space-x-6 text-gray-500 mb-16">
           <div className="flex items-center space-x-2">
             <Calendar size={16} />
             <span className="text-xs font-mono uppercase tracking-tighter">6 İyul, 2026</span>
           </div>
           <div className="w-1 h-1 bg-gray-700 rounded-full" />
           <div className="flex items-center space-x-2">
             <Clock size={16} />
             <span className="text-xs font-mono uppercase tracking-tighter">00:00 - Bayram Başlayır</span>
           </div>
        </div>

        {/* Notes Section */}
        <div className="max-w-md mx-auto w-full space-y-8 pb-20">
          <div className="text-left space-y-4">
            <div className="flex items-center space-x-2 text-pink-500">
              <MessageCircle size={20} />
              <h3 className="text-sm font-bold uppercase tracking-[0.2em]">Özəl Qeydlər</h3>
            </div>
            
            <div className="relative group">
              <textarea
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                placeholder="Özəl bir arzu yaz..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:outline-none focus:border-pink-500/50 transition-all resize-none placeholder:text-gray-600 h-28"
              />
              <button
                onClick={saveNote}
                disabled={!noteInput.trim()}
                className="absolute bottom-3 right-3 p-2 bg-pink-500 rounded-xl text-white disabled:opacity-30 disabled:grayscale hover:scale-110 active:scale-95 transition-all shadow-lg shadow-pink-500/20"
              >
                <Send size={16} />
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <AnimatePresence initial={false}>
              {notes.length > 0 ? (
                <div className="max-h-60 overflow-y-auto pr-2 custom-scrollbar space-y-3">
                  {notes.map((note) => (
                    <motion.div
                      key={note.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="bg-white/[0.03] border border-white/5 p-4 rounded-2xl group flex justify-between items-start hover:bg-white/[0.05] transition-colors"
                    >
                      <div className="flex-1 mr-4">
                        <p className="text-sm text-gray-300 leading-relaxed text-left">
                          {note.text}
                        </p>
                        <span className="text-[10px] text-gray-600 mt-2 block font-mono">
                          {note.date}
                        </span>
                      </div>
                      <button
                        onClick={() => deleteNote(note.id)}
                        className="text-gray-700 hover:text-red-500 transition-colors p-1"
                      >
                        <Trash2 size={14} />
                      </button>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="py-12 border-2 border-dashed border-white/5 rounded-3xl text-center">
                  <p className="text-xs text-gray-600 uppercase tracking-widest font-medium">Hələ heç bir qeyd yoxdur</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* Footer Branding */}
      <div className="absolute bottom-8 text-[10px] text-gray-600 uppercase tracking-[0.2em] font-light">
        Özəl Tədbir • Unudulmaz Anlar
      </div>
    </div>
  );
}
