import React from 'react';

export default function ProgressRing({ radius = 40, stroke = 8, progress = 0, color = 'stroke-sage-500' }) {
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, progress)) / 100) * circumference;

  return (
    <div class="relative flex items-center justify-center">
      <svg
        height={radius * 2}
        width={radius * 2}
        class="transform -rotate-90"
      >
        {/* Background track ring */}
        <circle
          class="stroke-cream-300 fill-transparent"
          strokeWidth={stroke}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        {/* Active progress ring */}
        <circle
          class={`fill-transparent transition-all duration-500 ease-out ${color}`}
          strokeWidth={stroke}
          strokeDasharray={circumference + ' ' + circumference}
          style={{ strokeDashoffset }}
          strokeLinecap="round"
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
      </svg>
      {/* Percentage Center Text */}
      <span class="absolute text-sm font-serif font-semibold text-charcoal-900">
        {Math.round(progress)}%
      </span>
    </div>
  );
}
