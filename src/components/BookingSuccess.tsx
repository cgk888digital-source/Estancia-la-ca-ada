import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, ArrowRight, Home } from 'lucide-react';
import confetti from 'canvas-confetti';

interface BookingData {
  unitName: string;
  checkIn: string;
  checkOut: string;
  bookingCode: string;
}

interface BookingSuccessProps {
  data: BookingData;
  onGoToClub: () => void;
  onBackToHome: () => void;
}

const BookingSuccess: React.FC<BookingSuccessProps> = ({ data, onGoToClub, onBackToHome }) => {
  useEffect(() => {
    // Subtle gold and cream confetti rain
    const duration = 3 * 1000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 2,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#C5A059', '#FDFBF7', '#FAF9F6']
      });
      confetti({
        particleCount: 2,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#C5A059', '#FDFBF7', '#FAF9F6']
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };

    frame();
  }, []);

  return (
    <div className="min-h-full bg-[#FAF9F6] flex flex-col items-center px-8 py-16">
      {/* Success Icon */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.2 }}
        className="w-24 h-24 bg-[#C5A059]/10 rounded-full flex items-center justify-center mb-8"
      >
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <Check size={48} className="text-[#C5A059]" strokeWidth={3} />
        </motion.div>
      </motion.div>

      {/* Messages */}
      <div className="text-center space-y-4 mb-12">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-4xl font-serif text-brand-primary"
        >
          ¡Tu Estancia comienza aquí!
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="text-brand-primary/70 leading-relaxed max-w-[280px] mx-auto"
        >
          Tu reservación en <span className="font-semibold">Estancia La Cañada</span> se ha registrado satisfactoriamente. Hemos enviado los detalles y el código de confirmación a tu correo electrónico.
        </motion.p>
      </div>

      {/* Summary Card */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="w-full bg-white rounded-[2rem] p-8 border border-[#A65D47]/10 shadow-xl shadow-black/5 space-y-6 mb-12"
      >
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-[0.2em] text-brand-primary/40 font-bold">Alojamiento</p>
          <h3 className="text-xl font-serif text-brand-wood">{data.unitName}</h3>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-[0.2em] text-brand-primary/40 font-bold">Check-in</p>
            <p className="font-medium text-brand-primary">{data.checkIn}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-[0.2em] text-brand-primary/40 font-bold">Check-out</p>
            <p className="font-medium text-brand-primary">{data.checkOut}</p>
          </div>
        </div>

        <div className="pt-6 border-t border-brand-primary/5 flex justify-between items-center">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-brand-primary/40 font-bold">Código de Reserva</p>
            <p className="text-lg font-mono font-bold text-brand-terracotta">{data.bookingCode}</p>
          </div>
          <div className="w-12 h-12 bg-brand-neutral rounded-xl flex items-center justify-center text-brand-terracotta border border-brand-terracotta/10">
            <Check size={20} />
          </div>
        </div>
      </motion.div>

      {/* Action Buttons */}
      <div className="w-full space-y-4">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onGoToClub}
          className="w-full bg-brand-primary text-white py-5 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-xl shadow-brand-primary/20"
        >
          Ir a mis puntos Club Estancia
          <ArrowRight size={18} />
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onBackToHome}
          className="w-full py-5 rounded-2xl font-bold text-brand-primary/60 flex items-center justify-center gap-2"
        >
          <Home size={18} />
          Volver al Inicio
        </motion.button>
      </div>
    </div>
  );
};

export default BookingSuccess;
