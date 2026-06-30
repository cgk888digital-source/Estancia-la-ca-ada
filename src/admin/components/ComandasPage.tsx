import React, { useState } from 'react'
import { Plus, Check, Search, Coffee, Utensils } from 'lucide-react'

// Placeholder interface para comandas. 
// En un futuro se puede vincular con Supabase y el menú real.
interface OrderItem {
  id: string
  name: string
  quantity: number
  notes?: string
}

interface Order {
  id: string
  tableId: string
  status: 'preparando' | 'entregado'
  items: OrderItem[]
  timestamp: string
}

const ComandasPage: React.FC = () => {
  const [orders] = useState<Order[]>([])
  const [showNewOrder, setShowNewOrder] = useState(false)
  const [search, setSearch] = useState('')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Comandas del Restaurante</h1>
          <p className="text-sm text-gray-500 mt-1">Gestión de pedidos para mesas y cabañas</p>
        </div>
        <button
          onClick={() => setShowNewOrder(true)}
          className="flex items-center gap-2 bg-[#C5A059] text-white px-5 py-2.5 rounded-xl font-bold hover:bg-[#b8904a] transition-colors shadow-sm"
        >
          <Plus size={20} />
          Nueva Comanda
        </button>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Buscar por número de mesa o cabaña..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#C5A059] focus:bg-white transition-colors"
          />
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-amber-50 text-amber-700 font-bold text-sm rounded-xl border border-amber-100">
            En Preparación (0)
          </button>
          <button className="px-4 py-2 text-gray-500 hover:bg-gray-50 font-bold text-sm rounded-xl">
            Entregados
          </button>
        </div>
      </div>

      {/* Content grid */}
      {orders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 border-dashed p-16 text-center">
          <Utensils size={48} className="mx-auto text-gray-200 mb-4" />
          <h3 className="text-lg font-bold text-gray-900 mb-1">Sin pedidos activos</h3>
          <p className="text-gray-500 text-sm">Crea una nueva comanda para comenzar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Aquí irían las tarjetas de las comandas activas */}
        </div>
      )}

      {/* Modal Nueva Comanda (Placeholder) */}
      {showNewOrder && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Tomar Pedido</h2>
              <button 
                onClick={() => setShowNewOrder(false)}
                className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 text-center text-gray-500 flex flex-col items-center justify-center">
              <Coffee size={48} className="text-gray-200 mb-4" />
              <p>Módulo de captura de pedidos en construcción.</p>
              <p className="text-sm mt-2 text-gray-400">Aquí se integrará el menú configurado.</p>
            </div>

            <div className="p-6 border-t border-gray-100 bg-gray-50 rounded-b-3xl flex justify-end gap-3">
              <button 
                onClick={() => setShowNewOrder(false)}
                className="px-5 py-2.5 rounded-xl font-bold text-gray-600 hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button 
                className="px-5 py-2.5 rounded-xl font-bold bg-[#C5A059] text-white hover:bg-[#b8904a] transition-colors flex items-center gap-2 opacity-50 cursor-not-allowed"
              >
                <Check size={18} /> Confirmar Pedido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ComandasPage
