import React, { useState, useEffect, useRef } from 'react';
import { Camera, MessageSquare, BookOpen, Cloud, ChevronRight, Menu, X, Send, User, LogIn, LogOut, Loader2, AlertTriangle, CheckCircle2, MapPin, Navigation, Search, Wind, Droplets, Sun, CloudRain, CloudLightning } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Services ---
import { auth, loginWithGoogle } from './lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { analyzeLeaf, AnalysisResult } from './lib/gemini';
import { subscribeToPosts, createPost, likePost, Post, subscribeToComments, addComment, type Comment as ForumComment } from './lib/forumService';
import { saveScan, subscribeToUserScans, subscribeToGlobalScans, ScanResult } from './lib/scanService';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar } from 'recharts';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Constants ---
const DISEASES_DB = [
  {
    name: 'Fındık Külleme',
    crop: 'Fındık',
    symptoms: 'Yaprak üst yüzeyinde beyaz tozlanma, yaprak kenarlarında kuruma, genç sürgünlerde bükülme.',
    cause: 'Erysiphe coryli mantarı. Yüksek nem (%70+), 20-25°C sıcaklık ve yetersiz hava sirkülasyonu.',
    prevention: 'Hava sirkülasyonu için doğru budama yapın, yere düşen hastalıklı yaprakları toplayıp imha edin.',
    treatment: 'Kükürt bazlı ilaçlar (400g/100L su) veya sistemik fungisitler. İlk belirtilerde veya sürgünler 10-15 cm olunca başlayın.',
    safety: 'Uygulama sırasında maske ve eldiven kullanın, arıların uçuş saatlerinde ilaçlama yapmayın.'
  },
  {
    name: 'Fındık Kurdu',
    crop: 'Fındık',
    symptoms: 'Meyvelerde küçük delikler, erken dökülme ve iç boşalması (sarı karamuk).',
    cause: 'Curculio nucum böceği. Toprakta kışlayan larvalar Mayıs ayında erginleşir.',
    prevention: 'Kışın toprak işleyerek larvaları yüzeye çıkarın. Sabah serinliğinde ağaçları silkeleyerek erginleri toplayın.',
    treatment: 'Deltamethrin veya uygun insektisitler. Meyveler mercimek büyüklüğüne (3-4 mm) gelince uygulanmalıdır.',
    safety: 'Hasada 30 gün kala ilaçlamayı kesin. Çevre dostu olması için feromon tuzakları değerlendirilebilir.'
  },
  {
    name: 'Çayda Kırmızı Örümcek',
    crop: 'Çay',
    symptoms: 'Yaprakların bronzlaşması, matlaşma, yaprak altında ince ağlar ve yoğun dökülme.',
    cause: 'Oligonychus coffeae. Kurak geçen yaz ayları, yol kenarındaki tozlu bitkiler.',
    prevention: 'Tozu önlemek için bahçe yollarını sulayın. Doğal avcıları korumak için gereksiz kimyasaldan kaçının.',
    treatment: 'Yazlık yağlar veya biyolojik pestisitler (Azadirachtin). Popülasyon yaprak başına 5 adedi geçerse müdahale edin.',
    safety: 'Hasat döneminde kesinlikle kimyasal kullanmayın. Yağmur sonrası popülasyon doğal olarak azalır.'
  },
  {
    name: 'Çay Antraknozu',
    crop: 'Çay',
    symptoms: 'Yaprak kenarlarında dairesel kahverengi lekeler, üzerinde siyah noktacıklar, dal uçlarının kuruması.',
    cause: 'Colletotrichum camelliae mantarı. Mekanik yaralanmalar ve aşırı yağışlı dönemler.',
    prevention: 'Dengeli gübreleme (aşırı azottan kaçının), kurumuş dalları budayarak bahçeden uzaklaştırın.',
    treatment: 'Bakır esaslı fungusitler (%1 Bordo Karışımı). Tomurcuk patlamasından önce uygulanması etkilidir.',
    safety: 'Bakırlı ilaçların kullanım dozuna dikkat edin, çay filizlerinde leke bırakabilir.'
  },
  {
    name: 'Yeşil Kokulu Böcek',
    crop: 'Fındık',
    symptoms: 'İç fındıkta şekil bozukluğu, acılaşma (sarı leke), meyvelerin şekilsiz gelişmesi.',
    cause: 'Palomena prasina. Haziran ve Temmuz aylarında fındıkla beslenirler.',
    prevention: 'Hardal gibi tuzak bitkiler kullanın, kışlak alanlardaki bitki artıklarını temizleyin.',
    treatment: 'Thiamethoxam içerikli ilaçlar. 10 ocakta 1\'den fazla böcek görürseniz ilaçlama yapın.',
    safety: 'Biyolojik mücadele için doğal parazitoidleri (Trissolcus spp.) koruyun.'
  }
];

type Tab = 'dashboard' | 'analyze' | 'forum' | 'library';

interface LocationData {
  lat: number;
  lon: number;
  name: string;
}

const DEFAULT_LOCATION: LocationData = {
  lat: 41.0027,
  lon: 39.7168,
  name: 'Trabzon, Merkez'
};

