import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Award, Star, History, Gift, CheckCircle2, Crown, Sparkles, ShoppingBag, Coins, Repeat2 } from 'lucide-react';

const ClubEstancia: React.FC = () => {
  const [points] = useState(2450);
  const nextLevelPoints = 3000;
  const progress = (points / nextLevelPoints) * 100;

  const benefits = [
    { id: 1, title: "Almuerzo Especial para Dos", cost: 600, icon: <Gift size={18} /> },
    { id: 2, title: "Botella de Vino de la Cava", cost: 800, icon: <Sparkles size={18} /> },
    { id: 3, title: "Descuento de $50 USD en Reserva", cost: 1500, icon: <Crown size={18} /> },
  ];

  const history = [
    { id: 1, date: "Marzo 2026", location: "Cabaña de la Pampa", points: "+150" },
    { id: 2, date: "Diciembre 2025", location: "Habitación Boutique", points: "+120" },
    { id: 3, date: "Agosto 2025", location: "Cabaña del Bosque", points: "+200" },
  ];

  const [redeeming, setRedeeming] = useState<number | null>(null);

  const handleRedeem = (id: number) => {
    setRedeeming(id);
    setTimeout(() => setRedeeming(null), 2000);
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-brand-primary font-sans pb-32 overflow-y-auto custom-scrollbar">
      {/* Header */}
      <header className="px-6 py-10">
        <span className="text-brand-terracotta text-[10px] uppercase tracking-[0.4em] font-bold mb-1 block">Miembro Exclusivo</span>
        <h1 className="text-3xl font-serif leading-tight">Club La Estancia<br />de La Cañada</h1>
      </header>

      {/* Virtual Card Section — va antes de Cómo Funciona */}
      <div className="px-6 mb-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative h-56 w-full rounded-[2.5rem] overflow-hidden shadow-2xl shadow-[#C5A059]/30 border border-[#C5A059]/20"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#D4AF37] via-[#C5A059] to-[#8B7355]" />
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear", repeatDelay: 1 }}
            className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12"
          />
          <div className="relative h-full p-8 flex flex-col justify-between text-white">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] uppercase tracking-widest font-bold opacity-70">Nivel Actual</p>
                <h2 className="text-2xl font-serif flex items-center gap-2">
                  Socio Oro <Award size={20} className="fill-current" />
                </h2>
              </div>
              <Sparkles size={24} className="opacity-40" />
            </div>
            <div className="space-y-4">
              <div className="flex gap-4 opacity-80">
                <div className="w-10 h-6 bg-white/20 rounded-md border border-white/30" />
                <div className="flex gap-1 items-center">
                  <div className="w-1 h-1 rounded-full bg-white/50" />
                  <div className="w-1 h-1 rounded-full bg-white/50" />
                  <div className="w-1 h-1 rounded-full bg-white/50" />
                  <div className="w-1 h-1 rounded-full bg-white/50" />
                  <span className="text-[10px] font-mono">8829</span>
                </div>
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-[8px] uppercase tracking-widest font-bold opacity-60">Nombre del Miembro</p>
                  <p className="text-lg font-serif">Mateo Arandía</p>
                </div>
                <div className="text-right">
                  <p className="text-[8px] uppercase tracking-widest font-bold opacity-60">ID Miembro</p>
                  <p className="text-xs font-mono">EC-4492-2026</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Cómo Funciona */}
      <section className="px-6 mb-10">
        <h2 className="text-xl font-serif mb-5">¿Cómo funciona?</h2>
        <div className="flex flex-col gap-3">
          {[
            {
              icon: <ShoppingBag size={20} />,
              title: 'Acumula con cada consumo',
              desc: 'Gana 1 punto por cada $1 gastado en hospedaje, restaurante o consumos de bodega. (Las excursiones se pagan por separado a terceros y no acumulan puntos).',
              color: 'bg-brand-accent/10 text-brand-accent',
            },
            {
              icon: <Coins size={20} />,
              title: 'Sube de nivel',
              desc: 'A mayor acumulación, mayor es tu nivel: Plata → Oro → Platino. Cada nivel desbloquea beneficios exclusivos.',
              color: 'bg-brand-terracotta/10 text-brand-terracotta',
            },
            {
              icon: <Repeat2 size={20} />,
              title: 'Canjea tus puntos',
              desc: 'Usa tus puntos acumulados para obtener almuerzos especiales, botellas de vino de la cava o descuentos en tus futuras reservas.',
              color: 'bg-brand-olive/10 text-brand-olive',
            },
          ].map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-white rounded-2xl p-5 flex items-start gap-4 shadow-sm shadow-black/5"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${step.color}`}>
                {step.icon}
              </div>
              <div>
                <p className="font-serif text-brand-primary text-sm mb-0.5">{step.title}</p>
                <p className="text-brand-primary/50 text-xs leading-relaxed">{step.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>


      {/* Points Dashboard */}
      <div className="px-6 mb-12">
        <div className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-black/5 flex items-center justify-between">
          <div className="relative w-28 h-28 shrink-0">
            {/* Circular Progress */}
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="56" cy="56" r="48"
                className="stroke-brand-neutral fill-none"
                strokeWidth="8"
              />
              <motion.circle
                cx="56" cy="56" r="48"
                className="stroke-[#C5A059] fill-none"
                strokeWidth="8"
                strokeDasharray="301.59"
                initial={{ strokeDashoffset: 301.59 }}
                animate={{ strokeDashoffset: 301.59 * (1 - progress / 100) }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-sm font-bold text-brand-terracotta">{Math.round(progress)}%</span>
              <span className="text-[7px] uppercase tracking-widest text-brand-primary/40 font-bold">Platino</span>
            </div>
          </div>

          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-brand-primary/40 mb-1">Puntos Acumulados</p>
            <div className="flex items-center justify-end gap-2 text-3xl font-serif text-brand-wood">
              {points.toLocaleString()} <span className="text-sm font-sans font-bold text-[#C5A059]">PTS</span>
            </div>
            <p className="text-[9px] text-brand-primary/60 mt-2">
              Faltan <span className="font-bold">{nextLevelPoints - points} pts</span> para el nivel Platino
            </p>
          </div>
        </div>
      </div>

      {/* Benefits Catalog */}
      <section className="px-6 mb-12">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-serif">Canjear Beneficios</h3>
          <span className="text-[10px] uppercase tracking-widest font-bold text-brand-terracotta">Ver Todo</span>
        </div>
        
        <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
          {benefits.map((b) => (
            <motion.div
              key={b.id}
              className="min-w-[200px] bg-white p-6 rounded-[2rem] shadow-lg shadow-black/5 flex flex-col justify-between"
            >
              <div className="w-10 h-10 bg-[#C5A059]/10 rounded-xl flex items-center justify-center text-[#C5A059] mb-4">
                {b.icon}
              </div>
              <div>
                <h4 className="font-serif text-lg leading-tight mb-2">{b.title}</h4>
                <p className="text-brand-terracotta font-bold text-xs">{b.cost} PTS</p>
              </div>
              <button
                onClick={() => handleRedeem(b.id)}
                disabled={redeeming !== null}
                className={`mt-6 w-full py-2.5 rounded-xl text-[10px] uppercase tracking-widest font-bold transition-all
                  ${redeeming === b.id 
                    ? 'bg-brand-olive text-white' 
                    : 'bg-brand-neutral text-brand-primary hover:bg-brand-terracotta hover:text-white'}
                `}
              >
                {redeeming === b.id ? (
                  <span className="flex items-center justify-center gap-2">
                    <CheckCircle2 size={12} /> Canjeado
                  </span>
                ) : 'Canjear Ahora'}
              </button>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Gift Cards */}
      <section className="px-6 mb-12">
        <div className="mb-5">
          <span className="text-brand-terracotta text-[10px] uppercase tracking-[0.4em] font-bold block mb-1">El regalo perfecto</span>
          <h3 className="text-xl font-serif">Gift Cards</h3>
          <p className="text-brand-primary/50 text-xs mt-1 leading-relaxed">
            Regala una experiencia única en La Cañada a tus familiares y amigos. Válidas únicamente para consumos de hospedaje, restaurante y nuestra selecta bodega de vinos. (Excluye excursiones externas).
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {[
            { value: 100, pay: 90,  discount: 10 },
            { value: 200, pay: 180, discount: 10 },
          ].map((card) => (
            <motion.div
              key={card.value}
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden rounded-[2rem] shadow-xl shadow-[#C5A059]/20"
            >
              {/* Background */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#3D2B1F] via-[#5a3e2b] to-[#2a1f15]" />
              <motion.div
                initial={{ x: '-100%' }} animate={{ x: '200%' }}
                transition={{ duration: 5, repeat: Infinity, ease: 'linear', repeatDelay: 3 }}
                className="absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-[#C5A059]/15 to-transparent skew-x-12 pointer-events-none"
              />

              <div className="relative p-6">
                {/* Título Tarjeta de Regalo */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Gift size={14} className="text-[#C5A059]" />
                    <span className="text-[#C5A059] text-xs uppercase tracking-[0.3em] font-bold">Tarjeta de Regalo</span>
                  </div>
                  <div className="bg-[#C5A059] text-white text-[9px] uppercase tracking-widest font-bold px-3 py-1.5 rounded-full">
                    {card.discount}% OFF
                  </div>
                </div>

                {/* Línea decorativa */}
                <div className="border-t border-[#C5A059]/20 mb-4" />

                {/* Header row */}
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.4em] text-[#C5A059]/70 font-bold mb-1">Estancia La Cañada</p>
                    <h4 className="text-3xl font-serif text-white">${card.value} <span className="text-base text-white/50">USD</span></h4>
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-white/10 my-4" />

                {/* Price & CTA */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white/40 text-[10px] uppercase tracking-widest mb-0.5">Precio especial</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-[#C5A059]">${card.pay}</span>
                      <span className="text-white/40 text-xs line-through">${card.value}</span>
                    </div>
                  </div>
                  <button className="bg-[#C5A059] hover:bg-[#d4b96a] active:scale-95 text-white font-bold text-xs uppercase tracking-widest px-5 py-3 rounded-xl transition-all flex items-center gap-2">
                    <Gift size={14} /> Comprar
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <p className="text-center text-brand-primary/40 text-[10px] mt-4 leading-relaxed">
          Las Gift Cards son válidas por 12 meses · Pago exclusivo en dólares (USD) · Excluye excursiones externas
        </p>
      </section>

      {/* History Section */}
      <section className="px-6">
        <div className="flex items-center gap-3 mb-6">
          <History size={20} className="text-brand-primary/40" />
          <h3 className="text-xl font-serif">Historial de Estancias</h3>
        </div>

        <div className="bg-white rounded-[2.5rem] p-6 shadow-xl shadow-black/5 divide-y divide-brand-primary/5">
          {history.map((h) => (
            <div key={h.id} className="py-4 first:pt-0 last:pb-0 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-brand-neutral rounded-full flex items-center justify-center text-brand-primary/40">
                  <Star size={16} />
                </div>
                <div>
                  <p className="text-sm font-medium text-brand-primary">{h.location}</p>
                  <p className="text-[10px] text-brand-primary/40 uppercase tracking-widest">{h.date}</p>
                </div>
              </div>
              <div className="text-brand-olive font-bold text-xs">
                {h.points} pts
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default ClubEstancia;
