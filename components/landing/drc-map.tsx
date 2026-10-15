'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';

const provinces = [
  { id: 'kin', name: 'Kinshasa', x: 30, y: 62, size: 1.4 },
  { id: 'kongo', name: 'Kongo Central', x: 22, y: 70, size: 1.1 },
  { id: 'kwi', name: 'Kwilu', x: 24, y: 52, size: 1 },
  { id: 'kwa', name: 'Kwango', x: 20, y: 60, size: 1 },
  { id: 'mai', name: 'Mai-Ndombe', x: 26, y: 46, size: 1 },
  { id: 'equa', name: 'Équateur', x: 30, y: 30, size: 1.3 },
  { id: 'tsho', name: 'Tshuapa', x: 36, y: 38, size: 1.1 },
  { id: 'mon', name: 'Mongala', x: 32, y: 22, size: 1 },
  { id: 'suu', name: 'Sud-Ubangi', x: 26, y: 18, size: 1 },
  { id: 'nuu', name: 'Nord-Ubangi', x: 20, y: 14, size: 1 },
  { id: 'bas', name: 'Bas-Uele', x: 38, y: 14, size: 1 },
  { id: 'hau', name: 'Haut-Uele', x: 46, y: 12, size: 1 },
  { id: 'ituri', name: 'Ituri', x: 52, y: 16, size: 1 },
  { id: 'nku', name: 'Nord-Kivu', x: 56, y: 38, size: 1.1 },
  { id: 'sku', name: 'Sud-Kivu', x: 56, y: 46, size: 1 },
  { id: 'man', name: 'Maniema', x: 48, y: 44, size: 1.1 },
  { id: 'tan', name: 'Tanganyika', x: 44, y: 54, size: 1.1 },
  { id: 'hauL', name: 'Haut-Lomami', x: 38, y: 56, size: 1 },
  { id: 'lual', name: 'Lualaba', x: 44, y: 64, size: 1.1 },
  { id: 'hauKa', name: 'Haut-Katanga', x: 54, y: 64, size: 1.2 },
  { id: 'kol', name: 'Kasaï', x: 34, y: 54, size: 1 },
  { id: 'kolC', name: 'Kasaï Central', x: 32, y: 60, size: 1 },
  { id: 'kolO', name: 'Kasaï Oriental', x: 38, y: 50, size: 1 },
  { id: 'lol', name: 'Lomami', x: 38, y: 44, size: 1 },
  { id: 'san', name: 'Sankuru', x: 40, y: 48, size: 1 },
  { id: 'tang', name: 'Tshopo', x: 50, y: 28, size: 1.2 },
];

export function DrcMap() {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div className="relative aspect-[4/5] w-full max-w-md mx-auto">
      <svg viewBox="0 0 70 90" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="drcGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.15" />
            <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0.1" />
          </linearGradient>
        </defs>
        <path
          d="M 15 12 L 28 8 L 45 6 L 58 12 L 62 22 L 60 32 L 64 40 L 62 50 L 58 60 L 52 70 L 48 78 L 38 82 L 28 78 L 22 70 L 18 60 L 16 50 L 14 40 L 12 30 L 14 20 Z"
          fill="url(#drcGrad)"
          stroke="hsl(var(--primary))"
          strokeWidth="0.4"
          className="transition-all"
        />
        {provinces.map((p) => (
          <g key={p.id}>
            <motion.circle
              cx={p.x}
              cy={p.y}
              r={hovered === p.id ? p.size * 1.6 : p.size}
              fill={
                hovered === p.id
                  ? 'hsl(var(--accent))'
                  : 'hsl(var(--primary))'
              }
              className="cursor-pointer"
              onMouseEnter={() => setHovered(p.id)}
              onMouseLeave={() => setHovered(null)}
              animate={{
                scale: hovered === p.id ? 1.4 : 1,
              }}
            />
            <circle
              cx={p.x}
              cy={p.y}
              r={p.size * 2.5}
              fill="hsl(var(--primary))"
              opacity={hovered === p.id ? 0.2 : 0.08}
              className="pointer-events-none"
            />
          </g>
        ))}
      </svg>
      {hovered && (
        <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-md border border-border bg-popover px-3 py-1.5 text-xs font-medium shadow-md">
          {provinces.find((p) => p.id === hovered)?.name}
        </div>
      )}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground">
        26 provinces · 1 capitale
      </div>
    </div>
  );
}
