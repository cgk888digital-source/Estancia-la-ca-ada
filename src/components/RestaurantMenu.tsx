import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Wine, Clock, Users } from 'lucide-react'
import { getMenu } from '../utils/menuStore'
import { weeklyMenu } from '../data/weeklyMenu'

const galleryPlatos = [
  { src: '/assets/restaurante/platos/ceviche.png',          label: 'Ceviche del Día' },
  { src: '/assets/restaurante/platos/bocado-1.png',         label: 'Bocado de Autor' },
  { src: '/assets/restaurante/platos/tartare-aguacate.png', label: 'Tartare de Atún' },
  { src: '/assets/restaurante/platos/pescado-grill.png',    label: 'Pescado a la Plancha' },
  { src: '/assets/restaurante/platos/ravioli.png',          label: 'Ravioli Artesanal' },
  { src: '/assets/restaurante/platos/ensalada.png',         label: 'Ensalada Fresca' },
  { src: '/assets/restaurante/platos/trucha-verduras.png',  label: 'Trucha del Páramo' },
  { src: '/assets/restaurante/platos/carne-papas.png',      label: 'Carne de Res' },
  { src: '/assets/restaurante/platos/milanesa.png',         label: 'Milanesa de la Casa' },
  { src: '/assets/restaurante/platos/sopa-cebolla.png',     label: 'Sopa Gratinada' },
  { src: '/assets/restaurante/platos/postre-fresas.png',    label: 'Fresas con Crema' },
  { src: '/assets/restaurante/platos/postre-crepe.png',     label: 'Crepe de Chocolate' },
]

