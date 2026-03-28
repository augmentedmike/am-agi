'use client';

import { useState, useEffect, useRef } from 'react';
import { Card } from './BoardClient';
import { STATE_TOKENS, PRIORITY_TOKENS } from '@/lib/tokens';
import { truncateTitle } from '@/lib/utils';

export function CardTile({
  card,
  onCardClick,
  celebrating = false,
}: {
  card: Card;
  onCardClick: (card: Card) => void;
  celebrating?: boolean;
}) {
  const isActive = !!card.workDir && card.state !== 'shipped';
  const isShipped = card.state === 'shipped';
  const lastWorkLog = card.workLog?.length ? card.workLog[card.workLog.length - 1].message : null;
  const [agentText, setAgentText] = useState<string | null>(null);
  const [flipped, setFlipped] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const flipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isActive) {
      setAgentText(null);
      return;
    }

    async function fetchMessage() {
      try {
        const res = await fetch(`/api/cards/${card.id}/agent-message`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.text) setAgentText(data.text);
      } catch {}
    }

    fetchMessage();
    intervalRef.current = setInterval(fetchMessage, 3_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isActive, card.id]);

  // Flip animation: flip to back when celebrating, then flip back after 3s
  useEffect(() => {
    if (celebrating) {
      setFlipped(true);
      flipTimerRef.current = setTimeout(() => {
        setFlipped(false);
      }, 3000);
    } else {
      setFlipped(false);
    }
    return () => {
      if (flipTimerRef.current) clearTimeout(flipTimerRef.current);
    };
  }, [celebrating]);

  return (
    <button
      type="button"
      className="card-flip-scene w-full text-left"
      onClick={() => onCardClick(card)}
      aria-label={card.title}
    >
      <div className={`card-flip-inner${flipped ? ' is-flipped' : ''}`}>
        {/* Front face */}
        <div className="card-flip-front bg-zinc-800/60 backdrop-blur-sm border border-white/10 rounded-xl p-3 hover:bg-zinc-700/70 hover:border-white/20 hover:-translate-y-0.5 transition-all cursor-pointer">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 min-w-0">
              {isActive && (
                <span className="relative flex h-3 w-3 shrink-0">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${STATE_TOKENS[card.state]?.dotPing ?? 'bg-state-backlog-fg'} opacity-75`} />
                  <span className={`relative inline-flex rounded-full h-3 w-3 ${STATE_TOKENS[card.state]?.dot ?? 'bg-state-backlog'}`} />
                </span>
              )}
              {isShipped && (
                <span className="relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 border border-emerald-500/40">
                  <span className="text-emerald-400 text-xs font-bold leading-none">✓</span>
                </span>
              )}
              <span className={`text-base font-semibold ${agentText ? 'text-zinc-500' : 'text-zinc-100'} leading-snug line-clamp-2`}>{truncateTitle(card.title)}</span>
            </div>
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${PRIORITY_TOKENS[card.priority]?.badge ?? PRIORITY_TOKENS['normal'].badge}`}>
              {card.priority}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <p className={`text-xs ${agentText ? 'text-zinc-600' : 'text-zinc-500'} font-mono truncate`}>{card.id}</p>
            {card.version && (
              <span className="text-xs px-1.5 py-0.5 rounded font-mono font-medium shrink-0 bg-violet-500/20 text-violet-300 border border-violet-500/30">
                {card.version?.replace(/^v/, '')}
              </span>
            )}
          </div>
          {isActive && agentText && (
            <p className="text-xs text-zinc-100 font-mono mt-2 pt-2 border-t border-white/5 leading-relaxed">
              {agentText}
            </p>
          )}
          {!isActive && lastWorkLog && (
            <p className="text-xs text-zinc-500 font-mono mt-2 pt-2 border-t border-white/5 leading-relaxed line-clamp-3">
              {lastWorkLog}
            </p>
          )}
        </div>

        {/* Back face — ship meme */}
        <div className="card-flip-back rounded-xl overflow-hidden cursor-pointer border border-white/10">
          <img
            src="/ship-meme.gif"
            alt="Ship it!"
            className="w-full h-full object-cover"
            style={{ minHeight: '80px' }}
          />
        </div>
      </div>
    </button>
  );
}
