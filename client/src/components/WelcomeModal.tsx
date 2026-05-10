// WelcomeModal.tsx
// 初回プレイヤー向けのウェルカム画面 (Hit101 用)。

import { useState } from 'react';
import { useLocale, t } from '../i18n';
import RulesModal from './RulesModal';

interface Props {
  onClose: () => void;
}

export default function WelcomeModal({ onClose }: Props) {
  useLocale();
  const [showRules, setShowRules] = useState(false);

  return (
    <>
      <div
        className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-4"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
      >
        <div
          className="bg-green-800 max-w-md w-full max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl border border-yellow-500/40 relative"
          onClick={(e) => e.stopPropagation()}
          style={{ boxShadow: '0 30px 80px rgba(0,0,0,0.7), 0 0 60px rgba(250,204,21,0.15)' }}
        >
          {/* 上部のスポットライト風グロー */}
          <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-32 rounded-full opacity-50 blur-3xl" style={{ background: 'radial-gradient(circle, rgba(250,204,21,0.6) 0%, transparent 70%)' }} />

          <div className="text-center p-6 border-b border-green-700/60 relative">
            <h2 className="text-3xl font-black mb-1">
              <span className="gold-shimmer">{t('welcome.title')}</span>
            </h2>
            <p className="text-xs text-green-300">{t('welcome.subtitle')}</p>
          </div>

          <div className="p-5 space-y-3">
            <h3 className="font-bold text-yellow-200 text-sm">
              {t('welcome.howItWorks')}
            </h3>
            <ol className="space-y-2 text-sm text-green-100">
              {[1, 2, 3].map((n) => (
                <li key={n} className="flex gap-2">
                  <span className="flex-shrink-0 w-5 h-5 bg-yellow-500 text-black rounded-full text-xs font-bold flex items-center justify-center">
                    {n}
                  </span>
                  <span>{t(`welcome.point${n}`)}</span>
                </li>
              ))}
            </ol>

            <div className="bg-green-950 rounded-lg p-3 text-sm text-green-200 mt-3">
              {t('welcome.specialNote')}
            </div>
          </div>

          <div className="p-5 pt-0 space-y-2">
            <button
              onClick={() => setShowRules(true)}
              className="w-full py-2.5 rounded bg-green-700 hover:bg-green-600 text-green-100 text-sm font-bold transition"
            >
              {t('welcome.viewRules')}
            </button>
            <button
              onClick={onClose}
              className="w-full py-3 rounded bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-base shadow-lg transition"
            >
              {t('welcome.start')}
            </button>
          </div>
        </div>
      </div>
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
    </>
  );
}
