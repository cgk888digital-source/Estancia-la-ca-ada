import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, X, Users, Dog, Calendar as CalendarIcon, Award, Check } from 'lucide-react';
import { accommodationOptions } from '../data/accommodations';
import { supabase } from '../lib/supabase';
import { getBcvEuroRate } from '../utils/exchangeRate';
import { useHotelSettings } from '../utils/useHotelSettings';

export interface BookingFlowData {
  unitName: string;
  checkIn: string;
  checkOut: string;
  bookingCode: string;
  formData: {
    nombre: string;
    apellido: string;
    ci: string;
    tlf: string;
    correo: string;
    referido?: string;
    sigueCircuito: boolean;
  };
  occupants: {
    adults: number;
    children: number;
    babies: number;
    pets: number;
  };
  pricing: {
    roomTotal: number;
    mealsTotal: number;
  };
  totalStayPrice: number;
  depositAmount: number;
  remainingAmount: number;
  depositPercent: number;
  remainingPolicyText: string;
  selectedPayment: 'zelle' | 'pago_movil' | 'transferencia' | null;
  totalNights: number;
  bcvEuroRate?: number | null;
}

interface BookingFlowProps {
  onClose: () => void;
  onComplete: (data: BookingFlowData) => void;
  initialUnitId?: number | null;
}

interface DbAccommodation {
  id: number | string;
  price: number | string;
  december_price: number | string;
  discount_percent?: number | string | null;
}

