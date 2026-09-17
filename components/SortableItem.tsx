import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export function SortableItem(props: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.95 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center p-4 mb-3 rounded-2xl transition-all border ${
        isDragging 
          ? 'bg-white dark:bg-slate-800 border-blue-500 shadow-xl scale-[1.02] ring-2 ring-blue-500/20' 
          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md'
      }`}
    >
      <div className="flex items-center gap-4">
        {/* אייקון הגרירה */}
        <div
          {...attributes}
          {...listeners}
          className="p-2 -mr-2 text-slate-300 dark:text-slate-600 cursor-grab hover:text-blue-600 dark:hover:text-blue-400 active:cursor-grabbing transition-colors touch-none"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
          </svg>
        </div>
        
        {/* דירוג (מספר) */}
        <div className="flex items-center justify-center w-10 h-10 font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded-xl border border-blue-100 dark:border-blue-800/50">
          {props.index + 1}
        </div>
      </div>

      <div className="flex-1 mr-5">
        <span className="font-bold text-slate-700 dark:text-slate-200">{props.title}</span>
      </div>
    </div>
  );
}