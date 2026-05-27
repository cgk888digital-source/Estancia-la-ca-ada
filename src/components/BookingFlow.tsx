import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, X, Users, Dog, Calendar as CalendarIcon, Award } from 'lucide-react';
import { accommodationOptions } from '../data/accommodations';

interface BookingFlowProps {
  onClose: () => void;
  onComplete: (data: { unitName: string; checkIn: string; checkOut: string; bookingCode: string }) => void;
  initialUnitId?: number | null;
}

const BookingFlow: React.FC<BookingFlowProps> = ({ onClose, onComplete, initialUnitId }) => {
  const [step, setStep] = useState(1);
  const [selectedDates, setSelectedDates] = useState<{ start: Date | null, end: Date | null }>({
    start: null,
    end: null
  });
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [occupants, setOccupants] = useState({ adults: 1, children: 0, pets: 0 });
  const [selectedUnit, setSelectedUnit] = useState<number | null>(initialUnitId ?? null);
  const [galleryIndex, setGalleryIndex] = useState<Record<number, number>>({});

  // Calendar Logic
  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const normalizeDate = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

  const handleDateClick = (date: Date) => {
    const clickedDate = normalizeDate(date);
    const startDate = selectedDates.start ? normalizeDate(selectedDates.start) : null;
    const endDate = selectedDates.end ? normalizeDate(selectedDates.end) : null;

    if (!startDate || (startDate && endDate)) {
      setSelectedDates({ start: clickedDate, end: null });
    } else if (clickedDate.getTime() > startDate.getTime()) {
      setSelectedDates({ ...selectedDates, end: clickedDate });
    } else {
      setSelectedDates({ start: clickedDate, end: null });
    }
  };

  const isSelected = (date: Date) => {
    if (selectedDates.start && date.getTime() === selectedDates.start.getTime()) return true;
    if (selectedDates.end && date.getTime() === selectedDates.end.getTime()) return true;
    return false;
  };

  const isInRange = (date: Date) => {
    if (selectedDates.start && selectedDates.end) {
      return date > selectedDates.start && date < selectedDates.end;
    }
    return false;
  };

  const updateOccupant = (type: 'adults' | 'children' | 'pets', delta: number) => {
    setOccupants(prev => ({
      ...prev,
      [type]: Math.max(0, prev[type] + delta)
    }));
  };

  const renderCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const totalDays = daysInMonth(year, month);
    const startDay = firstDayOfMonth(year, month);
    const days = [];

    for (let i = 0; i < startDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-12 w-full" />);
    }

    for (let d = 1; d <= totalDays; d++) {
      const date = new Date(year, month, d);
      const selected = isSelected(date);
      const range = isInRange(date);
      const isPast = date < new Date(new Date().setHours(0,0,0,0));

      days.push(
        <button
          key={d}
          disabled={isPast}
          onClick={() => handleDateClick(date)}
          className={`h-12 w-full flex items-center justify-center relative transition-all duration-300 rounded-full
            ${isPast ? 'text-brand-primary/10 cursor-not-allowed' : 'text-brand-primary hover:bg-brand-terracotta/10'}
            ${selected ? 'bg-brand-terracotta text-white !rounded-full shadow-lg shadow-brand-terracotta/40' : ''}
            ${range ? 'bg-brand-terracotta/10 !rounded-none' : ''}
          `}
        >
          <span className="relative z-10 font-medium">{d}</span>
          {range && <div className="absolute inset-0 bg-brand-terracotta/5" />}
        </button>
      );
    }
    return days;
  };

  const nextMonth = () => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() + 1)));
  const prevMonth = () => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() - 1)));

  const selectedData = accommodationOptions.find(o => o.id === selectedUnit);

  return (
    <motion.div
      initial={{ opacity: 0, y: '100%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '100%' }}
      transition={{ type: 'spring' as const, damping: 25, stiffness: 200 }}
      className="absolute inset-0 z-[100] bg-brand-neutral flex flex-col overflow-hidden"
    >
      <header className="px-6 py-8 flex items-center justify-between border-b border-brand-primary/5 bg-white/80 backdrop-blur-xl sticky top-0 z-50">
        <button onClick={onClose} className="p-2 hover:bg-brand-primary/5 rounded-full transition-colors">
          <X size={24} />
        </button>
        <div className="flex flex-col items-center">
          <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-brand-terracotta mb-1">Reserva de Estancia</span>
          <div className="flex gap-1">
            {[1, 2, 3].map((s) => (
              <div key={s} className={`h-1 w-8 rounded-full transition-all duration-500 ${s <= step ? 'bg-brand-terracotta' : 'bg-brand-primary/10'}`} />
            ))}
          </div>
        </div>
        <div className="w-10" />
      </header>

      <main className="flex-grow overflow-y-auto custom-scrollbar">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="px-6 py-10 space-y-8"
            >
              <div>
                <h2 className="text-4xl font-serif mb-2">Seleccione sus fechas</h2>
                <p className="text-brand-primary/60">Disfrute de la tranquilidad de la pampa.</p>
              </div>

              <div className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-black/5 border border-brand-primary/5">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-serif capitalize">
                    {currentMonth.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}
                  </h3>
                  <div className="flex gap-4">
                    <button onClick={prevMonth} className="p-2 hover:bg-brand-neutral rounded-full transition-colors">
                      <ChevronLeft size={20} />
                    </button>
                    <button onClick={nextMonth} className="p-2 hover:bg-brand-neutral rounded-full transition-colors">
                      <ChevronRight size={20} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-7 mb-4">
                  {['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'].map(day => (
                    <div key={day} className="text-center text-[10px] uppercase tracking-widest font-bold text-brand-primary/30">
                      {day}
                    </div>
                  ))}
                </div>

                <motion.div 
                  key={currentMonth.toISOString()}
                  className="grid grid-cols-7 gap-y-2"
                >
                  {renderCalendar()}
                </motion.div>
              </div>

              {selectedDates.start && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between p-6 bg-white rounded-3xl shadow-xl border border-brand-primary/5"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-brand-neutral rounded-2xl flex items-center justify-center text-brand-terracotta">
                      <CalendarIcon size={24} />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-brand-primary/40 font-bold">Su Estadía</p>
                      <p className="text-sm font-medium text-brand-primary">
                        {selectedDates.start.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                        {selectedDates.end ? (
                          <>
                            <span className="mx-2 text-brand-primary/20">→</span>
                            {selectedDates.end.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                          </>
                        ) : (
                          <span className="ml-2 text-brand-terracotta italic text-xs animate-pulse">
                            — Seleccione fecha de salida
                          </span>
                        )}
                      </p>
                      {selectedDates.end && (
                        <p className="text-[9px] text-brand-terracotta font-bold uppercase tracking-widest mt-1">
                          {Math.ceil(Math.abs(selectedDates.end.getTime() - selectedDates.start.getTime()) / (1000 * 60 * 60 * 24))} Noches seleccionadas
                        </p>
                      )}
                    </div>
                  </div>
                  <button 
                    disabled={!selectedDates.end}
                    onClick={() => setStep(2)}
                    className={`px-8 py-4 rounded-2xl font-bold transition-all active:scale-95 text-sm shadow-lg
                      ${selectedDates.end 
                        ? 'bg-brand-terracotta text-white shadow-brand-terracotta/20' 
                        : 'bg-brand-primary/5 text-brand-primary/20 cursor-not-allowed shadow-none'
                      }
                    `}
                  >
                    Continuar
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="px-6 py-10 space-y-12"
            >
              <div className="flex items-center gap-4">
                <button onClick={() => setStep(1)} className="p-2 bg-brand-primary/5 rounded-full">
                  <ChevronLeft size={20} />
                </button>
                <div>
                  <h2 className="text-4xl font-serif mb-2">¿Quiénes viajan?</h2>
                  <p className="text-brand-primary/60">Configure la ocupación de su estadía.</p>
                </div>
              </div>

              <div className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-black/5 border border-brand-primary/5 space-y-12">
                <OccupantRow icon={<Users size={28} />} label="Adultos" sub="Mayores de 12" value={occupants.adults} onUpdate={(d) => updateOccupant('adults', d)} />
                <OccupantRow icon={<Users size={28} className="scale-75" />} label="Niños" sub="De 2 a 11" value={occupants.children} onUpdate={(d) => updateOccupant('children', d)} />
                <OccupantRow icon={<Dog size={28} />} label="Mascotas" sub="Hasta 15kg" value={occupants.pets} onUpdate={(d) => updateOccupant('pets', d)} hasBadge />
              </div>

              <AnimatePresence>
                {occupants.pets > 0 && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="p-4 bg-brand-olive/5 border border-brand-olive/10 rounded-2xl text-brand-olive text-sm italic text-center">
                    "¡Excelente! Tenemos espacios ideales para tu compañero."
                  </motion.div>
                )}
              </AnimatePresence>

              <button 
                disabled={occupants.adults === 0}
                onClick={() => setStep(3)}
                className={`w-full py-5 rounded-2xl font-bold text-lg transition-all active:scale-[0.98] shadow-xl ${occupants.adults > 0 ? 'bg-brand-primary text-white hover:bg-brand-terracotta' : 'bg-brand-primary/10 text-brand-primary/30 cursor-not-allowed'}`}
              >
                Ver Opciones de Alojamiento
              </button>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="px-6 py-10 pb-40 space-y-10"
            >
              <div className="flex items-center gap-4">
                <button onClick={() => setStep(2)} className="p-2 bg-brand-primary/5 rounded-full">
                  <ChevronLeft size={20} />
                </button>
                <div>
                  <h2 className="text-4xl font-serif mb-2">Elija su refugio</h2>
                  <p className="text-brand-primary/60">19 cabañas y 8 habitaciones boutique.</p>
                </div>
              </div>

              <div className="space-y-8">
                {accommodationOptions.map((opt) => {
                  const currentImg = galleryIndex[opt.id] ?? 0;
                  const total = opt.gallery.length;
                  const goNext = (e: React.MouseEvent) => {
                    e.stopPropagation();
                    setGalleryIndex(prev => ({ ...prev, [opt.id]: (currentImg + 1) % total }));
                  };
                  const goPrev = (e: React.MouseEvent) => {
                    e.stopPropagation();
                    setGalleryIndex(prev => ({ ...prev, [opt.id]: (currentImg - 1 + total) % total }));
                  };

                  return (
                    <motion.div
                      key={opt.id}
                      onClick={() => setSelectedUnit(opt.id)}
                      whileTap={{ scale: 0.98 }}
                      className={`w-full text-left bg-white rounded-[2.5rem] overflow-hidden shadow-xl shadow-black/5 border-2 transition-all relative cursor-pointer
                        ${selectedUnit === opt.id ? 'border-brand-terracotta' : 'border-transparent'}
                      `}
                    >
                      {/* Gallery */}
                      <div className="relative aspect-video overflow-hidden">
                        <AnimatePresence mode="wait">
                          <motion.img
                            key={currentImg}
                            src={opt.gallery[currentImg]}
                            alt={opt.title}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className="w-full h-full object-cover"
                          />
                        </AnimatePresence>

                        {/* Gallery arrows — solo si hay más de 1 foto */}
                        {total > 1 && (
                          <>
                            <button
                              onClick={goPrev}
                              className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center text-white active:scale-90 transition-all"
                            >
                              <ChevronLeft size={16} />
                            </button>
                            <button
                              onClick={goNext}
                              className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center text-white active:scale-90 transition-all"
                            >
                              <ChevronRight size={16} />
                            </button>
                            {/* Dots */}
                            <div className="absolute bottom-12 left-0 w-full flex justify-center gap-1.5 z-20">
                              {opt.gallery.map((_, i) => (
                                <button
                                  key={i}
                                  onClick={e => { e.stopPropagation(); setGalleryIndex(prev => ({ ...prev, [opt.id]: i })); }}
                                  className={`h-1.5 rounded-full transition-all ${i === currentImg ? 'w-4 bg-white' : 'w-1.5 bg-white/50'}`}
                                />
                              ))}
                            </div>
                            {/* Counter */}
                            <div className="absolute top-4 left-4 bg-black/40 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-full z-20">
                              {currentImg + 1} / {total}
                            </div>
                          </>
                        )}

                        <div className="absolute top-4 right-4 bg-brand-accent/90 backdrop-blur-md text-white text-[9px] uppercase tracking-widest font-bold py-1.5 px-3 rounded-full z-20">
                          {opt.type}
                        </div>
                        <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-[#C5A059]/90 backdrop-blur-md text-white text-[9px] uppercase tracking-widest font-bold py-1.5 px-4 rounded-full border border-white/20 z-20">
                          <Award size={12} />
                          +100 Puntos Club Estancia
                        </div>
                      </div>

                      <div className="p-6">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="text-2xl font-serif text-brand-wood">{opt.title}</h3>
                            <p className="text-brand-primary/40 text-xs uppercase tracking-widest mt-0.5">{opt.capacity} • {opt.pets}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-2xl font-serif text-brand-terracotta">${opt.price}</span>
                            <p className="text-[10px] text-brand-primary/40 uppercase tracking-widest">/ noche</p>
                          </div>
                        </div>

                        <p className="text-brand-primary/60 text-xs leading-relaxed mb-4">{opt.description}</p>

                        {/* Tipos de habitación */}
                        <div className="space-y-1.5 mb-4">
                          {opt.rooms.map(r => (
                            <div key={r} className="flex items-center gap-2 text-xs text-brand-primary/70">
                              <div className="w-1.5 h-1.5 rounded-full bg-brand-terracotta shrink-0" />
                              {r}
                            </div>
                          ))}
                        </div>

                        <div className="flex flex-wrap gap-3 pt-4 border-t border-brand-primary/5">
                          {opt.amenities.map(a => (
                            <div key={a} className="flex items-center gap-2 text-[10px] text-brand-primary/60 uppercase tracking-widest font-medium">
                              <div className="w-1 h-1 rounded-full bg-brand-accent" />
                              {a}
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {step === 3 && (
        <motion.div 
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="absolute bottom-0 left-0 w-full bg-brand-primary p-6 px-8 flex items-center justify-between shadow-2xl z-[110] pb-10"
        >
          <div>
            <p className="text-white/50 text-[10px] uppercase tracking-[0.2em] font-bold">Total Estancia</p>
            <p className="text-white text-2xl font-serif">
              {selectedData ? `$${selectedData.price}` : '--'}
            </p>
          </div>
          <button 
            disabled={!selectedUnit}
            onClick={() => {
              if (selectedData && selectedDates.start && selectedDates.end) {
                const bookingCode = Math.random().toString(36).substring(2, 7).toUpperCase();
                onComplete({
                  unitName: selectedData.title,
                  checkIn: selectedDates.start.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }),
                  checkOut: selectedDates.end.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }),
                  bookingCode: bookingCode
                });
              }
            }}
            className={`bg-brand-accent text-brand-wood px-10 py-4 rounded-2xl font-bold transition-all active:scale-95 ${!selectedUnit ? 'opacity-50 grayscale' : 'hover:bg-brand-accent/90'}`}
          >
            Confirmar Reserva
          </button>
        </motion.div>
      )}

      <div className="absolute bottom-0 right-0 w-32 h-32 bg-brand-terracotta/5 rounded-tl-full -z-10" />
    </motion.div>
  );
};

function OccupantRow({ icon, label, sub, value, onUpdate, hasBadge }: { icon: React.ReactNode, label: string, sub: string, value: number, onUpdate: (d: number) => void, hasBadge?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-6">
        <div className="w-14 h-14 bg-brand-neutral rounded-2xl flex items-center justify-center text-brand-terracotta">
          {icon}
        </div>
        <div>
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-serif">{label}</h3>
            {hasBadge && (
              <span className="text-[9px] bg-brand-olive/10 text-brand-olive px-2 py-0.5 rounded-full uppercase tracking-widest font-bold border border-brand-olive/20">
                Máx 15kg
              </span>
            )}
          </div>
          <p className="text-brand-primary/40 text-xs uppercase tracking-widest">{sub}</p>
        </div>
      </div>
      <div className="flex items-center gap-6">
        <button onClick={() => onUpdate(-1)} className="w-10 h-10 rounded-full border border-brand-primary/10 flex items-center justify-center hover:bg-brand-terracotta hover:text-white transition-all active:scale-90">-</button>
        <motion.span key={value} initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="text-2xl font-serif w-6 text-center">{value}</motion.span>
        <button onClick={() => onUpdate(1)} className="w-10 h-10 rounded-full border border-brand-primary/10 flex items-center justify-center hover:bg-brand-terracotta hover:text-white transition-all active:scale-90">+</button>
      </div>
    </div>
  )
}

export default BookingFlow;
