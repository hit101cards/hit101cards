import { useLocale, t } from '../i18n';

export default function RulesModal({ onClose }: { onClose: () => void }) {
  useLocale();
  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-[110] p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-label={t('rules.title')}>
      <div className="bg-green-800 rounded-2xl p-5 max-w-sm w-full shadow-2xl border border-green-600 my-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-yellow-400">{t('rules.title')}</h2>
          <button onClick={onClose} className="text-green-400 hover:text-white font-bold text-xl">✕</button>
        </div>

        <div className="space-y-4 text-sm">
          <div>
            <p className="text-yellow-300 font-bold mb-1">{t('rules.basic.title')}</p>
            <ul className="text-green-200 space-y-1 text-xs">
              <li>• {t('rules.basic.1')}</li>
              <li dangerouslySetInnerHTML={{ __html: '• ' + t('rules.basic.2.html') }} />
              <li dangerouslySetInnerHTML={{ __html: '• ' + t('rules.basic.3.html') }} />
              <li>• {t('rules.basic.4')}</li>
            </ul>
          </div>

          <div>
            <p className="text-yellow-300 font-bold mb-1">{t('rules.points.title')}</p>
            <ul className="text-green-200 space-y-1 text-xs">
              <li dangerouslySetInnerHTML={{ __html: '• ' + t('rules.points.1.html') }} />
              <li dangerouslySetInnerHTML={{ __html: '• ' + t('rules.points.2.html') }} />
              <li dangerouslySetInnerHTML={{ __html: '• ' + t('rules.points.3.html') }} />
            </ul>
          </div>

          <div>
            <p className="text-yellow-300 font-bold mb-1">{t('rules.values.title')}</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-green-200">
              <span>{t('rules.value.A')}</span>
              <span>{t('rules.value.27')}</span>
              <span>{t('rules.value.8')}</span>
              <span>{t('rules.value.9')}</span>
              <span>{t('rules.value.10')}</span>
              <span>{t('rules.value.J')}</span>
              <span>{t('rules.value.Q')}</span>
              <span>{t('rules.value.K')}</span>
              <span className="col-span-2">{t('rules.value.Joker')}</span>
            </div>
          </div>

          <div>
            <p className="text-yellow-300 font-bold mb-1">{t('rules.special.title')}</p>
            <ul className="text-green-200 space-y-1 text-xs">
              <li dangerouslySetInnerHTML={{ __html: '• ' + t('rules.special.1.html') }} />
              <li dangerouslySetInnerHTML={{ __html: '• ' + t('rules.special.2.html') }} />
              <li>• {t('rules.special.3')}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
