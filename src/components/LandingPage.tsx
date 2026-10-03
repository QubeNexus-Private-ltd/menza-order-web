import React from 'react';
import { QrCode, Utensils, AlertCircle, Camera } from 'lucide-react';

export interface LandingPageProps {
  onOpenScanner: () => void;
  isInvalidRestaurant?: boolean;
}

export default function LandingPage({
  onOpenScanner,
  isInvalidRestaurant = false,
}: LandingPageProps) {
  return (
    <div className="min-h-screen bg-[#FBF9F9] text-[#1B1C1C] flex flex-col justify-between font-['Hanken_Grotesk',sans-serif]">
      {/* 1. Minimal Top Brand Bar */}
      <header className="w-full max-w-4xl mx-auto px-4 py-6 flex items-center">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#D33401] to-[#FF6B35] flex items-center justify-center shadow-md shadow-[#D33401]/20">
            <Utensils className="w-4 h-4 text-white" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xl font-extrabold tracking-tight text-[#1B1C1C]">
              Menza<span className="text-[#D33401]">Order</span>
            </span>
          </div>
        </div>
      </header>

      {/* 2. Main Minimal Action Card */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm bg-white rounded-3xl border border-[#E0DDD8] p-8 shadow-sm text-center">
          {/* Circular QR Icon */}
          <div className="w-20 h-20 rounded-full bg-[#FFF1EC] text-[#D33401] flex items-center justify-center mx-auto mb-6 shadow-inner">
            <QrCode className="w-10 h-10 text-[#D33401]" />
          </div>

          {/* Invalid Restaurant Notice if landed on invalid ?r=... */}
          {isInvalidRestaurant && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-left flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="text-xs text-red-800 leading-relaxed">
                <span className="font-bold">Invalid or expired menu link.</span> Please scan the QR code on your dining table to load the menu.
              </div>
            </div>
          )}

          {/* Headline & Subtext */}
          <h1 className="text-2xl font-extrabold text-[#1B1C1C] tracking-tight">
            Scan Table QR to Order
          </h1>
          <p className="text-sm text-[#747878] mt-2.5 leading-relaxed font-normal">
            Please scan the QR code placed on your table or counter to view the live menu and place your order.
          </p>

          {/* Primary Action Button - Opens Camera */}
          <div className="mt-8">
            <button
              onClick={onOpenScanner}
              className="w-full py-3.5 px-6 rounded-xl bg-[#D33401] hover:bg-[#b82d01] active:scale-[0.98] text-white font-extrabold text-sm shadow-md shadow-[#D33401]/25 flex items-center justify-center gap-2.5 transition-all cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>Scan QR Code</span>
            </button>
          </div>
        </div>
      </main>

      {/* 3. Tiny Clean Footer */}
      <footer className="w-full max-w-4xl mx-auto px-4 py-6 text-center text-xs text-[#747878] border-t border-[#E0DDD8]/50">
        <p>© 2026 MenzaOrder · Contactless Restaurant Ordering & POS</p>
      </footer>
    </div>
  );
}
