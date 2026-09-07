import React from 'react';
import { ExternalLink, CheckCircle } from 'lucide-react';

export default function SourceCitations({ citations }) {
  if (!citations || citations.length === 0) return null;

  return (
    <div class="bg-sage-50/50 p-4 rounded-xl border border-sage-500/10 mt-6">
      <div class="flex items-center gap-1.5 text-sage-700 font-serif font-semibold text-sm mb-3">
        <CheckCircle size={16} class="text-sage-500" />
        <span>Grounded RAG Sources ({citations.length})</span>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {citations.map((citation, index) => (
          <div 
            key={index} 
            class="bg-cream-100 p-3 rounded-lg border border-cream-200 shadow-sm flex flex-col justify-between"
          >
            <div class="text-xs font-semibold text-charcoal-900 mb-1">
              [Source {index + 1}] {citation.title}
            </div>
            <div class="flex flex-wrap gap-2 mt-2">
              {citation.links && citation.links.map((link, lIndex) => (
                <a
                  key={lIndex}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-1 text-[10px] text-sage-500 hover:text-sage-600 bg-white border border-cream-300 px-2 py-0.5 rounded transition-all font-medium"
                >
                  <span>{link.title || 'Source link'}</span>
                  <ExternalLink size={10} />
                </a>
              ))}
              {(!citation.links || citation.links.length === 0) && (
                <span class="text-[10px] text-charcoal-100 italic">Pre-seeded campus catalog records</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
