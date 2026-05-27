export interface AccommodationOption {
  id: number;
  title: string;
  type: string;
  price: number;
  capacity: string;
  pets: string;
  image: string;
  gallery: string[];
  description: string;
  rooms: string[];
  amenities: string[];
}

export const accommodationOptions: AccommodationOption[] = [
  {
    id: 1,
    title: "Suites La Vega",
    type: "Suite Comunicante",
    price: 320,
    capacity: "Hasta 7 Personas",
    pets: "Consultar",
    image: "/assets/suites/la-vega/exterior.jpg",
    gallery: [
      "/assets/suites/la-vega/exterior.jpg",
      "/assets/suites/la-vega/img-1.png",
      "/assets/suites/la-vega/img-2.png",
      "/assets/suites/la-vega/img-3.png",
      "/assets/suites/la-vega/img-4.png",
      "/assets/suites/la-vega/img-5.png",
      "/assets/suites/la-vega/img-6.png",
      "/assets/suites/la-vega/img-7.png",
      "/assets/suites/la-vega/img-8.png",
      "/assets/suites/la-vega/img-9.png",
      "/assets/suites/la-vega/img-10.png",
      "/assets/suites/la-vega/img-11.png",
      "/assets/suites/la-vega/img-12.png",
      "/assets/suites/la-vega/img-13.png",
      "/assets/suites/la-vega/img-14.png",
      "/assets/suites/la-vega/img-15.png",
      "/assets/suites/la-vega/img-16.png",
      "/assets/suites/la-vega/img-17.png",
      "/assets/suites/la-vega/img-18.png",
      "/assets/suites/la-vega/img-19.png",
      "/assets/suites/la-vega/img-20.png",
      "/assets/suites/la-vega/img-21.png",
      "/assets/suites/la-vega/img-22.png",
      "/assets/suites/la-vega/img-23.png",
      "/assets/suites/la-vega/img-24.png",
      "/assets/suites/la-vega/img-25.png",
      "/assets/suites/la-vega/img-26.png",
      "/assets/suites/la-vega/img-27.png",
      "/assets/suites/la-vega/img-28.png",
    ],
    description: "2 habitaciones comunicantes con baños propios y terrazas a ambos lados.",
    rooms: ["Matrimonial (cama King)", "2 literas (4 camas) o litera + individual (3 camas)"],
    amenities: ["2 Baños Privados", "Terrazas Dobles", "Vistas a la Montaña"]
  },
  {
    id: 2,
    title: "Cabaña La Lomita",
    type: "Cabaña Privada",
    price: 420,
    capacity: "Hasta 6 Personas",
    pets: "Pet Friendly",
    image: "/assets/suites/la-lomita/exterior.png",
    gallery: [
      "/assets/suites/la-lomita/exterior.png",
      "/assets/suites/la-lomita/salon-chimenea.png",
      "/assets/suites/la-lomita/salon.png",
      "/assets/suites/la-lomita/hab-1.png",
      "/assets/suites/la-lomita/hab-2.png",
      "/assets/suites/la-lomita/hab-3.png",
      "/assets/suites/la-lomita/cocina.png",
      "/assets/suites/la-lomita/bano-1.png",
      "/assets/suites/la-lomita/bano-2.png",
    ],
    description: "Cabaña independiente con 3 habitaciones, salón con chimenea de piedra, mini cocina equipada y terraza privada.",
    rooms: ["3 Habitaciones dobles", "Salón con chimenea", "Mini cocina equipada"],
    amenities: ["3 Baños Privados", "Chimenea de Piedra", "Terraza", "Mini Cocina"]
  },
  {
    id: 4,
    title: "Cabaña Mitibibo",
    type: "Cabaña Privada",
    price: 400,
    capacity: "Hasta 8 Personas",
    pets: "Pet Friendly",
    image: "/assets/suites/mitibibo/exterior.png",
    gallery: [
      "/assets/suites/mitibibo/exterior.png",
      "/assets/suites/mitibibo/img-1.png",
      "/assets/suites/mitibibo/img-2.png",
      "/assets/suites/mitibibo/img-3.png",
      "/assets/suites/mitibibo/img-4.png",
      "/assets/suites/mitibibo/img-5.png",
      "/assets/suites/mitibibo/img-6.png",
    ],
    description: "Cabaña amarilla con paredes de piedra, salón con chimenea y ventanas panorámicas a la montaña, cocina completamente equipada.",
    rooms: ["2 Habitaciones dobles", "1 Habitación múltiple (literas)", "Salón con chimenea"],
    amenities: ["3 Baños Privados", "Cocina Equipada", "Chimenea", "Vistas Panorámicas"]
  },
  {
    id: 5,
    title: "Galería Llano Grande",
    type: "Galería de Habitaciones",
    price: 160,
    capacity: "Hasta 3 Personas por hab.",
    pets: "Consultar",
    image: "/assets/suites/llano-grande/exterior.png",
    gallery: [
      "/assets/suites/llano-grande/exterior.png",
      "/assets/suites/llano-grande/img-1.png",
      "/assets/suites/llano-grande/img-2.png",
      "/assets/suites/llano-grande/img-3.png",
      "/assets/suites/llano-grande/img-4.png",
      "/assets/suites/llano-grande/img-5.png",
      "/assets/suites/llano-grande/img-6.png",
      "/assets/suites/llano-grande/img-7.png",
      "/assets/suites/llano-grande/img-8.png",
      "/assets/suites/llano-grande/img-9.png",
      "/assets/suites/llano-grande/img-10.png",
      "/assets/suites/llano-grande/img-11.png",
      "/assets/suites/llano-grande/img-12.png",
      "/assets/suites/llano-grande/img-13.png",
      "/assets/suites/llano-grande/img-14.png",
      "/assets/suites/llano-grande/img-15.png",
      "/assets/suites/llano-grande/img-16.png",
    ],
    description: "6 habitaciones únicas, cada una con su propio encanto y estilo. Desde ambientes rústicos con paredes de piedra hasta habitaciones acogedoras con detalles artesanales.",
    rooms: ["Habitaciones dobles", "Habitaciones con litera", "Habitaciones twin", "Baño privado en cada una"],
    amenities: ["6 Baños Privados", "Cada hab. única", "Detalles artesanales", "Flores y jardines"]
  },
  {
    id: 3,
    title: "Galería La Manita",
    type: "Galería de Habitaciones",
    price: 180,
    capacity: "Hasta 3 Personas por hab.",
    pets: "Consultar",
    image: "/assets/suites/la-manita/exterior.png",
    gallery: [
      "/assets/suites/la-manita/exterior.png",
      "/assets/suites/la-manita/fachada.png",
      "/assets/suites/la-manita/hab-1.png",
      "/assets/suites/la-manita/hab-1-bano.png",
      "/assets/suites/la-manita/hab-2.png",
      "/assets/suites/la-manita/hab-2-bano.png",
      "/assets/suites/la-manita/hab-3.png",
      "/assets/suites/la-manita/hab-3-bano.png",
      "/assets/suites/la-manita/hab-4.png",
      "/assets/suites/la-manita/hab-4-bano.png",
      "/assets/suites/la-manita/hab-5.png",
      "/assets/suites/la-manita/hab-5-bano.png",
      "/assets/suites/la-manita/hab-6.png",
      "/assets/suites/la-manita/hab-6-bano.png",
    ],
    description: "6 habitaciones independientes con baño privado, techos de madera y vistas a la montaña. Cada una con cama doble y litera.",
    rooms: ["Cama doble + litera (hasta 3 personas)", "Baño privado por habitación", "6 habitaciones disponibles"],
    amenities: ["6 Baños Privados", "Techos de Madera", "Vistas a la Montaña"]
  }
];
