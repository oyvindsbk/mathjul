'use client';

import { useEffect, useState, useCallback } from 'react';
import { featurePlannerService, type FeatureBoardData, type FeatureCardData, type FeatureColumnData } from '@/lib/services/feature-planner.service';
import { useAuth } from '@/lib/context/AuthContext';
import { KanbanBoard } from './KanbanBoard';
import { CardDetailModal } from './CardDetailModal';
import { CardFormModal } from './CardFormModal';
import { ColumnManageModal } from './ColumnManageModal';

export function FeaturePlannerClient() {
  const { token } = useAuth();
  const [board, setBoard] = useState<FeatureBoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [detailCard, setDetailCard] = useState<FeatureCardData | null>(null);
  const [formModal, setFormModal] = useState<{ open: boolean; columnId?: number; card?: FeatureCardData }>({ open: false });
  const [columnModal, setColumnModal] = useState<{ open: boolean; column?: FeatureColumnData }>({ open: false });

  const loadBoard = useCallback(async () => {
    try {
      const data = await featurePlannerService.getBoard(token ?? undefined);
      setBoard(data);
      setError(null);
    } catch {
      setError('Kunne ikke laste tavlen. Sjekk at backend kjører.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  const handleMoveCard = useCallback(async (cardId: number, targetColumnId: number, sortOrder?: number) => {
    if (!board) return;
    // Optimistic update
    setBoard(prev => {
      if (!prev) return prev;
      const newColumns = prev.columns.map(col => ({
        ...col,
        cards: col.cards.filter(c => c.id !== cardId),
      }));
      const card = prev.columns.flatMap(c => c.cards).find(c => c.id === cardId);
      if (!card) return prev;
      const updatedCard = { ...card, columnId: targetColumnId, sortOrder: sortOrder ?? 0 };
      return {
        columns: newColumns.map(col =>
          col.id === targetColumnId
            ? { ...col, cards: [...col.cards, updatedCard].sort((a, b) => a.sortOrder - b.sortOrder) }
            : col
        ),
      };
    });
    try {
      await featurePlannerService.moveCard(cardId, targetColumnId, sortOrder, token ?? undefined);
    } catch {
      // Revert on failure
      loadBoard();
    }
  }, [board, token, loadBoard]);

  const handleCardSaved = useCallback(() => {
    setFormModal({ open: false });
    setDetailCard(null);
    loadBoard();
  }, [loadBoard]);

  const handleCardDeleted = useCallback(async (cardId: number) => {
    setDetailCard(null);
    setBoard(prev => prev ? {
      columns: prev.columns.map(col => ({
        ...col,
        cards: col.cards.filter(c => c.id !== cardId),
      })),
    } : prev);
    await featurePlannerService.deleteCard(cardId, token ?? undefined).catch(() => loadBoard());
  }, [token, loadBoard]);

  const handleColumnSaved = useCallback(() => {
    setColumnModal({ open: false });
    loadBoard();
  }, [loadBoard]);

  const handleColumnDeleted = useCallback(async (columnId: number) => {
    setColumnModal({ open: false });
    await featurePlannerService.deleteColumn(columnId, token ?? undefined).catch(() => null);
    loadBoard();
  }, [token, loadBoard]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400 text-lg">Laster tavlen...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-400 text-center">
          <div className="text-xl mb-2">Kunne ikke laste tavlen</div>
          <div className="text-sm">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-950 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-white">Feature Planner</h1>
          <p className="text-slate-400 text-sm mt-0.5">Planlegg og følg opp nye funksjoner</p>
        </div>
        <button
          onClick={() => setFormModal({ open: true })}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Ny funksjon
        </button>
      </div>

      {/* Board */}
      {board && (
        <KanbanBoard
          board={board}
          onCardClick={setDetailCard}
          onAddCard={(columnId) => setFormModal({ open: true, columnId })}
          onEditColumn={(column) => setColumnModal({ open: true, column })}
          onAddColumn={() => setColumnModal({ open: true })}
          onMoveCard={handleMoveCard}
        />
      )}

      {/* Card Detail Modal */}
      {detailCard && (
        <CardDetailModal
          card={detailCard}
          onClose={() => setDetailCard(null)}
          onEdit={(card) => {
            setDetailCard(null);
            setFormModal({ open: true, card });
          }}
          onDelete={handleCardDeleted}
        />
      )}

      {/* Card Form Modal */}
      {formModal.open && (
        <CardFormModal
          columnId={formModal.columnId ?? board?.columns[0]?.id ?? 0}
          card={formModal.card}
          onSaved={handleCardSaved}
          onClose={() => setFormModal({ open: false })}
          token={token ?? undefined}
        />
      )}

      {/* Column Manage Modal */}
      {columnModal.open && (
        <ColumnManageModal
          column={columnModal.column}
          onSaved={handleColumnSaved}
          onDeleted={handleColumnDeleted}
          onClose={() => setColumnModal({ open: false })}
          token={token ?? undefined}
        />
      )}
    </div>
  );
}
