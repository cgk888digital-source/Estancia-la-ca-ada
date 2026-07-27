import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Clock, X, CheckCircle2 } from 'lucide-react';

interface Experience {
  id: number;
  category: 'Aventura' | 'Relax' | 'Logística';
  title: string;
  description: string;
  gallery: string[];
  duration: string;
  points?: number;
  price?: string;
  themeColor: string;
}

const experiences: Experience[] = [
  {
    id: 1,
    category: 'Aventura',
    title: 'Excursión Laguna del Hoyo',
    description: 'Puede ser caminando o a caballo. Incluye picnic en la naturaleza.',
    gallery: [
      '/assets/excursiones/laguna-hoyo/1.jpg',
      '/assets/excursiones/laguna-hoyo/2.jpg',
      '/assets/excursiones/laguna-hoyo/3.jpg',
      '/assets/excursiones/laguna-hoyo/4.jpg',
    ],
    duration: 'Todo el día',
    points: 250,
    themeColor: 'bg-brand-wood'
  },
  {
    id: 2,
    category: 'Aventura',
    title: 'Excursión en Moto de 4 Ruedas (Quads)',
    description: 'Recorrido guiado en cuatrimoto de 4 ruedas por los caminos del páramo.',
    gallery: [
      '/assets/excursiones/quads/1.jpg',
      '/assets/excursiones/quads/2.jpg',
      '/assets/excursiones/quads/3.jpg',
    ],
    duration: '2 horas',
    points: 200,
    themeColor: 'bg-brand-terracotta'
  },
  {
    id: 3,
    category: 'Aventura',
    title: 'Paseo al Bosque de los Pinos',
    description: 'Caminata o paseo a caballo para el bosque de los pinos, saliendo directamente de la posada.',
    gallery: [
      '/assets/excursiones/bosque-pinos/1.jpg',
      '/assets/excursiones/bosque-pinos/2.jpg',
      '/assets/excursiones/bosque-pinos/3.jpg',
      '/assets/excursiones/bosque-pinos/4.jpg',
      '/assets/excursiones/bosque-pinos/5.jpg',
      '/assets/excursiones/bosque-pinos/6.jpg',
    ],
    duration: '3 km subiendo / 3 km bajando',
    points: 180,
    themeColor: 'bg-brand-wood'
  },
  {
    id: 7,
    category: 'Aventura',
    title: 'Vuelo en Parapente en las Aguas Termales',
    description: 'Disfrute de la maravillosa vista aérea volando en parapente sobre las Aguas Termales.',
    gallery: [
      '/assets/excursiones/parapente/1.jpg',
      '/assets/excursiones/parapente/2.jpg',
      '/assets/excursiones/parapente/3.jpg',
      '/assets/excursiones/parapente/4.jpg',
      '/assets/excursiones/parapente/5.jpg',
      '/assets/excursiones/parapente/6.jpg',
    ],
    duration: 'Vuelo guiado',
    points: 300,
    price: '€90',
    themeColor: 'bg-brand-terracotta'
  },
  {
    id: 8,
    category: 'Aventura',
    title: 'Tirolesa Las Termales',
    description: 'Recorrido de 420 metros de tirolesa pura adrenalina sobre el valle de Aguas Termales.',
    gallery: [
      '/assets/excursiones/tirolesa/1.jpg',
      '/assets/excursiones/tirolesa/2.jpg',
      '/assets/excursiones/tirolesa/3.jpg',
      '/assets/excursiones/tirolesa/4.jpg',
      '/assets/excursiones/tirolesa/5.jpg',
      '/assets/excursiones/tirolesa/6.jpg',
      '/assets/excursiones/tirolesa/7.jpg',
    ],
    duration: '420 mt',
    points: 150,
    price: '€15 pp',
    themeColor: 'bg-brand-terracotta'
  },
  {
    id: 4,
    category: 'Aventura',
    title: 'Recorrido en Bus Antiguo por el Pueblo',
    description: 'Un viaje en el tiempo a bordo de nuestro icónico bus antiguo recorriendo las calles del pueblo y paisajes coloniales.',
    gallery: [
      '/assets/excursiones/bus-pueblo-1.png',
      '/assets/excursiones/bus-pueblo-2.png',
      '/assets/excursiones/bus-pueblo-3.png',
    ],
    duration: '2h - 3h',
    points: 150,
    themeColor: 'bg-brand-terracotta'
  },
  {
    id: 5,
    category: 'Relax',
    title: 'Masajes Terapéuticos & Spa',
    description: 'Sesiones profesionales de masaje en la comodidad del hotel con terapeutas certificadas.',
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
    id: 6,
    category: 'Logística',
    title: 'Transporte Privado Premium',
    description: 'Traslados exclusivos desde y hacia el aeropuerto y puntos de interés.',
    gallery: [
      'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?q=80&w=2069&auto=format&fit=crop',
      '/assets/instalaciones/recepcion.png'
    ],
    duration: 'A pedido',
    points: 80,
    themeColor: 'bg-brand-primary'
  }
];

