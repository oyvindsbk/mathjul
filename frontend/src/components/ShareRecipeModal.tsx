"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { recipeService } from "@/lib/services/recipe.service";
import { renderQrSvg } from "@/lib/qrcode";

interface Props {
  recipeId: string | number;
  recipeTitle: string;
  token: string | null;
  /** True while AuthContext is still resolving `token`. See the effect below. */
  authLoading?: boolean;
  onClose: () => void;
}

/**
 * Creates (or loads) the recipe's share link and shows it with a copy button and
 * an on-screen QR code. Opening the modal is what mints the link — the owner
 * asked to share, so there is no second "create" step to click through.
 */
export function ShareRecipeModal({ recipeId, recipeTitle, token, authLoading = false, onClose }: Props) {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [revoked, setRevoked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // AuthContext resolves the token asynchronously on mount. Creating the share
    // before it lands sends no Authorization header and the API answers 403, so
    // wait it out rather than showing the owner a spurious failure.
    if (authLoading) return;

    const load = async () => {
      try {
        const status = await recipeService.createShare(recipeId, token || undefined);
        if (cancelled) return;
        setShareUrl(status.shareUrl ?? null);
      } catch (err) {
        if (cancelled) return;
        console.error("Error creating share:", err);
        setError("Kunne ikke lage delingslenke. Prøv igjen.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [recipeId, token, authLoading]);

  // Close on Escape, the same as the other modals in the app.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const qrSvg = useMemo(() => {
    if (!shareUrl) return null;
    try {
      return renderQrSvg(shareUrl, {
        pixelSize: 200,
        title: `QR-kode til ${recipeTitle}`,
      });
    } catch (err) {
      console.error("Error rendering QR code:", err);
      return null;
    }
  }, [shareUrl, recipeTitle]);

  const handleCopy = useCallback(async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Error copying share link:", err);
      setError("Kunne ikke kopiere lenken. Kopier den manuelt fra feltet.");
    }
  }, [shareUrl]);

  const handleRevoke = useCallback(async () => {
    setRevoking(true);
    try {
      await recipeService.revokeShare(recipeId, token || undefined);
      setShareUrl(null);
      setRevoked(true);
      setConfirmingRevoke(false);
    } catch (err) {
      console.error("Error revoking share:", err);
      setError("Kunne ikke slå av deling. Prøv igjen.");
    } finally {
      setRevoking(false);
    }
  }, [recipeId, token]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      data-testid="del-oppskrift-modal"
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Del oppskrift"
      >
        <div className="flex items-start justify-between px-5 pt-5 pb-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Del oppskrift</h2>
            <p className="text-xs text-gray-500 mt-0.5">{recipeTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            aria-label="Lukk"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 pb-5 flex flex-col gap-4">
          {error && (
            <p className="text-sm text-red-600" data-testid="del-oppskrift-feil">
              {error}
            </p>
          )}

          {loading && <p className="text-sm text-gray-500">Lager delingslenke…</p>}

          {!loading && revoked && (
            <p className="text-sm text-gray-700" data-testid="del-oppskrift-avslatt">
              Delingen er slått av. Lenken du delte tidligere virker ikke lenger.
            </p>
          )}

          {!loading && shareUrl && (
            <>
              <p className="text-sm text-gray-600">
                Alle som har lenken kan åpne oppskriften uten å logge inn. De ser bare denne
                oppskriften, ingenting annet.
              </p>

              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  data-testid="del-oppskrift-lenke"
                  onFocus={(e) => e.currentTarget.select()}
                  className="flex-1 min-w-0 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <button
                  onClick={handleCopy}
                  data-testid="del-oppskrift-kopier"
                  className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                >
                  {copied ? "Kopiert!" : "Kopier lenke"}
                </button>
              </div>

              {qrSvg && (
                <div
                  className="self-center rounded-lg border border-gray-200 p-3 bg-white"
                  data-testid="del-oppskrift-qr"
                  // The SVG is built locally from the share URL by lib/qrcode.ts,
                  // so there is no untrusted markup here.
                  dangerouslySetInnerHTML={{ __html: qrSvg }}
                />
              )}

              <div className="border-t border-gray-200 pt-3">
                {confirmingRevoke ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-sm text-gray-700">
                      Slå av deling? Lenker du allerede har sendt slutter å virke med en gang.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setConfirmingRevoke(false)}
                        disabled={revoking}
                        className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                      >
                        Avbryt
                      </button>
                      <button
                        onClick={handleRevoke}
                        disabled={revoking}
                        data-testid="del-oppskrift-bekreft-av"
                        className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                      >
                        {revoking ? "Slår av…" : "Ja, slå av"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmingRevoke(true)}
                    data-testid="del-oppskrift-slaa-av"
                    className="text-sm font-medium text-red-600 hover:text-red-700 transition-colors"
                  >
                    Slå av deling
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
