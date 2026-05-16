import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Utensils, Compass, Award, ChevronRight, Menu as MenuIcon, X, Home, Calendar } from 'lucide-react';

const EstanciaHome: React.FC<{ 
  onOpenMenu: () => void, 
  onOpenExcursions: () => void, 
  onOpenBooking: () => void,
  onNavigate: (s: any) => void 
}> = ({ onOpenMenu, onOpenExcursions, onOpenBooking, onNavigate }) => {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

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
            <div className="flex justify-between items-center mb-16">
              <span className="text-[10px] uppercase tracking-[0.5em] font-bold text-brand-accent">Menu</span>
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
          >
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
              Donde el lujo encuentra la tierra
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
            onClick={onOpenMenu}
            className="bg-white group p-6 rounded-3xl shadow-xl shadow-black/5 flex items-center justify-between transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-brand-neutral rounded-2xl flex items-center justify-center text-brand-accent group-hover:bg-brand-accent group-hover:text-white transition-colors">
                <Utensils size={28} />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-serif text-brand-primary">Menú del Restaurante</h3>
                <p className="text-brand-primary/50 text-xs">Gastronomía de autor</p>
              </div>
            </div>
            <ChevronRight className="text-brand-primary/20 group-hover:text-brand-accent transition-colors" />
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
                <img src="/assets/instalaciones/salon.jpg" alt="Salón Principal" className="w-full h-full object-cover" />
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
                <img src="/assets/instalaciones/comedor-1.jpg" alt="Comedor" className="w-full h-full object-cover" />
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

            {/* Formato 6: Horizontal — Sala de Juegos */}
            <motion.div
              initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.6 }}
              className="bg-white rounded-3xl overflow-hidden shadow-lg shadow-black/5 flex h-44"
            >
              <div className="relative w-2/5 flex-none overflow-hidden">
                <img src="/assets/instalaciones/sala-de-juegos.jpg" alt="Sala de Juegos" className="w-full h-full object-cover" />
              </div>
              <div className="flex flex-col justify-center p-5 flex-1">
                <span className="text-brand-accent text-[9px] uppercase tracking-widest font-bold mb-2">Diversión</span>
                <h3 className="text-lg font-serif text-brand-wood mb-2 leading-tight">Sala de Juegos</h3>
                <p className="text-brand-primary/60 text-[11px] leading-relaxed">Un espacio para el entretenimiento de toda la familia. Momentos de diversión sin salir de la estancia.</p>
              </div>
            </motion.div>

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
