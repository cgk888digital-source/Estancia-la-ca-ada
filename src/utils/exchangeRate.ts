/**
 * Servicio para obtener tasas de cambio oficiales del BCV (Banco Central de Venezuela)
 */

const BCV_EURO_API_URL = 'https://ve.dolarapi.com/v1/euros/oficial';
const DEFAULT_FALLBACK_RATE = 708.39; // Tasa de respaldo realista para junio de 2026

interface DolarApiResponse {
  moneda: string;
  fuente: string;
  nombre: string;
  compra: number | null;
  venta: number | null;
  promedio: number;
  fechaActualizacion: string;
}

/**
 * Obtiene la tasa de cambio oficial del Euro (EUR/VES) publicada por el BCV
 */
export async function getBcvEuroRate(): Promise<number> {
  try {
    const response = await fetch(BCV_EURO_API_URL);
    if (!response.ok) {
      throw new Error(`Error en respuesta de API: ${response.status}`);
    }
    const data: DolarApiResponse = await response.json();
    if (data && typeof data.promedio === 'number' && data.promedio > 0) {
      return data.promedio;
    }
    throw new Error('Datos de tasa de cambio no válidos en la respuesta');
  } catch (err) {
    console.error('Error consultando la tasa del euro en DolarApi, usando tasa de respaldo:', err);
    return DEFAULT_FALLBACK_RATE;
  }
}
export async function getBcvUsdRate(): Promise<number> {
  try {
    const response = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
    if (!response.ok) {
      throw new Error(`Error en respuesta de API: ${response.status}`);
    }
    const data: DolarApiResponse = await response.json();
    if (data && typeof data.promedio === 'number' && data.promedio > 0) {
      return data.promedio;
    }
    throw new Error('Datos de tasa de cambio no válidos en la respuesta');
  } catch (err) {
    console.error('Error consultando la tasa del dólar en DolarApi, usando tasa de respaldo:', err);
    return 36.50; // Tasa de respaldo aproximada
  }
}
