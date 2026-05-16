import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';

interface Experience {
  id: number;
  category: 'Aventura' | 'Relax' | 'Logística';
  title: string;
  description: string;
  gallery: string[];
  duration: string;
  points: number;
  themeColor: string;
}

const experiences: Experience[] = [
  {
    id: 1,
    category: 'Aventura',
    title: 'Cabalgata a la Laguna de Mucubají',
    description: 'Recorra el páramo andino a lomo de caballo entre frailejones y flores silvestres hasta la espectacular Laguna de Mucubají, a más de 3.500 m de altitud.',
    gallery: [
      '/assets/excursiones/caballos/laguna.png',
      '/assets/excursiones/caballos/panoramica.png',
      '/assets/excursiones/caballos/paramo-laguna.png',
      '/assets/excursiones/caballos/grupo-frailejones.png',
      '/assets/excursiones/caballos/frailejones.png',
      '/assets/excursiones/caballos/jinete.png',
    ],
    duration: '4h - 5h',
    points: 200,
    themeColor: 'bg-brand-wood'
  },
  {
    id: 2,
    category: 'Aventura',
    title: 'Rutas de Adrenalina en Quads',
    description: 'Sienta la potencia y el polvo en nuestros circuitos off-road diseñados para los más audaces.',
    gallery: ['/assets/quads.png'],
    duration: '1h 45m',
    points: 200,
    themeColor: 'bg-brand-terracotta'
  },
  {
    id: 3,
    category: 'Relax',
    title: 'Masajes Terapéuticos',
    description: 'Sesiones profesionales de masaje en la comodidad del hotel. Nuestras terapeutas certificadas utilizan técnicas de relajación y descontractura para renovar cuerpo y mente.',
    gallery: [
      '/assets/excursiones/masajes/terapeuta.png',
      '/assets/excursiones/masajes/sesion-1.png',
      '/assets/excursiones/masajes/sesion-2.png',
    ],
    duration: '60m',
    points: 120,
    themeColor: 'bg-brand-olive'
  },
  {
    id: 4,
    category: 'Logística',
    title: 'Transporte Privado Premium',
    description: 'Traslados exclusivos desde y hacia el aeropuerto en vehículos de alta gama con chofer bilingüe.',
    gallery: ['https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?q=80&w=2069&auto=format&fit=crop'],
    duration: 'A pedido',
    points: 80,
    themeColor: 'bg-brand-primary'
  }
];

const ExcursionCard: React.FC<{ exp: Experience }> = ({ exp }) => {
  const [imgIndex, setImgIndex] = useState(0);
  const total = exp.gallery.length;

  const next = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImgIndex(i => (i + 1) % total);
  };
  const prev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImgIndex(i => (i - 1 + total) % total);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="group bg-white rounded-[2rem] overflow-hidden shadow-xl shadow-black/5 flex flex-col"
    >
      {/* Image / Gallery */}
      <div className="relative h-64 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.img
            key={imgIndex}
            src={exp.gallery[imgIndex]}
            alt={exp.title}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="w-full h-full object-cover"
          />
        </AnimatePresence>

        {/* Nav arrows — solo si hay más de 1 */}
        {total > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center text-white active:scale-90 transition-all"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={next}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center text-white active:scale-90 transition-all"
            >
              <ChevronRight size={16} />
            </button>

            {/* Dots */}
            <div className="absolute bottom-10 left-0 w-full flex justify-center gap-1.5 z-20">
              {exp.gallery.map((_, i) => (
                <button
                  key={i}
                  onClick={e => { e.stopPropagation(); setImgIndex(i); }}
                  className={`h-1.5 rounded-full transition-all ${i === imgIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/50'}`}
                />
              ))}
            </div>

            {/* Counter */}
            <div className="absolute top-4 left-4 bg-black/40 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-full z-20">
              {imgIndex + 1} / {total}
            </div>
          </>
        )}

        {/* Points badge */}
        <div className="absolute top-4 right-4 z-10 bg-brand-accent/90 backdrop-blur-md text-white text-[9px] uppercase tracking-widest font-bold py-1.5 px-3 rounded-full">
          +{exp.points} pts
        </div>

        {/* Category badge */}
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

        <h3 className="text-xl font-serif text-brand-wood mb-3">{exp.title}</h3>
        <p className="text-brand-primary/60 text-xs leading-relaxed mb-6">{exp.description}</p>

        <button className="w-full bg-brand-neutral hover:bg-brand-primary hover:text-white text-brand-primary font-bold py-3 rounded-xl transition-all text-sm">
          Reservar Experiencia
        </button>
      </div>
    </motion.div>
  );
};

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

      {/* Cards */}
      <div className="px-6">
        <motion.div layout className="flex flex-col gap-8">
          <AnimatePresence mode="popLayout">
            {filteredExperiences.map((exp) => (
              <ExcursionCard key={exp.id} exp={exp} />
            ))}
          </AnimatePresence>
        </motion.div>
      </div>

      {filter === 'Relax' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-brand-olive/5 -z-10 pointer-events-none" />
      )}
      {filter === 'Aventura' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-brand-terracotta/5 -z-10 pointer-events-none" />
      )}
    </div>
  );
};

export default Excursions;
