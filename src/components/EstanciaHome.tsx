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
    <div className="min-h-screen bg-brand-neutral overflow-hidden relative">
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
          <img 
            src="/assets/hero.png" 
            alt="Estancia La Cañada" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/30" />
        </div>

        {/* Header */}
        <header className="relative z-10 flex justify-between items-center px-6 py-8">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <h1 className="text-white text-3xl tracking-tighter font-serif">
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
            <h2 className="text-white text-5xl mb-4 font-serif italic">
              Donde el lujo encuentra la tierra
            </h2>
            <p className="text-white/80 text-lg font-sans tracking-wide max-w-sm mx-auto">
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
