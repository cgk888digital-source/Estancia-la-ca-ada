import { useState, lazy, Suspense, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Home, Utensils, Calendar, Award, ChevronLeft, Bed } from 'lucide-react'
import type { BookingFlowData } from './components/BookingFlow'
import { resolveLocationSlug } from './data/orderingLocations'
import { useHotelSettings } from './utils/useHotelSettings'

const EstanciaHome = lazy(() => import('./components/EstanciaHome'))
const RestaurantMenu = lazy(() => import('./components/RestaurantMenu'))
const WineCellar = lazy(() => import('./components/WineCellar'))
const Excursions = lazy(() => import('./components/Excursions'))
const BookingFlow = lazy(() => import('./components/BookingFlow'))
const ClubEstancia = lazy(() => import('./components/ClubEstancia'))
const BookingSuccess = lazy(() => import('./components/BookingSuccess'))
const CabinsGallery = lazy(() => import('./components/CabinsGallery'))

type Screen = 'home' | 'restaurant' | 'excursions' | 'club' | 'cava' | 'success' | 'cabins'


function App() {
  const [searchParams] = useSearchParams()
  const { settings: hotelSettings } = useHotelSettings()
  const [tableId, setTableId] = useState<string | null>(() => {
    return localStorage.getItem('estancia_table_id')
  })

  const [currentScreen, setCurrentScreen] = useState<Screen>('home')
  const [isBookingOpen, setIsBookingOpen] = useState(false)
  const [bookingData, setBookingData] = useState<BookingFlowData | null>(null)

  useEffect(() => {
    const loc = searchParams.get('loc')
    const mesa = searchParams.get('mesa')
    const cabana = searchParams.get('cabana')

    let urlTableId: string | null = null
    if (loc) {
      const resolved = resolveLocationSlug(loc, Number(hotelSettings.table_count) || 6)
      urlTableId = resolved?.label ?? null
    } else if (mesa) {
      // Legacy QR/NFC codes printed before the unified `?loc=` scheme.
      urlTableId = mesa.toLowerCase().startsWith('mesa') ? mesa : `Mesa ${mesa}`
    } else if (cabana) {
      urlTableId = cabana.toLowerCase().startsWith('cabaña') ? cabana : `Cabaña ${cabana}`
    }

    if (urlTableId) {
      setTableId(urlTableId)
      localStorage.setItem('estancia_table_id', urlTableId)
      setCurrentScreen('restaurant')
    }
  }, [searchParams, hotelSettings.table_count])
  const [bookingInitialUnitId, setBookingInitialUnitId] = useState<number | null>(null)

  const slideVariants = {
    initial: (direction: number) => ({
      x: direction > 0 ? '100%' : '-100%',
      opacity: 0
    }),
    animate: {
      x: 0,
      opacity: 1,
      transition: { type: 'spring' as const, damping: 25, stiffness: 200 }
    },
    exit: (direction: number) => ({
      x: direction > 0 ? '-100%' : '100%',
      opacity: 0,
      transition: { duration: 0.3 }
    })
  }

  const [direction, setDirection] = useState(0)

  const navigateTo = (screen: Screen) => {
    const screenOrder: string[] = ['home', 'cabins', 'restaurant', 'excursions', 'club', 'success']
    const currentIndex = screenOrder.indexOf(currentScreen)
    const nextIndex = screenOrder.indexOf(screen)
    
    setDirection(nextIndex > currentIndex ? 1 : -1)
    setCurrentScreen(screen)
  }

  return (
    <div className="bg-[#121212] h-[100dvh] flex justify-center items-start md:py-8 overflow-hidden">
      {/* Mobile Container */}
      <div className="w-full max-w-[430px] h-[100dvh] md:h-[850px] bg-brand-neutral relative shadow-2xl md:rounded-[3rem] overflow-hidden flex flex-col">
        {/* Modal Portal Root */}
        <div id="modal-root" className="absolute inset-0 pointer-events-none z-[160]" />
        
        {/* Screen Content */}
        <div className="flex-grow overflow-hidden relative">
          <AnimatePresence>
            {currentScreen !== 'home' && currentScreen !== 'cava' && (
              <motion.button
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onClick={() => navigateTo('home')}
                className="absolute top-6 left-6 z-[60] p-2 bg-white/20 backdrop-blur-md rounded-full border border-white/20 text-white shadow-lg"
              >
                <ChevronLeft size={24} />
              </motion.button>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
              key={currentScreen}
              custom={direction}
              variants={slideVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="absolute inset-0 overflow-y-auto custom-scrollbar"
            >
              <Suspense fallback={<div className="flex h-full w-full items-center justify-center text-[#C5A059]">Cargando...</div>}>
                {currentScreen === 'home' && (
                  <EstanciaHome 
                    onOpenMenu={() => navigateTo('restaurant')} 
                    onOpenExcursions={() => navigateTo('excursions')}
                    onOpenBooking={() => {
                      setBookingInitialUnitId(null);
                      setIsBookingOpen(true);
                    }}
                    onNavigate={(s) => navigateTo(s)}
                  />
                )}
                {currentScreen === 'cabins' && (
                  <CabinsGallery 
                    onBookCabin={(cabinId) => {
                      setBookingInitialUnitId(cabinId);
                      setIsBookingOpen(true);
                    }}
                  />
                )}
                {currentScreen === 'restaurant' && (
                  <RestaurantMenu 
                    onBack={() => navigateTo('home')} 
                    onOpenCava={() => setCurrentScreen('cava')}
                    tableId={tableId}
                  />
                )}
                {currentScreen === 'cava' && (
                  <WineCellar onBack={() => setCurrentScreen('restaurant')} />
                )}
                {currentScreen === 'excursions' && (
                  <Excursions onBack={() => navigateTo('home')} />
                )}
                {currentScreen === 'club' && (
                  <ClubEstancia />
                )}
                {currentScreen === 'success' && bookingData && (
                  <BookingSuccess 
                    data={bookingData}
                    onGoToClub={() => navigateTo('club')}
                    onBackToHome={() => navigateTo('home')}
                  />
                )}
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Bottom Navigation Bar */}
        <nav className="shrink-0 bg-white/80 backdrop-blur-xl border-t border-brand-primary/5 px-4 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] flex justify-between items-center z-50">
          <NavItem 
            icon={<Home size={22} />} 
            label="Inicio" 
            isActive={currentScreen === 'home'} 
            onClick={() => navigateTo('home')} 
          />
          <NavItem 
            icon={<Bed size={22} />} 
            label="Cabañas" 
            isActive={currentScreen === 'cabins'} 
            onClick={() => navigateTo('cabins')} 
          />
          <NavItem 
            icon={<Utensils size={22} />} 
            label="Menú" 
            isActive={currentScreen === 'restaurant' || currentScreen === 'cava'} 
            onClick={() => navigateTo('restaurant')} 
          />
          <NavItem 
            icon={<Calendar size={22} />} 
            label="Reservas" 
            isActive={isBookingOpen} 
            onClick={() => {
              setBookingInitialUnitId(null);
              setIsBookingOpen(true);
            }} 
          />
          <NavItem 
            icon={<Award size={22} />} 
            label="Club" 
            isActive={currentScreen === 'club'} 
            onClick={() => navigateTo('club')} 
          />
        </nav>

        {/* Booking Flow Modal */}
        <AnimatePresence>
          {isBookingOpen && (
            <Suspense fallback={<div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 backdrop-blur-sm text-[#C5A059]">Cargando...</div>}>
              <BookingFlow 
                onClose={() => {
                  setIsBookingOpen(false);
                  setBookingInitialUnitId(null);
                }} 
                initialUnitId={bookingInitialUnitId}
                onComplete={(data) => {
                  setBookingData(data);
                  setIsBookingOpen(false);
                  setBookingInitialUnitId(null);
                  navigateTo('success');
                }}
              />
            </Suspense>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function NavItem({ icon, label, isActive, onClick }: { icon: React.ReactNode, label: string, isActive: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-1 transition-all active:scale-90 ${isActive ? 'text-brand-terracotta' : 'text-brand-primary/40'}`}
    >
      <div className={`p-1 rounded-xl transition-colors ${isActive ? 'bg-brand-terracotta/10' : ''}`}>
        {icon}
      </div>
      <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
    </button>
  )
}

export default App
