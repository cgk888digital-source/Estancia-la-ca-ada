import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Utensils, Compass, Award, ChevronRight, Menu as MenuIcon, X, Home, Calendar, HelpCircle, ChevronDown, MapPin, Phone, Mail } from 'lucide-react';

const EstanciaHome: React.FC<{
  onOpenMenu: () => void,
  onOpenExcursions: () => void,
  onOpenBooking: () => void,
  onNavigate: (s: any) => void
}> = ({ onOpenExcursions, onOpenBooking, onNavigate }) => {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [openFaq, setOpenFaq] = React.useState<number | null>(null);

  const faqs = [
    {
      question: "¿Qué precio tiene la habitación para 2 personas?",
      answer: "La tarifa para 2 personas por noche ronda entre $172 y $176 en temporada baja (según la habitación). Nuestras tarifas incluyen hospedaje en habitaciones confortables y pensión completa: ¡exquisitas cenas servidas con un menú dirigido en 4 tiempos ($36/persona) y deliciosos desayunos típicos andinos ($20/persona) incluidos! 😃"
    },
    {
      question: "¿Qué precio tiene la habitación para 2 adultos y 1 niño?",
      answer: "La tarifa para 2 adultos y 1 niño (3 a 12 años) por noche ronda entre $220 y $224 en temporada baja. Incluye el hospedaje, desayunos típicos andinos para los tres, cenas de 4 tiempos para los adultos y cenas adaptadas para niños ($28). 😃"
    },
    {
      question: "¿Cuál es la tarifa para 2 adultos y 2 niños?",
      answer: "La tarifa para 2 adultos y 2 niños (3 a 12 años) por noche es de $272 en temporada baja (en nuestra Galería Llano Grande). Incluye hospedaje y alimentación completa (cenas y desayunos) para todo el grupo. Los bebés de 0 a 2 años se hospedan gratis. 😃"
    },
    {
      question: "¿Cuál es el costo para 3 adultos?",
      answer: "La tarifa para 3 adultos por noche ronda entre $228 y $232 en temporada baja. Incluye el hospedaje de tres personas y su alimentación completa de cenas dirigidas y desayunos típicos."
    },
    {
      question: "¿Cuáles son las capacidades de las Cabañas Grandes?",
      answer: "Nuestras cabañas de 3 habitaciones y 3 baños (La Lomita y Mitibibó) se reservan para un mínimo de 6 personas y admiten un máximo de 10 y 9 personas respectivamente. Cuentan con salón con chimenea de piedra, cocina equipada y estacionamiento propio."
    },
    {
      question: "¿Aceptan hospedaje sin comidas?",
      answer: "No. Solo aceptamos hospedaje con cenas y desayunos incluidos. La gastronomía andina y la cena de 4 tiempos son parte fundamental de la experiencia en la estancia."
    },
    {
      question: "¿Cómo se formaliza la reservación y cuáles son las políticas?",
      answer: "Nuestra política de pago es:\n• Para reservas con 15 días o menos de anticipación: se requiere el 100% por adelantado.\n• Para reservas con más tiempo: se abona el 50% por adelantado y el 50% restante se cancela 1 mes antes si es Temporada Alta (Diciembre, feriados, etc.) o 1 semana antes si es Temporada Baja."
    }
  ];

  const menuItems = [
    { id: 'home', label: 'Inicio', icon: <Home size={20} />, action: () => { onNavigate('home'); setIsMenuOpen(false); } },
    { id: 'restaurant', label: 'Restaurante', icon: <Utensils size={20} />, action: () => { onNavigate('restaurant'); setIsMenuOpen(false); } },
    { id: 'excursions', label: 'Excursiones', icon: <Compass size={20} />, action: () => { onNavigate('excursions'); setIsMenuOpen(false); } },
    { id: 'reservas', label: 'Reservar Ahora', icon: <Calendar size={20} />, action: () => { onOpenBooking(); setIsMenuOpen(false); } },
    { id: 'club', label: 'Club Estancia', icon: <Award size={20} />, action: () => { onNavigate('club'); setIsMenuOpen(false); } },
  ];

  return (
    <div className="min-h-screen bg-brand-neutral overflow-x-hidden relative">
      {/* Top Menu Overlay */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="absolute inset-0 z-[100] bg-brand-wood text-white p-8 flex flex-col"
          >
            <div className="flex justify-between items-center mb-10">
              <div className="flex items-center gap-3">
                <img 
                  src="/assets/logo-nuevo.png" 
                  alt="Estancia La Cañada Logo" 
                  className="w-12 h-12 object-contain bg-white/10 p-1.5 rounded-full backdrop-blur-sm border border-white/10 shadow-md"
                />
                <div>
                  <span className="text-white text-lg font-serif block">La Cañada</span>
                  <span className="text-[8px] uppercase tracking-[0.3em] font-bold text-brand-accent block">Estancia de Montaña</span>
                </div>
              </div>
              <button onClick={() => setIsMenuOpen(false)} className="p-2 bg-white/10 rounded-full">
                <X size={24} />
              </button>
            </div>

            <nav className="space-y-8">
              {menuItems.map((item, idx) => (
                <motion.button
                  key={item.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  onClick={item.action}
                  className="w-full flex items-center justify-between group"
                >
                  <div className="flex items-center gap-6">
                    <div className="text-brand-accent group-hover:scale-110 transition-transform">
                      {item.icon}
                    </div>
                    <span className="text-3xl font-serif tracking-tight">{item.label}</span>
                  </div>
                  <ChevronRight className="opacity-20 group-hover:opacity-100 transition-opacity" />
                </motion.button>
              ))}
            </nav>

            <div className="mt-auto pb-12 border-t border-white/10 pt-8">
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/40 mb-2">Contacto</p>
              <p className="text-sm font-sans font-medium">hola@lacanyada.com</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Section */}
      <section className="relative h-[600px] w-full">
        <div className="absolute inset-0">
          <video
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
          >
            <source src="/assets/hero.mp4" type="video/mp4" />
            <img src="/assets/hero.png" alt="Estancia La Cañada" className="w-full h-full object-cover" />
          </video>
          <div className="absolute inset-0 bg-black/30" />
        </div>

        {/* Header */}
        <header className="relative z-10 flex justify-between items-center px-6 py-8">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="flex items-center gap-3"
          >
            <img 
              src="/assets/logo-nuevo.png" 
              alt="Estancia La Cañada Logo" 
              className="w-10 h-10 object-contain rounded-full bg-white/10 p-1 backdrop-blur-sm border border-white/20 shadow-lg"
            />
            <h1 className="text-white text-base tracking-widest font-sans uppercase opacity-90">
              Estancia La Cañada
            </h1>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
            className="flex items-center gap-4"
          >
            <button 
              onClick={() => setIsMenuOpen(true)}
              className="text-white p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <MenuIcon size={24} />
            </button>
          </motion.div>
        </header>

        {/* Hero Content */}
        <div className="relative z-10 flex flex-col justify-center items-center h-[calc(600px-200px)] px-6 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, ease: "easeOut" }}
          >
            <h2 className="text-white text-2xl mb-2 font-serif italic">
              En el Corazón del Páramo Andino
            </h2>
            <p className="text-white/70 text-xs font-sans tracking-widest max-w-xs mx-auto uppercase">
              Una experiencia exclusiva en el corazón de la pampa.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Quick Actions Section */}
      <section className="relative z-10 -mt-20 px-6 pb-20">
        <div className="flex flex-col gap-6">
          <motion.button
            whileHover={{ y: -5 }}
            onClick={onOpenBooking}
            className="bg-brand-accent group p-6 rounded-3xl shadow-xl shadow-brand-accent/30 flex items-center justify-between transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-white transition-colors">
                <Calendar size={28} />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-serif text-white">Reserva tu Estadía</h3>
                <p className="text-white/70 text-xs">Disponibilidad inmediata · Sin intermediarios</p>
              </div>
            </div>
            <ChevronRight className="text-white/60 group-hover:text-white transition-colors" />
          </motion.button>

          <motion.button
            whileHover={{ y: -5 }}
            onClick={onOpenExcursions}
            className="bg-white group p-6 rounded-3xl shadow-xl shadow-black/5 flex items-center justify-between transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-brand-neutral rounded-2xl flex items-center justify-center text-brand-accent group-hover:bg-brand-accent group-hover:text-white transition-colors">
                <Compass size={28} />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-serif text-brand-primary">Excursiones</h3>
                <p className="text-brand-primary/50 text-xs">Descubre los secretos</p>
              </div>
            </div>
            <ChevronRight className="text-brand-primary/20 group-hover:text-brand-accent transition-colors" />
          </motion.button>

          {/* Club & Gift Cards banner */}
          <motion.button
            whileHover={{ y: -5 }}
            onClick={() => onNavigate('club')}
            className="relative overflow-hidden rounded-3xl shadow-xl shadow-black/10 text-left"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[#3D2B1F] via-[#5a3e2b] to-[#3D2B1F]" />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: '200%' }}
              transition={{ duration: 4, repeat: Infinity, ease: 'linear', repeatDelay: 2 }}
              className="absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-[#C5A059]/20 to-transparent skew-x-12 pointer-events-none"
            />
            <div className="relative p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-[#C5A059]/20 rounded-2xl flex items-center justify-center">
                  <Award size={28} className="text-[#C5A059]" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="text-lg font-serif text-white">Club & Gift Cards</h3>
                    <span className="bg-[#C5A059] text-white text-[8px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full">Nuevo</span>
                  </div>
                  <p className="text-white/60 text-xs">Puntos, beneficios y regalos para tus seres queridos</p>
                </div>
              </div>
              <ChevronRight className="text-[#C5A059]/60 shrink-0" />
            </div>
          </motion.button>
        </div>

        {/* Instalaciones Section */}
        <div className="mt-12">
          <div className="mb-8">
            <span className="text-brand-terracotta text-[10px] uppercase tracking-[0.4em] font-bold block mb-1">Nuestras Instalaciones</span>
            <h2 className="text-2xl font-serif text-brand-primary">El espacio que te espera</h2>
          </div>

          <div className="flex flex-col gap-8">

            {/* Formato 1: Imagen grande arriba, texto abajo */}
            <motion.div
              initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.6 }}
              className="bg-white rounded-3xl overflow-hidden shadow-lg shadow-black/5"
            >
              <div className="relative h-64 overflow-hidden">
                <img src="/assets/instalaciones/comedor-1.jpg" alt="Salón Principal" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                <span className="absolute bottom-4 left-5 text-[10px] uppercase tracking-[0.3em] text-white/80 font-bold">Encuentros con estilo</span>
              </div>
              <div className="p-5">
                <h3 className="text-xl font-serif text-brand-wood mb-2">Salón Principal</h3>
                <p className="text-brand-primary/60 text-xs leading-relaxed">Un espacio amplio y elegante diseñado para reuniones sociales, eventos privados y momentos especiales en familia.</p>
              </div>
            </motion.div>

            {/* Formato 2: Horizontal — imagen izquierda, texto derecha */}
            <motion.div
              initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.6 }}
              className="bg-white rounded-3xl overflow-hidden shadow-lg shadow-black/5 flex h-44"
            >
              <div className="relative w-2/5 flex-none overflow-hidden">
                <img src="/assets/restaurante/Comedor.png" alt="Comedor" className="w-full h-full object-cover" />
              </div>
              <div className="flex flex-col justify-center p-5 flex-1">
                <span className="text-brand-terracotta text-[9px] uppercase tracking-widest font-bold mb-2">Gastronomía</span>
                <h3 className="text-lg font-serif text-brand-wood mb-2 leading-tight">Comedor</h3>
                <p className="text-brand-primary/60 text-[11px] leading-relaxed">Desayunos y cenas con productos frescos de la región andina.</p>
              </div>
            </motion.div>

            {/* Formato 3: Imagen full con overlay de texto */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }} whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.7 }}
              className="relative h-72 rounded-3xl overflow-hidden shadow-lg shadow-black/5"
            >
              <img src="/assets/instalaciones/vistas-aereas.jpg" alt="Vistas Panorámicas" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <span className="text-brand-accent text-[9px] uppercase tracking-[0.4em] font-bold block mb-1">El páramo a tus pies</span>
                <h3 className="text-2xl font-serif text-white mb-2">Vistas Panorámicas</h3>
                <p className="text-white/70 text-xs leading-relaxed max-w-xs">La Cañada revela toda su magnitud. Montaña, cielo y estancia fundidos en un solo horizonte.</p>
              </div>
            </motion.div>

            {/* Formato 4: Horizontal invertido — texto izquierda, imagen derecha */}
            <motion.div
              initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.6 }}
              className="bg-brand-wood rounded-3xl overflow-hidden shadow-lg shadow-black/5 flex h-44"
            >
              <div className="flex flex-col justify-center p-5 flex-1">
                <span className="text-brand-accent text-[9px] uppercase tracking-widest font-bold mb-2">Celebra lo que importa</span>
                <h3 className="text-lg font-serif text-white mb-2 leading-tight">Salón de Eventos</h3>
                <p className="text-white/60 text-[11px] leading-relaxed">Capacidad para grupos, con iluminación y equipamiento a medida.</p>
              </div>
              <div className="relative w-2/5 flex-none overflow-hidden">
                <img src="/assets/instalaciones/salon-eventos.jpg" alt="Salón de Eventos" className="w-full h-full object-cover" />
              </div>
            </motion.div>

            {/* Formato 5: Imagen grande con franja de color lateral */}
            <motion.div
              initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.6 }}
              className="bg-white rounded-3xl overflow-hidden shadow-lg shadow-black/5"
            >
              <div className="relative h-56 overflow-hidden">
                <img src="/assets/instalaciones/jardines.jpg" alt="Jardines" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                <div className="absolute top-4 right-4 bg-brand-olive/90 backdrop-blur-sm text-white text-[9px] uppercase tracking-widest font-bold px-3 py-1.5 rounded-full">
                  Naturaleza
                </div>
              </div>
              <div className="p-5 flex gap-4 items-start">
                <div className="w-1 self-stretch bg-brand-olive rounded-full flex-none" />
                <div>
                  <h3 className="text-xl font-serif text-brand-wood mb-2">Jardines y Terrazas</h3>
                  <p className="text-brand-primary/60 text-xs leading-relaxed">Amplios jardines con especies nativas y rincones íntimos para descansar al aire libre. El paisaje venezolano en su máxima expresión.</p>
                </div>
              </div>
            </motion.div>


            {/* Formato 7: Full imagen overlay — Sala de Chimenea */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }} whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.7 }}
              className="relative h-72 rounded-3xl overflow-hidden shadow-lg shadow-black/5"
            >
              <img src="/assets/instalaciones/sala-chimenea.png" alt="Sala de Chimenea" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <span className="text-brand-accent text-[9px] uppercase tracking-[0.4em] font-bold block mb-1">Confort & Calidez</span>
                <h3 className="text-2xl font-serif text-white mb-2">Sala de Chimenea</h3>
                <p className="text-white/70 text-xs leading-relaxed max-w-xs">Un rincón íntimo donde el fuego de leña convierte cada velada en un momento especial.</p>
              </div>
            </motion.div>

            {/* Formato 8: Full imagen — Terraza al Atardecer */}
            <motion.div
              initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.6 }}
              className="bg-white rounded-3xl overflow-hidden shadow-lg shadow-black/5"
            >
              <div className="relative h-64 overflow-hidden">
                <img src="/assets/instalaciones/terraza-atardecer.png" alt="Terraza al Atardecer" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                <span className="absolute top-4 right-4 bg-brand-terracotta/90 backdrop-blur-sm text-white text-[9px] uppercase tracking-widest font-bold px-3 py-1.5 rounded-full">Al aire libre</span>
              </div>
              <div className="p-5 flex gap-4 items-start">
                <div className="w-1 self-stretch bg-brand-terracotta rounded-full flex-none" />
                <div>
                  <h3 className="text-xl font-serif text-brand-wood mb-2">Terraza con Vista a la Montaña</h3>
                  <p className="text-brand-primary/60 text-xs leading-relaxed">Cenas al atardecer con el páramo andino como telón de fondo. Una experiencia que no se olvida.</p>
                </div>
              </div>
            </motion.div>

            {/* Formato 9: Horizontal derecha — Recepción */}
            <motion.div
              initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.6 }}
              className="bg-brand-neutral rounded-3xl overflow-hidden shadow-lg shadow-black/5 flex h-44 border border-brand-primary/5"
            >
              <div className="flex flex-col justify-center p-5 flex-1">
                <span className="text-brand-terracotta text-[9px] uppercase tracking-widest font-bold mb-2">Bienvenida</span>
                <h3 className="text-lg font-serif text-brand-wood mb-2 leading-tight">Recepción</h3>
                <p className="text-brand-primary/60 text-[11px] leading-relaxed">Atención personalizada desde el primer momento. Estamos aquí para hacer tu estancia perfecta.</p>
              </div>
              <div className="relative w-2/5 flex-none overflow-hidden">
                <img src="/assets/instalaciones/recepcion.png" alt="Recepción" className="w-full h-full object-cover" />
              </div>
            </motion.div>

            {/* Formato 10: Grid 2 columnas — Terraza + Área infantil */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { src: '/assets/instalaciones/terraza-exterior.png', label: 'Terraza Exterior', sub: 'Sociales' },
                { src: '/assets/instalaciones/area-infantil.png',    label: 'Área Infantil',   sub: 'Familias' },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-60px' }} transition={{ delay: i * 0.1, duration: 0.5 }}
                  className="relative rounded-2xl overflow-hidden shadow-md"
                  style={{ height: 180 }}
                >
                  <img src={item.src} alt={item.label} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
                  <div className="absolute bottom-3 left-3">
                    <span className="text-white/60 text-[9px] uppercase tracking-widest font-bold block">{item.sub}</span>
                    <span className="text-white text-xs font-bold leading-tight">{item.label}</span>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Formato 11: Full imagen — Vista panorámica del hotel */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }} whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.8 }}
              className="relative h-56 rounded-3xl overflow-hidden shadow-lg shadow-black/5"
            >
              <img src="/assets/instalaciones/vista-panoramica-hotel.png" alt="Vista Panorámica" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/50" />
              <div className="absolute bottom-4 left-5">
                <span className="text-brand-accent text-[9px] uppercase tracking-[0.4em] font-bold block mb-1">La Estancia desde arriba</span>
                <h3 className="text-xl font-serif text-white">Un paraíso en los Andes</h3>
              </div>
            </motion.div>

            {/* Formato 13: Full overlay — Terraza de Fiestas */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }} whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.7 }}
              className="relative h-64 rounded-3xl overflow-hidden shadow-lg shadow-black/5"
            >
              <img src="/assets/instalaciones/terraza-fiesta.png" alt="Terraza de Fiestas" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute bottom-5 left-5 right-5">
                <span className="text-brand-accent text-[9px] uppercase tracking-[0.4em] font-bold block mb-1">Eventos & Celebraciones</span>
                <h3 className="text-xl font-serif text-white leading-tight">Terraza de Fiestas</h3>
                <p className="text-white/70 text-[11px] mt-1">El escenario perfecto para celebrar momentos únicos.</p>
              </div>
            </motion.div>

            {/* Formato 14: Grid 2 columnas — Desayuno + Tablita de Vino */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { src: '/assets/instalaciones/desay.png',        label: 'Desayunos',      sub: 'Gastronomía' },
                { src: '/assets/instalaciones/tablita-vino.png', label: 'Tablita de Vino', sub: 'Bodega' },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }} transition={{ delay: i * 0.1, duration: 0.5 }}
                  className="relative rounded-2xl overflow-hidden shadow-md shadow-black/5"
                  style={{ aspectRatio: '3/4' }}
                >
                  <img src={item.src} alt={item.label} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
                  <div className="absolute bottom-3 left-3">
                    <span className="text-brand-accent text-[8px] uppercase tracking-widest font-bold block mb-0.5">{item.sub}</span>
                    <span className="text-white text-xs font-serif leading-tight">{item.label}</span>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Formato 15: Video — Noche & Música en Vivo */}
            <motion.div
              initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.7 }}
              className="relative rounded-3xl overflow-hidden shadow-xl shadow-black/10"
            >
              <video
                src="/assets/video-fiesta.mov"
                autoPlay
                loop
                muted
                playsInline
                className="w-full object-cover"
                style={{ aspectRatio: '9/16', maxHeight: 520 }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/20 pointer-events-none" />
              <div className="absolute bottom-6 left-5 right-5">
                <span className="text-brand-accent text-[9px] uppercase tracking-[0.4em] font-bold block mb-1">Magia de la Noche</span>
                <h3 className="text-2xl font-serif text-white leading-tight">Música en Vivo</h3>
                <p className="text-white/70 text-xs mt-1.5">Noches únicas donde el alma de Los Andes cobra vida.</p>
              </div>
            </motion.div>

            {/* Formato 12: Imagen principal + tira de fotos — Salón El Morro */}
            <motion.div
              initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.6 }}
              className="bg-white rounded-3xl overflow-hidden shadow-lg shadow-black/5"
            >
              <div className="relative h-52 overflow-hidden">
                <img src="/assets/instalaciones/salon-morro-pool.png" alt="Salón El Morro" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                <div className="absolute top-4 left-4 bg-brand-wood/90 backdrop-blur-sm text-white text-[9px] uppercase tracking-widest font-bold px-3 py-1.5 rounded-full">
                  Salón El Morro
                </div>
              </div>
              {/* Mini tira de 3 fotos */}
              <div className="grid grid-cols-3 gap-1 px-1 pt-1">
                {[
                  '/assets/instalaciones/salon-morro-pool.png',
                  '/assets/instalaciones/salon-morro-pingpong.png',
                  '/assets/instalaciones/salon-morro-ambiente.png',
                ].map((src, i) => (
                  <div key={i} className="h-16 overflow-hidden rounded-lg">
                    <img src={src} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
              <div className="p-5">
                <h3 className="text-xl font-serif text-brand-wood mb-2">Salón El Morro</h3>
                <p className="text-brand-primary/60 text-xs leading-relaxed mb-3">Diversión para toda la familia en un espacio único con techo de madera rústica.</p>
                <div className="flex flex-wrap gap-2">
                  {['Mesa de Pool', 'Ping Pong', 'TV SimpleTV'].map(tag => (
                    <span key={tag} className="text-[9px] uppercase tracking-widest bg-brand-wood/5 text-brand-wood border border-brand-wood/15 px-2.5 py-1 rounded-full font-bold">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>

          </div>
        </div>

        {/* Circuito de la Excelencia Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.7 }}
          className="mt-16 bg-[#3D2B1F] rounded-[2.5rem] overflow-hidden shadow-xl border border-white/5 relative"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#3D2B1F] via-[#4d3728] to-[#3D2B1F]" />
          
          {/* Subtle light shine */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#C5A059]/10 via-transparent to-transparent pointer-events-none" />
          
          <div className="relative p-6 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-[#C5A059]/10 rounded-2xl flex items-center justify-center text-[#C5A059] border border-[#C5A059]/20">
                <Award size={24} />
              </div>
              <div>
                <span className="text-[#C5A059] text-[9px] uppercase tracking-[0.3em] font-bold block">Sello de Calidad</span>
                <h2 className="text-xl font-serif text-white">Circuito de la Excelencia</h2>
              </div>
            </div>

            {/* Certificado Image */}
            <div className="relative group rounded-2xl overflow-hidden shadow-lg border border-white/10 bg-black/20">
              <img 
                src="/assets/circuito-excelencia.jpeg" 
                alt="Certificado Circuito de la Excelencia" 
                className="w-full h-auto block transition-transform duration-500 group-hover:scale-102"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
              <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-md text-[8px] text-white/80 uppercase tracking-widest px-2.5 py-1 rounded-full border border-white/10">
                Miembro Oficial
              </div>
            </div>

            {/* Description Copy */}
            <div className="space-y-3">
              <p className="text-white/80 text-xs leading-relaxed font-sans">
                Estancia La Cañada forma parte de la prestigiosa red del <strong className="text-[#C5A059] font-serif font-medium">Circuito de la Excelencia</strong>, una selecta alianza que agrupa a las 30 mejores posadas boutique y hoteles de diseño en toda Venezuela.
              </p>
              <p className="text-white/60 text-[11px] leading-relaxed">
                Nuestra membresía garantiza a los huéspedes un sello inquebrantable de calidad superior, confort refinado y hospitalidad excepcional, auditado de forma rigurosa para preservar la esencia del turismo de lujo en nuestro país.
              </p>
            </div>
          </div>
        </motion.div>

        {/* FAQ Section */}
        <div className="mt-16 bg-white rounded-[2.5rem] p-8 shadow-xl border border-brand-primary/5">
          <div className="mb-6 flex items-center gap-3">
            <div className="w-12 h-12 bg-brand-terracotta/10 rounded-2xl flex items-center justify-center text-brand-terracotta">
              <HelpCircle size={24} />
            </div>
            <div>
              <span className="text-brand-terracotta text-[9px] uppercase tracking-[0.3em] font-bold block">Respuestas Rápidas</span>
              <h2 className="text-xl font-serif text-brand-primary">Preguntas Frecuentes</h2>
            </div>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={idx} className="border-b border-brand-primary/5 last:border-b-0 pb-4 last:pb-0">
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full flex items-center justify-between text-left py-3 gap-4 group"
                  >
                    <span className="font-serif text-brand-wood text-sm font-medium group-hover:text-brand-terracotta transition-colors">{faq.question}</span>
                    <motion.div
                      animate={{ rotate: isOpen ? 180 : 0 }}
                      className="text-brand-terracotta/60 shrink-0"
                    >
                      <ChevronDown size={18} />
                    </motion.div>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <p className="text-xs text-brand-primary/60 leading-relaxed pt-1 pb-3 pr-2 whitespace-pre-line">
                          {faq.answer}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>

        {/* Ubicación y Dirección Section */}
        <div className="mt-16 bg-white rounded-[2.5rem] p-6 shadow-xl border border-brand-primary/5 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-brand-terracotta/10 rounded-2xl flex items-center justify-center text-brand-terracotta">
              <MapPin size={24} />
            </div>
            <div>
              <span className="text-brand-terracotta text-[9px] uppercase tracking-[0.3em] font-bold block">Encuéntranos</span>
              <h2 className="text-xl font-serif text-brand-primary">Ubicación y Dirección</h2>
            </div>
          </div>

          {/* Map Container */}
          <div className="relative rounded-2xl overflow-hidden shadow-inner border border-brand-primary/5 h-64 bg-brand-neutral/20">
            <iframe
              src="https://maps.google.com/maps?q=Estancia%20La%20Ca%C3%B1ada,%20Escag%C3%BCey,%20M%C3%A9rida,%20Venezuela&t=&z=15&ie=UTF8&iwloc=&output=embed"
              className="w-full h-full border-0 grayscale hover:grayscale-0 transition-all duration-700"
              allowFullScreen={true}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Estancia La Cañada Google Map"
            />
          </div>

          {/* Address Details */}
          <div className="space-y-4 text-xs text-brand-primary/70">
            <div className="flex gap-4 p-4 bg-brand-neutral/30 rounded-2xl items-start">
              <MapPin size={18} className="text-brand-terracotta shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-brand-wood text-[10px] uppercase tracking-wider mb-0.5">Dirección de la Estancia</p>
                <p className="leading-relaxed">Sector La Cañada, Carretera Trasandina (entre Cacute y Mucurubá), Escagüey, Mérida, Venezuela.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <a href="tel:+584141294308" className="flex gap-3 p-3 bg-brand-neutral/30 rounded-2xl items-center active:scale-95 transition-all text-inherit decoration-none">
                <Phone size={16} className="text-brand-terracotta shrink-0" />
                <div className="overflow-hidden">
                  <p className="font-bold text-brand-wood text-[8px] uppercase tracking-wider mb-0.5">Llámanos</p>
                  <p className="truncate text-[10px] font-mono">+58 414-1294308</p>
                </div>
              </a>

              <a href="mailto:Escagueyelc@gmail.com" className="flex gap-3 p-3 bg-brand-neutral/30 rounded-2xl items-center active:scale-95 transition-all text-inherit decoration-none">
                <Mail size={16} className="text-brand-terracotta shrink-0" />
                <div className="overflow-hidden">
                  <p className="font-bold text-brand-wood text-[8px] uppercase tracking-wider mb-0.5">Escríbenos</p>
                  <p className="truncate text-[10px] font-mono">Escagueyelc@gmail.com</p>
                </div>
              </a>
            </div>

            <button
              onClick={() => window.open("https://maps.google.com/?q=Estancia+La+Cañada,+Escagüey,+Mérida,+Venezuela", "_blank")}
              className="w-full bg-brand-primary text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-98 transition-all hover:bg-brand-terracotta text-xs tracking-wider uppercase shadow-md shadow-brand-primary/10 cursor-pointer"
            >
              <Compass size={16} />
              Cómo Llegar (Google Maps)
            </button>
          </div>
        </div>

        {/* Loyalty Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          className="mt-16 flex flex-col items-center justify-center text-center"
        >
          <div className="flex items-center gap-2 mb-2">
            <Award className="text-brand-accent" size={18} />
            <span className="text-[10px] uppercase tracking-[0.3em] font-sans text-brand-primary/40 font-medium">Club Estancia Privileges</span>
          </div>
          <p className="text-brand-primary/60 text-xs max-w-[280px] italic">
            "Acumule puntos en cada estancia y acceda a beneficios exclusivos."
          </p>
        </motion.div>
      </section>

      {/* Decorative background element */}
      <div className="fixed top-0 right-0 w-1/3 h-full bg-brand-accent/5 -skew-x-12 transform origin-top translate-x-1/2 -z-10 pointer-events-none" />
    </div>
  );
};

export default EstanciaHome;
