# Migración desde Paxer — 22 de agosto de 2026

Volcado completo de las reservas vivas de Paxer a la app, hecho a mano reserva por
reserva contra la ficha original de cada una.

## Qué se cargó

| | |
|---|---|
| Reservas | **44 localizadores** |
| Habitaciones | **58 filas** (las multi-habitación van una fila por habitación, mismo localizador) |
| Pasajeros | **200** |
| Facturado | **USD 80.639,20** |
| Cobrado | **USD 41.283,19** |
| Por cobrar | **USD 39.356,01** |
| Abonos | **76**, cada uno con su ingreso en contabilidad |

Por mes de entrada:

| Mes | Reservas | Habitaciones | Facturado | Por cobrar |
|---|---|---|---|---|
| Agosto 2026 | 25 | 32 | 30.614,00 | 4.272,81 |
| Septiembre 2026 | 7 | 8 | 7.211,20 | 4.204,20 |
| Noviembre 2026 | 1 | 1 | 1.568,00 | 1.318,00 |
| Diciembre 2026 | 11 | 17 | 41.246,00 | 29.561,00 |

## Cómo se cargó

**Los totales son los de Paxer, siempre.** Cuando el cálculo de la app no coincidía se
respetó Paxer y se anotó la diferencia en `special_notes` de la reserva.

**Las multi-habitación se guardan como varias filas con el mismo `locator`.** El
descuento de la reserva se reparte entre las habitaciones en proporción a su precio, de
forma que la suma de las filas da el total exacto de Paxer.

**Los abonos conservan su fecha real**, no la de la carga. Por eso la contabilidad tiene
apuntes desde noviembre de 2025. Cuando un pago cubre varias habitaciones se reparte
entre ellas cuadrando al céntimo por fila y por columna: cada habitación queda saldada
con su parte y cada pago conserva su importe original.

**Cada abono genera su ingreso** de categoría `alojamiento`, enlazado por `notes` con la
marca `abono:<id-del-pago>`. Ese enlace es lo que impide duplicar y lo que permite
retirar el ingreso si el abono se borra.

## El modelo de precios, descifrado contra Paxer

Paxer muestra el precio de **un pasajero** (habitación + su pensión). La app guarda la
habitación aparte y suma la pensión por persona. Dan lo mismo.

### Pensión por persona y noche

| | Normal | Navidad (21 dic – 7 ene) |
|---|---|---|
| Adulto | 56 (desayuno 22 + cena 34) | **62** |
| Niño | 48 (desayuno 20 + cena 28) | 48 |

### Habitación por noche

| Alojamiento | Normal | Navidad |
|---|---|---|
| Galería La Manita | 62 | **78** |
| Galería Llano Grande (2 pax, hab. 7) | 66 | **86** |
| Galería Llano Grande (4 pax, hab. 8–12) | 64 | **86** |
| Galería Suite La Vega | 140 | **190** |
| Cabaña La Lomita | 297 | **344** |
| Cabaña Mitibibó | 300 | **344** |

En temporada normal las habitaciones 7 y 8–12 de Llano Grande cuestan distinto (66 y 64);
en navidad las seis van al mismo precio.

### Temporadas

Solo hay **dos**: normal y navideña.

- **Navideña: del 21 de diciembre al 7 de enero**, ambos incluidos. Verificado en los dos
  extremos contra el grid: el 20 de diciembre todavía cobra tarifa normal y el 8 de enero
  ya ha vuelto a la normal.
- **El resto del año es tarifa normal.** No existe temporada baja.

Durante la migración pareció haber una tercera temporada porque el grid daba 114 para La
Manita de enero a mayo de 2026 y 118 de junio en adelante. No lo era: **el 1 de junio de
2026 subieron los precios** (adulto de 56 a 62 no, eso es navidad; la habitación de La
Manita de 58 a 62 y el niño de 40 a 48). El cambio cae en el primer día de un mes —huella
de subida de tarifa, no de temporada— y marzo de 2027 vuelve a marcar 118. Todas las
fechas con precio viejo están en el pasado.

## La tarifa navideña — corregido el 22 de agosto de 2026

`accommodations.december_price` tenía **6 dólares de más** en todas las unidades, y la
pensión del adulto no subía a 62 en navidad. Los dos errores se compensaban cuando había
un solo adulto y se separaban en cuanto había dos o más: con dos adultos la app cobraba 6
de menos por noche; con seis, 30.

Ya está arreglado:

1. Se bajaron 6 los `december_price` de las 24 unidades.
2. Se añadió el ajuste `meal_adult_navidad` (62), editable desde *Tarifas y Descuentos*.
3. El cálculo (`src/utils/seasonNights.ts`) aplica a cada noche su tarifa de habitación
   **y** su pensión según la temporada en que cae.

