import React, { useState, useMemo } from 'react';
import {
  Utensils,
  Flame,
  QrCode,
  Bell,
  Clock,
  Sparkles,
  Smartphone,
  CheckCircle2,
  TrendingUp,
  ShieldCheck,
  CreditCard,
  ChefHat,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Star,
  Menu,
  X,
  Store,
  Receipt,
  Droplets,
  Zap,
  Check,
  Coffee,
  HelpCircle,
  Sliders,
  DollarSign,
  Activity,
  Layers,
  ArrowUpRight,
  ExternalLink,
} from 'lucide-react';

interface LandingPageProps {
  onLaunchCustomerView: (targetEncRestId?: string, targetTableNum?: number | string | null) => void;
  onOpenStaffView: () => void;
  onOpenScanner: () => void;
  onOpenQrModal: () => void;
  catalog?: any;
  activeOrder?: any;
}

export default function LandingPage({
  onLaunchCustomerView,
  onOpenStaffView,
  onOpenScanner,
  onOpenQrModal,
  catalog,
  activeOrder,
}: LandingPageProps) {
  // Mobile Nav Drawer Toggle
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Hero interactive mockup tab
  const [heroMockupTab, setHeroMockupTab] = useState<'customer' | 'kds' | 'service'>('customer');

  // How it works role toggle
  const [howItWorksTab, setHowItWorksTab] = useState<'diner' | 'staff'>('diner');

  // Interactive Live KDS Simulator state
  const [simulatorStatus, setSimulatorStatus] = useState<'Placed' | 'Cooking' | 'Ready' | 'Served'>('Cooking');

  // ROI Calculator states
  const [calcTables, setCalcTables] = useState<number>(20);
  const [calcAov, setCalcAov] = useState<number>(950);
  const [calcTurns, setCalcTurns] = useState<number>(3.5);

  // Pricing toggle (monthly vs annual)
  const [annualBilling, setAnnualBilling] = useState<boolean>(true);

  // FAQ open index
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // ROI calculated metrics
  const roiMetrics = useMemo(() => {
    const dailyOrders = calcTables * calcTurns;
    const minutesSavedPerTable = 14;
    const totalDailyHoursSaved = Math.round((dailyOrders * minutesSavedPerTable) / 60);
    const extraTableTurnsMonthly = Math.round(dailyOrders * 0.25 * 30);
    const estimatedExtraRevenue = Math.round(extraTableTurnsMonthly * calcAov * 0.7);
    return {
      totalDailyHoursSaved,
      extraTableTurnsMonthly,
      estimatedExtraRevenue,
    };
  }, [calcTables, calcAov, calcTurns]);

  // Pre-configured real/demo restaurants
  const demoRestaurants = [
    {
      id: 51,
      encId: 'bEfOdSjPPB6U8FPbxxQzTg',
      name: 'Menza Veerji Cafe',
      mode: 'Dine-In Table T1',
      tag: 'Fine Dining & Cafe',
      tableId: 'CDRJgfrhq_MBC2FUdl5kSQ',
      tableDisplay: 'Table T1',
      desc: 'Experience full table ordering with instant waiter call and digital billing.',
      badge: 'Most Popular',
      color: 'from-orange-500/10 to-amber-500/5',
      image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&auto=format&fit=crop',
    },
    {
      id: 52,
      encId: 'fPo9f2iv1IjJcp77OZWtgA',
      name: 'Menza Kitchen',
      mode: 'Terrace Table TE2',
      tag: 'Rooftop & Grill',
      tableId: 'FhRodSl1o-j1bBJ92fd2ag',
      tableDisplay: 'Table TE2',
      desc: 'Real-time SignalR live kitchen tracker with estimated prep countdown.',
      badge: 'Live KDS',
      color: 'from-amber-500/10 to-red-500/5',
      image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&auto=format&fit=crop',
    },
    {
      id: 1,
      encId: 'uqQTzsGyDJy4_TBVeYXCfg',
      name: 'Menza Fine Dining',
      mode: 'Takeaway / Counter',
      tag: 'Express Pickup',
      tableId: null,
      tableDisplay: 'Counter Pickup',
      desc: 'Streamlined counter takeaway mode with Cashfree instant payment and token.',
      badge: 'Quick Service',
      color: 'from-red-500/10 to-rose-500/5',
      image: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop',
    },
  ];

  const features = [
    {
      icon: Smartphone,
      title: 'Instant QR Digital Menu',
      description: 'Zero app downloads or registrations required. Guests scan the table QR code and the rich visual menu loads in under 2 seconds on any mobile browser.',
      badge: 'Zero Friction',
    },
    {
      icon: Activity,
      title: 'Real-Time SignalR Kitchen Sync',
      description: 'Live bi-directional updates between kitchen displays and diner screens. Status moves from Confirmed to Cooking, Ready, and Served with live audio chimes.',
      badge: 'Live WebSocket',
    },
    {
      icon: Bell,
      title: '1-Tap Digital Waiter Assistance',
      description: 'Guests can request water refills, extra cutlery, custom service, or their bill right from their phone without awkwardly waving their hands.',
      badge: 'Smart Service',
    },
    {
      icon: CreditCard,
      title: 'Cashfree Multi-Payment Gateway',
      description: 'Instant UPI (PhonePe, Google Pay, Paytm), credit/debit cards, and net banking with auto-settlement, or choose pay-at-counter cash.',
      badge: 'Instant UPI',
    },
    {
      icon: ShieldCheck,
      title: 'Dynamic Table Intelligence',
      description: 'Auto-track table occupancy, cleaning sanitization cycles, and reservation locks. Cryptographic QR tokens prevent spoofing and off-site orders.',
      badge: 'Table Security',
    },
    {
      icon: ChefHat,
      title: 'Unified Kitchen POS & KOT Portal',
      description: 'Comprehensive staff dashboard for waiters and kitchen managers to monitor active tables, print or view KOTs, and toggle out-of-stock items in real-time.',
      badge: 'Staff Command',
    },
  ];

  const faqs = [
    {
      q: 'Do customers need to download an app or register an account?',
      a: 'No app download is required! MenzaOrder is built as a lightning-fast progressive web application. Customers simply scan the QR code with their regular smartphone camera (iOS or Android) and the interactive menu opens instantly in their browser.',
    },
    {
      q: 'How does real-time kitchen tracking (SignalR) work?',
      a: 'MenzaOrder uses high-performance Azure SignalR WebSockets. When kitchen staff update an order status on their kitchen display (e.g. from "Cooking" to "Ready"), the customer\'s screen updates immediately with live countdowns, visual progress bars, and toast alerts without requiring a page refresh.',
    },
    {
      q: 'What payment options are supported?',
      a: 'MenzaOrder is integrated with Cashfree POS gateway, supporting seamless UPI (Google Pay, PhonePe, Paytm, BHIM), all major Credit/Debit Cards, Net Banking, and Pay-at-Counter cash settlements with cashier verification.',
    },
    {
      q: 'Can we use MenzaOrder for both Dine-In and Takeaway / Counter orders?',
      a: 'Yes! MenzaOrder natively supports dual ordering modes. Dine-In links attach orders directly to specific tables with Call Waiter capabilities, while General Storefront QR links activate Takeaway mode with pickup token numbers and counter settlement.',
    },
    {
      q: 'What happens when an item runs out of stock during service?',
      a: 'Staff or managers can toggle any menu item to "Out of Stock" or "Inactive" from the Staff View in 1 click. The item instantly disables across all customer screens in real-time via SignalR, preventing order cancellations and kitchen chaos.',
    },
    {
      q: 'Can we generate QR codes for all our restaurant tables?',
      a: 'Absolutely! MenzaOrder includes a built-in Table QR Generator that creates high-resolution, branded, cryptographically-secured QR codes for every table, complete with print-ready templates and table numbers.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#FBF9F9] text-[#1B1C1C] font-['Hanken_Grotesk',sans-serif] selection:bg-[#D33401]/10 selection:text-[#D33401]">
      {/* =========================================================
          1. STICKY MODERN NAVBAR
         ========================================================= */}
      <header className="sticky top-0 z-50 bg-[#FBF9F9]/90 backdrop-blur-md border-b border-[#E0DDD8]/70 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          {/* Brand Logo */}
          <div
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#D33401] to-[#FF6B35] flex items-center justify-center shadow-md shadow-[#D33401]/25 group-hover:scale-105 transition-transform">
              <Utensils className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-extrabold tracking-tight text-[#1B1C1C]">
                  Menza<span className="text-[#D33401]">Order</span>
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-[#D33401]/10 text-[#D33401]">
                  POS & QR
                </span>
              </div>
              <span className="text-[11px] text-[#747878] font-medium hidden sm:inline">
                Smart Restaurant Dining
              </span>
            </div>
          </div>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-semibold text-[#5A5E5E]">
            <a href="#features" className="hover:text-[#D33401] transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-[#D33401] transition-colors">
              How It Works
            </a>
            <a href="#simulator" className="hover:text-[#D33401] transition-colors">
              Live Demo
            </a>
            <a href="#calculator" className="hover:text-[#D33401] transition-colors">
              ROI Calculator
            </a>
            <a href="#pricing" className="hover:text-[#D33401] transition-colors">
              Pricing
            </a>
            <a href="#faq" className="hover:text-[#D33401] transition-colors">
              FAQ
            </a>
          </nav>

          {/* Action CTAs */}
          <div className="hidden lg:flex items-center gap-3">
            {/* Scan Table QR Button */}
            <button
              onClick={onOpenScanner}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-[#1B1C1C] bg-white border border-[#E0DDD8] rounded-xl hover:border-[#D33401] hover:text-[#D33401] shadow-xs transition-all cursor-pointer"
              title="Scan Table QR with Camera"
            >
              <QrCode className="w-4 h-4 text-[#D33401]" />
              <span>Scan QR</span>
            </button>

            {/* Staff / Kitchen KDS Button */}
            <button
              onClick={onOpenStaffView}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-[#1B1C1C] bg-white border border-[#E0DDD8] rounded-xl hover:border-[#D33401] hover:text-[#D33401] shadow-xs transition-all cursor-pointer"
              title="Open Staff POS & Kitchen Display"
            >
              <ChefHat className="w-4 h-4 text-[#747878]" />
              <span>Staff KDS</span>
            </button>

            {/* Launch Live Menu (Primary) */}
            <button
              onClick={() => onLaunchCustomerView('bEfOdSjPPB6U8FPbxxQzTg', 27)}
              className="flex items-center gap-2 px-5 py-2.5 text-xs font-extrabold uppercase tracking-wider text-white bg-gradient-to-r from-[#D33401] to-[#e44613] rounded-xl shadow-md shadow-[#D33401]/25 hover:shadow-lg hover:shadow-[#D33401]/35 hover:-translate-y-0.5 active:scale-95 transition-all cursor-pointer"
            >
              <Flame className="w-4 h-4" />
              <span>Launch Live Menu</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Mobile Menu Toggle Button */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={() => onLaunchCustomerView('bEfOdSjPPB6U8FPbxxQzTg', 27)}
              className="px-3 py-1.5 text-xs font-extrabold text-white bg-[#D33401] rounded-lg shadow-xs"
            >
              Live Demo
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-[#1B1C1C] hover:text-[#D33401] focus:outline-none"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-[#E0DDD8] bg-white px-4 pt-3 pb-6 space-y-3 animate-float-in shadow-xl">
            <div className="grid grid-cols-2 gap-2 pb-3 border-b border-gray-100">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onLaunchCustomerView('bEfOdSjPPB6U8FPbxxQzTg', 27);
                }}
                className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-[#D33401] text-white text-xs font-bold shadow-xs"
              >
                <Flame className="w-4 h-4" />
                <span>Launch Menu</span>
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenScanner();
                }}
                className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-gray-100 text-[#1B1C1C] text-xs font-bold"
              >
                <QrCode className="w-4 h-4 text-[#D33401]" />
                <span>Scan QR</span>
              </button>
            </div>
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm font-semibold text-[#1B1C1C] hover:text-[#D33401]"
            >
              Features & POS
            </a>
            <a
              href="#how-it-works"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm font-semibold text-[#1B1C1C] hover:text-[#D33401]"
            >
              How It Works
            </a>
            <a
              href="#simulator"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm font-semibold text-[#1B1C1C] hover:text-[#D33401]"
            >
              Live Demo Simulator
            </a>
            <a
              href="#calculator"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm font-semibold text-[#1B1C1C] hover:text-[#D33401]"
            >
              ROI Calculator
            </a>
            <a
              href="#pricing"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm font-semibold text-[#1B1C1C] hover:text-[#D33401]"
            >
              Pricing Plans
            </a>
            <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenStaffView();
                }}
                className="w-full flex items-center justify-center gap-2 p-2 rounded-lg bg-gray-50 border border-gray-200 text-xs font-bold text-[#1B1C1C]"
              >
                <ChefHat className="w-4 h-4 text-gray-500" />
                <span>Switch to Staff POS & KDS Portal</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* =========================================================
          2. HERO SECTION
         ========================================================= */}
      <section className="relative overflow-hidden pt-8 pb-16 lg:pt-16 lg:pb-24">
        {/* Subtle background ambient glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-gradient-to-tr from-[#D33401]/10 via-[#FF8C42]/5 to-transparent rounded-full blur-3xl pointer-events-none -z-10" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Column: Value Proposition & Headlines */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              {/* Feature Pill */}
              <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white border border-[#E0DDD8] shadow-xs text-xs font-semibold text-[#5A5E5E]">
                <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                <span className="text-[#1B1C1C] font-bold">MenzaOrder 2.0</span>
                <span className="text-gray-300">|</span>
                <span className="text-[#D33401] flex items-center gap-1 font-bold">
                  <Sparkles className="w-3.5 h-3.5" /> Next-Gen Contactless Dining
                </span>
              </div>

              {/* Main Catchy Headline */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[#1B1C1C] leading-[1.12]">
                The Smarter Way to Dine.
                <span className="block mt-2 bg-gradient-to-r from-[#D33401] via-[#E85D04] to-[#F48C06] bg-clip-text text-transparent">
                  Instant QR Menu & Real-Time POS.
                </span>
              </h1>

              {/* Descriptive Subtitle */}
              <p className="text-base sm:text-lg text-[#5A5E5E] max-w-2xl mx-auto lg:mx-0 font-medium leading-relaxed">
                Empower your restaurant with instant table QR ordering, real-time live kitchen progression (SignalR), one-tap waiter calling, dynamic table management, and seamless Cashfree UPI payments. Zero app downloads needed.
              </p>

              {/* CTA Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5 pt-2">
                <button
                  onClick={() => onLaunchCustomerView('bEfOdSjPPB6U8FPbxxQzTg', 27)}
                  className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-7 py-3.5 text-sm font-extrabold text-white bg-gradient-to-r from-[#D33401] to-[#e44613] rounded-xl shadow-lg shadow-[#D33401]/30 hover:shadow-xl hover:shadow-[#D33401]/40 hover:-translate-y-0.5 active:scale-95 transition-all cursor-pointer"
                >
                  <Flame className="w-4 h-4" />
                  <span>Launch Live Demo Menu</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  onClick={onOpenScanner}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3.5 text-sm font-bold text-[#1B1C1C] bg-white border border-[#E0DDD8] rounded-xl hover:border-[#D33401] hover:text-[#D33401] shadow-xs hover:shadow-md transition-all cursor-pointer"
                >
                  <QrCode className="w-4 h-4 text-[#D33401]" />
                  <span>Scan Table QR</span>
                </button>

                <button
                  onClick={onOpenStaffView}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3.5 text-sm font-bold text-[#5A5E5E] hover:text-[#1B1C1C] hover:bg-white rounded-xl transition-all cursor-pointer"
                >
                  <ChefHat className="w-4 h-4 text-[#D33401]" />
                  <span>Kitchen POS Portal</span>
                </button>
              </div>

              {/* Social Proof Stats Ticker */}
              <div className="pt-6 border-t border-[#E0DDD8]/60 grid grid-cols-2 sm:grid-cols-4 gap-4 text-left">
                <div className="p-3 bg-white/70 backdrop-blur-xs rounded-xl border border-[#E0DDD8]/50">
                  <div className="text-2xl font-black text-[#D33401] tracking-tight">35%</div>
                  <div className="text-xs font-semibold text-[#5A5E5E]">Faster Table Turns</div>
                </div>
                <div className="p-3 bg-white/70 backdrop-blur-xs rounded-xl border border-[#E0DDD8]/50">
                  <div className="text-2xl font-black text-[#1B1C1C] tracking-tight">0%</div>
                  <div className="text-xs font-semibold text-[#5A5E5E]">Order Taking Errors</div>
                </div>
                <div className="p-3 bg-white/70 backdrop-blur-xs rounded-xl border border-[#E0DDD8]/50">
                  <div className="text-2xl font-black text-[#10B981] tracking-tight">&lt; 2.5s</div>
                  <div className="text-xs font-semibold text-[#5A5E5E]">Scan-to-Menu Speed</div>
                </div>
                <div className="p-3 bg-white/70 backdrop-blur-xs rounded-xl border border-[#E0DDD8]/50">
                  <div className="text-2xl font-black text-[#8B5CF6] tracking-tight">99.9%</div>
                  <div className="text-xs font-semibold text-[#5A5E5E]">SignalR Live Sync</div>
                </div>
              </div>
            </div>

            {/* Right Column: Interactive Phone Mockup with Tabs */}
            <div className="lg:col-span-5 flex flex-col items-center justify-center">
              {/* Tab Selector */}
              <div className="w-full max-w-sm flex items-center justify-between p-1 mb-4 bg-white/80 backdrop-blur-sm border border-[#E0DDD8] rounded-xl shadow-xs">
                <button
                  onClick={() => setHeroMockupTab('customer')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    heroMockupTab === 'customer'
                      ? 'bg-[#D33401] text-white shadow-xs'
                      : 'text-[#5A5E5E] hover:text-[#1B1C1C]'
                  }`}
                >
                  Diner View
                </button>
                <button
                  onClick={() => setHeroMockupTab('kds')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    heroMockupTab === 'kds'
                      ? 'bg-[#D33401] text-white shadow-xs'
                      : 'text-[#5A5E5E] hover:text-[#1B1C1C]'
                  }`}
                >
                  Kitchen KDS
                </button>
                <button
                  onClick={() => setHeroMockupTab('service')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    heroMockupTab === 'service'
                      ? 'bg-[#D33401] text-white shadow-xs'
                      : 'text-[#5A5E5E] hover:text-[#1B1C1C]'
                  }`}
                >
                  Call Waiter
                </button>
              </div>

              {/* Mobile Phone Mockup Frame */}
              <div className="relative w-full max-w-[340px] bg-[#111827] p-3 rounded-[38px] shadow-2xl border-4 border-[#374151]/30">
                {/* Phone Speaker & Camera Notch */}
                <div className="absolute top-5 left-1/2 -translate-x-1/2 w-28 h-4 bg-[#1F2937] rounded-full z-20 flex items-center justify-center">
                  <div className="w-3 h-3 rounded-full bg-black/50 mr-2" />
                  <div className="w-8 h-1 rounded-full bg-black/40" />
                </div>

                {/* Inner Screen Container */}
                <div className="bg-[#FAF8F5] rounded-[30px] overflow-hidden pt-8 pb-4 min-h-[500px] flex flex-col justify-between text-[#1B1C1C] border border-[#E5E7EB]">
                  {heroMockupTab === 'customer' && (
                    <div className="flex-1 flex flex-col">
                      {/* Mini Header */}
                      <div className="px-4 py-2 bg-white border-b border-[#E0DDD8]/70 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-[#D33401] flex items-center justify-center text-white font-black text-xs">
                            M
                          </div>
                          <div>
                            <div className="text-xs font-bold text-[#1B1C1C]">Menza Veerji Cafe</div>
                            <div className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                              <span className="text-[10px] text-[#747878] font-medium">Table T1 · Dine-In</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-full bg-[#10B981]/15 text-[#10B981] font-bold text-[9px]">
                            OPEN
                          </span>
                        </div>
                      </div>

                      {/* Mockup Body: Dish Item */}
                      <div className="p-3.5 space-y-3 flex-1">
                        <div className="text-[11px] font-bold text-[#747878] uppercase tracking-wider flex items-center justify-between">
                          <span>Chef's Recommended</span>
                          <span className="text-[#D33401] font-extrabold text-[10px]">🔥 Trending</span>
                        </div>

                        {/* Dish Card 1 */}
                        <div className="bg-white p-2.5 rounded-2xl border border-[#E0DDD8] shadow-xs flex gap-2.5 items-center">
                          <img
                            src="https://images.unsplash.com/photo-1576107232684-1279f3908594?w=200&auto=format&fit=crop"
                            alt="Crispy Truffle Fries"
                            className="w-16 h-16 rounded-xl object-cover"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 mb-0.5">
                              <span className="w-2.5 h-2.5 rounded-xs border border-green-600 flex items-center justify-center p-0.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-600" />
                              </span>
                              <span className="text-xs font-bold truncate">Crispy Truffle Fries</span>
                            </div>
                            <p className="text-[10px] text-[#747878] line-clamp-1">
                              Parmesan, roasted garlic aioli, rosemary
                            </p>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-xs font-black text-[#1B1C1C]">₹280</span>
                              <button
                                onClick={() => onLaunchCustomerView('bEfOdSjPPB6U8FPbxxQzTg', 27)}
                                className="px-2.5 py-0.5 text-[10px] font-bold text-white bg-[#D33401] rounded-lg shadow-xs hover:bg-[#b82d01]"
                              >
                                + ADD
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Dish Card 2 */}
                        <div className="bg-white p-2.5 rounded-2xl border border-[#E0DDD8] shadow-xs flex gap-2.5 items-center">
                          <img
                            src="https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?w=200&auto=format&fit=crop"
                            alt="Paneer Tikka Sizzler"
                            className="w-16 h-16 rounded-xl object-cover"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 mb-0.5">
                              <span className="w-2.5 h-2.5 rounded-xs border border-green-600 flex items-center justify-center p-0.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-600" />
                              </span>
                              <span className="text-xs font-bold truncate">Paneer Tikka Sizzler</span>
                            </div>
                            <p className="text-[10px] text-[#747878] line-clamp-1">
                              Smoked cottage cheese, mint chutney
                            </p>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-xs font-black text-[#1B1C1C]">₹340</span>
                              <button
                                onClick={() => onLaunchCustomerView('bEfOdSjPPB6U8FPbxxQzTg', 27)}
                                className="px-2.5 py-0.5 text-[10px] font-bold text-white bg-[#D33401] rounded-lg shadow-xs hover:bg-[#b82d01]"
                              >
                                + ADD
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Live Running Order Tracker Pill */}
                        <div className="mt-3 p-2.5 rounded-xl bg-[#0F172A] text-white shadow-md border border-slate-700">
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            <span className="flex items-center gap-1.5 font-bold text-amber-400">
                              <Flame className="w-3.5 h-3.5" /> Order #104 Active
                            </span>
                            <span className="text-[10px] text-slate-300 font-semibold">~12m left</span>
                          </div>
                          <div className="text-[10px] text-slate-300">
                            Chef is preparing Truffle Fries & Sizzler
                          </div>
                          <div className="w-full h-1.5 bg-slate-700 rounded-full mt-2 overflow-hidden">
                            <div className="w-2/3 h-full bg-gradient-to-r from-amber-500 to-[#D33401] rounded-full animate-pulse" />
                          </div>
                        </div>
                      </div>

                      {/* Mockup Bottom Bar */}
                      <div className="px-3 pt-2 bg-white border-t border-[#E0DDD8] flex items-center justify-between">
                        <button
                          onClick={() => onLaunchCustomerView('bEfOdSjPPB6U8FPbxxQzTg', 27)}
                          className="flex-1 py-2 text-center text-xs font-black text-white bg-[#D33401] rounded-xl shadow-xs hover:bg-[#b82d01]"
                        >
                          View Full Menu (28 Items)
                        </button>
                      </div>
                    </div>
                  )}

                  {heroMockupTab === 'kds' && (
                    <div className="p-3.5 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                          <div className="text-xs font-bold flex items-center gap-1.5">
                            <ChefHat className="w-4 h-4 text-[#D33401]" />
                            <span>Kitchen Display (KOT)</span>
                          </div>
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                            SignalR Live
                          </span>
                        </div>

                        {/* KOT Ticket Card */}
                        <div className="mt-3 p-3 bg-white rounded-xl border-2 border-orange-200 shadow-sm space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-extrabold text-[#D33401]">KOT #104 · Table T1</span>
                            <span className="text-[10px] font-bold text-gray-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> 04:12 elapsed
                            </span>
                          </div>
                          <div className="space-y-1 text-xs border-y border-gray-100 py-1.5">
                            <div className="flex justify-between font-semibold">
                              <span>1x Crispy Truffle Fries</span>
                              <span className="text-gray-500">Extra Aioli</span>
                            </div>
                            <div className="flex justify-between font-semibold">
                              <span>1x Paneer Tikka Sizzler</span>
                              <span className="text-amber-600 text-[10px]">Medium Spicy</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 pt-1">
                            <span className="flex-1 text-center py-1 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                              Cooking in Kitchen
                            </span>
                            <button
                              onClick={() => onOpenStaffView()}
                              className="flex-1 py-1 rounded bg-emerald-600 text-white text-[10px] font-bold shadow-xs hover:bg-emerald-700"
                            >
                              Bump to Ready
                            </button>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={onOpenStaffView}
                        className="w-full mt-3 py-2 text-center text-xs font-bold text-white bg-slate-900 rounded-xl hover:bg-black"
                      >
                        Open Full Staff & KDS Portal →
                      </button>
                    </div>
                  )}

                  {heroMockupTab === 'service' && (
                    <div className="p-3.5 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                          <div className="text-xs font-bold flex items-center gap-1.5">
                            <Bell className="w-4 h-4 text-[#D33401]" />
                            <span>1-Tap Waiter Call</span>
                          </div>
                          <span className="text-[10px] font-bold text-[#D33401] bg-orange-50 px-2 py-0.5 rounded-md">
                            Table T1
                          </span>
                        </div>

                        <div className="mt-4 space-y-2">
                          <div className="p-3 bg-white rounded-xl border border-gray-200 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                              <Droplets className="w-4 h-4" />
                            </div>
                            <div className="flex-1">
                              <div className="text-xs font-bold">Water Refill</div>
                              <div className="text-[10px] text-gray-500">Instant notification to waiter</div>
                            </div>
                            <span className="text-[10px] font-bold text-emerald-600">Sent (12s ago)</span>
                          </div>

                          <div className="p-3 bg-white rounded-xl border border-gray-200 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                              <Receipt className="w-4 h-4" />
                            </div>
                            <div className="flex-1">
                              <div className="text-xs font-bold">Request Bill</div>
                              <div className="text-[10px] text-gray-500">UPI QR or Paper invoice</div>
                            </div>
                            <button className="px-2 py-1 bg-emerald-600 text-white rounded-md text-[10px] font-bold">
                              Request
                            </button>
                          </div>

                          <div className="p-3 bg-white rounded-xl border border-gray-200 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-orange-50 text-[#D33401] flex items-center justify-center">
                              <Bell className="w-4 h-4" />
                            </div>
                            <div className="flex-1">
                              <div className="text-xs font-bold">General Assistance</div>
                              <div className="text-[10px] text-gray-500">Extra cutlery, condiments</div>
                            </div>
                            <button className="px-2 py-1 bg-[#D33401] text-white rounded-md text-[10px] font-bold">
                              Call
                            </button>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => onLaunchCustomerView('bEfOdSjPPB6U8FPbxxQzTg', 27)}
                        className="w-full mt-3 py-2 text-center text-xs font-bold text-white bg-[#D33401] rounded-xl hover:bg-[#b82d01]"
                      >
                        Try Service Calls in Live Menu →
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          3. DIRECT RESTAURANT DEMO SELECTOR (TEST DRIVE)
         ========================================================= */}
      <section className="py-14 bg-white border-y border-[#E0DDD8]/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-extrabold uppercase tracking-wider text-[#D33401] bg-[#D33401]/10 px-3 py-1 rounded-full">
              Interactive Test Drive
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1B1C1C] mt-2">
              Experience Real MenzaOrder Restaurants
            </h2>
            <p className="text-sm text-[#5A5E5E] mt-1 font-medium">
              Click any restaurant preset below to launch the actual ordering interface with live categories and dishes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {demoRestaurants.map((rest) => (
              <div
                key={rest.id}
                className="group relative bg-[#FBF9F9] rounded-2xl border border-[#E0DDD8] overflow-hidden hover:border-[#D33401] hover:shadow-xl transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Image Banner */}
                  <div className="relative h-44 overflow-hidden">
                    <img
                      src={rest.image}
                      alt={rest.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                    <div className="absolute top-3 left-3">
                      <span className="px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-white bg-[#D33401] rounded-lg shadow-sm">
                        {rest.badge}
                      </span>
                    </div>
                    <div className="absolute bottom-3 left-3 right-3 text-white">
                      <div className="text-xs font-semibold text-orange-200">{rest.tag}</div>
                      <div className="text-lg font-bold truncate">{rest.name}</div>
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-5 space-y-3">
                    <div className="flex items-center justify-between text-xs font-semibold text-[#747878]">
                      <span className="flex items-center gap-1.5 text-[#1B1C1C] font-bold">
                        <Store className="w-3.5 h-3.5 text-[#D33401]" /> {rest.mode}
                      </span>
                      {rest.tableDisplay && (
                        <span className="px-2 py-0.5 bg-orange-100/70 text-[#D33401] rounded-md font-bold text-[11px]">
                          {rest.tableDisplay}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#5A5E5E] leading-relaxed">
                      {rest.desc}
                    </p>
                  </div>
                </div>

                {/* Card Button */}
                <div className="p-5 pt-0">
                  <button
                    onClick={() => onLaunchCustomerView(rest.encId, rest.id === 51 ? 27 : rest.id === 52 ? 34 : null)}
                    className="w-full py-2.5 px-4 rounded-xl bg-white border border-[#E0DDD8] group-hover:bg-[#D33401] group-hover:text-white group-hover:border-[#D33401] text-xs font-bold text-[#1B1C1C] flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                  >
                    <span>Launch {rest.name}</span>
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Scanner Strip */}
          <div className="mt-8 p-4 bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 rounded-2xl border border-orange-200/60 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-center sm:text-left">
              <div className="w-10 h-10 rounded-xl bg-[#D33401] text-white flex items-center justify-center shrink-0 shadow-sm">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-[#1B1C1C]">Have a physical QR code on your restaurant table?</div>
                <div className="text-xs text-[#5A5E5E]">Scan with your device camera to simulate real diner table check-in.</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onOpenScanner}
                className="px-4 py-2 bg-[#D33401] text-white rounded-xl text-xs font-bold shadow-xs hover:bg-[#b82d01] flex items-center gap-1.5"
              >
                <QrCode className="w-4 h-4" />
                <span>Open QR Camera</span>
              </button>
              <button
                onClick={onOpenQrModal}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-800 rounded-xl text-xs font-bold shadow-xs hover:border-[#D33401]"
              >
                Generate Table QRs
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          4. CORE PLATFORM FEATURES
         ========================================================= */}
      <section id="features" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
          <span className="text-xs font-extrabold uppercase tracking-wider text-[#D33401] bg-[#D33401]/10 px-3.5 py-1 rounded-full">
            Engineered for Hospitality
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#1B1C1C] tracking-tight">
            Everything Your Restaurant Needs to Run Smoothly
          </h2>
          <p className="text-base text-[#5A5E5E] font-medium">
            From the moment diners scan the table QR code to the final UPI bill payment, MenzaOrder unifies every touchpoint into one frictionless ecosystem.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <div
                key={idx}
                className="p-7 rounded-3xl bg-white border border-[#E0DDD8] hover:border-[#D33401]/50 hover:shadow-xl transition-all group flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-2xl bg-[#D33401]/10 group-hover:bg-[#D33401] text-[#D33401] group-hover:text-white flex items-center justify-center transition-colors">
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-gray-100 text-[#5A5E5E] group-hover:bg-orange-50 group-hover:text-[#D33401] transition-colors">
                      {feat.badge}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-[#1B1C1C] tracking-tight">
                    {feat.title}
                  </h3>
                  <p className="text-sm text-[#5A5E5E] leading-relaxed">
                    {feat.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* =========================================================
          5. HOW IT WORKS (FOR DINERS & RESTAURANT STAFF)
         ========================================================= */}
      <section id="how-it-works" className="py-20 bg-white border-y border-[#E0DDD8]/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-extrabold uppercase tracking-wider text-[#D33401] bg-[#D33401]/10 px-3 py-1 rounded-full">
              Frictionless Workflow
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#1B1C1C] mt-3">
              How MenzaOrder Works in 3 Simple Steps
            </h2>

            {/* Role Tab Switcher */}
            <div className="inline-flex p-1 mt-6 bg-[#FBF9F9] border border-[#E0DDD8] rounded-xl">
              <button
                onClick={() => setHowItWorksTab('diner')}
                className={`px-5 py-2 text-xs font-bold rounded-lg transition-all ${
                  howItWorksTab === 'diner'
                    ? 'bg-[#D33401] text-white shadow-xs'
                    : 'text-[#5A5E5E] hover:text-[#1B1C1C]'
                }`}
              >
                For Diners & Guests
              </button>
              <button
                onClick={() => setHowItWorksTab('staff')}
                className={`px-5 py-2 text-xs font-bold rounded-lg transition-all ${
                  howItWorksTab === 'staff'
                    ? 'bg-[#D33401] text-white shadow-xs'
                    : 'text-[#5A5E5E] hover:text-[#1B1C1C]'
                }`}
              >
                For Kitchen & Staff
              </button>
            </div>
          </div>

          {howItWorksTab === 'diner' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
              {/* Step 1 */}
              <div className="bg-[#FBF9F9] p-8 rounded-3xl border border-[#E0DDD8] relative space-y-4">
                <div className="w-10 h-10 rounded-full bg-[#D33401] text-white font-extrabold flex items-center justify-center text-sm shadow-md">
                  1
                </div>
                <div className="w-12 h-12 rounded-2xl bg-orange-100 flex items-center justify-center text-[#D33401]">
                  <QrCode className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-[#1B1C1C]">Scan Table QR Code</h3>
                <p className="text-sm text-[#5A5E5E] leading-relaxed">
                  Guests sit down and scan the table QR code with their phone camera. The live digital menu opens in under 2 seconds without any app download.
                </p>
              </div>

              {/* Step 2 */}
              <div className="bg-[#FBF9F9] p-8 rounded-3xl border border-[#E0DDD8] relative space-y-4">
                <div className="w-10 h-10 rounded-full bg-[#D33401] text-white font-extrabold flex items-center justify-center text-sm shadow-md">
                  2
                </div>
                <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-700">
                  <Utensils className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-[#1B1C1C]">Customize & Order</h3>
                <p className="text-sm text-[#5A5E5E] leading-relaxed">
                  Browse dishes with photos, spice ratings, allergens, and dietary tags. Add cooking instructions and send the order directly to the kitchen.
                </p>
              </div>

              {/* Step 3 */}
              <div className="bg-[#FBF9F9] p-8 rounded-3xl border border-[#E0DDD8] relative space-y-4">
                <div className="w-10 h-10 rounded-full bg-[#D33401] text-white font-extrabold flex items-center justify-center text-sm shadow-md">
                  3
                </div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-700">
                  <CreditCard className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-[#1B1C1C]">Track Live & Settle</h3>
                <p className="text-sm text-[#5A5E5E] leading-relaxed">
                  Watch live kitchen progression timers, call the waiter with 1-tap, and pay instantly via Cashfree UPI (Google Pay, PhonePe) or counter cash.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
              {/* Staff Step 1 */}
              <div className="bg-[#FBF9F9] p-8 rounded-3xl border border-[#E0DDD8] relative space-y-4">
                <div className="w-10 h-10 rounded-full bg-[#1B1C1C] text-white font-extrabold flex items-center justify-center text-sm shadow-md">
                  1
                </div>
                <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-700">
                  <ChefHat className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-[#1B1C1C]">Instant KOT Signal</h3>
                <p className="text-sm text-[#5A5E5E] leading-relaxed">
                  Orders appear in real-time on kitchen displays with audio chimes and table numbers, completely eliminating handwritten order slip delays.
                </p>
              </div>

              {/* Staff Step 2 */}
              <div className="bg-[#FBF9F9] p-8 rounded-3xl border border-[#E0DDD8] relative space-y-4">
                <div className="w-10 h-10 rounded-full bg-[#1B1C1C] text-white font-extrabold flex items-center justify-center text-sm shadow-md">
                  2
                </div>
                <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-700">
                  <Clock className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-[#1B1C1C]">1-Click Bump Status</h3>
                <p className="text-sm text-[#5A5E5E] leading-relaxed">
                  Chefs bump dishes to "Preparing" and "Ready" with a single tap. Waiters get alerted to pick up piping-hot dishes immediately.
                </p>
              </div>

              {/* Staff Step 3 */}
              <div className="bg-[#FBF9F9] p-8 rounded-3xl border border-[#E0DDD8] relative space-y-4">
                <div className="w-10 h-10 rounded-full bg-[#1B1C1C] text-white font-extrabold flex items-center justify-center text-sm shadow-md">
                  3
                </div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-700">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-[#1B1C1C]">Auto-Settle & Clear Table</h3>
                <p className="text-sm text-[#5A5E5E] leading-relaxed">
                  Bills are automatically reconciled. Tables flip from Occupied to Cleaning to Available, maximizing seat turnover during peak hours.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* =========================================================
          6. INTERACTIVE REAL-TIME KDS SIMULATOR
         ========================================================= */}
      <section id="simulator" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-[#0F172A] text-white rounded-3xl p-8 sm:p-12 shadow-2xl relative overflow-hidden border border-slate-800">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#D33401]/15 rounded-full blur-3xl pointer-events-none" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center relative z-10">
            {/* Simulator Left: Explanation & Status Buttons */}
            <div className="lg:col-span-6 space-y-6">
              <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-[#D33401]/20 text-orange-400 border border-[#D33401]/30">
                Live SignalR Simulation
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                Try the Real-Time Kitchen Workflow
              </h2>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                Click any progression stage below to see how MenzaOrder synchronizes kitchen staff and diner devices in under 150 milliseconds.
              </p>

              {/* Status Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                {[
                  { key: 'Placed', label: '1. Order Placed', sub: 'KOT sent to Kitchen' },
                  { key: 'Cooking', label: '2. Chef Cooking', sub: 'Timer ~12m active' },
                  { key: 'Ready', label: '3. Food Ready', sub: 'Server brings to table' },
                  { key: 'Served', label: '4. Served & Settled', sub: 'Table refreshed' },
                ].map((st) => (
                  <button
                    key={st.key}
                    onClick={() => setSimulatorStatus(st.key as any)}
                    className={`p-3.5 rounded-2xl text-left border transition-all cursor-pointer ${
                      simulatorStatus === st.key
                        ? 'bg-[#D33401] border-[#D33401] text-white shadow-lg shadow-[#D33401]/40'
                        : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700/80'
                    }`}
                  >
                    <div className="text-xs font-extrabold">{st.label}</div>
                    <div className="text-[11px] opacity-75">{st.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Simulator Right: Live Toast & Status Feedback */}
            <div className="lg:col-span-6">
              <div className="bg-slate-900/90 rounded-2xl p-6 border border-slate-800 space-y-5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-bold text-slate-200">Table T1 · Order #104</span>
                  </div>
                  <span className="text-xs font-mono text-slate-400">SignalR Connected</span>
                </div>

                {/* Simulated Diner Toast Banner */}
                <div
                  className={`p-4 rounded-xl flex items-center gap-3 transition-all ${
                    simulatorStatus === 'Placed'
                      ? 'bg-blue-950/80 border border-blue-800 text-blue-200'
                      : simulatorStatus === 'Cooking'
                      ? 'bg-amber-950/80 border border-amber-800 text-amber-200'
                      : simulatorStatus === 'Ready'
                      ? 'bg-purple-950/80 border border-purple-800 text-purple-200'
                      : 'bg-emerald-950/80 border border-emerald-800 text-emerald-200'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                    {simulatorStatus === 'Cooking' ? (
                      <Flame className="w-4 h-4 text-amber-300" />
                    ) : simulatorStatus === 'Ready' ? (
                      <Bell className="w-4 h-4 text-purple-300" />
                    ) : simulatorStatus === 'Served' ? (
                      <Check className="w-4 h-4 text-emerald-300" />
                    ) : (
                      <Clock className="w-4 h-4 text-blue-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-extrabold">
                      {simulatorStatus === 'Placed' && 'Order #104 confirmed by restaurant!'}
                      {simulatorStatus === 'Cooking' && 'Chef started preparing Order #104 (~12m).'}
                      {simulatorStatus === 'Ready' && 'Order #104 is READY! Server is bringing it.'}
                      {simulatorStatus === 'Served' && 'Order #104 has been served. Enjoy your feast!'}
                    </div>
                    <div className="text-[11px] opacity-80 mt-0.5">
                      Live Push Alert via WebSocket
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-bold uppercase">
                    Live
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Kitchen Progression</span>
                    <span className="font-bold text-white">
                      {simulatorStatus === 'Placed' && '25% · KOT Queued'}
                      {simulatorStatus === 'Cooking' && '60% · On Grill'}
                      {simulatorStatus === 'Ready' && '90% · Plated & Ready'}
                      {simulatorStatus === 'Served' && '100% · Complete'}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-orange-500 to-[#D33401] transition-all duration-500 rounded-full"
                      style={{
                        width:
                          simulatorStatus === 'Placed'
                            ? '25%'
                            : simulatorStatus === 'Cooking'
                            ? '60%'
                            : simulatorStatus === 'Ready'
                            ? '90%'
                            : '100%',
                      }}
                    />
                  </div>
                </div>

                {/* Launch Button */}
                <button
                  onClick={() => onLaunchCustomerView('bEfOdSjPPB6U8FPbxxQzTg', 27)}
                  className="w-full py-3 bg-[#D33401] hover:bg-[#b82d01] text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <Flame className="w-4 h-4" />
                  <span>Test this in Live Menu (Customer View)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          7. ROI CALCULATOR
         ========================================================= */}
      <section id="calculator" className="py-20 bg-white border-y border-[#E0DDD8]/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-extrabold uppercase tracking-wider text-[#D33401] bg-[#D33401]/10 px-3 py-1 rounded-full">
              Revenue & Efficiency
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#1B1C1C] mt-2">
              Calculate Your Restaurant's Growth
            </h2>
            <p className="text-sm text-[#5A5E5E] mt-1 font-medium">
              See how shaving 14 minutes off table turnover translates into thousands of rupees in incremental monthly profit.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center bg-[#FBF9F9] p-8 sm:p-12 rounded-3xl border border-[#E0DDD8]">
            {/* Sliders on Left */}
            <div className="lg:col-span-7 space-y-7">
              {/* Slider 1: Number of Tables */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm font-bold">
                  <span className="text-[#1B1C1C]">Dining Tables:</span>
                  <span className="text-[#D33401] text-base font-black">{calcTables} Tables</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="80"
                  step="1"
                  value={calcTables}
                  onChange={(e) => setCalcTables(Number(e.target.value))}
                  className="w-full accent-[#D33401] h-2 bg-gray-200 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[11px] text-[#747878]">
                  <span>5 tables (Cafe)</span>
                  <span>40 tables (Bistro)</span>
                  <span>80 tables (Grand Hall)</span>
                </div>
              </div>

              {/* Slider 2: Average Order Value */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm font-bold">
                  <span className="text-[#1B1C1C]">Average Order Value (AOV):</span>
                  <span className="text-[#D33401] text-base font-black">₹{calcAov.toLocaleString()}</span>
                </div>
                <input
                  type="range"
                  min="300"
                  max="3500"
                  step="50"
                  value={calcAov}
                  onChange={(e) => setCalcAov(Number(e.target.value))}
                  className="w-full accent-[#D33401] h-2 bg-gray-200 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[11px] text-[#747878]">
                  <span>₹300</span>
                  <span>₹1,800</span>
                  <span>₹3,500</span>
                </div>
              </div>

              {/* Slider 3: Daily Table Turnover */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm font-bold">
                  <span className="text-[#1B1C1C]">Daily Table Turns:</span>
                  <span className="text-[#D33401] text-base font-black">{calcTurns} turns/day</span>
                </div>
                <input
                  type="range"
                  min="1.5"
                  max="8"
                  step="0.5"
                  value={calcTurns}
                  onChange={(e) => setCalcTurns(Number(e.target.value))}
                  className="w-full accent-[#D33401] h-2 bg-gray-200 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[11px] text-[#747878]">
                  <span>1.5 turns</span>
                  <span>4.0 turns</span>
                  <span>8.0 turns</span>
                </div>
              </div>
            </div>

            {/* Results Card on Right */}
            <div className="lg:col-span-5 bg-white p-7 rounded-2xl border-2 border-[#D33401]/20 shadow-lg space-y-6">
              <div className="text-xs font-extrabold uppercase tracking-wider text-[#D33401]">
                Estimated Monthly Value Unlocked
              </div>

              <div className="space-y-4">
                <div>
                  <div className="text-3xl sm:text-4xl font-black text-[#1B1C1C] tracking-tight">
                    +₹{roiMetrics.estimatedExtraRevenue.toLocaleString()}
                  </div>
                  <div className="text-xs text-[#5A5E5E] font-medium mt-0.5">
                    Estimated Extra Monthly Gross Revenue
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100 grid grid-cols-2 gap-3 text-left">
                  <div className="p-3 rounded-xl bg-orange-50/70">
                    <div className="text-lg font-black text-[#D33401]">
                      {roiMetrics.totalDailyHoursSaved} hrs
                    </div>
                    <div className="text-[11px] text-[#5A5E5E] font-medium">Wait Time Saved/Day</div>
                  </div>

                  <div className="p-3 rounded-xl bg-emerald-50/70">
                    <div className="text-lg font-black text-emerald-700">
                      +{roiMetrics.extraTableTurnsMonthly}
                    </div>
                    <div className="text-[11px] text-[#5A5E5E] font-medium">Extra Tables Served/Mo</div>
                  </div>
                </div>
              </div>

              <button
                onClick={() => onLaunchCustomerView('bEfOdSjPPB6U8FPbxxQzTg', 27)}
                className="w-full py-3 bg-[#D33401] hover:bg-[#b82d01] text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
              >
                <span>Start Free Trial Today</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          8. COMPARISON MATRIX
         ========================================================= */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="text-xs font-extrabold uppercase tracking-wider text-[#D33401] bg-[#D33401]/10 px-3 py-1 rounded-full">
            The MenzaOrder Advantage
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#1B1C1C] mt-2">
            Traditional Dining vs MenzaOrder
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full bg-white rounded-3xl border border-[#E0DDD8] overflow-hidden shadow-xs">
            <thead>
              <tr className="border-b border-[#E0DDD8] text-left text-xs font-extrabold text-[#747878] uppercase">
                <th className="p-5">Dining Experience Touchpoint</th>
                <th className="p-5 text-gray-400">Paper Menus & Old POS</th>
                <th className="p-5 text-gray-400">Static PDF QR Menus</th>
                <th className="p-5 bg-orange-50/60 text-[#D33401]">MenzaOrder Smart QR & KDS</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-[#E0DDD8]/60">
              <tr>
                <td className="p-5 font-bold text-[#1B1C1C]">Menu Access Speed</td>
                <td className="p-5 text-[#747878]">Wait 5-10 mins for waiter</td>
                <td className="p-5 text-[#747878]">Pinch-to-zoom unreadable PDF</td>
                <td className="p-5 bg-orange-50/30 font-bold text-emerald-600">⚡ Instant &lt; 2.5s responsive web</td>
              </tr>
              <tr>
                <td className="p-5 font-bold text-[#1B1C1C]">Kitchen KOT Transmission</td>
                <td className="p-5 text-[#747878]">Handwritten notepad delays</td>
                <td className="p-5 text-[#747878]">Still requires waiter to write</td>
                <td className="p-5 bg-orange-50/30 font-bold text-emerald-600">🚀 Instant SignalR WebSocket push</td>
              </tr>
              <tr>
                <td className="p-5 font-bold text-[#1B1C1C]">Calling Waiter for Water / Bill</td>
                <td className="p-5 text-[#747878]">Awkward hand-waving & shouting</td>
                <td className="p-5 text-[#747878]">No digital assistance</td>
                <td className="p-5 bg-orange-50/30 font-bold text-emerald-600">🔔 1-Tap Call Waiter with Table ID</td>
              </tr>
              <tr>
                <td className="p-5 font-bold text-[#1B1C1C]">Out of Stock Handling</td>
                <td className="p-5 text-[#747878]">Customer orders, waiter apologizes</td>
                <td className="p-5 text-[#747878]">Static, cannot change live</td>
                <td className="p-5 bg-orange-50/30 font-bold text-emerald-600">🛡️ Real-time 1-click stock toggle</td>
              </tr>
              <tr>
                <td className="p-5 font-bold text-[#1B1C1C]">Payment & Settlement</td>
                <td className="p-5 text-[#747878]">Wait 10 mins for card machine</td>
                <td className="p-5 text-[#747878]">Manual billing queue</td>
                <td className="p-5 bg-orange-50/30 font-bold text-emerald-600">💳 Instant Cashfree UPI & Cards</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* =========================================================
          9. TRANSPARENT PRICING PLANS
         ========================================================= */}
      <section id="pricing" className="py-20 bg-white border-y border-[#E0DDD8]/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-extrabold uppercase tracking-wider text-[#D33401] bg-[#D33401]/10 px-3 py-1 rounded-full">
              Simple & Transparent Pricing
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#1B1C1C] mt-2">
              Plans Built for Every Stage of Dining
            </h2>
            <p className="text-sm text-[#5A5E5E] mt-1 font-medium">
              Zero hidden setup fees. Upgrade or cancel anytime.
            </p>

            {/* Annual Billing Toggle */}
            <div className="inline-flex items-center gap-3 mt-6 p-1.5 bg-[#FBF9F9] rounded-xl border border-[#E0DDD8]">
              <span className={`text-xs font-bold ${!annualBilling ? 'text-[#1B1C1C]' : 'text-[#747878]'}`}>
                Monthly Billing
              </span>
              <button
                onClick={() => setAnnualBilling(!annualBilling)}
                className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                  annualBilling ? 'bg-[#D33401]' : 'bg-gray-300'
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    annualBilling ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className={`text-xs font-bold flex items-center gap-1.5 ${annualBilling ? 'text-[#1B1C1C]' : 'text-[#747878]'}`}>
                <span>Annual Billing</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
                  Save 20%
                </span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
            {/* Starter Plan */}
            <div className="bg-[#FBF9F9] p-8 rounded-3xl border border-[#E0DDD8] flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <span className="text-xs font-extrabold uppercase tracking-wider text-[#747878]">
                  Starter / Cafe
                </span>
                <h3 className="text-xl font-bold text-[#1B1C1C]">For Cafes & Quick Service</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-[#1B1C1C]">
                    ₹{annualBilling ? '1,199' : '1,499'}
                  </span>
                  <span className="text-xs text-[#747878]">/month</span>
                </div>
                <p className="text-xs text-[#5A5E5E]">
                  Perfect for coffee shops, fast casual counters, and bakeries.
                </p>
                <div className="pt-4 border-t border-gray-200 space-y-2.5 text-xs text-[#1B1C1C]">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600" /> Up to 15 Tables / Counters
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600" /> Digital QR Code Generator
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600" /> Cashfree UPI & Card Payments
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600" /> Takeaway & Counter Mode
                  </div>
                </div>
              </div>
              <button
                onClick={() => onLaunchCustomerView('uqQTzsGyDJy4_TBVeYXCfg', null)}
                className="w-full py-3 bg-white border border-[#E0DDD8] hover:border-[#D33401] hover:text-[#D33401] text-[#1B1C1C] font-bold text-xs rounded-xl shadow-xs transition-all"
              >
                Choose Starter
              </button>
            </div>

            {/* Pro Plan (Featured) */}
            <div className="bg-white p-8 rounded-3xl border-2 border-[#D33401] shadow-xl relative flex flex-col justify-between space-y-6">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3.5 py-1 rounded-full bg-[#D33401] text-white text-[11px] font-extrabold uppercase tracking-wider shadow-sm">
                Most Popular
              </div>
              <div className="space-y-4 pt-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-[#D33401]">
                  Pro Restaurant & Bar
                </span>
                <h3 className="text-xl font-bold text-[#1B1C1C]">For Busy Dining Halls</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-[#1B1C1C]">
                    ₹{annualBilling ? '2,399' : '2,999'}
                  </span>
                  <span className="text-xs text-[#747878]">/month</span>
                </div>
                <p className="text-xs text-[#5A5E5E]">
                  Complete dining management with live KDS, SignalR, and Call Waiter.
                </p>
                <div className="pt-4 border-t border-gray-200 space-y-2.5 text-xs text-[#1B1C1C]">
                  <div className="flex items-center gap-2 font-semibold">
                    <Check className="w-4 h-4 text-[#D33401]" /> Unlimited Tables & Zones
                  </div>
                  <div className="flex items-center gap-2 font-semibold">
                    <Check className="w-4 h-4 text-[#D33401]" /> Real-Time SignalR Live KDS Display
                  </div>
                  <div className="flex items-center gap-2 font-semibold">
                    <Check className="w-4 h-4 text-[#D33401]" /> 1-Tap "Call Waiter" & Bill Requests
                  </div>
                  <div className="flex items-center gap-2 font-semibold">
                    <Check className="w-4 h-4 text-[#D33401]" /> Dynamic Table Sanitization & Turnover
                  </div>
                  <div className="flex items-center gap-2 font-semibold">
                    <Check className="w-4 h-4 text-[#D33401]" /> Live Out-of-Stock Toggle
                  </div>
                </div>
              </div>
              <button
                onClick={() => onLaunchCustomerView('bEfOdSjPPB6U8FPbxxQzTg', 27)}
                className="w-full py-3 bg-[#D33401] hover:bg-[#b82d01] text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md shadow-[#D33401]/30 transition-all"
              >
                Launch Pro Experience
              </button>
            </div>

            {/* Enterprise Plan */}
            <div className="bg-[#FBF9F9] p-8 rounded-3xl border border-[#E0DDD8] flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <span className="text-xs font-extrabold uppercase tracking-wider text-[#747878]">
                  Enterprise / Chains
                </span>
                <h3 className="text-xl font-bold text-[#1B1C1C]">Multi-Branch & Franchises</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-[#1B1C1C]">Custom</span>
                </div>
                <p className="text-xs text-[#5A5E5E]">
                  Tailored integration for restaurant chains, resorts, and hotel groups.
                </p>
                <div className="pt-4 border-t border-gray-200 space-y-2.5 text-xs text-[#1B1C1C]">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600" /> Multi-Branch Central Console
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600" /> Custom Domain & Whitelabel Branding
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600" /> Thermal KOT Printer Integration
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600" /> 24/7 Dedicated Account Manager
                  </div>
                </div>
              </div>
              <button
                onClick={() => onOpenStaffView()}
                className="w-full py-3 bg-white border border-[#E0DDD8] hover:border-[#D33401] hover:text-[#D33401] text-[#1B1C1C] font-bold text-xs rounded-xl shadow-xs transition-all"
              >
                Contact Enterprise
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          10. FREQUENTLY ASKED QUESTIONS (FAQ)
         ========================================================= */}
      <section id="faq" className="py-20 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <span className="text-xs font-extrabold uppercase tracking-wider text-[#D33401] bg-[#D33401]/10 px-3 py-1 rounded-full">
            Got Questions?
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#1B1C1C] mt-2">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, idx) => {
            const isOpen = openFaqIndex === idx;
            return (
              <div
                key={idx}
                className="bg-white rounded-2xl border border-[#E0DDD8] overflow-hidden transition-all"
              >
                <button
                  onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                  className="w-full p-5 text-left flex items-center justify-between gap-4 cursor-pointer focus:outline-none"
                >
                  <span className="text-sm sm:text-base font-bold text-[#1B1C1C]">
                    {faq.q}
                  </span>
                  <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0 text-[#747878]">
                    {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-xs sm:text-sm text-[#5A5E5E] leading-relaxed border-t border-gray-100 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* =========================================================
          11. FINAL HIGH-CONVERSION CTA BANNER
         ========================================================= */}
      <section className="py-16 bg-gradient-to-r from-[#D33401] via-[#E85D04] to-[#F48C06] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
            Ready to Revolutionize Your Restaurant?
          </h2>
          <p className="text-base sm:text-lg text-white/90 max-w-2xl mx-auto font-medium">
            Join hundreds of modern restaurants, cafes, and rooftop bistros speeding up table turns with MenzaOrder.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <button
              onClick={() => onLaunchCustomerView('bEfOdSjPPB6U8FPbxxQzTg', 27)}
              className="w-full sm:w-auto px-8 py-4 bg-white text-[#D33401] hover:bg-gray-100 font-extrabold text-sm rounded-xl shadow-xl hover:shadow-2xl transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Flame className="w-4 h-4" />
              <span>Launch Live Demo Menu</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={onOpenStaffView}
              className="w-full sm:w-auto px-7 py-4 bg-black/20 hover:bg-black/30 border border-white/30 text-white font-bold text-sm rounded-xl transition-all cursor-pointer"
            >
              Access Kitchen POS
            </button>
          </div>
        </div>
      </section>

      {/* =========================================================
          12. RICH BRANDED FOOTER
         ========================================================= */}
      <footer className="bg-[#1B1C1C] text-white pt-16 pb-12 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
            {/* Brand Column */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#D33401] to-[#FF6B35] flex items-center justify-center shadow-md">
                  <Utensils className="w-5 h-5 text-white" />
                </div>
                <span className="text-2xl font-extrabold tracking-tight">
                  Menza<span className="text-[#D33401]">Order</span>
                </span>
              </div>
              <p className="text-xs text-gray-400 max-w-sm leading-relaxed">
                Next-generation contactless QR ordering, real-time Azure SignalR kitchen progression, dynamic table turnover management, and Cashfree payments.
              </p>
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>All SignalR Systems Operational</span>
              </div>
            </div>

            {/* Quick Links */}
            <div className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-gray-400">Solutions</div>
              <ul className="space-y-2 text-xs text-gray-300">
                <li><a href="#features" className="hover:text-white transition-colors">Dine-In QR Menu</a></li>
                <li><a href="#features" className="hover:text-white transition-colors">Real-Time KDS</a></li>
                <li><a href="#features" className="hover:text-white transition-colors">1-Tap Call Waiter</a></li>
                <li><a href="#features" className="hover:text-white transition-colors">Storefront Takeaway</a></li>
                <li><a href="#features" className="hover:text-white transition-colors">Table QR Generator</a></li>
              </ul>
            </div>

            {/* Live Demos */}
            <div className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-gray-400">Live Demos</div>
              <ul className="space-y-2 text-xs text-gray-300">
                <li>
                  <button
                    onClick={() => onLaunchCustomerView('bEfOdSjPPB6U8FPbxxQzTg', 27)}
                    className="hover:text-[#D33401] transition-colors text-left"
                  >
                    Menza Veerji Cafe (Table T1)
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => onLaunchCustomerView('fPo9f2iv1IjJcp77OZWtgA', 34)}
                    className="hover:text-[#D33401] transition-colors text-left"
                  >
                    Menza Kitchen (Table TE2)
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => onLaunchCustomerView('uqQTzsGyDJy4_TBVeYXCfg', null)}
                    className="hover:text-[#D33401] transition-colors text-left"
                  >
                    Menza Fine Dining (Counter)
                  </button>
                </li>
                <li>
                  <button
                    onClick={onOpenStaffView}
                    className="hover:text-[#D33401] transition-colors text-left"
                  >
                    Kitchen Staff Portal
                  </button>
                </li>
              </ul>
            </div>

            {/* Legal & Status */}
            <div className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-gray-400">Security & POS</div>
              <ul className="space-y-2 text-xs text-gray-300">
                <li>Cashfree POS Verified</li>
                <li>Azure SignalR Protected</li>
                <li>Cryptographic QR Encryption</li>
                <li>PCI-DSS Compliant</li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-500 gap-4">
            <div>
              © 2026 MenzaOrder Technologies. All rights reserved.
            </div>
            <div className="flex items-center gap-6">
              <span className="hover:text-gray-400 cursor-pointer">Privacy Policy</span>
              <span className="hover:text-gray-400 cursor-pointer">Terms of Service</span>
              <span className="hover:text-gray-400 cursor-pointer">Support</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
