import React, { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SlidersHorizontal, RotateCw, RotateCcw } from 'lucide-react';
import CustomizeDashboardDrawer from './CustomizeDashboardDrawer';

// Sortable item wrapper
const SortableItem = ({ id, size = 'M', children }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : 1,
    opacity: isDragging ? 0.6 : 1,
  };

  // Map size to 12-column grid spans
  const spanClass =
    size === 'S'
      ? 'col-span-12 md:col-span-6 lg:col-span-4'
      : size === 'L'
      ? 'col-span-12'
      : 'col-span-12 md:col-span-6 lg:col-span-6';

  return (
    <div ref={setNodeRef} style={style} className={`${spanClass} flex flex-col`}>
      {React.cloneElement(children, {
        dragHandleProps: { ...attributes, ...listeners },
      })}
    </div>
  );
};

export const DashboardGrid = ({
  dashboardKey = 'hrms',
  title = 'HRMS Dashboard',
  subtitle = 'Overview of workforce metrics, headcount, and punctuality',
  allWidgets = [],
  layout = [],
  hiddenWidgets = [],
  widgetSizes = {},
  onUpdateLayout,
  onUpdateHiddenWidgets,
  onUpdateSizes,
  onResetLayout,
  onRefreshAll,
  extraHeaderActions,
  renderWidget,
}) => {
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const oldIndex = layout.indexOf(active.id);
      const newIndex = layout.indexOf(over.id);
      const newLayout = arrayMove(layout, oldIndex, newIndex);
      onUpdateLayout(newLayout);
    }
  };

  const handleToggleVisibility = (key) => {
    const isHidden = hiddenWidgets.includes(key);
    const updated = isHidden
      ? hiddenWidgets.filter((k) => k !== key)
      : [...hiddenWidgets, key];
    onUpdateHiddenWidgets(updated);
  };

  const handleChangeSize = (key, size) => {
    const updated = { ...widgetSizes, [key]: size };
    onUpdateSizes(updated);
  };

  // Filter out hidden widgets for display
  const activeKeys = layout.filter((k) => !hiddenWidgets.includes(k));

  return (
    <div className="space-y-6">
      {/* Dashboard Top Header & Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80 dark:border-slate-800/80">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
          )}
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center space-x-2.5">
          {extraHeaderActions}

          {/* Refresh All */}
          {onRefreshAll && (
            <button
              onClick={onRefreshAll}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 shadow-2xs transition-all"
              title="Refresh All Widgets"
            >
              <RotateCw className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Refresh All</span>
            </button>
          )}

          {/* Customize Layout */}
          <button
            onClick={() => setIsCustomizeOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white shadow-xs shadow-brand-500/25 transition-all"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Customize</span>
          </button>
        </div>
      </div>

      {/* 12-Column Responsive Drag-and-Drop Grid */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={activeKeys} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-5">
            {activeKeys.map((key) => {
              const widgetDef = allWidgets.find((w) => w.key === key);
              if (!widgetDef) return null;
              const size = widgetSizes[key] || widgetDef.defaultSize || 'M';

              return (
                <SortableItem key={key} id={key} size={size}>
                  {renderWidget(key, widgetDef)}
                </SortableItem>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {/* Customize Drawer */}
      <CustomizeDashboardDrawer
        isOpen={isCustomizeOpen}
        onClose={() => setIsCustomizeOpen(false)}
        allWidgets={allWidgets}
        layout={layout}
        hiddenWidgets={hiddenWidgets}
        widgetSizes={widgetSizes}
        onToggleVisibility={handleToggleVisibility}
        onChangeSize={handleChangeSize}
        onResetLayout={onResetLayout}
      />
    </div>
  );
};

export default DashboardGrid;
