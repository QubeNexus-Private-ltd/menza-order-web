import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import {
  Sparkles,
  Flame,
  Plus,
  Minus,
  Check,
  ChevronLeft,
  ChevronRight,
  Shuffle,
  Star,
  Clock,
} from 'lucide-react';
import { MenuItem, OrderItem } from '../types';
import { getItemImageUrl, getOriginalImageUrl } from '../services/api';

export interface Dish3DShuffleProps {
  items: MenuItem[];
  onAddToCart?: (itemId: number | string, quantity: number, item?: MenuItem) => void | Promise<any>;
  cartItems?: OrderItem[];
  currencySymbol?: string;
}

export default function Dish3DShuffle({
  items = [],
  onAddToCart,
  cartItems = [],
  currencySymbol = '₹',
}: Dish3DShuffleProps) {
  // Select top featured dishes (items with images and available)
  const featuredList = useMemo(() => {
    if (!items || items.length === 0) return [];
    const available = items.filter((it) => it.isAvailable !== false);
    const withImages = available.filter((it) => Boolean(it.imageUrl || it.image || it.itemImage));
    const pool = withImages.length >= 3 ? withImages : available;
    return pool.slice(0, 6);
  }, [items]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [addedAnimation, setAddedAnimation] = useState<Record<string | number, boolean>>({});

  const total = featuredList.length;

  const nextCard = useCallback(() => {
    if (total <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % total);
  }, [total]);

  const prevCard = useCallback(() => {
    if (total <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + total) % total);
  }, [total]);

  const handleDragEnd = useCallback(
    (_: any, info: PanInfo) => {
      const swipeThreshold = 50;
      if (info.offset.x < -swipeThreshold) {
        nextCard();
      } else if (info.offset.x > swipeThreshold) {
        prevCard();
      }
    },
    [nextCard, prevCard]
  );

  const resolveImage = (item?: MenuItem) => {
    if (!item) return '';
    const raw = item.imageUrl || item.image || item.itemImage;
    if (!raw || typeof raw !== 'string') return '';
    const clean = raw.trim();
    if (clean.startsWith('http://') || clean.startsWith('https://') || clean.startsWith('data:')) {
      return clean;
    }
    return getItemImageUrl(clean, item.isVeg !== false) || '';
  };

  const getQuantityInCart = (itemId?: number | string) => {
    if (!itemId) return 0;
    const found = cartItems.find((c) => String(c.itemId ?? c.id) === String(itemId));
    return found ? Number(found.quantity) || 0 : 0;
  };

  const handleAdd = (item: MenuItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const id = item.itemId ?? item.id;
    if (!id || typeof onAddToCart !== 'function') return;

    setAddedAnimation((prev) => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setAddedAnimation((prev) => ({ ...prev, [id]: false }));
    }, 650);

    const curQty = getQuantityInCart(id);
    onAddToCart(id, curQty + 1, item);
  };

  if (total < 2) return null;

  const activeDish = featuredList[currentIndex];

  // Visual stack: Top 3 cards in the deck
  const stackOrder = [0, 1, 2].map((offset) => {
    const idx = (currentIndex + offset) % total;
    return {
      index: idx,
      item: featuredList[idx],
      offset,
    };
  });

  return (
    <div className="w-full max-w-5xl mx-auto px-3 sm:px-4 py-3 sm:py-5 select-none">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-md shadow-orange-500/20">
            <Flame size={18} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
                Chef's Specials
              </h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700 uppercase tracking-wider">
                3D Spotlight
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 font-medium">
              Swipe or shuffle to discover today's highlights
            </p>
          </div>
        </div>

        {/* Shuffle & Navigation Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={prevCard}
            aria-label="Previous special"
            className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-700 flex items-center justify-center hover:bg-slate-50 active:scale-95 transition-all shadow-xs"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={nextCard}
            aria-label="Shuffle special"
            className="px-2.5 h-8 rounded-full bg-gradient-to-r from-orange-600 to-amber-600 text-white text-xs font-bold flex items-center gap-1.5 hover:from-orange-700 hover:to-amber-700 active:scale-95 transition-all shadow-sm shadow-orange-600/25"
          >
            <Shuffle size={13} className="transition-transform active:rotate-180" />
            <span className="hidden sm:inline">Shuffle</span>
          </button>
          <button
            onClick={nextCard}
            aria-label="Next special"
            className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-700 flex items-center justify-center hover:bg-slate-50 active:scale-95 transition-all shadow-xs"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* 3D Shuffle Deck Stage */}
      <div
        className="relative w-full h-[250px] sm:h-[280px] flex items-center justify-center overflow-visible"
        style={{ perspective: '1100px' }}
      >
        <AnimatePresence mode="popLayout">
          {stackOrder
            .slice()
            .reverse()
            .map(({ index, item, offset }) => {
              if (!item) return null;

              const isTop = offset === 0;
              const imgUrl = resolveImage(item);
              const dishId = item.itemId ?? item.id;
              const inCartQty = getQuantityInCart(dishId);
              const isJustAdded = Boolean(dishId && addedAnimation[dishId]);

              // 3D layering transforms based on depth in deck
              const yOffset = offset * 12;
              const scale = 1 - offset * 0.06;
              const rotation = offset === 0 ? 0 : offset === 1 ? 4 : -4;
              const zIndex = 30 - offset * 10;
              const opacity = 1 - offset * 0.18;

              return (
                <motion.div
                  key={`${dishId}-${index}`}
                  style={{
                    zIndex,
                    transformOrigin: 'bottom center',
                  }}
                  initial={{
                    scale: scale * 0.9,
                    y: yOffset + 25,
                    opacity: 0,
                    rotateZ: rotation,
                  }}
                  animate={{
                    scale,
                    y: yOffset,
                    opacity,
                    rotateZ: rotation,
                    transition: {
                      type: 'spring',
                      stiffness: 280,
                      damping: 24,
                    },
                  }}
                  exit={{
                    x: -240,
                    rotateZ: -16,
                    opacity: 0,
                    scale: 0.8,
                    transition: { duration: 0.26, ease: 'easeIn' },
                  }}
                  drag={isTop ? 'x' : false}
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.65}
                  onDragEnd={isTop ? handleDragEnd : undefined}
                  className={`absolute w-[92%] sm:w-[380px] h-[230px] sm:h-[260px] rounded-2xl bg-white border border-slate-200/90 shadow-xl overflow-hidden cursor-grab active:cursor-grabbing transition-shadow ${
                    isTop ? 'shadow-orange-950/10 hover:shadow-2xl' : 'shadow-slate-900/5 pointer-events-none'
                  }`}
                >
                  {/* Card Background Image with Gradient Overlay */}
                  <div className="relative w-full h-[140px] sm:h-[160px] bg-slate-900 overflow-hidden">
                    {imgUrl ? (
                      <img
                        src={imgUrl}
                        alt={item.itemName || 'Dish'}
                        className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-500"
                        onError={(e) => {
                          // Fallback placeholder
                          (e.currentTarget as HTMLImageElement).src =
                            'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-amber-600 via-orange-600 to-rose-700 flex items-center justify-center text-white">
                        <Sparkles size={36} className="opacity-60 animate-spin" />
                      </div>
                    )}

                    {/* Gradient shade */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />

                    {/* Veg / Non-Veg Badge */}
                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                      <span
                        className={`w-4 h-4 rounded-xs border-1.5 flex items-center justify-center bg-white/95 backdrop-blur-xs ${
                          item.isVeg !== false ? 'border-emerald-600' : 'border-rose-600'
                        }`}
                        title={item.isVeg !== false ? 'Vegetarian' : 'Non-Vegetarian'}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            item.isVeg !== false ? 'bg-emerald-600' : 'bg-rose-600'
                          }`}
                        />
                      </span>

                      {item.categoryName && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-black/60 backdrop-blur-xs text-white border border-white/20">
                          {item.categoryName}
                        </span>
                      )}
                    </div>

                    {/* Top Right Rating / Chef Badge */}
                    <div className="absolute top-2.5 right-2.5">
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-400 text-slate-950 shadow-xs">
                        <Star size={10} className="fill-slate-950" />
                        Popular
                      </span>
                    </div>

                    {/* Bottom Title on Image */}
                    <div className="absolute bottom-2.5 left-3 right-3 text-white">
                      <h3 className="text-sm sm:text-base font-extrabold truncate drop-shadow-sm">
                        {item.itemName || item.name || 'Signature Special'}
                      </h3>
                      <p className="text-[11px] text-white/80 line-clamp-1">
                        {item.description || 'Specially curated by our chef'}
                      </p>
                    </div>
                  </div>

                  {/* Card Bottom Details & Action Bar */}
                  <div className="h-[90px] sm:h-[100px] px-3.5 sm:px-4 py-2 flex items-center justify-between bg-white">
                    {/* Price and Prep time */}
                    <div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-xs font-bold text-orange-600">{currencySymbol}</span>
                        <span className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                          {Number(item.price ?? item.unitPrice ?? item.amount ?? 0).toFixed(0)}
                        </span>
                        {item.unitDescription && (
                          <span className="text-[10px] text-slate-400 font-semibold ml-0.5">
                            /{item.unitDescription}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 mt-0.5">
                        <Clock size={10} className="text-slate-400" />
                        <span>Freshly Prepared</span>
                      </div>
                    </div>

                    {/* Add to Cart Button */}
                    <div>
                      {inCartQty > 0 ? (
                        <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-full px-2 py-1 shadow-xs">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (dishId && onAddToCart) {
                                onAddToCart(dishId, inCartQty - 1, item);
                              }
                            }}
                            aria-label="Decrease quantity"
                            className="w-6 h-6 rounded-full bg-white text-orange-700 flex items-center justify-center font-bold text-xs hover:bg-orange-100 transition-colors shadow-2xs"
                          >
                            <Minus size={12} strokeWidth={2.5} />
                          </button>
                          <span className="text-xs font-extrabold text-orange-950 min-w-4 text-center">
                            {inCartQty}
                          </span>
                          <button
                            onClick={(e) => handleAdd(item, e)}
                            aria-label="Increase quantity"
                            className="w-6 h-6 rounded-full bg-orange-600 text-white flex items-center justify-center font-bold text-xs hover:bg-orange-700 transition-colors shadow-2xs"
                          >
                            <Plus size={12} strokeWidth={2.5} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => handleAdd(item, e)}
                          className={`px-3.5 sm:px-4 py-2 rounded-full font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-all active:scale-95 shadow-sm ${
                            isJustAdded
                              ? 'bg-emerald-600 text-white shadow-emerald-600/30'
                              : 'bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white shadow-orange-600/25'
                          }`}
                        >
                          {isJustAdded ? (
                            <>
                              <Check size={14} strokeWidth={3} />
                              <span>Added!</span>
                            </>
                          ) : (
                            <>
                              <Plus size={14} strokeWidth={2.5} />
                              <span>Add</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
        </AnimatePresence>
      </div>

      {/* Indicator Dots */}
      <div className="flex items-center justify-center gap-1.5 mt-3 sm:mt-4">
        {featuredList.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentIndex(i)}
            aria-label={`Go to slide ${i + 1}`}
            className={`transition-all duration-300 rounded-full ${
              i === currentIndex
                ? 'w-5 h-1.5 bg-orange-600'
                : 'w-1.5 h-1.5 bg-slate-300 hover:bg-slate-400'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
