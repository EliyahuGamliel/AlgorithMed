'use client';

import React, { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { SortableItem } from '../components/SortableItem';
import { doc, getDoc, updateDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

const MoonIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>;
const SunIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>;

const INITIAL_TRACKS = [
  { id: '1', title: 'מסלול 1' },
  { id: '2', title: 'מסלול 2' },
  { id: '3', title: 'מסלול 3' },
  { id: '4', title: 'מסלול 4' },
  { id: '5', title: 'מסלול 5' },
  { id: '6', title: 'מסלול 6' },
  { id: '7', title: 'מסלול 7' },
  { id: '8', title: 'מסלול 8' },
  { id: '9', title: 'מסלול 9' },
  { id: '10', title: 'מסלול 10' },
  { id: '11', title: 'מסלול 11' },
  { id: '12', title: 'מסלול 12' },
  { id: '13', title: 'מסלול 13' },
  { id: '14', title: 'מסלול 14' },
  { id: '15', title: 'מסלול 15' },
];

// תאריך ושעת ההגרלה: 17 בספטמבר 2026, שעה 22:00 שעון ישראל
const TARGET_DATE = new Date('2026-09-17T22:00:00+03:00').getTime();

export default function Home() {
  const [tracks, setTracks] = useState(INITIAL_TRACKS);
  const [groupCode, setGroupCode] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [splashState, setSplashState] = useState("visible");
  const [isMounted, setIsMounted] = useState(false);

  const [results, setResults] = useState<any[] | null>(null);
  const [isRunningAlgorithm, setIsRunningAlgorithm] = useState(false);
  
  // ניהול הרשאות סודיות וסיסמת מנהל
  const [logoClicks, setLogoClicks] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');

  // ניהול שעון העצר
  const [timeLeft, setTimeLeft] = useState({
    days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: false
  });

  useEffect(() => {
    setIsMounted(true);
    const isDark = localStorage.getItem('theme') === 'dark';
    setDarkMode(isDark);
    if (isDark) document.documentElement.classList.add('dark');
    
    setTimeout(() => setSplashState("fading"), 1800);
    setTimeout(() => setSplashState("hidden"), 2600);

    // מאזין בזמן אמת לתוצאות השיבוץ
    const unsub = onSnapshot(doc(db, 'results', 'final'), (docSnap) => {
      if (docSnap.exists()) {
        setResults(docSnap.data().assignments);
      } else {
        setResults(null);
      }
    });

    // טיימר לשעון עצר
    const timerInterval = setInterval(() => {
      const now = new Date().getTime();
      const distance = TARGET_DATE - now;

      if (distance < 0) {
        clearInterval(timerInterval);
        setTimeLeft(prev => ({ ...prev, isExpired: true }));
      } else {
        setTimeLeft({
          days: Math.floor(distance / (1000 * 60 * 60 * 24)),
          hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((distance % (1000 * 60)) / 1000),
          isExpired: false
        });
      }
    }, 1000);

    return () => {
      unsub();
      clearInterval(timerInterval);
    };
  }, []);

  const toggleDarkMode = () => {
    if (darkMode) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setDarkMode(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setDarkMode(true);
    }
  };

  // דלת סתרים: 5 לחיצות על הלוגו יפתחו את פאנל המנהל
  const handleSecretClick = () => {
    setLogoClicks((prev) => {
      const newCount = prev + 1;
      if (newCount === 5) {
        setIsAdmin(true);
        return 0;
      }
      return newCount;
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      setTracks((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleSave = async () => {
    if (timeLeft.isExpired) {
      setSaveStatus('❌ זמן ההגשה תם. לא ניתן לעדכן יותר העדפות.');
      return;
    }

    if (!groupCode) {
      setSaveStatus('נא להזין קוד קבוצה!');
      return;
    }
    
    setIsSaving(true);
    setSaveStatus('');
    
    try {
      if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
        alert("שגיאה קריטית: משתני הסביבה של Firebase לא נטענו!");
        setIsSaving(false);
        return;
      }

      const groupRef = doc(db, 'groups', groupCode);
      const groupSnap = await getDoc(groupRef);

      if (!groupSnap.exists()) {
        setSaveStatus('❌ קוד הקבוצה אינו תקין. ודא שהקלדת נכון.');
        setIsSaving(false);
        return;
      }

      const rankedPreferences = tracks.map(track => parseInt(track.id));

      await updateDoc(groupRef, {
        preferences: rankedPreferences,
        updatedAt: serverTimestamp(),
        submitted: true
      });

      setSaveStatus('✅ ההעדפות נשמרו בהצלחה במערכת!');
      setIsSaving(false);
      
    } catch (error: any) {
      console.error("Firebase Error:", error);
      if (error.code === 'permission-denied') {
        setSaveStatus('❌ שגיאה: המערכת ננעלה! חלף זמן ההגשה.');
      } else {
        setSaveStatus('❌ שגיאה בשמירה. בדוק את החיבור לרשת.');
      }
      setIsSaving(false);
    }
  };

  // ----- פעולות מנהל (Admin) עם סיסמה -----

  const handleRunMatch = async () => {
    if (!window.confirm("האם אתה בטוח שברצונך לנעול את ההרשמה ולהריץ את האלגוריתם? כל הסטודנטים יראו מיד את התוצאות!")) return;
    
    setIsRunningAlgorithm(true);
    try {
      const response = await fetch('/api/run-match', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPassword })
      });
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "שגיאה בחישוב האלגוריתם");
      }
    } catch (error: any) {
      alert("שגיאת מערכת: " + error.message);
    }
    setIsRunningAlgorithm(false);
  };

  const handleSetupGroups = async () => {
    if (!window.confirm("פעולה זו תייצר 15 קבוצות חדשות עם קודים מאובטחים. הקבוצות הקודמות יישארו ללא שימוש. להמשיך?")) return;
    try {
      const res = await fetch('/api/setup-groups', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPassword })
      });
      const data = await res.json();
      
      if (data.success) {
        alert(data.message + "\n\nפתח את ה-Console של הדפדפן (F12) כדי להעתיק את רשימת הקודים!");
        console.table(data.codes); 
      } else {
        alert(data.error);
      }
    } catch (e) {
      alert("שגיאה ביצירת קבוצות");
    }
  };

  const handleResetMatch = async () => {
    if (!window.confirm("אזהרה: זה ימחק את התוצאות הנוכחיות ויחזיר את כולם למסך הדירוג! בטוח?")) return;
    try {
      const res = await fetch('/api/reset-match', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPassword })
      });
      const data = await res.json();
      
      if (res.ok) {
        alert(data.message);
      } else {
        alert(data.error);
      }
    } catch (e) {
      alert("שגיאה באיפוס המערכת");
    }
  };

  // ----- רינדור מסכים -----

  const renderSplashScreen = (fading: boolean) => (
    <div className={`fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-slate-50 dark:bg-[#0B1120] transition-opacity duration-700 ease-in-out ${fading ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes heartbeat {
          0% { transform: scale(1); }
          14% { transform: scale(1.05); }
          28% { transform: scale(1); }
          42% { transform: scale(1.05); }
          70% { transform: scale(1); }
        }
        .animate-heartbeat { animation: heartbeat 2s infinite; }
      `}} />
      <div className="flex flex-col items-center justify-center relative -translate-y-12 sm:-translate-y-16">
        <div className="absolute w-[250%] h-[250%] bg-blue-500/10 dark:bg-blue-600/10 blur-[120px] rounded-full animate-pulse pointer-events-none"></div>
        <div className="animate-in fade-in zoom-in-95 duration-1000 flex flex-col items-center relative z-10">
          {/* הוספנו font-sans ועיצוב ישיר ללוגו כאן */}
          <h1 className="text-6xl sm:text-7xl font-black tracking-tighter flex mb-1 drop-shadow-lg dark:drop-shadow-2xl animate-heartbeat font-sans" dir="ltr">
            <span className="text-slate-800 dark:text-white">Algorit</span>
            <span className="text-indigo-500 dark:text-indigo-400">M</span>
            <span className="text-blue-600 dark:text-blue-500">ed</span>
          </h1>
          <div className="h-1 w-12 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full mt-3 opacity-80"></div>
        </div>
      </div>
    </div>
  );

  const renderAdminTools = () => (
    <div className="mt-16 pt-8 border-t border-slate-200/50 dark:border-slate-800/50 flex flex-col items-center gap-6 opacity-100 transition-opacity">
      
      {/* שדה הזנת סיסמת מנהל */}
      <div className="w-full max-w-xs">
        <input
          type="password"
          value={adminPassword}
          onChange={(e) => setAdminPassword(e.target.value)}
          placeholder="הכנס סיסמת מנהל לביצוע פעולות"
          className="w-full p-3 text-center bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
        />
      </div>

      <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
        <button 
          onClick={handleRunMatch} disabled={isRunningAlgorithm || !adminPassword}
          className="text-xs font-bold px-4 py-2 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 transition-colors border border-indigo-200 dark:border-indigo-800 shadow-sm disabled:opacity-50"
        >
          {isRunningAlgorithm ? 'מחשב...' : '1. הרץ אלגוריתם הונגרי'}
        </button>
        
        <button 
          onClick={handleResetMatch} disabled={!adminPassword}
          className="text-xs font-bold px-4 py-2 bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded-lg hover:bg-red-100 transition-colors border border-red-200 dark:border-red-800 shadow-sm disabled:opacity-50"
        >
          2. איפוס הגרלה
        </button>

        <button 
          onClick={handleSetupGroups} disabled={!adminPassword}
          className="text-xs font-bold px-4 py-2 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 rounded-lg hover:bg-slate-200 transition-colors border border-slate-200 dark:border-slate-700 shadow-sm disabled:opacity-50"
        >
          3. צור 15 קבוצות (Seed)
        </button>
      </div>
    </div>
  );

  const renderCountdown = () => {
    if (!isMounted) return null;
    
    if (timeLeft.isExpired) {
      return (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-2xl p-4 text-center mb-10 shadow-sm animate-pulse">
          <span className="text-red-600 dark:text-red-400 font-bold text-lg">זמן ההגשה תם. ממתינים לתוצאות ההגרלה...</span>
        </div>
      );
    }

    return (
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-100 dark:border-blue-800/50 rounded-2xl p-4 sm:p-6 text-center mb-10 shadow-sm">
        <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wider">הזמן שנותר עד לנעילת המערכת</h3>
        <div className="flex justify-center gap-4 sm:gap-6" dir="ltr">
          <div className="flex flex-col items-center">
            <span className="text-3xl sm:text-4xl font-black text-slate-800 dark:text-white tabular-nums">{String(timeLeft.days).padStart(2, '0')}</span>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">ימים</span>
          </div>
          <span className="text-3xl sm:text-4xl font-black text-slate-300 dark:text-slate-600/50">:</span>
          <div className="flex flex-col items-center">
            <span className="text-3xl sm:text-4xl font-black text-slate-800 dark:text-white tabular-nums">{String(timeLeft.hours).padStart(2, '0')}</span>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">שעות</span>
          </div>
          <span className="text-3xl sm:text-4xl font-black text-slate-300 dark:text-slate-600/50">:</span>
          <div className="flex flex-col items-center">
            <span className="text-3xl sm:text-4xl font-black text-slate-800 dark:text-white tabular-nums">{String(timeLeft.minutes).padStart(2, '0')}</span>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">דקות</span>
          </div>
          <span className="text-3xl sm:text-4xl font-black text-slate-300 dark:text-slate-600/50">:</span>
          <div className="flex flex-col items-center">
            <span className="text-3xl sm:text-4xl font-black text-blue-600 dark:text-blue-400 tabular-nums">{String(timeLeft.seconds).padStart(2, '0')}</span>
            <span className="text-xs font-bold text-blue-600/70 dark:text-blue-400/70 mt-1">שניות</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B1120] text-slate-800 dark:text-slate-100 relative flex flex-col pb-24 transition-colors duration-300" dir="rtl">
      
      {splashState !== "hidden" && renderSplashScreen(splashState === "fading")}

      <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50 px-5 sm:px-8 py-3.5 flex justify-between items-center shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] h-[72px] shrink-0 transition-colors relative">
        <div className="flex items-center gap-4 z-10 w-1/3"></div>
        
        {/* הלוגו המרכזי עם פונקציית הלחיצה הסודית */}
        <div 
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-0 flex justify-center w-1/3 cursor-default select-none"
          onClick={handleSecretClick}
        >
          {/* הוספנו font-sans ועיצוב ישיר ללוגו כאן */}
          <h1 className="text-3xl font-black tracking-tight flex font-sans" dir="ltr" >
            <span className="text-slate-800 dark:text-white">Algorit</span>
            <span className="text-indigo-500 dark:text-indigo-400">M</span>
            <span className="text-blue-600 dark:text-blue-500">ed</span>
          </h1>
        </div>
        
        <div className="flex items-center justify-end gap-3 z-10 w-1/3">
          <button onClick={toggleDarkMode} className="p-2.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-amber-400 hover:scale-110 transition-all border border-slate-200/50 dark:border-slate-700/50" title={darkMode ? "מצב יום" : "מצב לילה"}>
            {darkMode ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </header>

      {results ? (
        // --- מסך התוצאות החגיגי ---
        <main className="max-w-4xl mx-auto px-4 sm:px-8 mt-10 flex-grow w-full animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="text-center mb-12 relative">
            <div className="text-5xl mb-4 animate-bounce">🎉</div>
            <h2 className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 tracking-tight mb-2">
              השיבוצים הושלמו!
            </h2>
            <p className="text-lg text-slate-500 dark:text-slate-400">
              אלגוריתם ההשמה ההונגרי חישב את השיבוץ האופטימלי לכלל המחזור.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-800/90 rounded-[2rem] shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden mb-12">
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-5 font-bold text-slate-500 dark:text-slate-400">קבוצה</th>
                    <th className="p-5 font-bold text-slate-500 dark:text-slate-400">המסלול ששובץ</th>
                    <th className="p-5 font-bold text-slate-500 dark:text-slate-400 text-center">עדיפות שנתקבלה</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {results.map((row, idx) => (
                    <tr key={idx} className="hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors">
                      <td className="p-5 font-black text-slate-800 dark:text-slate-200">{row.groupName}</td>
                      <td className="p-5 font-bold text-blue-600 dark:text-blue-400">{row.assignedTrack}</td>
                      <td className="p-5 text-center">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-black text-sm ${
                          row.preferenceReceived <= 3 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' : 
                          row.preferenceReceived <= 7 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800' :
                          'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 border border-red-200 dark:border-red-800'
                        }`}>
                          {row.preferenceReceived}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* הרשאות מנהל בלבד */}
          {isAdmin && renderAdminTools()}
        </main>
      ) : (
        // --- מסך טופס הדירוג הרגיל ---
        <main className="max-w-3xl mx-auto px-4 sm:px-8 mt-10 flex-grow w-full mb-12 animate-in fade-in slide-in-from-bottom-4 duration-300">
          
          {renderCountdown()}

          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-black text-slate-800 dark:text-white tracking-tight mb-2">
              הגשת העדפות לשיבוץ
            </h2>
            <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400">
              גרור את המסלולים וסדר אותם לפי סדר העדיפויות של הקבוצה שלך.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-800/80 p-6 sm:p-8 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-700/80 transition-colors mb-10">
            
            <div className="mb-8">
              <label htmlFor="groupCode" className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 ml-1">
                קוד קבוצה ייחודי
              </label>
              <input
                type="text"
                id="groupCode"
                value={groupCode}
                onChange={(e) => setGroupCode(e.target.value)}
                disabled={timeLeft.isExpired}
                className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-slate-100 font-bold transition-all placeholder:font-normal disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="הכנס את קוד הקבוצה שקיבלתם"
              />
            </div>

            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100 dark:border-slate-700/50">
                <div className="w-8 h-8 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center text-sm font-bold shadow-inner">1</div>
                <h3 className="font-bold text-slate-800 dark:text-white">דירוג מסלולים <span className="text-xs font-normal text-slate-400 mx-1">(הכי מועדף למעלה)</span></h3>
              </div>
              
              {isMounted ? (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={tracks} strategy={verticalListSortingStrategy}>
                    <div className={`space-y-1 ${timeLeft.isExpired ? 'opacity-75 pointer-events-none' : ''}`}>
                      {tracks.map((track, index) => (
                        <SortableItem key={track.id} id={track.id} title={track.title} index={index} />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              ) : (
                <div className="animate-pulse space-y-3 opacity-50">
                  <div className="h-20 bg-slate-200 dark:bg-slate-700 rounded-2xl w-full"></div>
                  <div className="h-20 bg-slate-200 dark:bg-slate-700 rounded-2xl w-full"></div>
                  <div className="h-20 bg-slate-200 dark:bg-slate-700 rounded-2xl w-full"></div>
                </div>
              )}
            </div>

            <button
              onClick={handleSave}
              disabled={isSaving || timeLeft.isExpired}
              className={`w-full py-4 px-6 rounded-xl text-lg font-bold text-white transition-all transform active:scale-95 shadow-md
                ${(isSaving || timeLeft.isExpired)
                  ? 'bg-slate-400 dark:bg-slate-700 cursor-not-allowed shadow-none' 
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-500/20'
                }`}
            >
              {isSaving ? 'מעדכן נתונים...' : timeLeft.isExpired ? 'הזמן להגשה תם' : 'נעל העדפות ושמור'}
            </button>
            
            {saveStatus && (
              <div className={`mt-5 p-4 rounded-xl text-center font-bold text-sm animate-in fade-in ${
                saveStatus.includes('❌') || saveStatus.includes('נא') || saveStatus.includes('תם')
                  ? 'bg-red-50 text-red-600 border border-red-100 dark:bg-red-900/20 dark:border-red-900/50 dark:text-red-400' 
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-900/50 dark:text-emerald-400'
              }`}>
                {saveStatus}
              </div>
            )}
          </div>
          
          {/* הרשאות מנהל בלבד */}
          {isAdmin && renderAdminTools()}
        </main>
      )}
    </div>
  );
}