/**
 * Las formas de pago que la posada ofrece al huésped para el adelanto, con los datos
 * de cada una en un solo sitio.
 *
 * El precio está siempre en dólares. Zelle y Binance se pagan en dólares tal cual;
 * el pago móvil y la transferencia se pagan en bolívares a la tasa oficial del EURO
 * del BCV, que es la referencia que usa la posada.
 */

export type FormaDePagoWeb = 'zelle' | 'pago_movil' | 'transferencia' | 'binance'

export const etiquetaDeFormaWeb: Record<FormaDePagoWeb, string> = {
  zelle: 'Zelle',
  pago_movil: 'Pago Móvil (Bancamiga)',
  transferencia: 'Transferencia Bancaria',
  binance: 'Binance',
}

/** Qué formas se liquidan en bolívares y por tanto llevan la conversión del euro BCV. */
export const seCobraEnBolivares = (forma: FormaDePagoWeb | null | undefined): boolean =>
  forma === 'pago_movil' || forma === 'transferencia'

export const DATOS_ZELLE = {
  correo: 'mariasusana01@hotmail.com',
  titular: 'Maria Araujo',
}

export const DATOS_BANCO = {
  banco: 'Bancamiga (0172)',
  telefono: '04141294308',
  cedula: '10345954',
  cuenta: '01720110701108762467',
  correo: 'Escagueyelc@gmail.com',
  titular: 'María Araujo',
}

export const DATOS_BINANCE = {
  correo: 'mariasusana01@gmail.com',
  usuario: 'Su69',
  payId: '1104587799',
}
