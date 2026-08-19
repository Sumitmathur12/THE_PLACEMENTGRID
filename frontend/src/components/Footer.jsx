import React from "react";

export default function Footer() {
  return (
    <footer className="bg-cream-200 border-t border-cream-300 py-8 text-center text-xs text-charcoal-100 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="font-serif italic text-sage-600 mb-1">
          “Adoptable placement preparation that actually feels like studying.”
        </p>
        <p>&copy; {new Date().getFullYear()} THE_PlacementGRID.</p>
      </div>
    </footer>
  );
}
