import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, X, Dog, Bed, Eye, Calendar } from 'lucide-react';
import { accommodationOptions } from '../data/accommodations';
import type { AccommodationOption } from '../data/accommodations';

interface CabinsGalleryProps {
  onBookCabin: (cabinId: number) => void;
}

const CabinsGallery: React.FC<CabinsGalleryProps> = ({ onBookCabin }) => {
  const [selectedCabin, setSelectedCabin] = useState<AccommodationOption | null>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  const handleOpenGallery = (cabin: AccommodationOption) => {
    setSelectedCabin(cabin);
    setActivePhotoIndex(0);
  };

  const handleNextPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedCabin) return;
    setActivePhotoIndex((prev) => (prev + 1) % selectedCabin.gallery.length);
  };

  const handlePrevPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedCabin) return;
    const len = selectedCabin.gallery.length;
    setActivePhotoIndex((prev) => (prev - 1 + len) % len);
  };

  return (
    <div className="min-h-full bg-brand-neutral pb-24 text-brand-primary">
      {/* Header section with high aesthetics */}
      <div className="relative h-64 overflow-hidden flex flex-col justify-end p-6 text-white mb-8">
        <div className="absolute inset-0 z-0 bg-cover bg-center" style={{ backgroundImage: "url('/assets/room.png')" }} />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-primary/90 via-brand-primary/45 to-black/20 z-10" />
        
        <div className="relative z-20 space-y-2">
          <span className="text-[10px] tracking-[0.3em] font-bold text-[#C5A059] uppercase">Nuestra Estancia</span>
          <h1 className="text-4xl font-serif leading-none">Nuestros Refugios</h1>
          <p className="text-xs text-white/70 max-w-[320px] font-light leading-relaxed">
            Descubre nuestras cabañas de montaña y habitaciones boutique diseñadas para tu máximo confort.
          </p>
        </div>
      </div>

      {/* Grid List of Cabins */}
      <div className="px-6 space-y-8">
        {accommodationOptions.map((cabin) => (
          <motion.div
            key={cabin.id}
            onClick={() => handleOpenGallery(cabin)}
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.98 }}
            className="bg-white rounded-[2.5rem] overflow-hidden shadow-xl shadow-black/5 border border-brand-primary/5 cursor-pointer relative group"
          >
            {/* Main Image */}
            <div className="relative aspect-[16/10] overflow-hidden">
              <img
                src={cabin.image}
                alt={cabin.title}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
              
              {/* Floating badges */}
              <div className="absolute top-4 right-4 bg-brand-accent/90 backdrop-blur-md text-brand-wood text-[9px] uppercase tracking-widest font-bold py-1.5 px-3 rounded-full border border-white/10">
                {cabin.type}
              </div>

              {/* Photos Counter Badge */}
              <div className="absolute bottom-4 right-4 bg-black/50 backdrop-blur-md text-white text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1">
                <Eye size={12} />
                <span>{cabin.gallery.length} fotos</span>
              </div>
            </div>

            {/* Info */}
            <div className="p-6">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-2xl font-serif text-brand-wood font-medium leading-tight">{cabin.title}</h3>
                  <p className="text-brand-primary/40 text-[10px] uppercase tracking-widest mt-1">
                    {cabin.capacity} • {cabin.pets}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-serif text-brand-terracotta">${cabin.price}</span>
                  <p className="text-[9px] text-brand-primary/40 uppercase tracking-widest">/ noche</p>
                </div>
              </div>

              <p className="text-brand-primary/60 text-xs leading-relaxed line-clamp-2 mb-4">
                {cabin.description}
              </p>

              <div className="flex flex-wrap gap-2 pt-4 border-t border-brand-primary/5">
                {cabin.amenities.slice(0, 3).map((amenity) => (
                  <span
                    key={amenity}
                    className="bg-brand-neutral text-[9px] text-brand-primary/60 uppercase tracking-widest font-bold py-1 px-3 rounded-full border border-brand-primary/5"
                  >
                    {amenity}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Immersive Photo Gallery Overlay via Portal to prevent scroll positioning issues */}
      {createPortal(
        <AnimatePresence>
          {selectedCabin && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[150] bg-black/95 flex flex-col justify-between pointer-events-auto"
            >
              {/* Header controls */}
              <header className="relative z-10 p-6 pb-2 flex justify-between items-center text-white bg-gradient-to-b from-black/85 via-black/40 to-transparent">
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-[#C5A059] font-bold">{selectedCabin.type}</span>
                  <h2 className="text-2xl font-serif mt-1">{selectedCabin.title}</h2>
                </div>
                <button
                  onClick={() => setSelectedCabin(null)}
                  className="p-2.5 bg-white/10 hover:bg-white/20 active:scale-90 rounded-full transition-all border border-white/10"
                >
                  <X size={18} />
                </button>
              </header>

              {/* Picture Viewer */}
              <div className="relative flex-grow flex items-center justify-center overflow-hidden px-4 py-2">
                <AnimatePresence mode="wait">
                  <motion.img
                    key={activePhotoIndex}
                    src={selectedCabin.gallery[activePhotoIndex]}
                    alt={`${selectedCabin.title} photo ${activePhotoIndex + 1}`}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3 }}
                    className="max-w-full max-h-[42vh] object-contain rounded-2xl shadow-2xl"
                  />
                </AnimatePresence>

                {/* Navigation arrows */}
                {selectedCabin.gallery.length > 1 && (
                  <>
                    <button
                      onClick={handlePrevPhoto}
                      className="absolute left-4 w-10 h-10 bg-white/10 hover:bg-white/20 border border-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white active:scale-90 transition-all z-25"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <button
                      onClick={handleNextPhoto}
                      className="absolute right-4 w-10 h-10 bg-white/10 hover:bg-white/20 border border-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white active:scale-90 transition-all z-25"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </>
                )}

                {/* Photo Counter */}
                <div className="absolute bottom-2 bg-black/60 border border-white/10 text-white text-[10px] px-3 py-1 rounded-full backdrop-blur-md">
                  {activePhotoIndex + 1} / {selectedCabin.gallery.length}
                </div>
              </div>

              {/* Immersive Detail Info Panel and Direct Booking CTA */}
              <motion.div 
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="bg-[#121212] border-t border-white/5 rounded-t-[2.5rem] p-6 space-y-4 text-white text-left z-10"
              >
                <div className="space-y-2">
                  <div className="flex justify-between items-baseline">
                    <span className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Descripción del Refugio</span>
                    <span className="text-[#C5A059] font-serif text-xl">${selectedCabin.price} / noche</span>
                  </div>
                  <p className="text-white/70 text-xs leading-relaxed font-light">
                    {selectedCabin.description}
                  </p>
                </div>

                {/* Rooms & Details */}
                <div className="grid grid-cols-2 gap-4 border-y border-white/5 py-4">
                  <div className="space-y-1">
                    <span className="text-[9px] text-white/30 uppercase tracking-widest font-bold flex items-center gap-1">
                      <Bed size={10} className="text-[#C5A059]" /> Distribución
                    </span>
                    <div className="space-y-1 mt-1">
                      {selectedCabin.rooms.map((r, idx) => (
                        <p key={idx} className="text-[10px] text-white/70 font-light truncate">{r}</p>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] text-white/30 uppercase tracking-widest font-bold flex items-center gap-1">
                      <Dog size={10} className="text-[#C5A059]" /> Características
                    </span>
                    <p className="text-[10px] text-white/70 font-light mt-1">Capacidad: {selectedCabin.capacity}</p>
                    <p className="text-[10px] text-white/70 font-light">Mascotas: {selectedCabin.pets}</p>
                  </div>
                </div>

                {/* CTA Booking Button */}
                <button
                  onClick={() => {
                    const id = selectedCabin.id;
                    setSelectedCabin(null);
                    onBookCabin(id);
                  }}
                  className="w-full py-4.5 bg-brand-accent hover:bg-brand-accent/90 text-brand-wood font-bold rounded-2xl flex items-center justify-center gap-2.5 active:scale-[0.98] transition-all shadow-lg shadow-brand-accent/20"
                >
                  <Calendar size={18} />
                  <span>Reservar esta Cabaña</span>
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.getElementById('modal-root') || document.body
      )}
    </div>
  );
};

export default CabinsGallery;
