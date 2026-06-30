import React, { useEffect, useState } from 'react';
import { X, Printer, CheckCircle2 } from 'lucide-react';
import type { Employee } from '../types';

interface ReceiptModalProps {
  emp: Employee;
  amountUsd: number;
  period: string; // e.g. "Quincena", "Semana", "5 días"
  bcvRate: number;
  isHistory?: boolean;
  onClose: () => void;
}

const fmtUsd = (n: number) =>
  new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);

const fmtBs = (n: number) =>
  new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'VES', maximumFractionDigits: 2 }).format(n);

const ReceiptModal: React.FC<ReceiptModalProps> = ({ emp, amountUsd, period, bcvRate, isHistory, onClose }) => {
  const amountBs = amountUsd * bcvRate;
  const [date] = useState(new Date().toLocaleDateString('es-ES', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  }));

  const handlePrint = () => {
    window.print();
  };

  // Prevent scrolling on body when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm print:bg-white print:p-0 print:block">
      
      {/* Modal Container for Screen (hidden when printing) */}
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6 space-y-6 relative print:hidden">
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <X size={20} className="text-gray-500" />
        </button>

        <div className="text-center space-y-2">
          {!isHistory && (
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={32} className="text-emerald-600" />
            </div>
          )}
          <h2 className="text-2xl font-bold text-gray-900">{isHistory ? 'Detalle del Recibo' : 'Pago Registrado'}</h2>
          {!isHistory && <p className="text-gray-500 text-sm">El pago ha sido registrado exitosamente en el sistema.</p>}
        </div>

        <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
          <div className="flex justify-between items-center mb-4">
            <span className="text-gray-500 text-sm font-medium">Empleado</span>
            <span className="font-bold text-gray-900">{emp.name}</span>
          </div>
          <div className="flex justify-between items-center mb-4">
            <span className="text-gray-500 text-sm font-medium">Cargo</span>
            <span className="font-bold text-gray-900">{emp.role}</span>
          </div>
          <div className="flex justify-between items-center mb-4">
            <span className="text-gray-500 text-sm font-medium">Período</span>
            <span className="font-bold text-gray-900 capitalize">{period}</span>
          </div>
          <div className="pt-4 border-t border-gray-200 flex flex-col gap-1 items-end">
            <div className="flex justify-between items-center w-full">
              <span className="text-gray-500 text-sm font-bold uppercase tracking-wider">Total Pagado</span>
              <span className="font-bold text-2xl text-emerald-600">{fmtBs(amountBs)}</span>
            </div>
            <span className="text-[10px] text-gray-400 font-bold tracking-widest uppercase">
              Equivalente a {fmtUsd(amountUsd)} (Tasa: {bcvRate} Bs/$)
            </span>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handlePrint}
            className="flex-1 py-3 bg-[#C5A059] hover:bg-[#b08d4b] text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2"
          >
            <Printer size={18} />
            Imprimir Recibo
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition-all"
          >
            Cerrar
          </button>
        </div>
      </div>

      {/* Printable Receipt (hidden on screen, visible when printing) */}
      <div className="hidden print:block w-full max-w-3xl mx-auto p-8 bg-white text-black font-sans">
        <div className="border-2 border-gray-800 p-8">
          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-gray-800 pb-6 mb-8">
            <div>
              <h1 className="text-3xl font-serif font-bold text-gray-900 tracking-wider uppercase mb-1">
                La Estancia
              </h1>
              <p className="text-sm font-bold tracking-[0.2em] text-gray-500 uppercase">
                Hotel & Club
              </p>
            </div>
            <div className="text-right">
              <h2 className="text-xl font-bold text-gray-800 uppercase tracking-widest mb-1">
                Recibo de Pago
              </h2>
              <p className="text-gray-600 font-medium">Fecha: {date}</p>
              <p className="text-gray-600 font-medium">ID Pago: #{Math.random().toString(36).substring(2, 8).toUpperCase()}</p>
            </div>
          </div>

          {/* Body */}
          <div className="space-y-6 mb-12">
            <p className="text-lg">
              He recibido de <strong>La Estancia Hotel & Club</strong>, la cantidad de:
            </p>
            <div className="bg-gray-100 p-4 rounded-lg flex flex-col items-center justify-center border border-gray-300">
              <span className="text-3xl font-bold text-gray-900 mb-1">{fmtBs(amountBs)}</span>
              <span className="text-sm font-bold text-gray-500 tracking-wider">Equivalente a {fmtUsd(amountUsd)} (Tasa BCV: {bcvRate} Bs/$)</span>
            </div>
            <p className="text-lg">
              Por concepto de honorarios / salario correspondiente al período: <strong>{period}</strong>.
            </p>
          </div>

          {/* Details Table */}
          <div className="mb-16">
            <h3 className="font-bold text-gray-800 uppercase tracking-wider mb-4 border-b border-gray-300 pb-2">
              Detalles del Empleado
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="block text-sm text-gray-500 font-bold uppercase tracking-wider">Nombre Completo</span>
                <span className="block text-lg font-medium">{emp.name}</span>
              </div>
              <div>
                <span className="block text-sm text-gray-500 font-bold uppercase tracking-wider">Cargo</span>
                <span className="block text-lg font-medium">{emp.role}</span>
              </div>
              <div>
                <span className="block text-sm text-gray-500 font-bold uppercase tracking-wider">Tipo de Contrato</span>
                <span className="block text-lg font-medium capitalize">{emp.employeeType}</span>
              </div>
            </div>
          </div>

          {/* Signatures */}
          <div className="flex justify-between items-end mt-24 px-8">
            <div className="text-center w-64">
              <div className="border-t border-gray-800 mb-2"></div>
              <p className="font-bold text-gray-800">Firma del Empleado</p>
              <p className="text-sm text-gray-500">{emp.name}</p>
            </div>
            <div className="text-center w-64">
              <div className="border-t border-gray-800 mb-2"></div>
              <p className="font-bold text-gray-800">Autorizado por</p>
              <p className="text-sm text-gray-500">Administración</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default ReceiptModal;