const BookingFlow: React.FC<BookingFlowProps> = ({ onClose, onComplete, initialUnitId }) => {
  const [step, setStep] = useState(1);
  const [bcvEuroRate, setBcvEuroRate] = useState<number | null>(null);
  const [loadingRate, setLoadingRate] = useState(false);
  const [dbAccommodations, setDbAccommodations] = useState<DbAccommodation[]>([]);
  const { settings: hotelSettings } = useHotelSettings();

  React.useEffect(() => {
    let active = true;
    const fetchDbRates = async () => {
      const { data, error } = await supabase.from('accommodations').select('*');
      if (active && !error && data) {
        setDbAccommodations(data);
      }
    };
    fetchDbRates();
    return () => {
      active = false;
    };
  }, []);

  React.useEffect(() => {
    let active = true;
    const fetchRate = async () => {
      setLoadingRate(true);
      const rate = await getBcvEuroRate();
      if (active) {
        setBcvEuroRate(rate);
        setLoadingRate(false);
      }
    };
    fetchRate();
    return () => {
      active = false;
    };
  }, []);

  const [selectedDates, setSelectedDates] = useState<{ start: Date | null, end: Date | null }>({
    start: null,
    end: null
  });
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [occupants, setOccupants] = useState({ adults: 2, children: 0, babies: 0, pets: 0 });
  const [selectedUnits, setSelectedUnits] = useState<number[]>(initialUnitId ? [initialUnitId] : []);
  const [galleryIndex, setGalleryIndex] = useState<Record<number, number>>({});
  const [mealsInfoOpen, setMealsInfoOpen] = useState(false);

  // Ficha de Reserva & Payment state
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    ci: '',
    tlf: '',
    correo: '',
    referido: '',
    sigueCircuito: false
  });
  const [selectedPayment, setSelectedPayment] = useState<'zelle' | 'pago_movil' | 'transferencia' | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const getSeason = (date: Date): 'low' | 'high' | 'dec' => {
    const month = date.getMonth();
    const day = date.getDate();
    
    // Diciembre (Dic 20 - Ene 06)
    if ((month === 11 && day >= 20) || (month === 0 && day <= 6)) {
      return 'dec';
    }
    
    // Temporada Alta: Dic 15 - Dic 19, Ene 7 - Ene 15, Jun 15 - Sep 15
    if (
      (month === 11 && day >= 15 && day <= 19) ||
      (month === 0 && day >= 7 && day <= 15) ||
      ((month === 5 && day >= 15) || month === 6 || month === 7 || (month === 8 && day <= 15))
    ) {
      return 'high';
    }
    
    return 'low';
  };

  const getRoomPrice = (roomId: number, isDecember: boolean) => {
    const dbAcc = dbAccommodations.find(d => Number(d.id) === roomId);
    if (dbAcc) {
      const basePrice = isDecember ? Number(dbAcc.december_price) : Number(dbAcc.price);
      const discount = Number(dbAcc.discount_percent || 0);
      return discount > 0 ? Math.round(basePrice * (1 - discount / 100)) : basePrice;
    }
    // Fallback to static defaults
    switch (roomId) {
      case 1:
      case 6:
      case 7:
        return isDecember ? 158 : 137;
      case 2:
      case 4:
        return isDecember ? 337 : 297;
      case 5:
      case 8:
      case 9:
        return isDecember ? 76 : 64;
      case 3:
        return isDecember ? 70 : 60;
      default:
        return 0;
    }
  };

  const calculateStayPrice = (roomId: number, adults: number, children: number, nights: number, isDecember: boolean) => {
    const roomNightlyRate = getRoomPrice(roomId, isDecember);
    // Alimentos: $56 por adulto, $48 por niño (3-12 años)
    const mealsNightlyRate = (adults * 56) + (children * 48);
    const totalNightlyRate = roomNightlyRate + mealsNightlyRate;
    return {
      roomNightly: roomNightlyRate,
      mealsNightly: mealsNightlyRate,
      roomTotal: roomNightlyRate * nights,
      mealsTotal: mealsNightlyRate * nights,
      nightlyRate: totalNightlyRate,
      totalStayPrice: totalNightlyRate * nights
    };
  };



  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

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

  const updateOccupant = (type: 'adults' | 'children' | 'babies' | 'pets', delta: number) => {
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


  const selectedData = selectedUnits.length > 0 
    ? accommodationOptions.filter(o => selectedUnits.includes(o.id))
    : [];
  const totalNights = selectedDates.start && selectedDates.end
    ? Math.ceil(Math.abs(selectedDates.end.getTime() - selectedDates.start.getTime()) / (1000 * 60 * 60 * 24))
    : 1;

  const isDecember = selectedDates.start ? getSeason(selectedDates.start) === 'dec' : false;

  const getRoomMaxCapacity = (roomId: number): number => {
    switch (roomId) {
      case 1: return 6; // Suite 6p
      case 6: return 5; // Suite 5p
      case 7: return 4; // Suite 4p
      case 2: return 10; // Cabaña La Lomita
      case 4: return 9; // Cabaña Mitibibo
      case 5: return 2; // Llano Grande Matrimonial King
      case 8: return 4; // Llano Grande King + Litera
      case 9: return 4; // Llano Grande Queen + 2 Camas
      case 3: return 3; // Galería La Manita
      default: return 0;
    }
  };

  const selectedCapacity = selectedUnits.reduce((acc, id) => acc + getRoomMaxCapacity(id), 0);
  const totalOccupants = occupants.adults + occupants.children;
  const isCapacitySufficient = selectedCapacity >= totalOccupants;

  const getMultiRoomPricing = () => {
    if (selectedUnits.length === 0) {
      return { roomNightly: 0, mealsNightly: 0, roomTotal: 0, mealsTotal: 0, nightlyRate: 0, totalStayPrice: 0 };
    }
    let totalRoomNightly = 0;
    selectedUnits.forEach(id => {
      totalRoomNightly += getRoomPrice(id, isDecember);
    });
    const mealsNightlyRate = (occupants.adults * 56) + (occupants.children * 48);
    const nightlyRate = totalRoomNightly + mealsNightlyRate;
    return {
      roomNightly: totalRoomNightly,
      mealsNightly: mealsNightlyRate,
      roomTotal: totalRoomNightly * totalNights,
      mealsTotal: mealsNightlyRate * totalNights,
      nightlyRate: nightlyRate,
      totalStayPrice: nightlyRate * totalNights
    };
  };

  const pricing = getMultiRoomPricing();
  const totalStayPrice = pricing.totalStayPrice;

  // Lógica dinámica de depósito
  const depositPercent = 50;
  const remainingPolicyText = 'El 50% restante se debe abonar 2 semanas antes de la llegada a la Estancia.';

  const depositAmount = totalStayPrice * (depositPercent / 100);
  const remainingAmount = totalStayPrice - depositAmount;

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
            {[1, 2, 3, 4, 5].map((s) => (
              <div key={s} className={`h-1 w-6 rounded-full transition-all duration-500 ${s <= step ? 'bg-brand-terracotta' : 'bg-brand-primary/10'}`} />
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
                <p className="text-brand-primary/60">Disfrute de la tranquilidad del páramo.</p>
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
                <OccupantRow icon={<Users size={28} />} label="Adultos" sub="Mayores de 12 años" value={occupants.adults} onUpdate={(d) => updateOccupant('adults', d)} />
                <OccupantRow icon={<Users size={28} className="scale-75" />} label="Niños" sub="De 3 a 12 años" value={occupants.children} onUpdate={(d) => updateOccupant('children', d)} />
                <OccupantRow icon={<Users size={28} className="scale-50" />} label="Bebés" sub="De 0 a 2 años" value={occupants.babies} onUpdate={(d) => updateOccupant('babies', d)} />
                <OccupantRow icon={<Dog size={28} />} label="Mascotas" sub="Perros pequeños hasta 5kg" value={occupants.pets} onUpdate={(d) => updateOccupant('pets', d)} hasBadge />
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
                  <h2 className="text-4xl font-serif mb-2">Elija su Hospedaje</h2>
                  <p className="text-brand-primary/60">2 cabañas, 5 Suites y 12 habitaciones.</p>
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

                  const displayMealsAdults = Math.min(occupants.adults, getRoomMaxCapacity(opt.id));
                  const displayMealsChildren = Math.min(occupants.children, Math.max(0, getRoomMaxCapacity(opt.id) - displayMealsAdults));
                  const roomPriceDetails = calculateStayPrice(opt.id, displayMealsAdults, displayMealsChildren, totalNights, isDecember);

                  return (
                    <motion.div
                      key={opt.id}
                      onClick={() => {
                        setSelectedUnits(prev => {
                          if (prev.includes(opt.id)) {
                            return prev.filter(id => id !== opt.id);
                          } else {
                            return [...prev, opt.id];
                          }
                        });
                      }}
                      whileTap={{ scale: 0.98 }}
                      className={`w-full text-left bg-white rounded-[2.5rem] overflow-hidden shadow-xl shadow-black/5 border-2 transition-all relative cursor-pointer
                        ${selectedUnits.includes(opt.id) ? 'border-brand-terracotta' : 'border-transparent'}
                      `}
                    >
                      {/* Gallery */}
                      <div className="relative aspect-video overflow-hidden">
                        {selectedUnits.includes(opt.id) && (
                          <div className="absolute top-4 left-4 bg-brand-terracotta text-white p-2 rounded-full z-20 shadow-lg border border-white/20">
                            <Check size={16} strokeWidth={3} />
                          </div>
                        )}
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
                        <div className="flex justify-between items-start mb-3 gap-2">
                          <div>
                            <h3 className="text-2xl font-serif text-brand-wood leading-tight">{opt.title}</h3>
                            <p className="text-brand-primary/40 text-[10px] uppercase tracking-widest mt-1">Capacidad: {opt.capacity} • {opt.pets}</p>
                            
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMealsInfoOpen(true);
                                }}
                                className="inline-block bg-brand-terracotta/10 hover:bg-brand-terracotta/20 text-brand-terracotta border border-brand-terracotta/20 text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg cursor-pointer transition-colors active:scale-95"
                              >
                                Media Pensión Incluida 🍲
                              </button>
                              {(opt.id === 2 || opt.id === 4) && (occupants.adults + occupants.children) < 6 && (
                                <span className="inline-block bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg">
                                  Tarifa Base Aplicada 🏕️
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-2xl font-serif text-brand-terracotta">${roomPriceDetails.nightlyRate}</span>
                            <p className="text-[9px] text-brand-primary/40 uppercase tracking-widest leading-none">/ noche total</p>
                            <p className="text-[8px] text-brand-primary/30 mt-1 font-mono">Hab: ${roomPriceDetails.roomNightly} | Alim: ${roomPriceDetails.mealsNightly}</p>
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

          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="px-6 py-10 space-y-8"
            >
              <div className="flex items-center gap-4">
                <button onClick={() => setStep(3)} className="p-2 bg-brand-primary/5 rounded-full">
                  <ChevronLeft size={20} />
                </button>
                <div>
                  <h2 className="text-4xl font-serif mb-2">Ficha de Reserva</h2>
                  <p className="text-brand-primary/60">Por favor, complete sus datos para continuar.</p>
                </div>
              </div>

              <div className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-black/5 border border-brand-primary/5 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-brand-primary/40 font-bold">Nombre *</label>
                    <input
                      type="text"
                      required
                      value={formData.nombre}
                      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-brand-primary/10 text-sm focus:outline-none focus:border-brand-terracotta bg-brand-neutral/20"
                      placeholder="Ej: Juan"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-brand-primary/40 font-bold">Apellido *</label>
                    <input
                      type="text"
                      required
                      value={formData.apellido}
                      onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-brand-primary/10 text-sm focus:outline-none focus:border-brand-terracotta bg-brand-neutral/20"
                      placeholder="Ej: Pérez"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-brand-primary/40 font-bold">Cédula de Identidad (CI) *</label>
                  <input
                    type="text"
                    required
                    value={formData.ci}
                    onChange={(e) => setFormData({ ...formData, ci: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-brand-primary/10 text-sm focus:outline-none focus:border-brand-terracotta bg-brand-neutral/20"
                    placeholder="Ej: 12345678"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-brand-primary/40 font-bold">Teléfono de Contacto (Tlf) *</label>
                  <input
                    type="tel"
                    required
                    value={formData.tlf}
                    onChange={(e) => setFormData({ ...formData, tlf: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-brand-primary/10 text-sm focus:outline-none focus:border-brand-terracotta bg-brand-neutral/20"
                    placeholder="Ej: 04141294308"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-brand-primary/40 font-bold">Correo Electrónico *</label>
                  <input
                    type="email"
                    required
                    value={formData.correo}
                    onChange={(e) => setFormData({ ...formData, correo: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-brand-primary/10 text-sm focus:outline-none focus:border-brand-terracotta bg-brand-neutral/20"
                    placeholder="Ej: cliente@correo.com"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-brand-primary/40 font-bold">Persona que lo refirió (Opcional)</label>
                  <input
                    type="text"
                    value={formData.referido}
                    onChange={(e) => setFormData({ ...formData, referido: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-brand-primary/10 text-sm focus:outline-none focus:border-brand-terracotta bg-brand-neutral/20"
                    placeholder="¿Quién le recomendó la Estancia?"
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <input
                    type="checkbox"
                    id="circuito"
                    checked={formData.sigueCircuito}
                    onChange={(e) => setFormData({ ...formData, sigueCircuito: e.target.checked })}
                    className="w-4 h-4 rounded text-brand-terracotta focus:ring-brand-terracotta border-brand-primary/10"
                  />
                  <label htmlFor="circuito" className="text-xs text-brand-primary/70 leading-tight cursor-pointer select-none">
                    Sigo la página de Instagram del <span className="font-bold text-brand-terracotta">@Circuitodelaexcelencia</span>
                  </label>
                </div>
              </div>

              <button
                disabled={!formData.nombre || !formData.apellido || !formData.ci || !formData.tlf || !formData.correo}
                onClick={() => setStep(5)}
                className={`w-full py-5 rounded-2xl font-bold text-lg transition-all active:scale-[0.98] shadow-xl 
                  ${(formData.nombre && formData.apellido && formData.ci && formData.tlf && formData.correo)
                    ? 'bg-brand-primary text-white hover:bg-brand-terracotta'
                    : 'bg-brand-primary/10 text-brand-primary/30 cursor-not-allowed'
                  }
                `}
              >
                Continuar al Pago
              </button>
            </motion.div>
          )}

          {step === 5 && (
            <motion.div
              key="step5"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="px-6 py-10 pb-40 space-y-8"
            >
              <div className="flex items-center gap-4">
                <button onClick={() => setStep(4)} className="p-2 bg-brand-primary/5 rounded-full">
                  <ChevronLeft size={20} />
                </button>
                <div>
                  <h2 className="text-4xl font-serif mb-2">Métodos de Pago</h2>
                  <p className="text-brand-primary/60">Garantice su reserva abonando el 50%.</p>
                </div>
              </div>

              {/* Booking Summary Card */}
              <div className="bg-white rounded-[2.5rem] p-6 shadow-xl border border-brand-primary/5 space-y-4">
                <div>
                  <span className="text-[9px] uppercase tracking-widest text-brand-primary/40 font-bold block">Resumen de Estadía</span>
                  <h3 className="text-lg font-serif text-brand-wood">
                    {selectedData.length > 1 
                      ? `${selectedData.length} Hospedajes (${selectedData.map(d => d.title.replace("Galería ", "")).join(', ')})`
                      : (selectedData[0]?.title || '')
                    }
                  </h3>
                  <p className="text-xs text-brand-primary/60">
                    {selectedDates.start?.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} a{' '}
                    {selectedDates.end?.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} ({totalNights} {totalNights === 1 ? 'noche' : 'noches'})
                  </p>
                  <div className="flex items-center gap-4 mt-2 bg-brand-terracotta/5 border border-brand-terracotta/10 rounded-xl px-3 py-2">
                    <div className="text-center">
                      <p className="text-[8px] uppercase tracking-widest text-brand-primary/40 font-bold">Check-in</p>
                      <p className="text-[10px] font-bold text-brand-terracotta">🕑 {hotelSettings.checkin_time}</p>
                    </div>
                    <div className="w-px h-6 bg-brand-terracotta/20 mx-1" />
                    <div className="text-center">
                      <p className="text-[8px] uppercase tracking-widest text-brand-primary/40 font-bold">Check-out</p>
                      <p className="text-[10px] font-bold text-brand-terracotta">🕚 {hotelSettings.checkout_time}</p>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-brand-primary/5 space-y-2.5 text-xs">
                  <div className="flex justify-between text-brand-primary/60">
                    <span>Hospedaje ({totalNights} {totalNights === 1 ? 'noche' : 'noches'}):</span>
                    <span className="font-semibold font-mono">${pricing.roomTotal}</span>
                  </div>
                  <div className="flex justify-between text-brand-primary/60">
                    <span>Alimentación ({totalNights} {totalNights === 1 ? 'noche' : 'noches'}):</span>
                    <span className="font-semibold font-mono">${pricing.mealsTotal}</span>
                  </div>
                  <div className="flex justify-between font-bold text-sm pt-2 border-t border-brand-primary/5">
                    <span className="text-brand-primary">Total Estadía:</span>
                    <span className="text-brand-wood font-mono">${totalStayPrice}</span>
                  </div>
                  
                  <div className="flex justify-between p-3 bg-brand-neutral/40 rounded-xl font-serif text-brand-wood text-sm mt-2">
                    <span>Adelanto Requerido ({depositPercent}%):</span>
                    <span className="font-bold text-brand-terracotta font-mono">${depositAmount}</span>
                  </div>
                  {remainingAmount > 0 && (
                    <div className="flex justify-between text-brand-primary/60 px-3 text-[11px] font-mono">
                      <span>Saldo restante (50%):</span>
                      <span>${remainingAmount}</span>
                    </div>
                  )}
                  <p className="text-[10px] text-brand-terracotta text-center font-medium mt-2 leading-relaxed bg-brand-terracotta/5 p-2.5 rounded-xl border border-brand-terracotta/10">
                    💡 {remainingPolicyText}
                  </p>
                </div>
              </div>

              {/* Payment Methods Selection */}
              <div className="space-y-4">
                <div
                  onClick={() => setSelectedPayment('zelle')}
                  className={`p-6 rounded-[2rem] border-2 cursor-pointer transition-all bg-white flex flex-col gap-2
                    ${selectedPayment === 'zelle' ? 'border-brand-terracotta shadow-lg' : 'border-transparent shadow-md'}
                  `}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center font-bold text-purple-700">Z</div>
                      <span className="font-serif font-semibold text-brand-wood">Pago vía Zelle</span>
                    </div>
                    <input
                      type="radio"
                      checked={selectedPayment === 'zelle'}
                      onChange={() => setSelectedPayment('zelle')}
                      className="text-brand-terracotta focus:ring-brand-terracotta"
                    />
                  </div>
                  {selectedPayment === 'zelle' && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="pt-4 border-t border-brand-primary/5 space-y-3 text-xs">
                      <div className="flex justify-between items-center p-2.5 bg-brand-neutral/40 rounded-xl">
                        <div>
                          <p className="text-[9px] uppercase tracking-widest text-brand-primary/40">Correo Zelle</p>
                          <p className="font-medium font-mono text-brand-primary">mariasusana01@hotmail.com</p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); copyToClipboard('mariasusana01@hotmail.com', 'zelle_email'); }}
                          className="px-3 py-1.5 bg-brand-terracotta text-white rounded-lg font-bold text-[10px] uppercase tracking-widest active:scale-95 transition-all shrink-0"
                        >
                          {copiedField === 'zelle_email' ? 'Copiado!' : 'Copiar'}
                        </button>
                      </div>
                      <div className="flex justify-between items-center p-2.5 bg-brand-neutral/40 rounded-xl">
                        <div>
                          <p className="text-[9px] uppercase tracking-widest text-brand-primary/40">Titular</p>
                          <p className="font-medium text-brand-primary">Maria Araujo</p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); copyToClipboard('Maria Araujo', 'zelle_holder'); }}
                          className="px-3 py-1.5 bg-brand-terracotta text-white rounded-lg font-bold text-[10px] uppercase tracking-widest active:scale-95 transition-all shrink-0"
                        >
                          {copiedField === 'zelle_holder' ? 'Copiado!' : 'Copiar'}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>

                <div
                  onClick={() => setSelectedPayment('pago_movil')}
                  className={`p-6 rounded-[2rem] border-2 cursor-pointer transition-all bg-white flex flex-col gap-2
                    ${selectedPayment === 'pago_movil' ? 'border-brand-terracotta shadow-lg' : 'border-transparent shadow-md'}
                  `}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center font-bold text-green-700">PM</div>
                      <span className="font-serif font-semibold text-brand-wood text-xs">Pago Móvil (Bancamiga)</span>
                    </div>
                    <input
                      type="radio"
                      checked={selectedPayment === 'pago_movil'}
                      onChange={() => setSelectedPayment('pago_movil')}
                      className="text-brand-terracotta focus:ring-brand-terracotta"
                    />
                  </div>
                  {selectedPayment === 'pago_movil' && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="pt-4 border-t border-brand-primary/5 space-y-3 text-xs">
                      <div className="flex justify-between items-center p-2.5 bg-brand-neutral/40 rounded-xl">
                        <div>
                          <p className="text-[9px] uppercase tracking-widest text-brand-primary/40">Banco</p>
                          <p className="font-medium text-brand-primary">Bancamiga (0172)</p>
                        </div>
                      </div>
                      <div className="flex justify-between items-center p-2.5 bg-brand-neutral/40 rounded-xl">
                        <div>
                          <p className="text-[9px] uppercase tracking-widest text-brand-primary/40">Teléfono</p>
                          <p className="font-medium font-mono text-brand-primary">04141294308</p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); copyToClipboard('04141294308', 'pm_phone'); }}
                          className="px-3 py-1.5 bg-brand-terracotta text-white rounded-lg font-bold text-[10px] uppercase tracking-widest active:scale-95 transition-all shrink-0"
                        >
                          {copiedField === 'pm_phone' ? 'Copiado!' : 'Copiar'}
                        </button>
                      </div>
                      <div className="flex justify-between items-center p-2.5 bg-brand-neutral/40 rounded-xl">
                        <div>
                          <p className="text-[9px] uppercase tracking-widest text-brand-primary/40">Cédula</p>
                          <p className="font-medium font-mono text-brand-primary">10345954</p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); copyToClipboard('10345954', 'pm_ci'); }}
                          className="px-3 py-1.5 bg-brand-terracotta text-white rounded-lg font-bold text-[10px] uppercase tracking-widest active:scale-95 transition-all shrink-0"
                        >
                          {copiedField === 'pm_ci' ? 'Copiado!' : 'Copiar'}
                        </button>
                      </div>
                      <div className="flex justify-between items-center p-2.5 bg-brand-neutral/40 rounded-xl">
                        <div>
                          <p className="text-[9px] uppercase tracking-widest text-brand-primary/40">Número de Cuenta</p>
                          <p className="font-medium font-mono text-brand-primary text-[10px]">01720110701108762467</p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); copyToClipboard('01720110701108762467', 'pm_acc'); }}
                          className="px-3 py-1.5 bg-brand-terracotta text-white rounded-lg font-bold text-[10px] uppercase tracking-widest active:scale-95 transition-all shrink-0"
                        >
                          {copiedField === 'pm_acc' ? 'Copiado!' : 'Copiar'}
                        </button>
                      </div>
                      <div className="flex justify-between items-center p-2.5 bg-brand-neutral/40 rounded-xl">
                        <div>
                          <p className="text-[9px] uppercase tracking-widest text-brand-primary/40">Titular y Correo</p>
                          <p className="font-medium text-brand-primary">María Araujo (Escagueyelc@gmail.com)</p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); copyToClipboard('Escagueyelc@gmail.com', 'pm_email'); }}
                          className="px-3 py-1.5 bg-brand-terracotta text-white rounded-lg font-bold text-[10px] uppercase tracking-widest active:scale-95 transition-all shrink-0"
                        >
                          {copiedField === 'pm_email' ? 'Copiado!' : 'Copiar'}
                        </button>
                      </div>

                      {/* Monto de Conversión y Nota de Transparencia */}
                      {loadingRate ? (
                        <div className="text-center py-2 text-brand-primary/40 text-[10px] animate-pulse">Consultando tasa oficial BCV del Euro...</div>
                      ) : bcvEuroRate ? (
                        <div className="space-y-3 pt-2">
                          <div className="p-3.5 bg-brand-terracotta/5 rounded-xl border border-brand-terracotta/10 space-y-1">
                            <p className="text-[9px] uppercase tracking-widest text-brand-terracotta font-bold">Monto a pagar en Bolívares (Bs.)</p>
                            <p className="text-base font-bold text-brand-wood font-mono">
                              Bs. {(depositAmount * bcvEuroRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                            <p className="text-[9px] text-brand-primary/50 leading-normal">
                              Calculado sobre un adelanto de <strong>${depositAmount} USD</strong> a la tasa oficial del Euro (BCV): <strong>Bs. {bcvEuroRate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                            </p>
                          </div>
                          
                          <div className="p-3.5 bg-brand-neutral/40 rounded-2xl text-[10px] text-brand-primary/70 leading-relaxed border border-brand-primary/5 flex flex-col gap-1 shadow-sm">
                            <p className="font-bold text-[10px] uppercase tracking-wide text-brand-wood">Nota de Transparencia:</p>
                            <p>
                              Para su total tranquilidad y de acuerdo a nuestras políticas de facturación, los pagos recibidos en Bolívares (Bs.) se calculan tomando como referencia la tasa oficial del <strong>Euro (EUR)</strong> publicada por el Banco Central de Venezuela (BCV), con la finalidad de mitigar el diferencial cambiario y costos de reposición.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-2 text-brand-primary/40 text-[10px]">Obteniendo tasa referencial...</div>
                      )}
                    </motion.div>
                  )}
                </div>

                <div
                  onClick={() => setSelectedPayment('transferencia')}
                  className={`p-6 rounded-[2rem] border-2 cursor-pointer transition-all bg-white flex flex-col gap-2
                    ${selectedPayment === 'transferencia' ? 'border-brand-terracotta shadow-lg' : 'border-transparent shadow-md'}
                  `}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center font-bold text-blue-700">TB</div>
                      <span className="font-serif font-semibold text-brand-wood text-xs">Transferencia Bancaria</span>
                    </div>
                    <input
                      type="radio"
                      checked={selectedPayment === 'transferencia'}
                      onChange={() => setSelectedPayment('transferencia')}
                      className="text-brand-terracotta focus:ring-brand-terracotta"
                    />
                  </div>
                  {selectedPayment === 'transferencia' && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="pt-4 border-t border-brand-primary/5 space-y-3 text-xs">
                      <div className="flex justify-between items-center p-2.5 bg-brand-neutral/40 rounded-xl">
                        <div>
                          <p className="text-[9px] uppercase tracking-widest text-brand-primary/40">Banco</p>
                          <p className="font-medium text-brand-primary">Bancamiga (0172)</p>
                        </div>
                      </div>
                      <div className="flex justify-between items-center p-2.5 bg-brand-neutral/40 rounded-xl">
                        <div>
                          <p className="text-[9px] uppercase tracking-widest text-brand-primary/40">Cédula</p>
                          <p className="font-medium font-mono text-brand-primary">10345954</p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); copyToClipboard('10345954', 'tb_ci'); }}
                          className="px-3 py-1.5 bg-brand-terracotta text-white rounded-lg font-bold text-[10px] uppercase tracking-widest active:scale-95 transition-all shrink-0"
                        >
                          {copiedField === 'tb_ci' ? 'Copiado!' : 'Copiar'}
                        </button>
                      </div>
                      <div className="flex justify-between items-center p-2.5 bg-brand-neutral/40 rounded-xl">
                        <div>
                          <p className="text-[9px] uppercase tracking-widest text-brand-primary/40">Número de Cuenta</p>
                          <p className="font-medium font-mono text-brand-primary text-[10px]">01720110701108762467</p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); copyToClipboard('01720110701108762467', 'tb_acc'); }}
                          className="px-3 py-1.5 bg-brand-terracotta text-white rounded-lg font-bold text-[10px] uppercase tracking-widest active:scale-95 transition-all shrink-0"
                        >
                          {copiedField === 'tb_acc' ? 'Copiado!' : 'Copiar'}
                        </button>
                      </div>
                      <div className="flex justify-between items-center p-2.5 bg-brand-neutral/40 rounded-xl">
                        <div>
                          <p className="text-[9px] uppercase tracking-widest text-brand-primary/40">Titular y Correo</p>
                          <p className="font-medium text-brand-primary">María Araujo (Escagueyelc@gmail.com)</p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); copyToClipboard('Escagueyelc@gmail.com', 'tb_email'); }}
                          className="px-3 py-1.5 bg-brand-terracotta text-white rounded-lg font-bold text-[10px] uppercase tracking-widest active:scale-95 transition-all shrink-0"
                        >
                          {copiedField === 'tb_email' ? 'Copiado!' : 'Copiar'}
                        </button>
                      </div>

                      {/* Monto de Conversión y Nota de Transparencia */}
                      {loadingRate ? (
                        <div className="text-center py-2 text-brand-primary/40 text-[10px] animate-pulse">Consultando tasa oficial BCV del Euro...</div>
                      ) : bcvEuroRate ? (
                        <div className="space-y-3 pt-2">
                          <div className="p-3.5 bg-brand-terracotta/5 rounded-xl border border-brand-terracotta/10 space-y-1">
                            <p className="text-[9px] uppercase tracking-widest text-brand-terracotta font-bold">Monto a pagar en Bolívares (Bs.)</p>
                            <p className="text-base font-bold text-brand-wood font-mono">
                              Bs. {(depositAmount * bcvEuroRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                            <p className="text-[9px] text-brand-primary/50 leading-normal">
                              Calculado sobre un adelanto de <strong>${depositAmount} USD</strong> a la tasa oficial del Euro (BCV): <strong>Bs. {bcvEuroRate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                            </p>
                          </div>
                        </div>
                      ) : null}
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {step === 3 && (
        <motion.div 
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="absolute bottom-0 left-0 w-full bg-brand-primary p-5 px-6 flex flex-col gap-3 shadow-2xl z-[110] pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        >
          {/* Capacity warning / status row */}
          <div className="flex items-center justify-between text-[11px] text-white/85 bg-white/5 px-4 py-2 rounded-xl border border-white/5">
            <span className="font-light">
              Huéspedes: <span className="font-bold text-white">{totalOccupants}</span> | Capacidad seleccionada: <span className={`font-bold ${isCapacitySufficient ? 'text-emerald-400' : 'text-amber-400'}`}>{selectedCapacity} {selectedCapacity === 1 ? 'persona' : 'personas'}</span>
            </span>
            {selectedUnits.length > 0 && (
              isCapacitySufficient ? (
                <span className="text-emerald-400 font-bold flex items-center gap-1">✓ Capacidad Suficiente</span>
              ) : (
                <span className="text-amber-400 font-medium animate-pulse">⚠️ Seleccione más hospedajes</span>
              )
            )}
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/50 text-[10px] uppercase tracking-[0.2em] font-bold">
                {selectedUnits.length} {selectedUnits.length === 1 ? 'Hospedaje' : 'Hospedajes'}
              </p>
              <p className="text-white text-2xl font-serif">
                {selectedUnits.length > 0 ? `$${totalStayPrice}` : '--'}
              </p>
            </div>
            <button 
              disabled={selectedUnits.length === 0 || !isCapacitySufficient}
              onClick={() => {
                if (selectedUnits.length > 0 && isCapacitySufficient) {
                  setStep(4);
                }
              }}
              className={`bg-brand-accent text-brand-wood px-6 py-4 rounded-2xl font-bold transition-all active:scale-95 text-sm
                ${(selectedUnits.length === 0 || !isCapacitySufficient) ? 'opacity-40 cursor-not-allowed grayscale' : 'hover:bg-brand-accent/90'}
              `}
            >
              Continuar Reserva
            </button>
          </div>
        </motion.div>
      )}

      {step === 5 && (
        <motion.div 
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="absolute bottom-0 left-0 w-full bg-brand-primary p-6 px-8 flex items-center justify-between shadow-2xl z-[110] pb-10"
        >
          <div>
            <p className="text-white/50 text-[10px] uppercase tracking-[0.2em] font-bold">{depositPercent}% para Reservar</p>
            <p className="text-white text-2xl font-serif">${depositAmount}</p>
          </div>
          <button 
            disabled={!selectedPayment}
            onClick={() => {
              if (selectedData.length > 0 && selectedDates.start && selectedDates.end && selectedPayment) {
                const bookingCode = 'LC-' + Math.random().toString(36).substring(2, 7).toUpperCase();
                
                // Formatear el texto de WhatsApp
                const whatsappText = `*Ficha de Reserva - Estancia La Cañada* 🏔️
              
*Nombre:* ${formData.nombre}
*Apellido:* ${formData.apellido}
*CI:* ${formData.ci}
*Tlf:* ${formData.tlf}
*Correo:* ${formData.correo}
*Fecha de entrada:* ${selectedDates.start.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })} *(Check-in a partir de las ${hotelSettings.checkin_time})*
*Fecha de salida:* ${selectedDates.end.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })} *(Check-out hasta las ${hotelSettings.checkout_time})* (${totalNights} ${totalNights === 1 ? 'noche' : 'noches'})
*Hospedajes:* ${selectedData.map(d => d.title).join(' + ')}
*Cantidad adultos:* ${occupants.adults}
*Cantidad de niños (3 a 12 años):* ${occupants.children}
*Cantidad de bebés (0 a 2 años):* ${occupants.babies}
*Persona que lo refirió:* ${formData.referido || 'Ninguna'}
*Sigue la Pag. @Circuitodelaexcelencia:* ${formData.sigueCircuito ? 'Sí ✅' : 'No ❌'}

---
*Resumen de Pago:*
*Hospedaje (${totalNights} ${totalNights === 1 ? 'noche' : 'noches'}):* $${pricing.roomTotal}
*Alimentación (${totalNights} ${totalNights === 1 ? 'noche' : 'noches'}):* $${pricing.mealsTotal}
*Total Estadía:* $${totalStayPrice}
*Monto de Adelanto Requerido (${depositPercent}%):* $${depositAmount}
${remainingAmount > 0 ? `*Monto restante (50%):* $${remainingAmount}\n*Política de saldo restante:* ${remainingPolicyText}` : '*Monto restante:* $0 (Reserva liquidada al 100%)'}

*Método de Pago Seleccionado:* ${selectedPayment === 'zelle' ? 'Zelle' : selectedPayment === 'pago_movil' ? 'Pago Móvil (Bancamiga)' : 'Transferencia Bancaria'}
${selectedPayment === 'pago_movil' && bcvEuroRate ? `*Monto en Bolívares a transferir:* Bs. ${(depositAmount * bcvEuroRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
*Tasa Oficial del Euro (BCV):* Bs. ${bcvEuroRate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
_(Nota: Los pagos en bolívares se calculan a tasa BCV del euro por políticas de facturación)_` : ''}
*Código de Reserva:* ${bookingCode}

Muchas gracias por escoger a Estancia La Cañada para sus vacaciones! 😃`;

                // URL encode the text
                const encodedText = encodeURIComponent(whatsappText);
                const whatsappUrl = `https://wa.me/584141294308?text=${encodedText}`;

                // Abrir enlace de WhatsApp en una pestaña nueva
                window.open(whatsappUrl, '_blank');

                // Guardar reserva en Supabase
                const formatLocalDate = (d: Date) => {
                  const yr = d.getFullYear();
                  const mo = String(d.getMonth() + 1).padStart(2, '0');
                  const dy = String(d.getDate()).padStart(2, '0');
                  return `${yr}-${mo}-${dy}`;
                };

                const checkInStr = formatLocalDate(selectedDates.start);
                const checkOutStr = formatLocalDate(selectedDates.end);
                
                const todayLocalStr = formatLocalDate(new Date());
                const initialStatus = checkInStr === todayLocalStr ? 'checkin_hoy' : 'confirmado';

                const notes = [
                  formData.referido ? `Referido: ${formData.referido}` : '',
                  formData.sigueCircuito ? 'Sigue al Circuito de la Excelencia' : '',
                  `Cédula: ${formData.ci}`
                ].filter(Boolean).join('. ');

                // Proportional split among selected rooms
                const N = selectedUnits.length;
                const insertRows = selectedUnits.map((id, idx) => {
                  const allocatedAdults = Math.floor(occupants.adults / N) + (idx === 0 ? occupants.adults % N : 0);
                  const allocatedChildren = Math.floor(occupants.children / N) + (idx === 0 ? occupants.children % N : 0);
                  const allocatedBabies = Math.floor(occupants.babies / N) + (idx === 0 ? occupants.babies % N : 0);
                  const allocatedPets = Math.floor(occupants.pets / N) + (idx === 0 ? occupants.pets % N : 0);

                  const roomPriceDetails = calculateStayPrice(id, allocatedAdults, allocatedChildren, totalNights, isDecember);
                  const roomTotal = roomPriceDetails.totalStayPrice;
                  const roomDeposit = roomTotal * (depositPercent / 100);

                  return {
                    guest_name: `${formData.nombre} ${formData.apellido}${N > 1 ? ` (Habitación ${idx + 1}/${N})` : ''}`,
                    guest_phone: formData.tlf,
                    guest_email: formData.correo,
                    accommodation_id: id,
                    check_in: checkInStr,
                    check_out: checkOutStr,
                    adults: allocatedAdults,
                    children: allocatedChildren,
                    babies: allocatedBabies,
                    pets: allocatedPets,
                    total_amount: roomTotal,
                    amount_paid: roomDeposit,
                    payment_status: 'parcial',
                    payment_method: selectedPayment || 'transferencia',
                    status: initialStatus,
                    special_notes: `${notes}${N > 1 ? `. Código de grupo: ${bookingCode}` : ''}`,
                    locator: bookingCode
                  };
                });

                supabase.from('bookings').insert(insertRows).then(({ error }) => {
                  if (error) {
                    console.error('Error guardando la reserva en Supabase:', error);
                  }
                });

                onComplete({
                  unitName: selectedData.map(d => d.title).join(' + '),
                  checkIn: selectedDates.start.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }),
                  checkOut: selectedDates.end.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }),
                  bookingCode: bookingCode,
                  formData: formData,
                  occupants: occupants,
                  pricing: pricing,
                  totalStayPrice: totalStayPrice,
                  depositAmount: depositAmount,
                  remainingAmount: remainingAmount,
                  depositPercent: depositPercent,
                  remainingPolicyText: remainingPolicyText,
                  selectedPayment: selectedPayment,
                  totalNights: totalNights,
                  bcvEuroRate: bcvEuroRate
                });
              }
            }}
            className={`bg-brand-accent text-brand-wood px-8 py-4 rounded-2xl font-bold transition-all active:scale-95 ${!selectedPayment ? 'opacity-50 grayscale' : 'hover:bg-brand-accent/90'}`}
          >
            Reservar y Enviar a WhatsApp
          </button>
        </motion.div>
      )}

      {/* Media Pensión Info Modal */}
      <AnimatePresence>
        {mealsInfoOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMealsInfoOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            {/* Content Card */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[2rem] p-8 max-w-sm w-full relative z-10 shadow-2xl border border-brand-primary/5 text-center space-y-6"
            >
              <div className="w-16 h-16 bg-brand-terracotta/10 rounded-full flex items-center justify-center text-brand-terracotta mx-auto text-3xl">
                🍲
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-serif text-brand-wood">Media Pensión Incluida</h3>
                <p className="text-xs uppercase tracking-widest text-[#C5A059] font-bold">¿Qué incluye tu tarifa?</p>
              </div>
              <div className="text-brand-primary/75 text-sm leading-relaxed font-light text-left bg-brand-neutral/40 p-5 rounded-2xl border border-brand-primary/5 space-y-2">
                <p>Nuestras tarifas incluyen:</p>
                <p>✨ <strong>Hospedaje</strong> en habitaciones confortables.</p>
                <p>🍲 Exquisitas <strong>cenas servidas</strong> con un menú dirigido en <strong>4 tiempos</strong>.</p>
                <p>🍳 Deliciosos <strong>desayunos típicos andinos</strong> para comenzar el día. 😃</p>
              </div>
              <button 
                type="button"
                onClick={() => setMealsInfoOpen(false)}
                className="w-full py-3.5 bg-brand-terracotta hover:bg-brand-terracotta/90 text-white font-bold rounded-xl text-sm transition-all active:scale-95 shadow-lg shadow-brand-terracotta/20 cursor-pointer"
              >
                Entendido
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
                Máx 5kg
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
