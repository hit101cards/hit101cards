export default function RulesModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-label="ルール確認">
      <div className="bg-green-800 rounded-2xl p-5 max-w-sm w-full shadow-2xl border border-green-600 my-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-yellow-400">ルール確認</h2>
          <button onClick={onClose} className="text-green-400 hover:text-white font-bold text-xl">✕</button>
        </div>

        <div className="space-y-4 text-sm">
          <div>
            <p className="text-yellow-300 font-bold mb-1">基本ルール</p>
            <ul className="text-green-200 space-y-1 text-xs">
              <li>• 順番にカードを出し、場の合計を増やす</li>
              <li>• 合計が <span className="text-yellow-300 font-bold">101ちょうど</span> になったら勝ち</li>
              <li>• 合計が <span className="text-red-400 font-bold">102以上</span> になったら出した人の負け</li>
              <li>• 手札から出したくなければ山札から出せる（中身不明）</li>
            </ul>
          </div>

          <div>
            <p className="text-yellow-300 font-bold mb-1">ポイント</p>
            <ul className="text-green-200 space-y-1 text-xs">
              <li>• 101ちょうど → 出した人 <span className="text-green-400">+5pt</span>、前の人 <span className="text-red-400">-2pt</span></li>
              <li>• 102以上 → 出した人 <span className="text-red-400">-2pt</span>、前の人 <span className="text-green-400">+3pt</span></li>
              <li>• 合計100でジョーカー → 出した人 <span className="text-green-400">+8pt</span>、他全員 <span className="text-red-400">-1pt</span></li>
            </ul>
          </div>

          <div>
            <p className="text-yellow-300 font-bold mb-1">カードの値</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-green-200">
              <span>A　→ 1</span>
              <span>2〜7 → 数字通り</span>
              <span>8　→ +8 か スキップ</span>
              <span>9　→ +9 か リターン</span>
              <span>10　→ +10 か -10</span>
              <span>J　→ 10</span>
              <span>Q　→ 20</span>
              <span>K　→ 30</span>
              <span className="col-span-2">Joker → 50（合計100の時は1）</span>
            </div>
          </div>

          <div>
            <p className="text-yellow-300 font-bold mb-1">特殊効果</p>
            <ul className="text-green-200 space-y-1 text-xs">
              <li>• <span className="text-orange-400 font-bold">スキップ</span>：次の人の番を飛ばす</li>
              <li>• <span className="text-purple-400 font-bold">リターン</span>：順番が逆回りになる</li>
              <li>• 合計は0未満にならない</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
