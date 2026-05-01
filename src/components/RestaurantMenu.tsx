import React from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Info, Wind, Wine, ChevronRight } from 'lucide-react';

interface MenuItem {
  name: string;
  description: string;
  price: string;
  tag?: string;
}

const menuData: { [key: string]: MenuItem[] } = {
  entradas: [
    { name: "Empanada de la Estancia", description: "Cortada a cuchillo, horneada en horno de barro con leña de piquillín.", price: "$2.800" },
    { name: "Burrata y Tomates Ahumados", description: "Queso de pasta hilada, tomates reliquia, pesto de albahaca silvestre y piñones.", price: "$8.500", tag: "Recomendado" },
    { name: "Mollejas al Verdeo", description: "Corazón de molleja crocante, crema de verdeo y papines andinos.", price: "$9.200" }
  ],
  principales: [
    { name: "Ojo de Bife 'La Cañada'", description: "400g de novillo seleccionado, madurado 21 días, servido con chimichurri de la casa.", price: "$24.500" },
    { name: "Costillar a la Llama", description: "Cocción lenta de 6 horas a la leña de quebracho, servido con ensalada de la huerta.", price: "$28.000" },
    { name: "Cordero Patagónico", description: "Cocción lenta de 12 horas, puré de calabaza asada y reducción de malbec.", price: "$26.000" },
    { name: "Risotto de Hongos del Bosque", description: "Arroz carnaroli, mix de hongos silvestres y aceite de trufa blanca.", price: "$16.800", tag: "Vegetariano" }
  ],
  postres: [
    { name: "Volcán de Dulce de Leche", description: "Con helado de crema americana y tierra de chocolate amargo.", price: "$5.200" },
    { name: "Peras al Borgoña", description: "Cocinadas en vino tinto especiado, mascarpone artesanal.", price: "$4.500" },
    { name: "Flan Casero 'La Cañada'", description: "Receta tradicional con 12 yemas, dulce de leche colonial y crema montada.", price: "$4.800" }
  ]
};

const RestaurantMenu: React.FC<{ onBack: () => void, onOpenCava: () => void }> = ({ onBack, onOpenCava }) => {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen bg-brand-neutral text-brand-primary font-sans"
    >
      {/* Header Image */}
      <div className="relative h-[30vh] w-full overflow-hidden">
        <img 
          src="/assets/restaurant_hero.png" 
          alt="Gourmet Experience" 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-brand-wood/60 to-transparent" />
        
        <button 
          onClick={onBack}
          className="absolute top-6 left-6 z-20 flex items-center gap-2 text-white/90 hover:text-white transition-colors"
        >
          <div className="p-2 bg-black/20 backdrop-blur-md rounded-full border border-white/20">
            <ChevronLeft size={20} />
          </div>
        </button>

        <div className="absolute bottom-0 left-0 w-full p-6">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <span className="text-brand-accent text-[10px] uppercase tracking-[0.4em] font-medium mb-1 block">Experiencia Gastronómica</span>
            <h1 className="text-white text-3xl font-serif">Menú de Pasos</h1>
          </motion.div>
        </div>
      </div>

      {/* Menu Content */}
      <div className="px-6 py-12 pb-24">
        {/* Intro */}
        <div className="text-center mb-16">
          <Wind className="mx-auto text-brand-olive/30 mb-4" size={24} />
          <p className="text-lg font-serif italic text-brand-primary/70 leading-relaxed max-w-xs mx-auto">
            "Nuestra cocina honra la tierra y el fuego."
          </p>
          <div className="w-8 h-[1px] bg-brand-accent mx-auto mt-6" />
        </div>

        {/* Categories */}
        <div className="space-y-16">
          {Object.entries(menuData).map(([category, items], idx) => (
            <motion.section 
              key={category}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
            >
              <h2 className="text-[10px] uppercase tracking-[0.5em] text-brand-terracotta font-bold mb-8 flex items-center gap-3">
                <span className="w-6 h-[1px] bg-brand-terracotta/30" />
                {category}
              </h2>

              <div className="space-y-10">
                {items.map((item) => (
                  <div key={item.name} className="group cursor-default">
                    <div className="flex justify-between items-baseline mb-1">
                      <h3 className="text-lg font-serif text-brand-wood">{item.name}</h3>
                      <span className="text-brand-accent font-serif text-sm">{item.price}</span>
                    </div>
                    <p className="text-brand-primary/60 text-xs leading-relaxed mb-2">
                      {item.description}
                    </p>
                    {item.tag && (
                      <span className="text-[9px] uppercase tracking-widest border border-brand-olive/20 text-brand-olive px-2 py-0.5 rounded-full font-bold">
                        {item.tag}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </motion.section>
          ))}
        </div>

        {/* Cava CTA Section */}
        <motion.section
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-32 relative h-[300px] rounded-3xl overflow-hidden group cursor-pointer"
          onClick={onOpenCava}
        >
          <div className="absolute inset-0 bg-brand-wood/80 group-hover:bg-brand-wood/70 transition-colors z-10" />
          <img 
            src="/assets/wine_bottle.png" 
            alt="Cava Virtual" 
            className="absolute inset-0 w-full h-full object-cover scale-150 group-hover:scale-[1.6] transition-transform duration-1000"
          />
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center p-8">
            <Wine className="text-brand-accent mb-4" size={40} />
            <h2 className="text-white text-3xl md:text-4xl font-serif mb-4">Cava Virtual</h2>
            <p className="text-white/70 text-sm md:text-base max-w-md mb-8">
              Explore nuestra selección exclusiva de etiquetas curadas y descubra el maridaje perfecto para su cena.
            </p>
            <div className="flex items-center gap-2 text-brand-accent text-xs uppercase tracking-[0.3em] font-bold">
              Explorar Selección <ChevronRight size={14} />
            </div>
          </div>
        </motion.section>

        {/* Footer Info */}
        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          className="mt-32 p-8 bg-brand-terracotta/5 rounded-3xl border border-brand-terracotta/10 flex flex-col md:flex-row items-center gap-6"
        >
          <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-brand-terracotta shadow-sm">
            <Info size={24} />
          </div>
          <div className="text-center md:text-left">
            <h4 className="text-brand-wood font-serif text-lg mb-1">Aviso para Comensales</h4>
            <p className="text-brand-primary/50 text-sm">
              Por favor, informe a nuestro personal sobre cualquier alergia o restricción alimentaria. Disponemos de opciones sin TACC.
            </p>
          </div>
        </motion.div>
      </div>

      {/* Decorative element */}
      <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-brand-neutral to-transparent pointer-events-none" />
    </motion.div>
  );
};

export default RestaurantMenu;