const RestaurantMenu: React.FC<{ onBack: () => void; onOpenCava: () => void }> = ({ onBack, onOpenCava }) => {
  const [activeTab, setActiveTab] = useState('almuerzo')
  const [menu, setMenu] = useState(weeklyMenu)

  useEffect(() => { getMenu().then(setMenu) }, [])

  const activeSection = menu.find(s => s.id === activeTab) ?? menu[0]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen bg-brand-neutral text-brand-primary font-sans pb-32"
    >
      {/* ── HERO ── */}
      <div className="relative h-[55vh] w-full overflow-hidden">
        <img
          src="/assets/restaurante/hero.jpg"
          alt="Restaurante La Cañada"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/20" />

        <button
          onClick={onBack}
          className="absolute top-6 left-6 z-20 p-2 bg-black/30 backdrop-blur-md rounded-full border border-white/20 text-white"
        >
          <ChevronLeft size={20} />
        </button>

        <div className="absolute bottom-0 left-0 w-full p-7">
          <motion.div initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}>
            <span className="text-brand-accent text-[10px] uppercase tracking-[0.45em] font-bold block mb-2">
              Cocina de La Cañada
            </span>
            <h1 className="text-white text-4xl font-serif leading-tight mb-2">
              Gastronomía<br />de Origen
            </h1>
            <p className="text-white/70 text-xs leading-relaxed max-w-[260px]">
              Productos locales, fuego de leña y recetas que celebran el territorio andino.
            </p>
          </motion.div>
        </div>
      </div>

      {/* ── VIDEO COCINA ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="px-5 mt-5"
      >
        <div className="rounded-2xl overflow-hidden" style={{ aspectRatio: '16/9' }}>
          <video
            src="/assets/restaurante/video-cocina.mov"
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
          />
        </div>
      </motion.div>

      {/* ── AMBIENTE — chefs + interior ── */}
      <section className="px-5 mt-8">
        <div className="mb-4">
          <span className="text-brand-terracotta text-[10px] uppercase tracking-[0.4em] font-bold block mb-1">Nuestra Cocina</span>
          <h2 className="text-2xl font-serif text-brand-primary">El arte en el plato</h2>
        </div>

        {/* 2 verticales lado a lado */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          {[
            { src: '/assets/restaurante/chef-1.png',  caption: 'Arepas artesanales' },
            { src: '/assets/restaurante/chef-2.png',  caption: 'Horneados del día' },
          ].map((img, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              className="relative rounded-2xl overflow-hidden"
              style={{ aspectRatio: '3/4' }}
            >
              <img src={img.src} alt={img.caption} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              <span className="absolute bottom-3 left-3 text-white text-[10px] font-bold tracking-wide">
                {img.caption}
              </span>
            </motion.div>
          ))}
        </div>

        {/* Interior de noche — full width */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative rounded-2xl overflow-hidden"
          style={{ height: 200 }}
        >
          <img src="/assets/restaurante/interior-noche.png" alt="Restaurante de noche" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          <div className="absolute bottom-4 left-5 right-5 flex justify-between items-end">
            <span className="text-white text-sm font-serif italic">Un ambiente para recordar</span>
          </div>
        </motion.div>
      </section>

      {/* ── GALERÍA DE PLATOS ── */}
      <section className="px-5 mt-12">
        <div className="mb-6">
          <span className="text-brand-terracotta text-[10px] uppercase tracking-[0.4em] font-bold block mb-1">Nuestros Platos</span>
          <h2 className="text-2xl font-serif text-brand-primary">Lo que llega a tu mesa</h2>
          <p className="text-brand-primary/50 text-xs mt-1">Elaborados con productos frescos de la región andina.</p>
        </div>

        {/* Grid mixto */}
        <div className="flex flex-col gap-3">
          {/* Full width — primer plato destacado */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }} whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative rounded-2xl overflow-hidden"
            style={{ height: 240 }}
          >
            <img src={galleryPlatos[0].src} alt={galleryPlatos[0].label} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
            <span className="absolute bottom-4 left-4 text-white font-serif text-lg">{galleryPlatos[0].label}</span>
            <span className="absolute top-4 right-4 bg-brand-accent/90 text-white text-[9px] uppercase tracking-widest font-bold px-3 py-1.5 rounded-full">
              Entrada
            </span>
          </motion.div>

          {/* Fila de 2 */}
          <div className="grid grid-cols-2 gap-3">
            {galleryPlatos.slice(1, 3).map((p, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                className="relative rounded-2xl overflow-hidden"
                style={{ height: 160 }}
              >
                <img src={p.src} alt={p.label} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
                <span className="absolute bottom-2 left-2 right-2 text-white text-[11px] font-bold leading-tight">{p.label}</span>
              </motion.div>
            ))}
          </div>

          {/* Full width — principal destacado */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }} whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative rounded-2xl overflow-hidden"
            style={{ height: 220 }}
          >
            <img src={galleryPlatos[3].src} alt={galleryPlatos[3].label} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            <div className="absolute bottom-4 left-4">
              <span className="text-brand-accent text-[9px] uppercase tracking-widest font-bold block mb-1">Principal</span>
              <span className="text-white font-serif text-lg">{galleryPlatos[3].label}</span>
            </div>
          </motion.div>

          {/* Fila de 2 */}
          <div className="grid grid-cols-2 gap-3">
            {galleryPlatos.slice(4, 6).map((p, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                className="relative rounded-2xl overflow-hidden"
                style={{ height: 160 }}
              >
                <img src={p.src} alt={p.label} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
                <span className="absolute bottom-2 left-2 right-2 text-white text-[11px] font-bold leading-tight">{p.label}</span>
              </motion.div>
            ))}
          </div>

          {/* Fila de 3 pequeñas */}
          <div className="grid grid-cols-3 gap-2">
            {galleryPlatos.slice(6, 9).map((p, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.07 }}
                className="relative rounded-xl overflow-hidden"
                style={{ height: 120 }}
              >
                <img src={p.src} alt={p.label} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <span className="absolute bottom-1.5 left-1.5 right-1.5 text-white text-[9px] font-bold leading-tight">{p.label}</span>
              </motion.div>
            ))}
          </div>

          {/* Full width — postre destacado */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }} whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative rounded-2xl overflow-hidden bg-brand-wood"
            style={{ height: 200 }}
          >
            <img src={galleryPlatos[11].src} alt={galleryPlatos[11].label} className="w-full h-full object-cover opacity-90" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
            <div className="absolute bottom-4 left-4">
              <span className="text-brand-accent text-[9px] uppercase tracking-widest font-bold block mb-1">Postre</span>
              <span className="text-white font-serif text-lg">{galleryPlatos[11].label}</span>
            </div>
          </motion.div>

          {/* Última fila de 2 — postres */}
          <div className="grid grid-cols-2 gap-3">
            {galleryPlatos.slice(9, 11).map((p, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                className="relative rounded-2xl overflow-hidden"
                style={{ height: 150 }}
              >
                <img src={p.src} alt={p.label} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
                <span className="absolute bottom-2 left-2 right-2 text-white text-[11px] font-bold leading-tight">{p.label}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── MENÚ DE LA SEMANA ── */}
      <section className="px-5 mt-14">
        <div className="mb-6">
          <span className="text-brand-terracotta text-[10px] uppercase tracking-[0.4em] font-bold block mb-1">Actualizado semanalmente</span>
          <h2 className="text-2xl font-serif text-brand-primary">Menú de la Semana</h2>
        </div>

        {/* Tabs */}
        <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-brand-primary/5 mb-6">
          {menu.map(section => (
            <button
              key={section.id}
              onClick={() => setActiveTab(section.id)}
              className={`flex-1 py-2.5 rounded-xl text-[10px] uppercase tracking-widest font-bold transition-all ${
                activeTab === section.id
                  ? 'bg-brand-wood text-white shadow-lg'
                  : 'text-brand-primary/50 hover:text-brand-primary'
              }`}
            >
              {section.emoji} {section.label}
            </button>
          ))}
        </div>

        {/* Included notice */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {activeSection.included && (
              <div className="flex items-center gap-2 mb-5 bg-brand-olive/10 border border-brand-olive/20 rounded-xl px-4 py-2.5">
                <span className="text-brand-olive text-xs">✓</span>
                <span className="text-brand-olive text-xs font-bold">{activeSection.included}</span>
              </div>
            )}

            {/* Dish list */}
            <div className="flex flex-col gap-4">
              {activeSection.items.map((dish, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="bg-white rounded-2xl overflow-hidden shadow-sm border border-brand-primary/5 flex"
                >
                  {/* Foto del plato si existe */}
                  {dish.image && (
                    <div className="w-24 flex-none overflow-hidden">
                      <img
                        src={dish.image!.startsWith('data:') ? dish.image! : `/assets/restaurante/${dish.image}`}
                        alt={dish.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className={`flex flex-col justify-center p-4 flex-1 ${!dish.image ? 'border-l-4 border-brand-accent' : ''}`}>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="text-sm font-serif text-brand-wood leading-tight">{dish.name}</h3>
                      {dish.price && (
                        <span className={`text-xs font-bold whitespace-nowrap flex-none ${dish.price === 'Incluido' ? 'text-brand-olive' : 'text-brand-accent'}`}>
                          {dish.price}
                        </span>
                      )}
                    </div>
                    {dish.description && (
                      <p className="text-brand-primary/55 text-[11px] leading-relaxed">{dish.description}</p>
                    )}
                    {dish.tag && (
                      <span className="mt-2 self-start text-[9px] uppercase tracking-widest border border-brand-olive/30 text-brand-olive px-2 py-0.5 rounded-full font-bold">
                        {dish.tag}
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Horario e info */}
        <div className="mt-8 grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl p-4 border border-brand-primary/5 shadow-sm flex items-center gap-3">
            <Clock size={18} className="text-brand-accent flex-none" />
            <div>
              <p className="text-[9px] uppercase tracking-widest text-brand-primary/40 font-bold mb-0.5">Horario</p>
              <p className="text-xs font-bold text-brand-wood">7am · 12pm · 7pm</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-brand-primary/5 shadow-sm flex items-center gap-3">
            <Users size={18} className="text-brand-accent flex-none" />
            <div>
              <p className="text-[9px] uppercase tracking-widest text-brand-primary/40 font-bold mb-0.5">Reservas</p>
              <p className="text-xs font-bold text-brand-wood">Recepción</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CAVA VIRTUAL CTA ── */}
      <section className="px-5 mt-12">
        <motion.div
          initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          onClick={onOpenCava}
          className="relative h-[220px] rounded-3xl overflow-hidden cursor-pointer group"
        >
          <img
            src="/assets/restaurante/mesa-elegante.png"
            alt="Cava Virtual"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-brand-wood/85 via-brand-wood/40 to-transparent" />
          <div className="absolute inset-0 flex flex-col items-center justify-end pb-7 text-center px-6">
            <Wine className="text-brand-accent mb-3" size={32} />
            <h3 className="text-white text-2xl font-serif mb-1">Cava Virtual</h3>
            <p className="text-white/60 text-xs mb-4">Etiquetas seleccionadas por nuestro sommelier</p>
            <div className="flex items-center gap-1.5 text-brand-accent text-[10px] uppercase tracking-[0.3em] font-bold">
              Explorar <ChevronRight size={12} />
            </div>
          </div>
        </motion.div>
      </section>
    </motion.div>
  )
}

export default RestaurantMenu
