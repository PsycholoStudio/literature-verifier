import { useState } from 'react';
import { ExternalLink, Heart, MessageCircle, Info } from 'lucide-react';

const Footer = () => {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <>
      {/* 控え目なフッター */}
      <footer className="mt-8 py-6 border-t border-gray-200 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            {/* 制作者情報 */}
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <span>Produced by</span>
              <a
                href="https://psycholo.studio"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 font-medium flex items-center space-x-1"
              >
                <span>Psycholo Studio</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {/* アクションボタン */}
            <div className="flex items-center space-x-4">
              {/* 詳細情報ボタン */}
              <button
                onClick={() => setShowInfo(true)}
                className="flex items-center space-x-1 text-sm text-gray-600 hover:text-blue-600 transition-colors"
              >
                <Info className="w-4 h-4" />
                <span>About</span>
              </button>

              {/* 問合せ・バグ報告 */}
              <a
                href="https://docs.google.com/forms/d/e/1FAIpQLSdk7epXc2GTdTJB3GAElmreejPsuY-5tkCoJVgjm5Pv3PEoiA/viewform?usp=header" // Google FormのURLをここに入れてください
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1 text-sm text-gray-600 hover:text-blue-600 transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                <span>フィードバック</span>
              </a>

              {/* ドネーション */}
              <a
                href="https://donate.stripe.com/00g02EgDrdnsb724gk" // StripeのURLをここに入れてください
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1 text-sm text-red-500 hover:text-red-700 transition-colors"
              >
                <Heart className="w-4 h-4" />
                <span>サポート</span>
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* 情報ポップアップ */}
      {showInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 relative">
            <button
              onClick={() => setShowInfo(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>

            <h3 className="text-lg font-bold text-gray-900 mb-4">文献一括検証システム について</h3>
            
            <div className="space-y-4 text-sm text-gray-700">
              <p>
                文献一括検証システムは複数の学術文献データベースから文献情報を一括検証し、正確な引用形式を生成するツールです。
              </p>
              
              <div>
                <h4 className="font-medium text-gray-900 mb-2">機能</h4>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>Google Books、CrossRef、Semantic Scholar、CiNiiでの文献検索</li>
                  <li>書籍・論文の自動判別と最適化された検索戦略</li>
                  <li>日本語・英語文献の自動判別</li>
                  <li>APA、MLA、Chicago等の引用形式対応</li>
                  <li>著者名、タイトル、年度の一致度評価</li>
                  <li>部分一致のハイライト表示</li>
                </ul>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-2">お問い合わせ</h4>
                <div className="space-y-2">
                  <a
                    href="https://docs.google.com/forms/d/e/1FAIpQLSdk7epXc2GTdTJB3GAElmreejPsuY-5tkCoJVgjm5Pv3PEoiA/viewform?usp=header" // Google FormのURL
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-2 text-blue-600 hover:text-blue-800"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>フィードバック・バグ報告</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  
                  <a
                    href="https://donate.stripe.com/00g02EgDrdnsb724gk" // StripeのURL
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-2 text-red-500 hover:text-red-700"
                  >
                    <Heart className="w-4 h-4" />
                    <span>開発をサポート</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                  Produced by{' '}
                  <a
                    href="https://psycholo.studio"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Psycholo Studio
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Footer;