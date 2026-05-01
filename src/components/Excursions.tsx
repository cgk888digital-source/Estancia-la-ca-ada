import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Clock } from 'lucide-react';

interface Experience {
  id: number;
  category: 'Aventura' | 'Relax' | 'Logística';
  title: string;
  description: string;
  image: string;
  duration: string;
  points: number;
  themeColor: string;
}

const experiences: Experience[] = [
  {
    id: 1,
    category: 'Aventura',
    title: 'Cabalgatas al Atardecer',
    description: 'Recorra los senderos históricos de la pampa a lomo de nuestros caballos criollos seleccionados.',
    image: '/assets/horse.png',
    duration: '2h 30m',
    points: 150,
    themeColor: 'bg-brand-wood'
  },
  {
    id: 2,
    category: 'Aventura',
    title: 'Rutas de Adrenalina en Quads',
    description: 'Sienta la potencia y el polvo en nuestros circuitos off-road diseñados para los más audaces.',
    image: '/assets/quads.png',
    duration: '1h 45m',
    points: 200,
    themeColor: 'bg-brand-terracotta'
  },
  {
    id: 3,
    category: 'Relax',
    title: 'Masajes bajo los Ombúes',
    description: 'Sesión terapéutica al aire libre con aceites esenciales de hierbas locales y el sonido de la naturaleza.',
    image: '/assets/massage.png',
    duration: '60m',
    points: 120,
    themeColor: 'bg-brand-olive'
  },
  {
    id: 4,
    category: 'Logística',
    title: 'Transporte Privado Premium',
    description: 'Traslados exclusivos desde y hacia el aeropuerto en vehículos de alta gama con chofer bilingüe.',
    image: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?q=80&w=2069&auto=format&fit=crop',
    duration: 'A pedido',
    points: 80,
    themeColor: 'bg-brand-primary'
  }
];

const Excursions: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [filter, setFilter] = useState<'Todas' | 'Aventura' | 'Relax' | 'Logística'>('Todas');

  const filteredExperiences = filter === 'Todas' 
    ? experiences 
    : experiences.filter(exp => exp.category === filter);

  return (
    <div className="min-h-screen bg-brand-neutral text-brand-primary font-sans pb-32">
      {/* Header */}
      <header className="px-6 py-10 flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 bg-white shadow-sm rounded-full transition-all active:scale-95"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <span className="text-brand-terracotta text-[10px] uppercase tracking-[0.4em] font-bold mb-1 block">La Cañada Lifestyle</span>
            <h1 className="text-3xl font-serif">Experiencias</h1>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-brand-primary/5 self-start overflow-x-auto custom-scrollbar max-w-full">
          {['Todas', 'Aventura', 'Relax', 'Logística'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={`px-4 py-2 rounded-xl text-[10px] uppercase tracking-widest font-bold transition-all whitespace-nowrap ${
                filter === f 
                  ? 'bg-brand-primary text-white shadow-lg' 
                  : 'text-brand-primary/60 hover:text-brand-primary'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </header>

      {/* Grid */}
      <div className="px-6">
        <motion.div 
          layout
          className="flex flex-col gap-8"
        >
          <AnimatePresence mode="popLayout">
            {filteredExperiences.map((exp) => (
              <motion.div
                key={exp.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="group bg-white rounded-[2rem] overflow-hidden shadow-xl shadow-black/5 flex flex-col"
              >
                {/* Image Container */}
                <div className="relative h-60 overflow-hidden">
                  <img 
                    src={exp.image} 
                    alt={exp.title} 
                    className="w-full h-full object-cover"
                  />
                  
                  {/* Loyalty Badge */}
                  <div className="absolute top-4 right-4 z-10">
                    <div className="bg-brand-accent/90 backdrop-blur-md text-white text-[9px] uppercase tracking-widest font-bold py-1.5 px-3 rounded-full">
                      +{exp.points} pts
                    </div>
                  </div>

                  <div className="absolute bottom-4 left-4 z-10">
                    <span className={`px-3 py-1 rounded-full text-[9px] uppercase tracking-widest font-bold text-white ${exp.themeColor}`}>
                      {exp.category}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6 flex flex-col">
                  <div className="flex items-center gap-3 text-brand-primary/40 text-[10px] mb-3 font-bold uppercase tracking-widest">
                    <div className="flex items-center gap-1">
                      <Clock size={12} /> {exp.duration}
                    </div>
                  </div>

                  <h3 className="text-xl font-serif text-brand-wood mb-3">
                    {exp.title}
                  </h3>
                  
                  <p className="text-brand-primary/60 text-xs leading-relaxed mb-6">
                    {exp.description}
                  </p>

                  <button className="w-full bg-brand-neutral hover:bg-brand-primary hover:text-white text-brand-primary font-bold py-3 rounded-xl transition-all text-sm">
                    Reservar Experiencia
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Special Zen Background for Relax filter */}
      {filter === 'Relax' && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 bg-brand-olive/5 -z-10 pointer-events-none"
        />
      )}
      
      {/* Special Dust Background for Aventura filter */}
      {filter === 'Aventura' && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 bg-brand-terracotta/5 -z-10 pointer-events-none"
        />
      )}
    </div>
  );
};

export default Excursions;
