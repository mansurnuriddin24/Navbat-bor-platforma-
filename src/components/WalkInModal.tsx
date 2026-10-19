import React, { useState, useEffect } from 'react';
import { 
  X, 
  Printer, 
  UserPlus, 
  Calendar, 
  Clock, 
  User, 
  Phone, 
  Layers, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw,
  FileText,
  Sparkles,
  Ticket
} from 'lucide-react';
import { api } from '../api';
import { BusinessItem, Service, StaffMember } from '../types';

interface WalkInModalProps {
  business: BusinessItem;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result: any) => void;
}

export const WalkInModal: React.FC<WalkInModalProps> = ({
  business,
  isOpen,
  onClose,
  onSuccess
}) => {
  // Mode selection: LIVE_QUEUE vs APPOINTMENT
  const [type, setType] = useState<'LIVE_QUEUE' | 'APPOINTMENT'>('LIVE_QUEUE');

  // Customer form inputs
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [serviceId, setServiceId] = useState<string>('');
  const [staffId, setStaffId] = useState<string>('');
  const [bookingDate, setBookingDate] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('09:00');
  const [guestNotes, setGuestNotes] = useState<string>('');

  // Available slots for APPOINTMENT mode
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);

  // Business services & staff
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loadingData, setLoadingData] = useState<boolean>(false);

  // Submission state
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [overrideHours, setOverrideHours] = useState<boolean>(false);

  // Result / Printed Ticket
  const [createdTicket, setCreatedTicket] = useState<any | null>(null);

  useEffect(() => {
    if (isOpen && business?.id) {
      setCreatedTicket(null);
      setErrorMessage(null);
      setOverrideHours(false);
      // Set default date to today in Tashkent
      const today = new Date().toISOString().slice(0, 10);
      setBookingDate(today);

      // Auto-set type based on business queue_mode
      if (business.queue_mode === 'APPOINTMENT') {
        setType('APPOINTMENT');
      } else {
        setType('LIVE_QUEUE');
      }

      loadBusinessResources();
    }
  }, [isOpen, business?.id]);

  const loadBusinessResources = async () => {
    setLoadingData(true);
    try {
      const [srvList, stfList] = await Promise.all([
        api.getBusinessServices(),
        api.getBusinessStaff()
      ]);
      setServices(srvList || []);
      setStaff(stfList || []);

      if (srvList && srvList.length > 0 && !serviceId) {
        setServiceId(srvList[0].id);
      }
      if (stfList && stfList.length > 0 && !staffId) {
        setStaffId(stfList[0].id);
      }
    } catch (e) {
      console.error('Error loading walk-in resources:', e);
    } finally {
      setLoadingData(false);
    }
  };

  // Fetch real-time available slots when in APPOINTMENT mode
  useEffect(() => {
    if (type === 'APPOINTMENT' && business?.id && bookingDate && staffId && serviceId) {
      fetchSlots();
    }
  }, [type, bookingDate, staffId, serviceId]);

  const fetchSlots = async () => {
    setLoadingSlots(true);
    try {
      const res = await api.getAvailableSlots(business.id, bookingDate, staffId, serviceId);
      setAvailableSlots(res.slots || []);
      if (res.slots && res.slots.length > 0) {
        setStartTime(res.slots[0]);
      }
    } catch (e) {
      setAvailableSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!serviceId) {
      setErrorMessage('Iltimos, xizmat turini tanlang');
      return;
    }

    if (type === 'APPOINTMENT' && (!bookingDate || !startTime || !staffId)) {
      setErrorMessage('Iltimos, sana, vaqt va xodimni tanlang');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.createWalkInCustomer({
        business_id: business.id,
        type,
        customer_name: customerName.trim() || 'Mijoz',
        customer_phone: customerPhone.trim() || undefined,
        service_id: serviceId,
        staff_id: staffId || undefined,
        booking_date: type === 'APPOINTMENT' ? bookingDate : undefined,
        start_time: type === 'APPOINTMENT' ? startTime : undefined,
        guest_notes: guestNotes.trim() || undefined,
        override_hours: overrideHours
      });

      if (res && res.success && res.ticket) {
        setCreatedTicket(res.ticket);
        onSuccess(res);
      } else {
        setErrorMessage('Navbat yaratishda noma’lum xatolik');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Xatolik yuz berdi');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn overflow-y-auto">
      {/* PRINT-ONLY THERMAL RECEIPT SLIP STYLES */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #walk-in-printable-slip, #walk-in-printable-slip * {
            visibility: visible;
          }
          #walk-in-printable-slip {
            position: absolute;
            left: 0;
            top: 0;
            width: 80mm;
            padding: 10px;
            font-family: monospace;
            background: white;
            color: black;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden relative my-auto">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-indigo-950 p-5 text-white flex items-center justify-between no-print">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight">Zaldagi Mijozni Qo‘shish (Walk-in)</h3>
              <p className="text-[11px] text-slate-300">
                {business.name} • Jonli navbat yoki soatli bron
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-5 sm:p-6 space-y-5">
          {/* STEP 1: SUCCESS RESULT & PRINT SLIP */}
          {createdTicket ? (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 no-print">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                <div className="text-xs">
                  <strong className="block font-bold">Mijoz muvaffaqiyatli ro‘yxatga olindi!</strong>
                  <span>Talon raqami generatsiya qilindi va audit jurnaliga saqlandi.</span>
                </div>
              </div>

              {/* Printable Ticket Receipt Card */}
              <div 
                id="walk-in-printable-slip"
                className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center space-y-4 shadow-xs"
              >
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">{createdTicket.business_name}</h4>
                  <p className="text-[11px] text-slate-500">{createdTicket.business_address || 'Qarshi shahri'}</p>
                </div>

                <div className="py-2 border-y border-dashed border-slate-300">
                  <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold block mb-1">
                    {createdTicket.queue_number ? 'Elektron Navbat Chiptasi' : 'Bron Qabul Taloni'}
                  </span>
                  <div className="text-5xl font-black font-mono tracking-wider text-slate-950">
                    {createdTicket.queue_number || createdTicket.booking_number}
                  </div>
                  <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-slate-900 text-amber-300">
                    <span>Holat: {createdTicket.status}</span>
                    <span>•</span>
                    <span>WALK_IN</span>
                  </div>
                </div>

                <div className="text-left text-xs space-y-1.5 text-slate-700 font-medium">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Mijoz:</span>
                    <strong className="text-slate-900">{createdTicket.customer_name}</strong>
                  </div>
                  {createdTicket.customer_phone ? (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Telefon:</span>
                      <strong className="font-mono text-slate-900">{createdTicket.customer_phone}</strong>
                    </div>
                  ) : (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Telefon:</span>
                      <span className="italic text-slate-400 text-[11px]">Ko‘rsatilmagan (Mehmon)</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-400">Xizmat:</span>
                    <strong className="text-slate-900">{createdTicket.service_name}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Mutaxassis:</span>
                    <strong className="text-slate-900">{createdTicket.staff_name}</strong>
                  </div>

                  {createdTicket.booking_date && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Sana & Vaqt:</span>
                      <strong className="text-indigo-700 font-mono">{createdTicket.booking_date} {createdTicket.start_time}–{createdTicket.end_time}</strong>
                    </div>
                  )}

                  {createdTicket.people_ahead !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Oldinda:</span>
                      <strong className="text-amber-800 font-bold">{createdTicket.people_ahead} kishi</strong>
                    </div>
                  )}

                  {createdTicket.estimated_wait_minutes !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Taxminiy kutish:</span>
                      <strong className="text-emerald-700 font-bold">~{createdTicket.estimated_wait_minutes} daqiqa</strong>
                    </div>
                  )}
                </div>

                <div className="pt-2 text-[10px] text-slate-400 leading-tight">
                  Tizim: <strong>NavbatBor.uz</strong> • Manba: <strong>WALK_IN</strong><br />
                  Chop etilgan vaqt: {new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-2.5 pt-2 no-print">
                <button
                  type="button"
                  id="walk-in-print-slip-btn"
                  onClick={handlePrint}
                  className="flex-1 py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-amber-400" />
                  <span>Printerda Talon Chop Etish</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreatedTicket(null);
                    setCustomerName('');
                    setCustomerPhone('');
                    setGuestNotes('');
                  }}
                  className="py-3 px-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Yana bir mijoz qo‘shish
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Yopish
                </button>
              </div>
            </div>
          ) : (
            /* STEP 2: CREATION FORM */
            <form onSubmit={handleSubmit} className="space-y-4 no-print">
              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs space-y-2 font-medium">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                  {(errorMessage.includes('yopiq') || errorMessage.includes('ish vaqti') || errorMessage.includes('tugagan')) && (
                    <div className="pt-2 border-t border-rose-200/60 flex items-center justify-between">
                      <label className="text-[11px] text-rose-800 font-bold flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={overrideHours}
                          onChange={(e) => {
                            setOverrideHours(e.target.checked);
                            if (e.target.checked) setErrorMessage(null);
                          }}
                          className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                        />
                        <span>Ish vaqtidan tashqari qabul qilishni tasdiqlash</span>
                      </label>
                    </div>
                  )}
                </div>
              )}

              {/* 1. Type Switcher: LIVE_QUEUE vs APPOINTMENT */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 block">Qabul Turi</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setType('LIVE_QUEUE')}
                    className={`p-3 rounded-2xl border-2 text-left transition cursor-pointer flex flex-col justify-between ${
                      type === 'LIVE_QUEUE'
                        ? 'border-amber-400 bg-amber-50/60 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-extrabold text-xs text-slate-900">Jonli Navbat</span>
                      <Clock className="w-4 h-4 text-amber-500" />
                    </div>
                    <span className="text-[10px] text-slate-500">Zalda chipta bilan kutish</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setType('APPOINTMENT')}
                    className={`p-3 rounded-2xl border-2 text-left transition cursor-pointer flex flex-col justify-between ${
                      type === 'APPOINTMENT'
                        ? 'border-indigo-600 bg-indigo-50/60 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-extrabold text-xs text-slate-900">Aniq Vaqtli Bron</span>
                      <Calendar className="w-4 h-4 text-indigo-600" />
                    </div>
                    <span className="text-[10px] text-slate-500">Belgilangan slotga yozish</span>
                  </button>
                </div>
              </div>

              {/* 2. Customer Name & Optional Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>Mijoz ismi</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Masalan: Sardor Aliyev"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>Telefon raqami</span>
                    </label>
                    <span className="text-[10px] text-slate-400 font-medium">Ixtiyoriy</span>
                  </div>
                  <input
                    type="tel"
                    placeholder="+998 90 123 45 67"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* 3. Service & Staff Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="walkin-service-select" className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-slate-400" />
                    <span>Xizmat turi</span>
                  </label>
                  <select
                    id="walkin-service-select"
                    aria-label="Xizmat turi"
                    value={serviceId}
                    onChange={(e) => setServiceId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.duration_minutes || 30} daq - {Number(s.price_uzs).toLocaleString('uz-UZ')} so‘m)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label htmlFor="walkin-staff-select" className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>Mutaxassis (Xodim)</span>
                  </label>
                  <select
                    id="walkin-staff-select"
                    aria-label="Mutaxassis (Xodim)"
                    value={staffId}
                    onChange={(e) => setStaffId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Navbatdagi bo‘sh xodim</option>
                    {staff.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name} ({st.title || 'Mutaxassis'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 4. If APPOINTMENT: Date & Slot Pickers */}
              {type === 'APPOINTMENT' && (
                <div className="p-3.5 bg-indigo-50/50 border border-indigo-200/60 rounded-2xl space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-indigo-950 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Qabul sanasi</span>
                      </label>
                      <input
                        type="date"
                        value={bookingDate}
                        onChange={(e) => setBookingDate(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-indigo-950 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Boshlanish vaqti</span>
                      </label>
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Slot chips */}
                  {loadingSlots ? (
                    <div className="text-center py-2 text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span>Bo‘sh vaqtlar tekshirilmoqda...</span>
                    </div>
                  ) : availableSlots.length > 0 ? (
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-600 uppercase">Tavsiya etilgan bo‘sh vaqtlar:</span>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                        {availableSlots.slice(0, 8).map((slot) => (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => setStartTime(slot)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                              startTime === slot
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {slot}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-[11px] text-amber-800 bg-amber-50 p-2 rounded-xl">
                      Tanlangan kunda tavsiya etilgan bo‘sh vaqtlar yo‘q yoki jadval to‘lgan.
                    </div>
                  )}
                </div>
              )}

              {/* 5. Notes */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <span>Qo‘shimcha izoh (ixtiyoriy)</span>
                </label>
                <input
                  type="text"
                  placeholder="Masalan: Bemor birinchi marta keldi, tahlil natijasi bilan"
                  value={guestNotes}
                  onChange={(e) => setGuestNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  id="walk-in-submit-btn"
                  disabled={submitting}
                  className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-extrabold rounded-xl text-xs transition shadow-md shadow-indigo-600/25 flex items-center gap-2 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Tekshirilmoqda va saqlanmoqda...</span>
                    </>
                  ) : (
                    <>
                      <Ticket className="w-4 h-4" />
                      <span>{type === 'LIVE_QUEUE' ? 'Navbat Chiptasini Olish' : 'Bronni Tasdiqlash'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
