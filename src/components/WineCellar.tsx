import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wine, ChevronRight, ChevronLeft, Droplets, Gauge, Thermometer, Utensils } from 'lucide-react';

interface WineType {
  id: number;
  name: string;
  winery: string;
  type: string;
  year: string;
  notes: {
    nose: string;
    body: string;
    finish: string;
  };
  pairing: string;
  stats: {
    body: number; // 1-5
    tannins: number;
    acidity: number;
  };
}

const wines: WineType[] = [
  {
    id: 1,
    name: "Gran Reserva Malbec",
    winery: "Bodega de la Pampa",
    type: "Tinto",
    year: "2019",
    notes: {
      nose: "Frutos rojos maduros, ciruela y toques de vainilla.",
      body: "Estructurado, con taninos firmes y elegantes.",
      finish: "Largo, persistente con notas de chocolate amargo."
    },
    pairing: "Ojo de Bife 'La Cañada' o Cordero Patagónico.",
    stats: { body: 5, tannins: 4, acidity: 3 }
  },
  {
    id: 2,
    name: "Altos del Valle Chardonnay",
    winery: "Viñedos del Saliente",
    type: "Blanco",
    year: "2021",
    notes: {
      nose: "Manzana verde, cítricos y un leve matiz mineral.",
      body: "Fresco, equilibrado y untuoso en paladar.",
      finish: "Limpio, con una acidez vibrante."
    },
    pairing: "Burrata y Tomates Ahumados o Risotto de Hongos.",
    stats: { body: 3, tannins: 1, acidity: 5 }
  },
  {
    id: 3,
    name: "Pinot Noir Selección",
    winery: "Valle Escondido",
    type: "Tinto",
    year: "2022",
    notes: {
      nose: "Cerezas, frambuesas y notas terrosas sutiles.",
      body: "Ligero, sedoso y muy aromático.",
      finish: "Delicado, con un final refrescante."
    },
    pairing: "Mollejas al Verdeo o Empanada de la Estancia.",
    stats: { body: 2, tannins: 2, acidity: 4 }
  }
];

const WineCellar: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [activeIndex, setActiveIndex] = useState(0);

  const nextWine = () => setActiveIndex((prev) => (prev + 1) % wines.length);
  const prevWine = () => setActiveIndex((prev) => (prev - 1 + wines.length) % wines.length);

  const activeWine = wines[activeIndex];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen bg-brand-wood text-brand-neutral pb-32"
    >
      {/* Visual Header */}
      <div className="relative h-[450px] w-full bg-brand-wood overflow-hidden">
        <div className="absolute inset-0 opacity-30 mix-blend-overlay">
          <div className="w-full h-full bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]" />
        </div>
        
        <button 
          onClick={onBack}
          className="absolute top-6 left-6 z-30 flex items-center gap-2 text-white/70 hover:text-white transition-colors"
        >
          <div className="p-2 bg-black/20 backdrop-blur-md rounded-full border border-white/10">
            <ChevronLeft size={20} />
          </div>
        </button>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeWine.id}
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.1, y: -20 }}
            transition={{ duration: 0.6, ease: "circOut" }}
            className="absolute inset-0 flex items-center justify-center p-12"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-brand-accent/10 blur-[100px] rounded-full scale-150" />
              <img 
                src="/assets/wine_bottle.png" 
                alt={activeWine.name}
                className="h-[350px] object-contain relative z-10 drop-shadow-2xl"
              />
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Navigation Arrows */}
        <div className="absolute bottom-6 left-0 w-full flex justify-between px-10 items-center z-30">
          <button onClick={prevWine} className="p-3 rounded-full bg-white/5 border border-white/10 active:scale-90 transition-all">
            <ChevronLeft size={20} />
          </button>
          <div className="flex gap-2">
            {wines.map((_, i) => (
              <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i === activeIndex ? 'bg-brand-accent w-4' : 'bg-white/20'}`} />
            ))}
          </div>
          <button onClick={nextWine} className="p-3 rounded-full bg-white/5 border border-white/10 active:scale-90 transition-all">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Information Content */}
      <div className="px-6 py-10 space-y-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeWine.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-3 mb-4">
              <Wine className="text-brand-accent" size={20} />
              <span className="text-brand-accent text-[10px] uppercase tracking-[0.4em] font-bold">{activeWine.type} / {activeWine.year}</span>
            </div>
            
            <h2 className="text-4xl font-serif mb-1">{activeWine.name}</h2>
            <h3 className="text-lg text-white/40 font-serif italic mb-8">{activeWine.winery}</h3>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 gap-4 mb-10">
              <StatBar label="Cuerpo" value={activeWine.stats.body} icon={<Droplets size={12} />} />
              <StatBar label="Taninos" value={activeWine.stats.tannins} icon={<Gauge size={12} />} />
              <StatBar label="Acidez" value={activeWine.stats.acidity} icon={<Thermometer size={12} />} />
            </div>

            {/* Tasting Notes */}
            <div className="space-y-10 mb-10">
              <div className="p-6 bg-white/5 rounded-3xl border border-white/5">
                <h4 className="text-[10px] uppercase tracking-widest text-brand-accent mb-4 font-bold">Notas de Cata</h4>
                <div className="space-y-6">
                  <p className="text-base text-white/80 leading-relaxed"><span className="text-white font-bold">Nariz:</span> {activeWine.notes.nose}</p>
                  <p className="text-base text-white/80 leading-relaxed"><span className="text-white font-bold">Boca:</span> {activeWine.notes.body}</p>
                </div>
              </div>

              {/* Pairing */}
              <div className="p-6 bg-brand-accent/10 rounded-3xl border border-brand-accent/20 flex items-start gap-4">
                <div className="w-10 h-10 bg-brand-accent rounded-xl flex items-center justify-center text-brand-wood shrink-0">
                  <Utensils size={20} />
                </div>
                <div>
                  <h4 className="text-brand-accent text-[9px] uppercase tracking-widest mb-1 font-bold">Maridaje Sugerido</h4>
                  <p className="text-white/90 font-serif text-lg italic">
                    "Ideal para nuestro {activeWine.pairing}"
                  </p>
                </div>
              </div>
            </div>

            <button className="w-full bg-brand-accent text-brand-wood font-bold py-4 rounded-2xl transition-all active:scale-[0.98] text-base shadow-lg shadow-brand-accent/10">
              Solicitar este Vino
            </button>
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

function StatBar({ label, value, icon }: { label: string, value: number, icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 p-3">
      <div className="flex items-center gap-2 w-24 shrink-0 text-white/40">
        {icon}
        <span className="text-[9px] uppercase tracking-widest font-bold">{label}</span>
      </div>
      <div className="flex gap-1 flex-grow">
        {[1,2,3,4,5].map(s => (
          <div key={s} className={`h-1 flex-1 rounded-full ${s <= value ? 'bg-brand-accent' : 'bg-white/10'}`} />
        ))}
      </div>
    </div>
  )
}

export default WineCellar;