export default function App() {
  const [activeTab, setActiveTab ] = useState<Tab>('dashboard');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [location, setLocation] = useState<LocationData>(DEFAULT_LOCATION);
  const [weather, setWeather] = useState<any>(null);
  const [isLocationSearchOpen, setIsLocationSearchOpen] = useState(false);

  useEffect(() => {
    // Attempt auto-location on mount
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords;
          try {
            // Reverse geocode to get name
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
            const data = await res.json();
            const cityName = data.address.city || data.address.town || data.address.village || 'Bilinmeyen Konum';
            const stateName = data.address.province || data.address.state || '';
            setLocation({
              lat: latitude,
              lon: longitude,
              name: `${cityName}${stateName ? `, ${stateName}` : ''}`
            });
          } catch (e) {
            setLocation({ lat: latitude, lon: longitude, name: 'Konumum' });
          }
        },
        (err) => console.log("Geolocation denied or error:", err)
      );
    }
  }, []);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lon}&current=temperature_2m,relative_humidity_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`);
        const data = await res.json();
        setWeather(data);
      } catch (e: any) {
        console.error("Weather fetch error", e?.message || String(e));
      }
    };
    fetchWeather();
  }, [location]);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
  }, []);

  const handleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (e: any) {
      if (e.code === 'auth/popup-closed-by-user') {
        // Silently handle or show a non-intrusive message
        console.log("Kullanıcı giriş penceresini kapattı.");
      } else {
        alert("Giriş yapılamadı: " + (e.message || "Bilinmeyen hata"));
      }
    }
  };

  const handleLogout = () => signOut(auth);

  return (
    <div className="min-h-screen bg-[#f5f5f0] text-[#1a1a1a] flex flex-col font-sans">
      {/* Header */}
      <header className="px-6 py-4 border-b border-black/10 flex justify-between items-end bg-white/40 backdrop-blur-md sticky top-0 z-50">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-[0.3em] font-semibold opacity-50">Google Cloud / Gemini Vision</span>
          <h1 className="serif text-3xl md:text-5xl font-semibold -mt-1 flex items-center gap-3">
            AgroVision <span className="italic font-light opacity-60 hidden md:inline">Karadeniz</span>
          </h1>
        </div>
        
        <nav className="hidden md:flex gap-8 mb-1">
          {[
            { id: 'dashboard', label: 'Özet', icon: Navigation },
            { id: 'analyze', label: 'Analiz', icon: Camera },
            { id: 'forum', label: 'Topluluk', icon: MessageSquare },
            { id: 'library', label: 'Kütüphane', icon: BookOpen },
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={cn(
                "text-sm font-semibold transition-all py-1 flex items-center gap-2", 
                activeTab === tab.id ? "text-primary border-b-2 border-primary" : "opacity-40 hover:opacity-100"
              )}
            >
              <tab.icon size={14} /> {tab.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block mr-2 cursor-pointer hover:opacity-70 transition-opacity" onClick={() => setIsLocationSearchOpen(true)}>
            <p className="text-xs font-semibold flex items-center justify-end gap-1">
              <MapPin size={10} className="text-primary" /> {location.name}
            </p>
            <p className="mono text-[10px] opacity-60 uppercase">
              {weather ? `Nem %${weather.current.relative_humidity_2m} / ${Math.round(weather.current.temperature_2m)}°C` : 'Yükleniyor...'}
            </p>
          </div>
          
          <AnimatePresence>
            {isLocationSearchOpen && (
              <LocationSearchModal 
                onClose={() => setIsLocationSearchOpen(false)} 
                onSelect={(loc) => {
                  setLocation(loc);
                  setIsLocationSearchOpen(false);
                }} 
              />
            )}
          </AnimatePresence>
          
          {user ? (
            <div className="flex items-center gap-3 bg-white/40 p-1 pr-4 rounded-full border border-black/5">
              <img src={user.photoURL} alt={user.displayName} className="w-8 h-8 rounded-full shadow-sm" />
              <button onClick={handleLogout} className="opacity-40 hover:opacity-100 transition-opacity"><LogOut size={16} /></button>
            </div>
          ) : (
            <button onClick={handleLogin} className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider bg-primary text-white px-4 py-2 rounded-full shadow-lg shadow-primary/20 hover:scale-105 transition-all">
              <LogIn size={16} /> Giriş Yap
            </button>
          )}

          <button className="md:hidden" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-b border-black/10 p-6 flex flex-col gap-4 absolute top-20 left-0 w-full z-40 overflow-hidden"
          >
            <button onClick={() => { setActiveTab('dashboard'); setIsMenuOpen(false); }} className="flex items-center gap-3 text-lg font-medium"><Navigation size={20}/> Özet</button>
            <button onClick={() => { setActiveTab('analyze'); setIsMenuOpen(false); }} className="flex items-center gap-3 text-lg font-medium"><Camera size={20}/> Analiz</button>
            <button onClick={() => { setActiveTab('forum'); setIsMenuOpen(false); }} className="flex items-center gap-3 text-lg font-medium"><MessageSquare size={20}/> Topluluk</button>
            <button onClick={() => { setActiveTab('library'); setIsMenuOpen(false); }} className="flex items-center gap-3 text-lg font-medium"><BookOpen size={20}/> Kütüphane</button>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && <ProfessionalDashboard key="dashboard" user={user} weather={weather} location={location} onNavigate={setActiveTab} />}
          {activeTab === 'analyze' && <VisionAnalyzer key="analyze" user={user} onLogin={handleLogin} weather={weather} location={location} />}
          {activeTab === 'forum' && <ForumSection key="forum" user={user} onLogin={handleLogin} />}
          {activeTab === 'library' && <DiseaseLibrary key="library" />}
        </AnimatePresence>
      </main>

      <footer className="p-8 border-t border-black/10 bg-white/20 flex flex-col md:flex-row justify-between items-center gap-6 opacity-60">
        <div className="flex flex-col md:flex-row gap-4 md:gap-8 items-center">
          <div className="flex gap-4 items-center">
            <p className="text-[10px] font-mono font-bold tracking-widest bg-black/5 px-2 py-1 rounded">AI v2.4.11-PRO</p>
            <span className="w-1 h-1 rounded-full bg-black/20" />
            <p className="text-[10px] uppercase font-bold tracking-wider">Doğu Karadeniz Tarımsal Kalkınma</p>
          </div>
          <div className="flex gap-4 text-[10px] font-semibold uppercase tracking-widest">
            <a href="#" className="hover:text-primary transition-colors">KVKK</a>
            <a href="#" className="hover:text-primary transition-colors">İletişim</a>
            <a href="#" className="hover:text-primary transition-colors">Hakkımızda</a>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-medium italic">"Toprak geleceğimizdir, teknolojimiz koruyucumuz."</p>
        </div>
      </footer>
    </div>
  );
}

// --- Analysis Component ---
function VisionAnalyzer({ user, onLogin, weather, location }: { user: any, onLogin: () => void, weather: any, location: LocationData }) {
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        setResult(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleScan = async () => {
    if (!image) return;
    setAnalyzing(true);
    try {
      const base64Data = image.split(',')[1];
      const res = await analyzeLeaf(base64Data);
      setResult(res);
    } catch (error: any) {
      alert("Hata: " + error.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSave = async () => {
    if (!result || !user || !image) return;
    setSaving(true);
    try {
      await saveScan({
        userId: user.uid,
        imageUrl: image,
        diseaseName: result.diseaseName,
        scientificName: result.scientificName,
        confidence: result.confidence,
        description: result.description,
        proactiveAdvice: result.proactiveAdvice,
        severity: result.severity,
      });
      alert("Analiz başarıyla buluta kaydedildi.");
    } catch (e: any) {
      alert("Kaydedilemedi: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
    >
      <div className="lg:col-span-7 flex flex-col items-center">
        <div className="relative aspect-[4/3] w-full leaf-mask bg-neutral-200 border-4 border-white shadow-2xl overflow-hidden group">
          {image ? (
            <img 
              src={image} 
              className={cn("w-full h-full object-cover transition-all duration-700", analyzing ? "grayscale blur-[2px] scale-105" : "grayscale-0")} 
              alt="Bitki Yaprağı"
            />
          ) : (
            <div className="w-full h-full bg-neutral-100 flex flex-col items-center justify-center gap-4 text-black/20">
              <Camera size={64} strokeWidth={1} />
              <p className="font-semibold text-lg serif italic">Henüz bir fotoğraf yüklenmedi</p>
            </div>
          )}
          
          {analyzing && <div className="scan-line" />}
          
          <AnimatePresence>
            {!analyzing && !result && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 flex items-center justify-center bg-black/5 backdrop-blur-[1px]"
              >
                <div className="flex flex-col gap-3 items-center">
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-white text-primary px-8 py-4 rounded-full font-bold shadow-xl flex items-center gap-3 hover:scale-105 transition-transform"
                  >
                    <Camera size={24} /> {image ? 'Fotoğrafı Değiştir' : 'Fotoğraf Yükle'}
                  </button>
                  {image && (
                    <button 
                      onClick={handleScan}
                      className="bg-primary text-white px-8 py-4 rounded-full font-bold shadow-xl flex items-center gap-3 hover:scale-105 transition-transform"
                    >
                      <Loader2 className={cn("animate-spin", !analyzing && "hidden")} size={20} />
                      Analize Başla
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <input type="file" hidden ref={fileInputRef} accept="image/*" onChange={handleFileChange} />

          {result && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute top-[8%] right-[8%] glass p-5 rounded-3xl w-64 shadow-2xl border-white/50"
            >
              <div className="flex justify-between items-start mb-2">
                <p className="text-[10px] uppercase tracking-widest font-bold opacity-70 leading-none">Analiz Raporu</p>
                <div className={cn(
                  "p-1 rounded-full",
                  result.severity > 3 ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"
                )}>
                  {result.severity > 3 ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
                </div>
              </div>
              <h3 className="serif text-2xl italic font-bold text-primary mb-1">{result.diseaseName}</h3>
              <p className="text-[11px] opacity-60 leading-relaxed italic mb-3">({result.scientificName})</p>
              
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                   <div className="flex-1 h-1.5 bg-black/5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${result.confidence}%` }}
                        className="h-full bg-green-600" 
                      />
                   </div>
                   <span className="mono text-[10px] font-bold">{result.confidence}%</span>
                </div>
                <div className="text-[10px] font-medium leading-normal bg-white/40 p-2 rounded-xl">
                  {result.description}
                </div>
              </div>
            </motion.div>
          )}
        </div>

        <div className="mt-8 grid grid-cols-2 md:flex gap-8 md:gap-14 w-full justify-start items-center px-4">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold opacity-40 mb-1">Analiz Kimliği</span>
            <span className="mono text-xs italic opacity-80">#{Math.random().toString(36).substr(2, 6).toUpperCase()}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold opacity-40 mb-1">Durum</span>
            <span className="flex items-center gap-2 text-xs font-semibold">
              <span className={cn("w-2 h-2 rounded-full", analyzing ? "bg-amber-500 animate-pulse" : "bg-green-500")}></span> 
              {analyzing ? 'İşleniyor...' : (result ? 'Tamamlandı' : 'Beklemede')}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold opacity-40 mb-1">Kapsam</span>
            <span className="mono text-xs uppercase tracking-tighter">Karadeniz / Fındık-Çay</span>
          </div>
        </div>
      </div>

      <aside className="lg:col-span-5 flex flex-col gap-6">
        <WeatherWidget weather={weather} location={location} />

        <div className="flex-1 glass rounded-[40px] p-8 flex flex-col justify-between shadow-xl border-white/60 bg-white/30">
          <div className="space-y-8">
            <div className="relative">
              <h4 className="text-[11px] uppercase tracking-[0.2em] font-black opacity-30 mb-3 underline decoration-primary/20 underline-offset-8">Uzman Tavsiyesi</h4>
              {result ? (
                <motion.p 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="serif text-2xl leading-tight text-primary font-semibold"
                >
                  {result.proactiveAdvice}
                </motion.p>
              ) : (
                <p className="serif text-xl opacity-40 italic font-light">Taramadan sonra uzman önerileri burada görünecektir.</p>
              )}
            </div>

            {result && (
              <div className="space-y-4">
                <h5 className="text-[10px] uppercase font-bold opacity-40">Uygulama Adımları</h5>
                <ul className="space-y-5">
                  {result.steps.map((step: string, i: number) => (
                    <motion.li 
                      key={i}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.12 }}
                      className="flex items-start gap-4 text-sm font-medium"
                    >
                      <span className="mono text-primary font-black text-xl leading-none pt-0.5">0{i+1}</span>
                      <span className="leading-snug opacity-80">{step}</span>
                    </motion.li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="mt-10 flex flex-col gap-3">
            <button 
              onClick={handleSave}
              disabled={!result || !user || saving}
              className="w-full bg-primary text-white py-5 rounded-full font-bold text-sm hover:opacity-90 active:scale-95 flex items-center justify-center gap-3 disabled:opacity-30 disabled:grayscale transition-all shadow-xl shadow-primary/20"
            >
              {saving ? <Loader2 className="animate-spin" size={18} /> : (
                <>Analiz Raporunu Buluta Kaydet <ChevronRight size={18} /></>
              )}
            </button>
            {!user && result && (
              <p className="text-[10px] text-center font-bold text-amber-700 bg-amber-50 py-2 rounded-full">Kayıt için giriş yapmalısınız.</p>
            )}
          </div>
        </div>
      </aside>
    </motion.div>
  );
}

function WeatherWidget({ weather, location }: { weather: any, location: LocationData }) {
  if (!weather) return (
    <div className="glass rounded-[40px] p-8 shadow-sm bg-white/50 animate-pulse h-[300px] flex items-center justify-center">
       <Loader2 className="animate-spin opacity-20" size={32} />
    </div>
  );

  const current = weather.current;
  const daily = weather.daily;

  // Simple risk calculation based on humidity and rain
  const humidityRisk = current.relative_humidity_2m > 80 ? 40 : 0;
  const rainRisk = [0, 1, 2, 3].some(i => daily.weather_code[i] >= 51) ? 45 : 0;
  const totalRisk = Math.min(95, humidityRisk + rainRisk + 5);

  const getWeatherDescription = (code: number) => {
    if (code === 0) return { label: 'Açık', icon: Sun };
    if (code <= 3) return { label: 'Parçalı Bulutlu', icon: Cloud };
    if (code <= 48) return { label: 'Sisli', icon: Cloud };
    if (code <= 67) return { label: 'Yağışlı', icon: CloudRain };
    if (code <= 77) return { label: 'Karlı', icon: CloudRain };
    if (code <= 82) return { label: 'Sağanak Yağış', icon: CloudRain };
    if (code <= 99) return { label: 'Fırtınalı', icon: CloudLightning };
    return { label: 'Bulutlu', icon: Cloud };
  };

  const currentDesc = getWeatherDescription(current.weather_code);

  const getDayName = (index: number) => {
    const dates = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
    const date = new Date();
    date.setDate(date.getDate() + index);
    const day = date.getDay();
    // JS getDay() is 0 for Sunday
    const days = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
    return days[day];
  };

  return (
    <div className="glass rounded-[40px] p-8 shadow-sm border-l-8 border-l-primary/30 bg-white/50 backdrop-blur-xl">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h3 className="serif text-3xl font-semibold -tracking-wide">Hava Durumu & Risk</h3>
          <p className="text-[10px] uppercase opacity-40 tracking-[.4em] font-black mt-2 flex items-center gap-2">
            <MapPin size={10} /> {location.name.toUpperCase()}
          </p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-3 justify-end">
            <currentDesc.icon className="text-primary" size={32} />
            <span className="text-5xl font-light scale-y-110">{Math.round(current.temperature_2m)}°C</span>
          </div>
          <p className="text-[11px] uppercase opacity-50 font-bold tracking-widest mt-1 mr-1 flex items-center justify-end gap-2">
             {currentDesc.label} / <Droplets size={12} className="text-blue-500" /> %{current.relative_humidity_2m}
          </p>
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => {
          const dayDesc = getWeatherDescription(daily.weather_code[i]);
          const isHighRisk = daily.weather_code[i] >= 51;
          
          return (
            <div key={i} className={cn(
              "p-4 rounded-3xl text-center transition-all duration-500",
              isHighRisk ? "bg-white shadow-xl border border-amber-200 scale-105" : "bg-black/5 hover:bg-black/10"
            )}>
              <p className="text-[10px] uppercase font-black opacity-30 mb-2">{getDayName(i)}</p>
              <dayDesc.icon className={cn("mx-auto mb-1", isHighRisk ? "text-amber-500" : "text-primary/40")} size={20} />
              <p className={cn("text-xl font-bold", isHighRisk && "text-amber-600")}>{Math.round(daily.temperature_2m_max[i])}°</p>
              <p className="text-[9px] mt-1 font-bold opacity-40 uppercase tracking-tighter">{dayDesc.label}</p>
            </div>
          );
        })}
      </div>
      
      {totalRisk > 30 && (
        <motion.div 
          animate={{ opacity: [0.6, 1, 0.6] }} 
          transition={{ repeat: Infinity, duration: 4 }}
          className={cn(
            "mt-6 text-[12px] font-bold p-4 rounded-2xl border flex gap-4",
            totalRisk > 60 ? "text-red-900 bg-red-500/10 border-red-500/30" : "text-amber-900 bg-amber-500/10 border-amber-500/30"
          )}
        >
          <div className="pt-1"><AlertTriangle size={18} className={totalRisk > 60 ? "text-red-600" : "text-amber-600"} /></div>
          <p className="leading-tight">
            {totalRisk > 60 
              ? `KRİTİK UYARI: Yüksek nem ve yağış beklentisiyle mantar yayılım riski %${totalRisk}'tir. Acil önlem alın.` 
              : `RİSK UYARISI: Nemli hava koşulları mantar oluşumu için elverişli. Takipte kalın.`}
          </p>
        </motion.div>
      )}
    </div>
  );
}

