import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Pencil, Trash2, X, Check, ImageOff, Upload } from 'lucide-react'
import { getMenu, saveMenu } from '../../utils/menuStore'
import type { MenuSection, DishItem } from '../../data/weeklyMenu'

const AVAILABLE_PHOTOS = [
  { file: 'platos/ceviche.png',           label: 'Ceviche' },
  { file: 'platos/bocado-1.png',          label: 'Bocado 1' },
  { file: 'platos/bocado-2.png',          label: 'Bocado 2' },
  { file: 'platos/ravioli.png',           label: 'Ravioli' },
  { file: 'platos/ensalada.png',          label: 'Ensalada' },
  { file: 'platos/pescado-grill.png',     label: 'Pescado Grill' },
  { file: 'platos/tartare-aguacate.png',  label: 'Tartare Aguacate' },
  { file: 'platos/tartare-2.png',         label: 'Tartare 2' },
  { file: 'platos/carne-papas.png',       label: 'Carne con Papas' },
  { file: 'platos/trucha-verduras.png',   label: 'Trucha' },
  { file: 'platos/milanesa.png',          label: 'Milanesa' },
  { file: 'platos/pizza-bowl.png',        label: 'Pizza / Bowl' },
  { file: 'platos/sopa-crema.png',        label: 'Sopa Crema' },
  { file: 'platos/crema-calabaza.png',    label: 'Crema Calabaza' },
  { file: 'platos/sopa-cebolla.png',      label: 'Sopa Cebolla' },
  { file: 'platos/postre-fresas.png',     label: 'Fresas' },
  { file: 'platos/postre-fresas-2.png',   label: 'Fresas 2' },
  { file: 'platos/postre-chocolate.png',  label: 'Chocolate' },
  { file: 'platos/postre-crepe.png',      label: 'Crepe' },
  { file: 'platos/postre-banana.png',     label: 'Banana' },
  { file: 'chef-1.png',                   label: 'Chef Arepas' },
  { file: 'chef-2.png',                   label: 'Chef Bandeja' },
]

const TAGS = ['', 'Vegetariano', 'Sin TACC', 'Postre', 'Recomendado', 'Especial del día']

const emptyDish: DishItem = { name: '', description: '', price: '', image: '', tag: '' }

// base64 uploads start with "data:", pre-loaded photos use the /assets/ path
function imgSrc(image: string) {
  return image.startsWith('data:') ? image : `/assets/restaurante/${image}`
}

