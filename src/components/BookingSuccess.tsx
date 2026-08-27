import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, ArrowRight, Home, MessageSquare } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useHotelSettings } from '../utils/useHotelSettings';

interface BookingData {
  unitName: string;
  checkIn: string;
  checkOut: string;
  bookingCode: string;
  formData?: {
    nombre: string;
    apellido: string;
    ci: string;
    tlf: string;
    correo: string;
    referido?: string;
    sigueCircuito: boolean;
  };
  occupants?: {
    adults: number;
    children: number;
    babies: number;
    pets: number;
  };
  pricing?: {
    roomTotal: number;
    mealsTotal: number;
  };
  totalStayPrice?: number;
  depositAmount?: number;
  remainingAmount?: number;
  depositPercent?: number;
  remainingPolicyText?: string;
  selectedPayment?: 'zelle' | 'pago_movil' | 'transferencia' | null;
  totalNights?: number;
  bcvEuroRate?: number | null;
}

interface BookingSuccessProps {
  data: BookingData;
  onGoToClub: () => void;
  onBackToHome: () => void;
}

const BookingSuccess: React.FC<BookingSuccessProps> = ({ data, onGoToClub, onBackToHome }) => {
  const { settings: hotelSettings } = useHotelSettings();
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

  const handleReSendWhatsApp = () => {
    if (!data.formData) return;
    
    const whatsappText = `*Ficha de Reserva - Estancia La Cañada* 🏔️
              
*Nombre:* ${data.formData.nombre}
*Apellido:* ${data.formData.apellido}
*CI:* ${data.formData.ci}
*Tlf:* ${data.formData.tlf}
*Correo:* ${data.formData.correo}
*Fecha de entrada:* ${data.checkIn} *(Check-in a partir de las ${hotelSettings.checkin_time})*
*Fecha de salida:* ${data.checkOut} *(Check-out hasta las ${hotelSettings.checkout_time})* (${data.totalNights || 1} ${data.totalNights === 1 ? 'noche' : 'noches'})
*Tipo de Habitación:* ${data.unitName}
*Cantidad adultos:* ${data.occupants?.adults || 2}
*Cantidad de niños (3 a 12 años):* ${data.occupants?.children || 0}
*Cantidad de bebés (0 a 2 años):* ${data.occupants?.babies || 0}
*Persona que lo refirió:* ${data.formData.referido || 'Ninguna'}
*Sigue la Pag. @Circuitodelaexcelencia:* ${data.formData.sigueCircuito ? 'Sí ✅' : 'No ❌'}

---
*Resumen de Pago:*
*Hospedaje (${data.totalNights || 1} ${data.totalNights === 1 ? 'noche' : 'noches'}):* $${data.pricing?.roomTotal || 0}
*Alimentación (${data.totalNights || 1} ${data.totalNights === 1 ? 'noche' : 'noches'}):* $${data.pricing?.mealsTotal || 0}
*Total Estadía:* $${data.totalStayPrice || 0}
*Monto de Adelanto Requerido (${data.depositPercent || 50}%):* $${data.depositAmount || 0}
${data.remainingAmount !== undefined && data.remainingAmount > 0 ? `*Monto restante:* $${data.remainingAmount}\n*Política de saldo restante:* ${data.remainingPolicyText}` : '*Monto restante:* $0 (Reserva liquidada al 100%)'}

*Método de Pago Seleccionado:* ${data.selectedPayment === 'zelle' ? 'Zelle' : data.selectedPayment === 'pago_movil' ? 'Pago Móvil (Bancamiga)' : 'Transferencia Bancaria'}
${(data.selectedPayment === 'pago_movil' || data.selectedPayment === 'transferencia') && data.bcvEuroRate && data.depositAmount ? `*Monto en Bolívares a transferir:* Bs. ${(data.depositAmount * data.bcvEuroRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
*Tasa Oficial del Euro (BCV):* Bs. ${data.bcvEuroRate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
_(Nota: Los pagos en bolívares se calculan exclusivamente con la tasa oficial del euro publicada por el BCV.)_` : ''}
*Código de Reserva:* ${data.bookingCode}

Si desean formalizar la reservación deben transferir 50% por adelantado y el 50% restante 2 semanas antes de la llegada a la Estancia. 

*Pago a través de Zelle:* mariasusana01@hotmail.com 
Maria Araujo 

*Pago móvil / Transferencia:* Bancamiga 
04141294308 CI 10345954
01720110701108762467
Escagueyelc@gmail.com 
María Araujo

Muchas gracias por escoger a Estancia La Cañada para sus vacaciones! 😃`;

    const encodedText = encodeURIComponent(whatsappText);
    const whatsappUrl = `https://wa.me/584141294308?text=${encodedText}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="min-h-full bg-[#FAF9F6] flex flex-col items-center px-6 py-10 overflow-y-auto custom-scrollbar">
      {/* Success Icon */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.2 }}
        className="w-16 h-16 bg-[#C5A059]/10 rounded-full flex items-center justify-center mb-6 shrink-0"
      >
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <Check size={32} className="text-[#C5A059]" strokeWidth={3} />
        </motion.div>
      </motion.div>

      {/* Messages */}
      <div className="text-center space-y-2 mb-8 shrink-0">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-3xl font-serif text-brand-primary"
        >
          ¡Tu Estancia comienza aquí!
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="text-brand-primary/70 text-xs leading-relaxed max-w-[320px] mx-auto"
        >
          Tu reservación en <span className="font-semibold">Estancia La Cañada</span> se ha registrado satisfactoriamente. Por favor formaliza tu reserva realizando el pago correspondiente.
        </motion.p>
      </div>

      {/* Summary Card */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="w-full bg-white rounded-[2rem] p-6 border border-[#A65D47]/10 shadow-xl shadow-black/5 space-y-4 mb-8 text-xs"
      >
        <div className="space-y-1">
          <p className="text-[9px] uppercase tracking-[0.2em] text-brand-primary/40 font-bold">Alojamiento Seleccionado</p>
          <h3 className="text-lg font-serif text-brand-wood">{data.unitName}</h3>
        </div>

        <div className="grid grid-cols-2 gap-4 py-2 border-y border-brand-primary/5">
          <div className="space-y-0.5">
            <p className="text-[9px] uppercase tracking-[0.2em] text-brand-primary/40 font-bold">Check-in</p>
            <p className="font-medium text-brand-primary text-xs">{data.checkIn}</p>
            <p className="text-[10px] text-brand-terracotta font-bold flex items-center gap-0.5">
              🕑 A partir de las {hotelSettings.checkin_time}
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[9px] uppercase tracking-[0.2em] text-brand-primary/40 font-bold">Check-out</p>
            <p className="font-medium text-brand-primary text-xs">{data.checkOut}</p>
            <p className="text-[10px] text-brand-terracotta font-bold flex items-center gap-0.5">
              🕚 Hasta las {hotelSettings.checkout_time}
            </p>
          </div>
        </div>

        {data.formData && (
          <div className="space-y-2 py-1">
            <p className="text-[9px] uppercase tracking-[0.2em] text-brand-primary/40 font-bold">Datos del Huésped</p>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-brand-primary/70">
              <p><span className="font-semibold">Nombre:</span> {data.formData.nombre} {data.formData.apellido}</p>
              <p><span className="font-semibold">CI:</span> {data.formData.ci}</p>
              <p><span className="font-semibold">Teléfono:</span> {data.formData.tlf}</p>
              <p className="col-span-2"><span className="font-semibold">Correo:</span> {data.formData.correo}</p>
              {data.occupants && (
                <p className="col-span-2 mt-1 bg-brand-neutral/40 p-2 rounded-lg text-[10px] text-brand-wood">
                  👪 <span className="font-bold">Grupo:</span> {data.occupants.adults} Ad. 
                  {data.occupants.children > 0 && ` | ${data.occupants.children} Niñ.`}
                  {data.occupants.babies > 0 && ` | ${data.occupants.babies} Beb.`}
                  {data.occupants.pets > 0 && ` | ${data.occupants.pets} Masc.`}
                </p>
              )}
            </div>
          </div>
        )}

        {data.totalStayPrice && (
          <div className="pt-3 border-t border-brand-primary/5 space-y-2 bg-[#FDFBF7] p-3.5 rounded-2xl border border-brand-primary/5">
            <div className="flex justify-between text-[11px] text-brand-primary/70">
              <span>Hospedaje ({data.totalNights || 1} {data.totalNights === 1 ? 'noche' : 'noches'}):</span>
              <span className="font-semibold text-brand-primary">${data.pricing?.roomTotal || 0}</span>
            </div>
            <div className="flex justify-between text-[11px] text-brand-primary/70">
              <span>Alimentación ({data.totalNights || 1} {data.totalNights === 1 ? 'noche' : 'noches'}):</span>
              <span className="font-semibold text-brand-primary">${data.pricing?.mealsTotal || 0}</span>
            </div>
            <div className="flex justify-between text-[11.5px] font-semibold text-brand-primary border-t border-brand-primary/5 pt-1.5">
              <span>Total Estadía:</span>
              <span className="font-bold">${data.totalStayPrice}</span>
            </div>
            
            <div className="flex justify-between text-[11.5px] font-bold text-brand-wood bg-brand-neutral/80 p-2 rounded-xl border border-brand-primary/5">
              <span>Adelanto Requerido ({data.depositPercent || 50}%):</span>
              <span className="text-brand-terracotta">${data.depositAmount}</span>
            </div>

            {data.remainingAmount !== undefined && data.remainingAmount > 0 ? (
              <div className="space-y-1 bg-[#FAF9F6] p-2 rounded-xl border border-brand-primary/5 mt-1">
                <div className="flex justify-between text-[11px] text-brand-primary/70">
                  <span>Saldo Restante (50%):</span>
                  <span className="font-bold text-brand-primary">${data.remainingAmount}</span>
                </div>
                {data.remainingPolicyText && (
                  <p className="text-[9px] text-brand-terracotta font-medium leading-tight mt-0.5">
                    ⚠️ {data.remainingPolicyText}
                  </p>
                )}
              </div>
            ) : (
              <div className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-100 p-2 rounded-xl text-center font-bold mt-1">
                ✅ Reserva pre-pagada al 100%
              </div>
            )}

            <p className="text-[9px] text-brand-primary/60 text-center leading-relaxed px-2 py-1">
              <strong>Importante:</strong> Los pagos en bolívares (Bs.) se calculan exclusivamente con la tasa oficial del euro (EUR) publicada por el Banco Central de Venezuela (BCV).
            </p>

            {/* Desglose Pago Móvil / Transferencia en Bolívares */}
            {(data.selectedPayment === 'pago_movil' || data.selectedPayment === 'transferencia') && data.bcvEuroRate && data.depositAmount && (
              <div className="space-y-2 mt-2 pt-2 border-t border-brand-primary/5">
                <div className="p-2.5 bg-brand-terracotta/5 rounded-xl border border-brand-terracotta/10 space-y-0.5 animate-fade-in">
                  <p className="text-[8px] uppercase tracking-widest text-brand-terracotta font-bold text-center">Monto a transferir en {data.selectedPayment === 'pago_movil' ? 'Pago Móvil' : 'Transferencia'}</p>
                  <p className="text-xs font-bold text-brand-wood font-mono text-center">
                    Bs. {(data.depositAmount * data.bcvEuroRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-[8px] text-brand-primary/50 text-center">
                    Tasa Oficial del Euro (BCV): Bs. {data.bcvEuroRate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            )}

            <p className="text-[9px] text-brand-primary/50 text-center italic leading-tight pt-1">
              Método seleccionado: <span className="font-bold uppercase text-brand-wood">{data.selectedPayment === 'zelle' ? 'Zelle' : data.selectedPayment === 'pago_movil' ? 'Pago Móvil' : 'Transferencia Bancaria'}</span>
            </p>
          </div>
        )}

        <div className="pt-4 border-t border-brand-primary/5 flex justify-between items-center">
          <div>
            <p className="text-[9px] uppercase tracking-[0.2em] text-brand-primary/40 font-bold">Código de Reserva</p>
            <p className="text-base font-mono font-bold text-brand-terracotta">{data.bookingCode}</p>
          </div>
          <div className="w-10 h-10 bg-brand-neutral rounded-xl flex items-center justify-center text-brand-terracotta border border-brand-terracotta/10">
            <Check size={16} />
          </div>
        </div>
      </motion.div>

      {/* Payment Instructions Note */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="w-full bg-[#FAF9F6] border border-[#C5A059]/30 p-5 rounded-[2rem] mb-8 space-y-4 shadow-sm"
      >
        <p className="text-xs text-brand-primary leading-relaxed font-medium">
          <span className="font-bold text-brand-wood">⚠️ Importante:</span> Si desean formalizar la reservación deben transferir 50% por adelantado y el 50% restante 2 semanas antes de la llegada a la Estancia.
        </p>
        <div className="bg-white p-4 rounded-2xl border border-brand-primary/10 text-[11px] text-brand-primary/80 space-y-4 font-mono shadow-sm">
          <div>
            <p className="font-bold text-brand-wood font-sans text-[10px] uppercase tracking-widest mb-1">Pago a través de Zelle:</p>
            <p>mariasusana01@hotmail.com</p>
            <p>Maria Araujo</p>
          </div>
          <div className="pt-2 border-t border-brand-primary/5">
            <p className="font-bold text-brand-wood font-sans text-[10px] uppercase tracking-widest mb-1">Pago móvil / Transferencia:</p>
            <p>Bancamiga (0172)</p>
            <p>04141294308 | CI 10345954</p>
            <p>01720110701108762467</p>
            <p>Escagueyelc@gmail.com | María Araujo</p>
          </div>
        </div>
      </motion.div>

      {/* Action Buttons */}
      <div className="w-full space-y-3 shrink-0">
        {data.formData && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleReSendWhatsApp}
            className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-xl shadow-emerald-600/20 text-sm"
          >
            <MessageSquare size={18} />
            Enviar Ficha por WhatsApp
          </motion.button>
        )}

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onGoToClub}
          className="w-full bg-brand-primary text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-xl shadow-brand-primary/10 text-sm"
        >
          Ir a mis puntos Club Estancia
          <ArrowRight size={18} />
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onBackToHome}
          className="w-full py-4 rounded-2xl font-bold text-brand-primary/60 flex items-center justify-center gap-2 text-xs"
        >
          <Home size={16} />
          Volver al Inicio
        </motion.button>
      </div>
    </div>
  );
};

export default BookingSuccess;
