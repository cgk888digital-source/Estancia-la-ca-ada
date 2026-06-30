// ============================================================
//  MENÚ SEMANAL — Estancia La Cañada
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

export const weeklyMenu: MenuSection[] = [
  {
    id: 'desayuno',
    label: 'Desayuno',
    emoji: '🌅',
    included: 'Incluido en todos los planes de hospedaje',
    items: [
      {
        name: 'Todos los Días de Forma Diaria',
        description: 'Yogurt cremoso, leche fresca, selección de frutas andinas de la estación y cereales variados. Acompañado de café de altura preparado a tu gusto.',
        tag: 'Diario',
        image: 'chef-1.png'
      },
      {
        name: 'Día 1: Menú Tradicional',
        description: 'Perico rojo criollo acompañado de arepas andinas (de trigo) y arepas de maíz, queso fresco de la región, natilla criolla y mermelada artesanal de la casa.',
        tag: 'Día 1'
      },
      {
        name: 'Día 2: Especialidad del Horno Andino',
        description: 'Pasteles andinos crujientes rellenos de queso, carne y pollo, acompañados de natilla de la finca y mermelada casera.',
        tag: 'Día 2'
      },
      {
        name: 'Día 3: Clásico Nacional',
        description: 'Nuestra icónica Reina Pepiada, arepas de maíz rellenas con queso rallado, pollo mechado con aguacate cremoso, acompañadas de natilla y mermelada de frutas.',
        tag: 'Día 3'
      },
      {
        name: 'Día 4: Sabores del Páramo',
        description: 'Deliciosos Huevos Arropados de la estancia acompañados de arepas andinas de trigo y arepas de maíz, queso fresco, natilla y mermelada artesanal.',
        tag: 'Día 4'
      },
      {
        name: 'Día 5: Tradición Andina',
        description: 'Nuestra emblemática Pisca Andina (sopa típica a base de leche, cilantro, papas y queso) o huevos al gusto, servidos con arepas andinas calientes, queso y natilla.',
        tag: 'Día 5'
      },
      {
        name: 'Día 6: Desayuno Criollo',
        description: 'Pabellón criollo matutino servido con arepitas fritas de maíz, queso rallado, natilla y mermelada casera.',
        tag: 'Día 6'
      },
      {
        name: 'Día 7: Omelette de la Finca',
        description: 'Omelette preparado al gusto con tomate fresco y queso, servido con arepas calientes, natilla criolla y mermelada de la casa.',
        tag: 'Día 7'
      }
    ]
  },
  {
    id: 'almuerzo',
    label: 'Almuerzo',
    emoji: '☀️',
    included: 'Servicio a la Carta · No incluido en el plan básico de hospedaje',
    items: [
      {
        name: 'Ceviche del Día',
        description: 'Pescado fresco del día marinado en zumo de limón, cebolla morada, ají dulce y cilantro fresco.',
        image: 'platos/ceviche.png',
        price: 'A la Carta'
      },
      {
        name: 'Crema de Apio Asado',
        description: 'Sopa cremosa de apio andino asado al horno de leña con un toque de aceite de oliva perfumado.',
        image: 'platos/bocado-1.png',
        price: 'A la Carta'
      },
      {
        name: 'Trucha del Páramo a la Plancha',
        description: 'Filete de trucha de manantial a la plancha acompañado de vegetales de nuestra huerta salteados y papitas al romero.',
        image: 'platos/trucha-verduras.png',
        price: 'A la Carta'
      },
      {
        name: 'Raviolis de la Estancia',
        description: 'Pasta artesanal hecha en casa rellena de ricotta fresca de cabra, salteada en mantequilla de salvia.',
        image: 'platos/ravioli.png',
        price: 'A la Carta',
        tag: 'Recomendado'
      },
      {
        name: 'Fresas con Crema de Altura',
        description: 'Fresas frescas cosechadas en los campos de Mucurubá con crema chantilly batida a mano.',
        image: 'platos/postre-fresas.png',
        price: 'A la Carta',
        tag: 'Postre'
      }
    ]
  },
  {
    id: 'cena',
    label: 'Cena',
    emoji: '🌙',
    included: 'Incluido en tu plan · Menú Dirigido en 4 Tiempos con Abrebocas Sorpresa',
    items: [
      {
        name: 'Día 1: Trucha Salmonada en Salsa Thai',
        description: '1. Abreboca: Sorpresa de cortesía\n2. Entrada: Crema de calabacín\n3. Plato principal: Trucha Salmonada bañada en una reducción de salsa estilo Thai, acompañada de puré de papas rústico y vegetales salteados\n4. Postre, café o té: Turrón de chocolate casero.',
        tag: 'Día 1',
        image: 'platos/trucha-verduras.png'
      },
      {
        name: 'Día 2: Lomito en Salsa Bearnesa',
        description: '1. Abreboca: Sorpresa de cortesía\n2. Entrada: Sopa tradicional de cebolla\n3. Plato principal: Lomito de res premium cocido al término en salsa Bearnesa, acompañado de papas fritas crujientes y mezclum de lechugas frescas con queso de cabra y vinagreta de miel y mostaza\n4. Postre, café o té: Pie de limón.',
        tag: 'Día 2',
        image: 'platos/carne-papas.png'
      },
      {
        name: 'Día 3: Pollo al Curry con Acompañantes',
        description: '1. Abreboca: Sorpresa de cortesía\n2. Entrada: Crema de apio andino\n3. Plato principal: Pollo al curry aromático servido con sus guarniciones tradicionales (maní crujiente, mango verde o piña y pasitas), arroz blanco y plátano horneado\n4. Postre, café o té: Marquesa de chocolate.',
        tag: 'Día 3',
        image: 'platos/bocado-1.png'
      },
      {
        name: 'Día 4: Noche Mexicana (Buffet Libre)',
        description: '1. Abreboca: Sorpresa de cortesía\n2. Entrada: Nachos y salsas mexicanas\n3. Plato principal: Tacos Mexicanos servidos tipo buffet con tortillas de maíz y trigo preparadas a mano en casa, rellenos de pollo y carne molida sazonada, acompañados de pico de gallo, guacamole y frijoles\n4. Postre, café o té: Tres leches.',
        tag: 'Día 4',
        image: 'platos/ceviche.png'
      },
      {
        name: 'Día 5: Asado Negro Tradicional',
        description: '1. Abreboca: Sorpresa de cortesía\n2. Entrada: Crema especial del día\n3. Plato principal: Delicioso Asado Negro caramelizado al estilo tradicional venezolano, acompañado de pasta al pesto o mantequilla y torta de plátanos horneada\n4. Postre, café o té: Crumble de piña.',
        tag: 'Día 5',
        image: 'platos/milanesa.png'
      },
      {
        name: 'Día 6: Parrilla de la Estancia (All You Can Eat)',
        description: '1. Abreboca: Sorpresa de cortesía\n2. Entrada: Estación de ensaladas y guarniciones\n3. Plato principal: Gran Parrilla libre que incluye lomito premium asado a la brasa al gusto, chorizos, morcillas artesanales, tostones crujientes de plátano, yuca hervida, ensalada de pico de gallo fresca, natilla y picante de la casa\n4. Postre, café o té: Quesillo tradicional.',
        tag: 'Día 6',
        image: 'platos/ensalada.png'
      },
      {
        name: 'Día 7: Trucha al Ajillo o Champiñones',
        description: '1. Abreboca: Sorpresa de cortesía\n2. Entrada: Crema sedosa de auyama\n3. Plato principal: Trucha fresca del páramo preparada al ajillo o bañada en salsa cremosa de champiñones, acompañada de papitas salteadas al romero y vegetales frescos\n4. Postre, café o té: Pie de parchita.',
        tag: 'Día 7',
        image: 'platos/trucha-verduras.png'
      }
    ]
  }
]