export default function MenuPage() {
  const [menu, setMenu] = useState<MenuSection[]>([])
  const [activeTab, setActiveTab] = useState('desayuno')
  const [saved, setSaved] = useState(false)

  // Modal state
  const [modal, setModal] = useState<{ open: boolean; sectionId: string; dishIndex: number | null }>({
    open: false, sectionId: '', dishIndex: null,
  })
  const [form, setForm] = useState<DishItem>(emptyDish)
  const [showPhotoPicker, setShowPhotoPicker] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setForm(f => ({ ...f, image: reader.result as string }))
    reader.readAsDataURL(file)
    setShowPhotoPicker(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const activeSection = menu.find(s => s.id === activeTab)

  useEffect(() => { getMenu().then(setMenu) }, [])

  if (!activeSection) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-gray-400 font-bold text-sm">
        Cargando menú...
      </div>
    )
  }

  async function handleSave() {
    await saveMenu(menu)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  function openAdd(sectionId: string) {
    setForm(emptyDish)
    setShowPhotoPicker(false)
    setModal({ open: true, sectionId, dishIndex: null })
  }

  function openEdit(sectionId: string, index: number) {
    const dish = menu.find(s => s.id === sectionId)!.items[index]
    setForm({ ...dish })
    setShowPhotoPicker(false)
    setModal({ open: true, sectionId, dishIndex: index })
  }

  function handleDelete(sectionId: string, index: number) {
    setMenu(prev => prev.map(s =>
      s.id === sectionId
        ? { ...s, items: s.items.filter((_, i) => i !== index) }
        : s
    ))
  }

  function handleModalSave() {
    if (!form.name.trim()) return
    const dish: DishItem = {
      name: form.name.trim(),
      ...(form.description?.trim() && { description: form.description.trim() }),
      ...(form.price?.trim()       && { price: form.price.trim() }),
      ...(form.image?.trim()       && { image: form.image.trim() }),
      ...(form.tag?.trim()         && { tag: form.tag.trim() }),
    }
    setMenu(prev => prev.map(s => {
      if (s.id !== modal.sectionId) return s
      const items = [...s.items]
      if (modal.dishIndex === null) items.push(dish)
      else items[modal.dishIndex] = dish
      return { ...s, items }
    }))
    setModal({ open: false, sectionId: '', dishIndex: null })
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Menú Semanal</h1>
          <p className="text-sm text-gray-400 mt-0.5">Los cambios se guardan con el botón verde</p>
        </div>
        <button
          onClick={handleSave}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
            saved ? 'bg-green-500 text-white' : 'bg-[#C5A059] text-white hover:bg-[#b8904a]'
          }`}
        >
          {saved ? <><Check size={16} /> Guardado</> : 'Guardar cambios'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 p-1 rounded-xl mb-6 gap-1">
        {menu.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveTab(s.id)}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === s.id ? 'bg-white shadow text-gray-800' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {s.emoji} {s.label}
          </button>
        ))}
      </div>

      {/* Included notice editable */}
      <div className="mb-5">
        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-1">
          Texto "incluido en plan" (opcional)
        </label>
        <input
          value={activeSection.included ?? ''}
          onChange={e => setMenu(prev => prev.map(s =>
            s.id === activeTab ? { ...s, included: e.target.value } : s
          ))}
          placeholder="Ej: Incluido en todos los planes"
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#C5A059] bg-white"
        />
      </div>

      {/* Dish list */}
      <div className="flex flex-col gap-3 mb-4">
        <AnimatePresence>
          {activeSection.items.map((dish, i) => (
            <motion.div
              key={`${activeTab}-${i}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white border border-gray-100 rounded-2xl flex items-center gap-3 shadow-sm overflow-hidden"
            >
              {/* Thumbnail */}
              <div className="w-16 h-16 flex-none bg-gray-100 overflow-hidden">
                {dish.image
                  ? <img src={imgSrc(dish.image)} alt={dish.name} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-gray-300"><ImageOff size={20} /></div>
                }
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 py-3">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-gray-800 text-sm truncate">{dish.name}</p>
                  {dish.tag && (
                    <span className="text-[9px] uppercase tracking-wider bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full font-bold flex-none">
                      {dish.tag}
                    </span>
                  )}
                </div>
                {dish.description && (
                  <p className="text-gray-400 text-xs mt-0.5 truncate">{dish.description}</p>
                )}
                {dish.price && (
                  <p className="text-[#C5A059] text-xs font-bold mt-0.5">{dish.price}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 pr-3">
                <button
                  onClick={() => openEdit(activeTab, i)}
                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => handleDelete(activeTab, i)}
                  className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {activeSection.items.length === 0 && (
          <div className="text-center py-10 text-gray-300 text-sm border-2 border-dashed border-gray-200 rounded-2xl">
            Sin platos. Agrega el primero.
          </div>
        )}
      </div>

      {/* Add button */}
      <button
        onClick={() => openAdd(activeTab)}
        className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-[#C5A059]/40 text-[#C5A059] rounded-2xl text-sm font-bold hover:border-[#C5A059] hover:bg-[#C5A059]/5 transition-all"
      >
        <Plus size={18} /> Agregar Plato
      </button>

      {/* ── MODAL ── */}
      <AnimatePresence>
        {modal.open && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40"
              onClick={() => setModal({ open: false, sectionId: '', dishIndex: null })}
            />
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.97 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-gray-800">
                  {modal.dishIndex === null ? 'Agregar Plato' : 'Editar Plato'}
                </h2>
                <button
                  onClick={() => setModal({ open: false, sectionId: '', dishIndex: null })}
                  className="p-2 rounded-full hover:bg-gray-100 text-gray-400"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex flex-col gap-4">
                {/* Nombre */}
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-1.5">
                    Nombre del plato <span className="text-red-400">*</span>
                  </label>
                  <input
                    autoFocus
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Ej: Trucha a la plancha"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#C5A059]"
                  />
                </div>

                {/* Descripción */}
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-1.5">
                    Ingredientes / Descripción
                  </label>
                  <textarea
                    value={form.description ?? ''}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Ej: Con vegetales salteados y limón (opcional)"
                    rows={5}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#C5A059] resize-none"
                  />
                </div>

                {/* Precio */}
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-1.5">
                    Precio
                  </label>
                  <input
                    value={form.price ?? ''}
                    onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                    placeholder='Ej: Bs. 45  —  o escribe "Incluido"'
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#C5A059]"
                  />
                </div>

                {/* Tag */}
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-1.5">
                    Etiqueta
                  </label>
                  <select
                    value={form.tag ?? ''}
                    onChange={e => setForm(f => ({ ...f, tag: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#C5A059] bg-white"
                  >
                    {TAGS.map(t => <option key={t} value={t}>{t || '— Sin etiqueta —'}</option>)}
                  </select>
                </div>

                {/* Foto */}
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-1.5">
                    Foto del plato
                  </label>

                  {/* Hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileUpload}
                  />

                  {/* Preview + actions */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 flex-none">
                      {form.image
                        ? <img src={imgSrc(form.image)} alt="" className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center text-gray-300"><ImageOff size={20} /></div>
                      }
                    </div>
                    <div className="flex-1 flex flex-col gap-1.5">
                      {/* Upload from device */}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 px-3 py-2 bg-[#C5A059] text-white text-xs font-bold rounded-lg hover:bg-[#b8904a] transition-colors"
                      >
                        <Upload size={13} /> Subir desde dispositivo
                      </button>
                      {/* Select from pre-loaded */}
                      <button
                        type="button"
                        onClick={() => setShowPhotoPicker(p => !p)}
                        className="flex items-center gap-2 px-3 py-2 border border-gray-200 text-gray-600 text-xs font-bold rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        {showPhotoPicker ? 'Cerrar galería' : 'Elegir de la galería'}
                      </button>
                      {form.image && (
                        <button
                          type="button"
                          onClick={() => setForm(f => ({ ...f, image: '' }))}
                          className="text-xs text-red-400 font-bold text-left px-1"
                        >
                          ✕ Quitar foto
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Photo picker grid */}
                  <AnimatePresence>
                    {showPhotoPicker && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="grid grid-cols-4 gap-2 pb-2">
                          {AVAILABLE_PHOTOS.map(photo => (
                            <button
                              key={photo.file}
                              type="button"
                              onClick={() => {
                                setForm(f => ({ ...f, image: photo.file }))
                                setShowPhotoPicker(false)
                              }}
                              className={`relative rounded-xl overflow-hidden aspect-square border-2 transition-all ${
                                form.image === photo.file ? 'border-[#C5A059]' : 'border-transparent hover:border-gray-300'
                              }`}
                            >
                              <img src={`/assets/restaurante/${photo.file}`} alt={photo.label} className="w-full h-full object-cover" />
                              {form.image === photo.file && (
                                <div className="absolute inset-0 bg-[#C5A059]/30 flex items-center justify-center">
                                  <Check size={16} className="text-white" />
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Modal footer */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setModal({ open: false, sectionId: '', dishIndex: null })}
                  className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-500 font-bold text-sm hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleModalSave}
                  disabled={!form.name.trim()}
                  className="flex-1 py-3 rounded-xl bg-[#C5A059] text-white font-bold text-sm disabled:opacity-40 hover:bg-[#b8904a] transition-colors"
                >
                  {modal.dishIndex === null ? 'Agregar' : 'Guardar'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
