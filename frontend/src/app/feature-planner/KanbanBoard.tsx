'use client';

import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';
import type { BugCardData, FeatureBoardData, FeatureCardData, FeatureColumnData } from '@/lib/services/feature-planner.service';

interface KanbanBoardProps {
  board: FeatureBoardData;
  onCardClick: (card: FeatureCardData) => void;
  onAddCard: (columnId: number) => void;
  onEditColumn: (column: FeatureColumnData) => void;
  onAddColumn: () => void;
  onMoveCard: (cardId: number, targetColumnId: number, sortOrder?: number) => void;
}

export function KanbanBoard({ board, onCardClick, onAddCard, onEditColumn, onAddColumn, onMoveCard }: KanbanBoardProps) {
  const [activeCard, setActiveCard] = useState<FeatureCardData | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const card = board.columns.flatMap(c => c.cards).find(c => c.id === event.active.id);
    setActiveCard(card ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveCard(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const cardId = active.id as number;
    const overId = over.id;

    // over.id can be a column id (prefixed) or a card id
    if (typeof overId === 'string' && overId.startsWith('col-')) {
      const targetColumnId = parseInt(overId.replace('col-', ''), 10);
      onMoveCard(cardId, targetColumnId);
    } else {
      // Dropped over a card — move to that card's column
      const targetCard = board.columns.flatMap(c => c.cards).find(c => c.id === overId);
      if (targetCard) {
        onMoveCard(cardId, targetCard.columnId, targetCard.sortOrder);
      }
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    if (!over) return;
    // Handled in dragEnd
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 p-6 overflow-x-auto h-full items-start">
        <SortableContext
          items={board.columns.map(c => `col-${c.id}`)}
          strategy={horizontalListSortingStrategy}
        >
          {board.columns.map(column => (
            <KanbanColumn
              key={column.id}
              column={column}
              onCardClick={onCardClick}
              onAddCard={onAddCard}
              onEditColumn={onEditColumn}
            />
          ))}
        </SortableContext>

        {/* Add column button */}
        <button
          onClick={onAddColumn}
          className="shrink-0 w-72 h-12 border-2 border-dashed border-slate-700 rounded-xl text-slate-500 hover:border-slate-500 hover:text-slate-400 transition-colors flex items-center justify-center gap-2 text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Legg til kolonne
        </button>
      </div>

      <DragOverlay>
        {activeCard && <CardDragOverlay card={activeCard} />}
      </DragOverlay>
    </DndContext>
  );
}

interface KanbanColumnProps {
  column: FeatureColumnData;
  onCardClick: (card: FeatureCardData) => void;
  onAddCard: (columnId: number) => void;
  onEditColumn: (column: FeatureColumnData) => void;
}

function KanbanColumn({ column, onCardClick, onAddCard, onEditColumn }: KanbanColumnProps) {
  const { setNodeRef } = useSortable({ id: `col-${column.id}` });

  return (
    <div
      ref={setNodeRef}
      className="shrink-0 w-72 bg-slate-900 rounded-xl flex flex-col max-h-full"
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white text-sm">{column.name}</span>
          <span className="text-xs text-slate-500 bg-slate-800 rounded-full px-2 py-0.5">
            {column.cards.length}
          </span>
        </div>
        <button
          onClick={() => onEditColumn(column)}
          className="text-slate-500 hover:text-slate-300 transition-colors p-1 rounded"
          title="Rediger kolonne"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0zm4 2a2 2 0 100-4 2 2 0 000 4z" />
          </svg>
        </button>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2 p-3 overflow-y-auto flex-1">
        <SortableContext
          items={column.cards.map(c => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {column.cards.map(card => (
            <KanbanCard key={card.id} card={card} onClick={onCardClick} />
          ))}
        </SortableContext>
      </div>

      {/* Add card button */}
      <div className="p-3 pt-0">
        <button
          onClick={() => onAddCard(column.id)}
          className="w-full text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors text-sm py-2 rounded-lg flex items-center justify-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Legg til funksjon
        </button>
      </div>
    </div>
  );
}

interface KanbanCardProps {
  card: FeatureCardData;
  onClick: (card: FeatureCardData) => void;
}

function KanbanCard({ card, onClick }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const isBug = card.cardType === 'Bug';
  const hasTechnical = !isBug && (card.stacksFrontend || card.stacksBackend || card.stacksInfrastructure);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onClick(card)}
      className={`bg-slate-800 hover:bg-slate-750 border rounded-lg p-3 cursor-pointer transition-all group border-l-4 ${
        isBug
          ? 'border-slate-700 border-l-red-500 hover:border-l-red-400'
          : 'border-slate-700 border-l-blue-500 hover:border-l-blue-400'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="font-medium text-white text-sm leading-snug">{card.title}</div>
        <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${
          isBug ? 'bg-red-900/50 text-red-300' : 'bg-blue-900/50 text-blue-300'
        }`}>
          {isBug ? 'Bug' : 'Feature'}
        </span>
      </div>
      {card.summary && (
        <div className="text-slate-400 text-xs leading-relaxed line-clamp-2">{card.summary}</div>
      )}
      {isBug && (card as BugCardData).bugUrl && (
        <div className="mt-1.5 flex items-center gap-1 min-w-0">
          <svg className="w-3 h-3 text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <span className="text-slate-500 text-xs truncate">
            {(() => { try { return new URL((card as BugCardData).bugUrl).pathname; } catch { return (card as BugCardData).bugUrl; } })()}
          </span>
        </div>
      )}
      {hasTechnical && (
        <div className="flex gap-1 mt-2">
          {card.stacksFrontend && (
            <span className="text-xs bg-blue-900/50 text-blue-300 px-1.5 py-0.5 rounded">FE</span>
          )}
          {card.stacksBackend && (
            <span className="text-xs bg-green-900/50 text-green-300 px-1.5 py-0.5 rounded">BE</span>
          )}
          {card.stacksInfrastructure && (
            <span className="text-xs bg-purple-900/50 text-purple-300 px-1.5 py-0.5 rounded">Infra</span>
          )}
        </div>
      )}
    </div>
  );
}

function CardDragOverlay({ card }: { card: FeatureCardData }) {
  const isBug = card.cardType === 'Bug';
  return (
    <div className={`bg-slate-800 border rounded-lg p-3 w-72 shadow-2xl rotate-2 border-l-4 ${isBug ? 'border-red-500 border-l-red-500' : 'border-blue-500 border-l-blue-500'}`}>
      <div className="font-medium text-white text-sm mb-1">{card.title}</div>
      {card.summary && (
        <div className="text-slate-400 text-xs line-clamp-2">{card.summary}</div>
      )}
    </div>
  );
}
