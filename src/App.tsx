import { useState } from 'react'
import EstanciaHome from './components/EstanciaHome'
import RestaurantMenu from './components/RestaurantMenu'
import WineCellar from './components/WineCellar'
import Excursions from './components/Excursions'
import BookingFlow from './components/BookingFlow'
import ClubEstancia from './components/ClubEstancia'
import BookingSuccess from './components/BookingSuccess'
import { AnimatePresence, motion } from 'framer-motion'
import { Home, Utensils, Calendar, Award, ChevronLeft } from 'lucide-react'

type Screen = 'home' | 'restaurant' | 'excursions' | 'club' | 'cava' | 'success'

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home')
  const [isBookingOpen, setIsBookingOpen] = useState(false)
  const [bookingData, setBookingData] = useState<any>(null)

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
    const screenOrder: Screen[] = ['home', 'restaurant', 'excursions', 'club', 'success']
    const currentIndex = screenOrder.indexOf(currentScreen as any)
    const nextIndex = screenOrder.indexOf(screen as any)
    
    setDirection(nextIndex > currentIndex ? 1 : -1)
    setCurrentScreen(screen)
  }

  return (
    <div className="bg-[#121212] h-[100dvh] flex justify-center items-start md:py-8 overflow-hidden">
      {/* Mobile Container */}
      <div className="w-full max-w-[430px] h-[100dvh] md:h-[850px] bg-brand-neutral relative shadow-2xl md:rounded-[3rem] overflow-hidden flex flex-col">
        
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
              {currentScreen === 'home' && (
                <EstanciaHome 
                  onOpenMenu={() => navigateTo('restaurant')} 
                  onOpenExcursions={() => navigateTo('excursions')}
                  onOpenBooking={() => setIsBookingOpen(true)}
                  onNavigate={(s) => navigateTo(s)}
                />
              )}
              {currentScreen === 'restaurant' && (
                <RestaurantMenu 
                  onBack={() => navigateTo('home')} 
                  onOpenCava={() => setCurrentScreen('cava')}
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
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Bottom Navigation Bar */}
        <nav className="shrink-0 bg-white/80 backdrop-blur-xl border-t border-brand-primary/5 px-8 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] flex justify-between items-center z-50">
          <NavItem 
            icon={<Home size={22} />} 
            label="Inicio" 
            isActive={currentScreen === 'home'} 
            onClick={() => navigateTo('home')} 
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
            onClick={() => setIsBookingOpen(true)} 
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
            <BookingFlow 
              onClose={() => setIsBookingOpen(false)} 
              onComplete={(data) => {
                setBookingData(data);
                setIsBookingOpen(false);
                navigateTo('success');
              }}
            />
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
