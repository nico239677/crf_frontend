import React, { useState, useRef, useEffect } from 'react';
import { Table2, ChevronDown } from 'lucide-react';

interface TableDropdownProps {
  tables: string[];
  selected: string;
  onSelect: (name: string) => void;
}

export const TableDropdown: React.FC<TableDropdownProps> = ({ tables, selected, onSelect }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
      >
        <Table2 className="w-4 h-4 text-gray-400" />
        <span className="font-mono">{selected}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[160px]">
          {tables.map((t) => (
            <button
              key={t}
              onClick={() => { onSelect(t); setOpen(false); }}
              className={`w-full text-left px-4 py-2 text-sm font-mono transition-colors ${
                t === selected
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
