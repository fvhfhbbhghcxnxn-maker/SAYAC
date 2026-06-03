/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Gift, Heart, Stars, Clock, Calendar, Sparkles, Send, Trash2, MessageCircle, LogIn, LogOut, User as UserIcon, Settings, Shield, ShieldCheck, X, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import confetti from 'canvas-confetti';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, deleteDoc, doc, getDocFromServer, writeBatch, getDocs, setDoc } from 'firebase/firestore';
import { onAuthStateChanged, signInWithPopup, signInWithRedirect, GoogleAuthProvider, signOut, User, getRedirectResult } from 'firebase/auth';
import { db, auth } from './lib/firebase';
import { cn } from './lib/utils';

// Error Handling helper
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return JSON.stringify(errInfo);
}

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
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [notes, setNotes] = useState<{ id: string; text: string; date: string; authorId: string; authorName: string }[]>([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [noteInput, setNoteInput] = useState("");
  const [chances, setChances] = useState(3);
  const [isSaving, setIsSaving] = useState(false);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  const [isAdmin, setIsAdmin] = useState(false);
  const [adminList, setAdminList] = useState<string[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminMode, setAdminMode] = useState(true);

  const isHardcodedOwner = user?.email === 'fvhfhbbhghcxnxn@gmail.com';

  useEffect(() => {
    const isUserAdmin = isHardcodedOwner || adminList.includes(user?.email || '');
    setIsAdmin(isUserAdmin);
    if (!isUserAdmin) {
      setAdminMode(false);
    }
  }, [user, isHardcodedOwner, adminList]);

  const targetDate = new Date('2026-07-06T00:00:00');

  useEffect(() => {
    // Auth listener
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setAuthLoading(false);
      
      if (user) {
        // Load chances for this user from localStorage as a fallback
        const savedChances = localStorage.getItem(`note_chances_${user.uid}`);
        if (savedChances !== null) {
          setChances(parseInt(savedChances));
        }
      }
    });

    // Test connection on boot
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        console.warn("Connection test warning (might be normal if doc doesn't exist):", error);
      }
    };
    testConnection();

    // Real-time notes listener
    const notesPath = 'notes';
    const q = collection(db, notesPath);
    const unsubscribeNotes = onSnapshot(q, (snapshot) => {
      const notesData = snapshot.docs.map(doc => {
        const data = doc.data();
        let date: Date | null = null;
        
        if (data.createdAt && typeof data.createdAt.toDate === 'function') {
          date = data.createdAt.toDate();
        } else if (data.createdAt instanceof Date) {
          date = data.createdAt;
        }

        const formattedDate = date 
          ? date.toLocaleString('az-AZ', { 
              day: 'numeric', 
              month: 'long', 
              hour: '2-digit', 
              minute: '2-digit' 
            }) 
          : 'İndi...';
        
        return {
          id: doc.id,
          text: data.text || '',
          date: formattedDate,
          rawDate: date || new Date(),
          authorId: data.authorId || '',
          authorName: data.authorName || 'Naməlum',
        };
      });

      notesData.sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime());
      
      setNotes(notesData);
      setNotesLoading(false);
      setErrorStatus(null);
    }, (error) => {
      const errJson = handleFirestoreError(error, OperationType.LIST, notesPath);
      setNotesLoading(false);
      setErrorStatus("Sistemə qoşula bilmədi");
      console.error(errJson);
    });

    // Real-time admin list listener
    const unsubscribeAdmins = onSnapshot(collection(db, 'admins'), (snapshot) => {
      const admins = snapshot.docs.map(doc => doc.id);
      setAdminList(admins);
    });

    return () => {
      unsubscribeAuth();
      unsubscribeNotes();
      unsubscribeAdmins();
    };
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Login Error:", error);
      if (error.code === 'auth/unauthorized-domain') {
        alert("Vercel domaini Firebase-də 'Authorized Domains' siyahısına əlavə edilməlidir. Firebase Console -> Auth -> Settings -> Authorized Domains bölməsinə keçin.");
      }
      // Fallback for redirect if popup is blocked
      if (error.code === 'auth/popup-blocked') {
        await signInWithRedirect(auth, provider);
      }
    }
  };

  const handleLogout = () => signOut(auth);

  const saveNote = async () => {
    if (!noteInput.trim() || (!adminMode && chances <= 0) || !user || isSaving) return;
    
    setIsSaving(true);
    // Optimistic update for chances
    const oldChances = chances;
    const newChances = chances - 1;
    if (!adminMode) {
      setChances(newChances);
      localStorage.setItem(`note_chances_${user.uid}`, newChances.toString());
    }

    try {
      await addDoc(collection(db, 'notes'), {
        text: noteInput.trim(),
        createdAt: serverTimestamp(),
        authorId: user.uid,
        authorName: user.displayName || user.email?.split('@')[0] || 'Dost',
      });
      setNoteInput("");
      setErrorStatus(null);
    } catch (error: any) {
      console.error("Error adding note: ", error);
      setErrorStatus("Yazı göndərilmədi. Yenidən yoxlayın.");
      // Revert if failed
      if (!adminMode) {
        setChances(oldChances);
        localStorage.setItem(`note_chances_${user.uid}`, oldChances.toString());
      }
    } finally {
      setIsSaving(false);
    }
  };

  const clearAllNotes = async () => {
    if (!isHardcodedOwner) return;
    if (!window.confirm("Bütün diləkləri silmək istədiyinizə əminsiniz?")) return;
    
    try {
      const q = query(collection(db, 'notes'));
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      setShowAdminPanel(false);
    } catch (error) {
      console.error("Error clearing notes:", error);
    }
  };

  const deleteNote = async (id: string) => {
    if (!isAdmin) return;
    try {
      await deleteDoc(doc(db, 'notes', id));
    } catch (error) {
      console.error("Error deleting note: ", error);
    }
  };

  const addAdmin = async () => {
    if (!isHardcodedOwner || !newAdminEmail.trim() || !newAdminEmail.includes('@')) return;
    try {
      await setDoc(doc(db, 'admins', newAdminEmail.trim().toLowerCase()), {
        addedAt: serverTimestamp(),
      });
      setNewAdminEmail("");
    } catch (error) {
      console.error("Error adding admin:", error);
    }
  };

  const removeAdmin = async (email: string) => {
    if (!isHardcodedOwner) return;
    try {
      await deleteDoc(doc(db, 'admins', email));
    } catch (error) {
      console.error("Error removing admin:", error);
    }
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
      {/* Admin Toggle Button */}
      {isAdmin && (
        <button 
          onClick={() => setShowAdminPanel(true)}
          className="fixed bottom-6 left-6 z-50 p-4 bg-white/5 hover:bg-white/10 backdrop-blur-xl border border-white/10 rounded-full text-pink-500 transition-all hover:rotate-90 active:scale-90"
        >
          <Settings size={20} />
        </button>
      )}

      {/* Admin Panel Modal */}
      <AnimatePresence>
        {showAdminPanel && isAdmin && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-[#0f0f0f] border border-white/10 p-8 rounded-[2.5rem] max-w-sm w-full relative overflow-y-auto max-h-[90vh] custom-scrollbar"
            >
              <button 
                onClick={() => setShowAdminPanel(false)}
                className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>

              <div className="flex items-center space-x-3 mb-8 text-pink-500">
                <ShieldCheck size={28} />
                <h2 className="text-xl font-black uppercase tracking-tighter">Yönətim Paneli</h2>
              </div>

              <div className="space-y-6">
                {/* Role Toggle */}
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Aktiv Rol</span>
                    <span className={cn(
                      "text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-widest transition-colors",
                      adminMode ? "bg-pink-500/20 text-pink-500" : "bg-blue-500/20 text-blue-500"
                    )}>
                      {adminMode ? 'OWNER' : 'MEMBER'}
                    </span>
                  </div>
                  <button 
                    onClick={() => setAdminMode(!adminMode)}
                    className="w-full py-3 bg-white text-black rounded-xl font-bold text-sm hover:scale-[1.02] active:scale-95 transition-all"
                  >
                    {adminMode ? 'Member Rejiminə Keç' : 'Owner Rejiminə Keç'}
                  </button>
                  <p className="mt-2 text-[10px] text-gray-500 leading-tight">
                    * Member rejimində şans limitiniz aktiv olacaq, lakin bütün diləkləri hələ də silə biləcəksiniz.
                  </p>
                </div>

                {/* Admin Management (Only for Super Admin) */}
                {isHardcodedOwner && (
                  <div className="space-y-3">
                    <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] px-1">Admin Əlavə Et</h3>
                    <div className="flex space-x-2">
                      <input 
                        type="email"
                        value={newAdminEmail}
                        onChange={(e) => setNewAdminEmail(e.target.value)}
                        placeholder="Email yaz..."
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-pink-500/50"
                      />
                      <button 
                        onClick={addAdmin}
                        className="bg-pink-500 text-white px-3 py-2 rounded-xl text-xs font-bold"
                      >
                        Əlavə et
                      </button>
                    </div>
                    
                    <div className="mt-4 space-y-2 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                      {adminList.map(email => (
                        <div key={email} className="flex items-center justify-between bg-white/[0.03] p-2 rounded-lg border border-white/5">
                          <span className="text-[10px] text-gray-400 font-mono">{email}</span>
                          <button onClick={() => removeAdmin(email)} className="text-gray-600 hover:text-red-500">
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                      {adminList.length === 0 && (
                        <p className="text-[10px] text-gray-600 text-center py-2 italic font-medium">Əlavə admin yoxdur</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Dangerous Actions */}
                <div className="space-y-3 pt-2 border-t border-white/5">
                  <h3 className="text-[10px] font-bold text-red-500/50 uppercase tracking-[0.2em] px-1">Təhlükəli Zonа</h3>
                  <button 
                    onClick={clearAllNotes}
                    className="w-full py-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl font-bold text-sm hover:bg-red-500 hover:text-white transition-all flex items-center justify-center space-x-2"
                  >
                    <AlertCircle size={16} />
                    <span>Bütün Diləkləri Sil</span>
                  </button>
                </div>
              </div>

              <div className="mt-8 text-center">
                <p className="text-[10px] text-gray-700 font-bold uppercase tracking-[0.3em] truncate">
                  Admin: {user?.email}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {user && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed top-6 right-6 z-50 flex items-center space-x-4 bg-white/5 backdrop-blur-xl border border-white/10 p-2 pl-4 rounded-full"
        >
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-pink-500 to-rose-600 flex items-center justify-center overflow-hidden border border-white/20">
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName || ''} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <UserIcon size={14} className="text-white" />
              )}
            </div>
            <span className="text-[10px] font-bold text-white/80 uppercase tracking-widest hidden sm:block">
              {user.displayName?.split(' ')[0]}
            </span>
          </div>
          <button 
            onClick={handleLogout}
            className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors"
          >
            <LogOut size={16} />
          </button>
        </motion.div>
      )}

      {/* Background Ornaments */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20">
        <div className="absolute top-10 left-10 text-pink-500 animate-pulse"><Stars size={40} /></div>
        <div className="absolute bottom-10 right-10 text-yellow-500 animate-pulse delay-700"><Sparkles size={40} /></div>
        <div className="absolute top-1/2 left-10 text-blue-500 animate-bounce"><Heart size={24} /></div>
        <div className="absolute top-20 right-20 text-purple-500 animate-bounce delay-300"><Gift size={32} /></div>
      </div>

      {/* Main Content */}
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
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-pink-500">
                <div className="relative">
                  <MessageCircle size={20} />
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full border border-[#0a0a0a] animate-pulse" />
                </div>
                <h3 className="text-sm font-bold uppercase tracking-[0.2em] flex items-center">
                  DİLƏK TUT 
                  {notes.length > 0 && (
                    <span className="ml-2 px-1.5 py-0.5 bg-white/5 rounded text-[10px] text-gray-500">{notes.length}</span>
                  )}
                </h3>
              </div>
              <div className="flex items-center space-x-3">
                {errorStatus && (
                  <span className="text-[10px] text-red-500 font-bold animate-pulse">{errorStatus}</span>
                )}
                {!notesLoading && !errorStatus && (
                  <div className="flex items-center space-x-1">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                  </div>
                )}
                <div className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                    Şans: <span className={cn("text-white", !adminMode && chances === 0 && "text-red-500")}>
                      {adminMode ? '∞' : chances}
                    </span> / 3
                  </span>
                </div>
              </div>
            </div>
            
            <div className="relative group min-h-[112px]">
              {user ? (
                <>
                  <textarea
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    disabled={!adminMode && chances === 0}
                    placeholder={adminMode || chances > 0 ? "Bura bir dilək yaz..." : "Yazma limiti doldu ✨"}
                    className={cn(
                      "w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:outline-none focus:border-pink-500/50 transition-all resize-none placeholder:text-gray-600 h-28",
                      !adminMode && chances === 0 && "opacity-50 cursor-not-allowed bg-red-500/5"
                    )}
                  />
                  {(adminMode || chances > 0) && (
                    <button
                      onClick={saveNote}
                      disabled={!noteInput.trim() || isSaving}
                      className="absolute bottom-3 right-3 p-2 bg-pink-500 rounded-xl text-white disabled:opacity-30 disabled:grayscale hover:scale-110 active:scale-95 transition-all shadow-lg shadow-pink-500/20"
                    >
                      {isSaving ? (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                        >
                          <Sparkles size={16} />
                        </motion.div>
                      ) : (
                        <Send size={16} />
                      )}
                    </button>
                  )}
                </>
              ) : (
                <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-4">
                  <p className="text-xs text-gray-500 uppercase tracking-widest font-medium">Bura yazmaq üçün hesab aç</p>
                  <button 
                    onClick={handleLogin}
                    className="flex items-center space-x-2 bg-white text-black py-2 px-6 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:scale-[1.05] active:scale-95 transition-all"
                  >
                    <LogIn size={14} />
                    <span>Google ilə Giriş Et</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <AnimatePresence initial={false} mode="wait">
              {notesLoading ? (
                <div className="py-8 flex flex-col items-center justify-center space-y-3 opacity-40">
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                  >
                    <Sparkles size={20} className="text-pink-500" />
                  </motion.div>
                  <span className="text-[10px] font-bold uppercase tracking-widest">Yüklənir...</span>
                </div>
              ) : notes.length > 0 ? (
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
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-[10px] font-bold text-pink-500/80 uppercase tracking-widest">
                            {note.authorName}
                          </span>
                        </div>
                        <p className="text-sm text-gray-300 leading-relaxed text-left">
                          {note.text}
                        </p>
                        <span className="text-[10px] text-gray-600 mt-2 block font-mono">
                          {note.date}
                        </span>
                      </div>
                      {isAdmin && (
                        <button
                          onClick={() => deleteNote(note.id)}
                          className="text-gray-700 hover:text-red-500 transition-colors p-1"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="py-12 border-2 border-dashed border-white/5 rounded-3xl text-center">
                  <p className="text-xs text-gray-600 uppercase tracking-widest font-medium">Hələ heç bir dilək yoxdur</p>
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