const ExcursionCard: React.FC<{ exp: Experience }> = ({ exp }) => {
  const [imgIndex, setImgIndex] = useState(0);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [bookingDate, setBookingDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [guests, setGuests] = useState(2);
  const [cabinOrRoom, setCabinOrRoom] = useState('');
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



        {/* Category badge & Price Tag */}
        <div className="absolute bottom-4 left-4 right-4 z-10 flex items-center justify-between pointer-events-none">
          <span className={`px-3 py-1 rounded-full text-[9px] uppercase tracking-widest font-bold text-white shadow-md ${exp.themeColor}`}>
            {exp.category}
          </span>
          {exp.price && (
            <span className="px-3 py-1 rounded-full text-xs font-bold text-white bg-black/70 backdrop-blur-md border border-white/20 shadow-md">
              {exp.price}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-6 flex flex-col">
        <div className="flex items-center justify-between text-brand-primary/40 text-[10px] mb-3 font-bold uppercase tracking-widest">
          <div className="flex items-center gap-1">
            <Clock size={12} /> {exp.duration}
          </div>
        </div>

        <h3 className="text-xl font-serif text-brand-wood mb-3">{exp.title}</h3>
        <p className="text-brand-primary/60 text-xs leading-relaxed mb-6">{exp.description}</p>

        <button 
          onClick={() => setIsBookingModalOpen(true)}
          className="w-full bg-brand-neutral hover:bg-brand-primary hover:text-white text-brand-primary font-bold py-3 rounded-xl transition-all text-sm shadow-sm flex items-center justify-center gap-2"
        >
          <span>Reservar Experiencia</span>
        </button>
      </div>

      {/* Booking Modal */}
      <AnimatePresence>
        {isBookingModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl p-6 relative flex flex-col gap-4 text-brand-primary"
            >
              <button
                onClick={() => { setIsBookingModalOpen(false); setIsSuccess(false); }}
                className="absolute top-4 right-4 p-2 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
              >
                <X size={18} />
              </button>

              {!isSuccess ? (
                <>
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-2xl text-white ${exp.themeColor}`}>
                      <Clock size={20} />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-brand-terracotta">Reserva de Experiencia</span>
                      <h4 className="text-lg font-serif font-bold text-brand-wood">{exp.title}</h4>
                    </div>
                  </div>

                  <div className="bg-brand-neutral/60 p-3 rounded-xl text-xs flex items-center justify-between text-brand-primary/70">
                    <span>Duración estimada: <strong>{exp.duration}</strong></span>
                    {exp.price && <span>Precio: <strong className="text-brand-wood">{exp.price}</strong></span>}
                  </div>

                  <div className="space-y-3 mt-2">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-brand-primary/60 mb-1">Fecha deseada</label>
                      <input 
                        type="date" 
                        value={bookingDate} 
                        onChange={(e) => setBookingDate(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-sans text-brand-primary focus:outline-none focus:border-brand-terracotta" 
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-brand-primary/60 mb-1">Cantidad de Personas</label>
                      <select 
                        value={guests} 
                        onChange={(e) => setGuests(Number(e.target.value))}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-sans text-brand-primary focus:outline-none focus:border-brand-terracotta"
                      >
                        {[1, 2, 3, 4, 5, 6, 8, 10].map(n => (
                          <option key={n} value={n}>{n} {n === 1 ? 'Persona' : 'Personas'}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-brand-primary/60 mb-1">Cabaña o Mesa (Opcional)</label>
                      <input 
                        type="text" 
                        placeholder="Ej. Cabaña Los Frailejones / Mesa 4"
                        value={cabinOrRoom}
                        onChange={(e) => setCabinOrRoom(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-sans text-brand-primary focus:outline-none focus:border-brand-terracotta" 
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => setIsSuccess(true)}
                    className="w-full bg-brand-terracotta hover:bg-brand-wood text-white font-bold py-3 rounded-xl transition-all text-xs tracking-wider uppercase mt-2 shadow-lg shadow-brand-terracotta/20"
                  >
                    Confirmar Solicitud
                  </button>
                </>
              ) : (
                <div className="py-6 flex flex-col items-center text-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                    <CheckCircle2 size={32} />
                  </div>
                  <h4 className="text-xl font-serif text-brand-wood font-bold">¡Solicitud Recibida!</h4>
                  <p className="text-xs text-brand-primary/70 max-w-xs">
                    Hemos registrado tu solicitud para <strong>{exp.title}</strong> para el <strong>{bookingDate}</strong> ({guests} {guests === 1 ? 'persona' : 'personas'}). Recepción confirmará tu turno en breve.
                  </p>
                  <button
                    onClick={() => { setIsBookingModalOpen(false); setIsSuccess(false); }}
                    className="mt-4 px-6 py-2.5 bg-brand-primary text-white text-xs font-bold rounded-xl uppercase tracking-wider"
                  >
                    Aceptar
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
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
          {(['Todas', 'Aventura', 'Relax', 'Logística'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
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