function LocationSearchModal({ onClose, onSelect }: { onClose: () => void, onSelect: (loc: LocationData) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const search = async () => {
    if (!query) return;
    setLoading(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=5`);
      const data = await res.json();
      setResults(data);
    } catch (e: any) {
      console.error("Location search error:", e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const useCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const { latitude, longitude } = pos.coords;
        onSelect({ lat: latitude, lon: longitude, name: 'Geçerli Konum' });
      });
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
        onClick={onClose} 
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative bg-[#f5f5f0] w-full max-w-md rounded-[48px] p-8 shadow-2xl border border-white/20"
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="serif text-2xl font-bold">Konum Değiştir</h3>
          <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-full"><X size={20} /></button>
        </div>

        <div className="space-y-4">
          <div className="relative">
            <input 
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search()}
              placeholder="Şehir veya ilçe ara..."
              className="w-full bg-white px-6 py-4 rounded-3xl outline-none pr-12 font-medium"
            />
            <button onClick={search} className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-primary">
              {loading ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
            </button>
          </div>

          <button 
            onClick={useCurrentLocation}
            className="w-full flex items-center justify-center gap-3 py-4 rounded-3xl bg-white/50 border border-black/5 font-bold text-xs uppercase tracking-widest hover:bg-white transition-all"
          >
            <Navigation size={14} className="text-primary" /> Mevcut Konumumu Kullan
          </button>

          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
            {results.map((res, i) => (
              <button 
                key={i}
                onClick={() => onSelect({ 
                  lat: parseFloat(res.lat), 
                  lon: parseFloat(res.lon), 
                  name: res.display_name.split(',')[0] + (res.display_name.split(',')[1] ? `, ${res.display_name.split(',')[1]}` : '') 
                })}
                className="w-full text-left p-4 rounded-2xl hover:bg-white transition-all border border-transparent hover:border-black/5"
              >
                <p className="text-sm font-bold">{res.display_name.split(',')[0]}</p>
                <p className="text-[10px] opacity-40 truncate">{res.display_name}</p>
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// --- Forum Section ---
function ForumSection({ user, onLogin }: { user: any, onLogin: () => void }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('Genel');
  const [crop, setCrop] = useState('Diğer');

  useEffect(() => {
    return subscribeToPosts((data) => {
      setPosts(data);
      setLoading(false);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return onLogin();
    if (!title || !content) return;

    await createPost({
      title,
      content,
      authorId: user.uid,
      authorName: user.displayName || 'Anonim Üretici',
      category,
      crop,
    });
    setTitle('');
    setContent('');
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="grid grid-cols-1 lg:grid-cols-12 gap-10"
    >
      <aside className="lg:col-span-3 flex flex-col gap-6">
        <div>
          <h3 className="serif text-3xl font-semibold mb-6 flex items-center gap-2">
            <span className="w-8 h-[2px] bg-primary/30" /> Kategoriler
          </h3>
          <div className="flex flex-col gap-2">
            {['Hepsi', 'Hastalık', 'Gübreleme', 'Hasat', 'Genel'].map(cat => (
              <button key={cat} className="text-left px-5 py-3 rounded-2xl hover:bg-primary/5 transition-all text-sm font-bold opacity-60 hover:opacity-100 flex justify-between items-center group">
                {cat}
                <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
              </button>
            ))}
          </div>
        </div>
        
        <div className="mt-8 glass p-8 rounded-[40px] bg-primary/5 border-primary/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-12 -mt-12" />
          <h4 className="text-[10px] font-black uppercase opacity-30 tracking-[.3em] mb-3">Ziraat Mühendisi Notu</h4>
          <p className="text-sm leading-relaxed italic serif text-primary/80">"Bitki beslemede azotlu gübrelerin aşırı ve zamansız kullanımı, yaprak dokusunu yumuşatarak mantar hastalıklarına kapı aralar. Analizsiz gübrelemeyin."</p>
          <div className="flex items-center gap-3 mt-4">
             <div className="w-8 h-8 rounded-full bg-primary/20" />
             <p className="text-[10px] font-black uppercase tracking-widest">— Selim Bayraktar</p>
          </div>
        </div>
      </aside>

      <div className="lg:col-span-9 flex flex-col gap-8">
        {/* Post Creation */}
        <div className={cn(
          "bg-white p-8 rounded-[40px] shadow-sm border border-black/5 transition-all",
          !user && "opacity-60 pointer-events-none grayscale"
        )}>
           <h4 className="serif text-2xl font-bold mb-6">Topluluğa Katıl</h4>
           <form onSubmit={handleSubmit} className="space-y-4">
              <input 
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Başlık (örn: Fındıkta uç kurusu sorunu)"
                className="w-full bg-neutral-50 px-6 py-4 rounded-2xl border-none outline-none font-semibold text-lg"
              />
              <textarea 
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Gözlemlerini veya sorunu burada detaylandır..."
                rows={3}
                className="w-full bg-neutral-50 px-6 py-4 rounded-2xl border-none outline-none font-medium resize-none"
              />
              <div className="flex flex-wrap gap-4 items-center justify-between">
                <div className="flex gap-3">
                  <select 
                    value={category} 
                    onChange={e => setCategory(e.target.value)}
                    className="bg-neutral-50 px-4 py-2 rounded-xl text-xs font-bold border-none outline-none"
                  >
                    <option>Genel</option>
                    <option>Hastalık</option>
                    <option>Gübreleme</option>
                  </select>
                  <select 
                    value={crop} 
                    onChange={e => setCrop(e.target.value)}
                    className="bg-neutral-50 px-4 py-2 rounded-xl text-xs font-bold border-none outline-none"
                  >
                    <option>Fındık</option>
                    <option>Çay</option>
                    <option>Diğer</option>
                  </select>
                </div>
                <button type="submit" className="bg-primary text-white px-10 py-3 rounded-full font-black text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-primary/20">
                  PAYLAŞ
                </button>
              </div>
           </form>
           {!user && (
             <div className="absolute inset-0 flex items-center justify-center p-8 text-center bg-white/10 backdrop-blur-sm rounded-[40px]">
               <button onClick={onLogin} className="bg-primary text-white px-8 py-4 rounded-full font-bold shadow-2xl">Katılmak İçin Giriş Yapın</button>
             </div>
           )}
        </div>

        {/* Posts List */}
        <div className="space-y-6">
          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary-40" /></div>
          ) : posts.map(post => (
            <motion.div 
              key={post.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="group bg-white p-8 rounded-[48px] shadow-sm border border-black/5 hover:shadow-xl hover:-translate-y-1 transition-all duration-500"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="space-y-2">
                   <div className="flex gap-3 items-center">
                     <span className="text-[10px] font-black uppercase text-amber-700 bg-amber-50 px-4 py-1.5 rounded-full leading-none tracking-widest">{post.category}</span>
                     <span className="text-[10px] font-black uppercase text-primary bg-primary/5 px-4 py-1.5 rounded-full leading-none tracking-widest">{post.crop}</span>
                   </div>
                   <h4 className="serif text-2xl font-bold text-[#1a1a1a] group-hover:text-primary transition-colors">{post.title}</h4>
                </div>
                <span className="text-[10px] opacity-30 font-bold uppercase tracking-widest mt-2">{post.createdAt?.toDate().toLocaleDateString('tr-TR')}</span>
              </div>
              
              <p className="text-sm opacity-70 leading-relaxed font-medium mb-6">{post.content}</p>
              
              <div className="flex justify-between items-center pt-6 border-t border-black/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-neutral-100 border border-black/5 flex items-center justify-center text-black/20 font-bold">
                    {post.authorName[0]}
                  </div>
                  <span className="text-xs font-black uppercase tracking-wider">{post.authorName}</span>
                </div>
                <div className="flex items-center gap-6">
                   <button onClick={() => post.id && likePost(post.id)} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.2em] text-primary hover:scale-110 transition-transform">
                     {post.likesCount} BEĞENİ
                   </button>
                </div>
              </div>

              <CommentSection postId={post.id!} user={user} authorName={user?.displayName || 'Misafir'} />
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function CommentSection({ postId, user, authorName }: { postId: string, user: any, authorName: string }) {
  const [comments, setComments] = useState<ForumComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [showComments, setShowComments] = useState(false);

  useEffect(() => {
    if (showComments) {
      return subscribeToComments(postId, setComments);
    }
  }, [postId, showComments]);

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    try {
      await addComment(postId, newComment, authorName);
      setNewComment('');
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="mt-6 border-t border-black/5 pt-4">
      <button 
        onClick={() => setShowComments(!showComments)}
        className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.2em] opacity-30 py-2 px-6 bg-black/5 rounded-full hover:opacity-100 transition-all mb-4"
      >
        <MessageSquare size={12} /> {showComments ? 'Yorumları Gizle' : 'Yorumlar'}
      </button>

      {showComments && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="space-y-3 pl-4 border-l-2 border-primary/10">
            {comments.map((c, i) => (
              <div key={i} className="bg-neutral-50/50 p-4 rounded-3xl">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-60">{c.authorName}</span>
                  <span className="text-[10px] opacity-30">{c.createdAt?.toDate().toLocaleDateString('tr-TR')}</span>
                </div>
                <p className="text-xs font-medium opacity-80">{c.content}</p>
              </div>
            ))}
          </div>

          {user ? (
            <form onSubmit={handleCommentSubmit} className="flex gap-2 pl-4">
              <input 
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                placeholder="Bir cevap yaz..."
                className="flex-1 bg-neutral-50 px-4 py-2 rounded-xl text-xs outline-none focus:ring-1 focus:ring-primary/20"
              />
              <button className="bg-primary text-white p-2 rounded-xl hover:scale-105 transition-transform">
                <Send size={14} />
              </button>
            </form>
          ) : (
            <p className="text-[10px] opacity-40 italic pl-4">Yorum yapmak için giriş yapmalısınız.</p>
          )}
        </div>
      )}
    </div>
  );
}

// --- Dashboard Component ---
function ProfessionalDashboard({ user, weather, location, onNavigate }: { user: any, weather: any, location: LocationData, onNavigate: (tab: Tab) => void }) {
  const [userScans, setUserScans] = useState<ScanResult[]>([]);
  const [globalTrends, setGlobalTrends] = useState<ScanResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubUser = () => {};
    let unsubGlobal = subscribeToGlobalScans(setGlobalTrends);

    if (user) {
      unsubUser = subscribeToUserScans(user.uid, (scans) => {
        setUserScans(scans);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }

    return () => {
      unsubUser();
      unsubGlobal();
    };
  }, [user]);

  // Transform global trends for chart
  const diseaseCounts = globalTrends.reduce((acc, scan) => {
    acc[scan.diseaseName] = (acc[scan.diseaseName] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const getSeasonStage = () => {
    const month = new Date().getMonth() + 1;
    if (month >= 3 && month <= 5) return { stage: 'Filizlenme & Çiçeklenme', icon: '🌱', advice: 'Azotlu gübreleme ve külleme takibi kritik.' };
    if (month >= 6 && month <= 7) return { stage: 'Meyve Gelişimi', icon: '🌰', advice: 'Fındık kurdu ve yeşil kokulu böcek sayımı yapın.' };
    if (month >= 8 && month <= 9) return { stage: 'Hasat Dönemi', icon: '🧺', advice: 'Hasat sonrası bahçe temizliği ve budama hazırlığı.' };
    return { stage: 'Kış Dinlenmesi', icon: '❄️', advice: 'Toprak analizi ve kışlık bakım için uygun zaman.' };
  };

  const season = getSeasonStage();
  const chartData = Object.entries(diseaseCounts).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 5);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="space-y-8"
    >
      {/* Seasonal Alert */}
      <div className="bg-white/80 border border-primary/20 p-4 rounded-[32px] flex items-center gap-6 shadow-sm overflow-hidden relative">
         <div className="text-4xl">{season.icon}</div>
         <div className="flex-1">
           <div className="flex items-center gap-3">
             <h4 className="text-[10px] font-black uppercase tracking-[.2em] text-primary">Mevcut Sezon: {season.stage}</h4>
             <span className="h-[1px] flex-1 bg-primary/10" />
           </div>
           <p className="text-xs font-bold opacity-70 mt-1">{season.advice}</p>
         </div>
         <div className="absolute top-0 right-0 h-full w-24 bg-primary/5 -skew-x-12 translate-x-12" />
      </div>

      {/* Hero Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="glass rounded-[40px] p-8 bg-primary/5 border-primary/10">
          <p className="text-[10px] uppercase font-black opacity-30 tracking-widest mb-4">Mevcut Durum</p>
          <div className="flex items-end gap-2">
            <span className="text-4xl font-bold tracking-tighter">İyi</span>
            <CheckCircle2 className="text-primary mb-1" size={24} />
          </div>
          <p className="text-xs font-semibold opacity-40 mt-2">Bölgesel risk düzeyi düşük</p>
        </div>
        
        <div className="glass rounded-[40px] p-8 bg-white/40">
          <p className="text-[10px] uppercase font-black opacity-30 tracking-widest mb-4">Sıcaklık</p>
          <div className="flex items-end gap-2">
            <span className="text-4xl font-bold tracking-tighter">{weather ? Math.round(weather.current.temperature_2m) : '--'}°C</span>
            <Sun className="text-amber-500 mb-1" size={24} />
          </div>
          <p className="text-xs font-semibold opacity-40 mt-2">{location.name.split(',')[0]}</p>
        </div>

        <div className="glass rounded-[40px] p-8 bg-white/40">
          <p className="text-[10px] uppercase font-black opacity-30 tracking-widest mb-4">Analizlerin</p>
          <div className="flex items-end gap-2">
            <span className="text-4xl font-bold tracking-tighter">{userScans.length}</span>
            <Camera className="text-primary/40 mb-1" size={24} />
          </div>
          <p className="text-xs font-semibold opacity-40 mt-2">Toplam kayıtlı tarama</p>
        </div>

        <div className="glass rounded-[40px] p-8 bg-white/40">
          <p className="text-[10px] uppercase font-black opacity-30 tracking-widest mb-4">Topluluk</p>
          <div className="flex items-end gap-2">
            <span className="text-4xl font-bold tracking-tighter">{globalTrends.length}</span>
            <MessageSquare className="text-primary/40 mb-1" size={24} />
          </div>
          <p className="text-xs font-semibold opacity-40 mt-2">Bölgesel aktif bildirim</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main Analytics Card */}
        <div className="lg:col-span-8 glass rounded-[48px] p-10 bg-white/50 border-white/60 shadow-xl overflow-hidden relative">
          <div className="absolute top-0 right-0 p-10 opacity-5">
             <Wind size={120} strokeWidth={1} />
          </div>
          
          <div className="flex justify-between items-start mb-10">
            <div>
              <h3 className="serif text-3xl font-bold italic mb-2 text-primary">Bölgesel Hastalık Dağılımı</h3>
              <p className="text-sm font-semibold opacity-40">Karadeniz geneli anonimleştirilmiş tarama verileri</p>
            </div>
            <div className="flex gap-2">
              <button className="bg-primary/5 text-primary px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest">Haftalık</button>
            </div>
          </div>

          <div className="h-[300px] w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} dy={10} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', fontFamily: 'Inter' }}
                    itemStyle={{ fontSize: '12px', fontWeight: '800', color: '#2d5a27' }}
                  />
                  <Bar dataKey="value" fill="#2d5a27" radius={[10, 10, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-black/20 italic font-medium">Yeterli veri toplanıyor...</div>
            )}
          </div>
        </div>

        {/* Side Actions */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="glass rounded-[40px] p-8 border-l-8 border-l-primary bg-primary/5">
             <h4 className="serif text-xl font-bold mb-4">Günün Önerisi</h4>
             <p className="text-sm leading-relaxed font-medium opacity-70 mb-6">"Hava analizi fındık küllemesi için riskli bir periyoda girdiğimizi gösteriyor. Yapraklar henüz nemliyken koruyucu uygulamaları değerlendirin."</p>
             <button onClick={() => onNavigate('analyze')} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.3em] text-primary hover:gap-4 transition-all">
               HEMEN ANALİZ YAP <ChevronRight size={14} />
             </button>
          </div>

          <div className="flex-1 glass rounded-[40px] p-8 bg-white/40 border-white/60">
            <h4 className="text-[10px] uppercase font-black opacity-30 tracking-widest mb-6 underline decoration-primary/20 underline-offset-4">Son Analizlerin</h4>
            <div className="space-y-4">
              {userScans.length > 0 ? userScans.slice(0, 3).map((scan, i) => (
                <div key={i} className="flex gap-4 items-center p-3 rounded-3xl hover:bg-white transition-all group">
                   <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-sm">
                     <img src={scan.imageUrl} className="w-full h-full object-cover" />
                   </div>
                   <div className="flex-1">
                     <p className="text-xs font-black truncate">{scan.diseaseName}</p>
                     <p className="text-[10px] opacity-40 font-bold">{scan.timestamp?.toDate().toLocaleDateString('tr-TR')}</p>
                   </div>
                   <div className={cn("w-2 h-2 rounded-full", scan.severity > 3 ? "bg-red-500" : "bg-green-500")} />
                </div>
              )) : (
                <div className="text-center py-10 opacity-30 italic text-xs">Henüz kayıtlı analiz bulunmuyor.</div>
              )}
              {userScans.length > 3 && (
                <button className="w-full text-center text-[10px] font-black uppercase tracking-widest opacity-40 hover:opacity-100 py-2">TÜMÜNÜ GÖR</button>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// --- Library Section ---
function DiseaseLibrary() {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-5xl mx-auto space-y-16"
    >
      <div className="text-center space-y-4 max-w-2xl mx-auto">
        <h2 className="serif text-5xl font-semibold italic text-primary">Bilgi Kütüphanesi</h2>
        <p className="text-sm font-medium opacity-50 uppercase tracking-widest leading-loose">Karadeniz florası, hastalıklar ve modern tarım teknikleri üzerine kapsamlı rehber.</p>
        <div className="h-1 w-24 bg-primary/20 mx-auto rounded-full" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {DISEASES_DB.map((d, i) => (
          <motion.div 
            key={i} 
            whileHover={{ y: -8 }}
            className="group glass rounded-[48px] p-8 border border-white/40 shadow-xl flex flex-col gap-8 bg-white/20 transition-all duration-500 overflow-hidden relative"
          >
            <div className="absolute top-0 right-0 p-8 transform translate-x-4 -translate-y-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <BookOpen size={120} />
            </div>
            
            <div className="space-y-4 relative">
              <span className="text-[10px] font-black uppercase tracking-[.3em] text-primary opacity-40">{d.crop}</span>
              <h3 className="serif text-3xl font-bold leading-tight -mt-2">{d.name}</h3>
            </div>
            
            <div className="space-y-6 flex-1 relative">
              <div className="space-y-2">
                <h5 className="text-[10px] uppercase font-black text-amber-700 opacity-40 tracking-widest">Belirtiler</h5>
                <p className="text-xs font-semibold leading-relaxed italic">{d.symptoms}</p>
              </div>
              <div className="space-y-2">
                <h5 className="text-[10px] uppercase font-black text-primary opacity-40 tracking-widest">Nedenler</h5>
                <p className="text-xs font-bold leading-relaxed">{d.cause}</p>
              </div>
              <div className="p-6 bg-primary/5 rounded-[32px] border border-primary/10 group-hover:bg-primary/10 transition-colors space-y-4">
                <div>
                  <h5 className="text-[10px] uppercase font-black text-primary mb-2">Çözüm Rehberi</h5>
                  <p className="text-xs font-black mb-1">{d.prevention}</p>
                  <p className="text-[11px] opacity-70 leading-relaxed font-medium">{d.treatment}</p>
                </div>
                {(d as any).safety && (
                  <div className="pt-2 border-t border-primary/10">
                    <h5 className="text-[10px] uppercase font-black text-amber-600 mb-1">Güvenlik ve Çevre</h5>
                    <p className="text-[10px] font-medium opacity-70 leading-tight">{(d as any).safety}</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="bg-white/40 backdrop-blur-xl p-12 rounded-[64px] flex flex-col md:flex-row items-center gap-12 border border-white/60 shadow-inner">
        <div className="flex-1 space-y-6">
          <h4 className="serif text-4xl font-bold italic leading-tight text-primary">Teşhis Koyamadınız mı?</h4>
          <p className="text-sm font-medium opacity-60 leading-relaxed max-w-lg">Yapay zeka analizimiz ve uzman topluluğumuzla yanınızdayız. Bir fotoğraf yükleyin veya forumda paylaşın.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
           <button className="bg-primary text-white px-10 py-5 rounded-full font-black text-xs uppercase tracking-[.3em] shadow-2xl shadow-primary/30 hover:scale-105 active:scale-95 transition-all">Analiz Yap</button>
           <button className="bg-white px-10 py-5 rounded-full font-black text-xs uppercase tracking-[.3em] border border-black/10 hover:bg-black/5 transition-all">Soru Sor</button>
        </div>
      </div>
    </motion.div>
  );
}
