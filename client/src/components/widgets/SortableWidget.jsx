import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

export const SortableWidget = ({
  id,
  isCustomizeMode,
  children,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      {/* Drag handle banner in customize mode */}
      {isCustomizeMode && (
        <div
          {...attributes}
          {...listeners}
          className="absolute -top-2 left-1/2 -translate-x-1/2 z-20 px-3 py-1 bg-brand-600 text-white rounded-full text-[10px] font-bold shadow-md cursor-grab active:cursor-grabbing flex items-center space-x-1 border border-white dark:border-[#151A26]"
        >
          <GripVertical className="w-3 h-3" />
          <span>Drag to reorder</span>
        </div>
      )}
      <div className={isCustomizeMode ? 'ring-2 ring-brand-500/50 rounded-2xl' : ''}>
        {children}
      </div>
    </div>
  );
};

export default SortableWidget;
