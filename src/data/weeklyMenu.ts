// ============================================================
//  MENÚ SEMANAL — Actualizar cada semana
//  Instrucciones:
//   1. Borra los platos de la semana anterior
//   2. Escribe el nombre del plato en "name"
//   3. Descripción de ingredientes en "description" (opcional)
//   4. Precio en "price" — déjalo vacío ("") si está incluido en el plan
//   5. Imagen: pon el nombre del archivo en /public/assets/restaurante/platos/
//      Si no tienes foto del plato, deja "image" vacío o bórralo
// ============================================================

export interface DishItem {
  name: string
  description?: string
  price?: string
  image?: string
  tag?: string
}

export interface MenuSection {
  id: string
  label: string
  emoji: string
  included?: string   // Ej: "Incluido en tu plan"
  items: DishItem[]
}

// ✏️  EDITAR AQUÍ CADA SEMANA:
export const weeklyMenu: MenuSection[] = [
  {
    id: 'desayuno',
    label: 'Desayuno',
    emoji: '🌅',
    included: 'Incluido en todos los planes',
    items: [
      {
        name: 'Arepas de la Casa',
        description: 'Recién hechas al momento, con mantequilla, queso blanco y mermelada artesanal',
        image: 'chef-1.png',  // usa ruta relativa a /assets/restaurante/
      },
      {
        name: 'Jugo de Frutas de Temporada',
        description: 'Frutas frescas de la región',
      },
      {
        name: 'Huevos al Gusto',
        description: 'Revueltos, fritos o pasados por agua con pan tostado',
      },
      {
        name: 'Café de la Montaña',
        description: 'Café de altura preparado en cafetera de émbolo',
      },
    ],
  },
  {
    id: 'almuerzo',
    label: 'Almuerzo',
    emoji: '☀️',
    items: [
      {
        name: 'Ceviche del Día',
        description: 'Pescado fresco marinado en limón, cebolla morada y cilantro',
        image: 'platos/ceviche.png',
        price: 'Incluido',
      },
      {
        name: 'Crema de Calabaza',
        description: 'Crema de calabaza asada con aceite de oliva y hierbas frescas',
        image: 'platos/crema-calabaza.png',
        price: 'Incluido',
      },
      {
        name: 'Trucha a la Plancha',
        description: 'Trucha del páramo a la plancha con vegetales salteados y limón',
        image: 'platos/trucha-verduras.png',
        price: 'Incluido',
      },
      {
        name: 'Ravioli de Ricotta',
        description: 'Pasta fresca rellena de ricotta con mantequilla y romero',
        image: 'platos/ravioli.png',
        price: 'Bs. 45',
        tag: 'Vegetariano',
      },
      {
        name: 'Fresas con Crema',
        description: 'Fresas frescas con crema chantilly y caramelo artesanal',
        image: 'platos/postre-fresas.png',
        price: 'Incluido',
        tag: 'Postre',
      },
    ],
  },
  {
    id: 'cena',
    label: 'Cena',
    emoji: '🌙',
    items: [
      {
        name: 'Tartare de Atún',
        description: 'Atún fresco con aguacate, patacones crujientes y semillas de ajonjolí',
        image: 'platos/tartare-aguacate.png',
        price: 'Incluido',
      },
      {
        name: 'Sopa de Cebolla Gratinada',
        description: 'Sopa francesa de cebolla caramelizada con costra de queso gratinado',
        image: 'platos/sopa-cebolla.png',
        price: 'Incluido',
      },
      {
        name: 'Milanesa con Arroz',
        description: 'Milanesa de res empanizada con salsa de mostaza y arroz amarillo',
        image: 'platos/milanesa.png',
        price: 'Incluido',
      },
      {
        name: 'Carne con Papas Fritas',
        description: 'Lomo de res a la plancha con papas fritas y caraotas negras',
        image: 'platos/carne-papas.png',
        price: 'Incluido',
      },
      {
        name: 'Crepe de Chocolate',
        description: 'Crepe fino con crema de chocolate y cacao en polvo',
        image: 'platos/postre-crepe.png',
        price: 'Incluido',
        tag: 'Postre',
      },
    ],
  },
]