Comprobado contra **16 reservas reales**: las once navideñas —con 1, 2, 3 y 6 adultos, con
y sin niños, en galería, suite y cabaña—, una que cruza el 21 de diciembre, y cuatro de
temporada normal. Las dieciséis dan el total exacto de Paxer.

## Descuentos

Nueve de las 44 llevan descuento, y no siguen una tabla:

| Huésped | Tarifa | Cobrado | Descuento |
|---|---|---|---|
| Gustavo Florindo | 420 | 400 | 5% |
| Ignacio Hellmund | 3.288 | 2.984 | 9% |
| Juan Ramos | 1.490 | 1.340 | 10% |
| Cesar Scivillano | 1.212 | 1.090,80 | **10% exacto** |
| Ana María Zubillaga | 2.136 | 1.922,40 | **10% exacto** |
| Luis Enrique Feo | 1.470 | 1.323 | **10% exacto** |
| Michelle King | 2.870 | 2.583 | **10% exacto** |
| Yassica Vera | 354 | 310 | 12% |
| Lissette Romero | 2.848 | 2.506 | 12% |
| David Galavis | 1.044 | 915 | 12% |
| José A. Cabrera | 4.152 | 3.408 | 18% |
| Xavier Garriga | 1.424 | 1.120 | 21% |
| Gonzalo Ponte-Dávila | 2.308 | 1.684 | 27% |
| Patricia Vegas | 1.848 | 1.331 | 28% |
| Ciro Rángel | 2.672 | 1.850 | 31% |
| Angélica Zambrano | 1.234 | 824 | 33% |

Hay cuatro que son un **10% redondo** y podrían configurarse. El resto son negociaciones
caso por caso: los descuentos grandes (27–33%) van todos a cabaña entera con grupo
numeroso. La tarifa original de cada una queda escrita en `special_notes`.

## Tres cosas que hay que preguntarle a la dueña

**1. Posible doble conteo de María Gabriela Martín (265 USD).**
La reserva `8DE5AU` (diciembre) tiene un abono de 348 pagado en efectivo por Bancamiga
el 20 de febrero de 2026. La reserva `LPMCR2` (septiembre) de la misma huésped —mismo
correo— tiene un abono de 265 registrado el 20 de agosto como forma de pago "Crédito",
con la nota *"Abono en Bolívares 20 Feb"*. Si esos 265 salieron de aquellos 348, el
dinero está contado dos veces.

**2. Ricardo Estrada (`AFYW94`): ¿cortesía o precio sin cargar?**
Paxer la registra con precio 0,00 y sin ningún pago, aunque la tarifa de la habitación
serían 696. No tiene correo ni teléfono, cosa que ninguna otra reserva de pago deja en
blanco. Si es una invitación está bien; si se quedó a medias, hay 696 por cobrar que no
aparecen en ninguna parte.

**3. Los descuentos.** Confirmar si el 10% es una política y si los del 27–33% son
deliberados. En total se han descontado unos 3.240 USD.

## Reservas sin ningún abono

Seis reservas confirmadas sin un dólar de señal, **16.614 USD**, de las cuales cinco son
navideñas:

| Entra | Huésped | Debe | Reservada desde |
|---|---|---|---|
| 29 ago | Adal Enrique Morales | 348 | 17 ago |
| 30 ago | Bilal Farhat | 1.056 | 21 ago |
| 7 sep | Ana María Zubillaga | 1.922,40 | 21 ago |
| 12 sep | Yassica Vera | 310 | **11 jun** |
| 20 dic | Ninnella Gabaldón | 1.438 | 20 ago |
| 27 dic | **Federico Loynaz** | **7.868** | 17 ago |
| 27 dic | Gustavo Salazar | 3.402 | 12 ago |
| 28 dic | Michelle King | 2.583 | **28 abr** |
| 28 dic | Luis Enrique Feo | 1.323 | **22 jun** |

La navidad tiene 14 habitaciones vendidas por 31.763 USD con **22.522 sin cobrar, el
71%**. Una reserva navideña sin señal que se cae en diciembre es una habitación que ya no
se vuelve a vender.

## Comprobaciones que se pasaron a las 58 habitaciones

- **Cero solapamientos**: ninguna habitación aparece ocupada por dos reservas la misma
  noche, en cinco meses de calendario y con varios relevos el mismo día.
- **Cero descuadres**: el abonado de cada reserva coincide con la suma real de sus pagos.
- **Cero abonos sin ingreso**: los 76 pagos tienen su apunte en la contabilidad.
