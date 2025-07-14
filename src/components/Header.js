import { BookOpen } from 'lucide-react';

const Header = () => {
  return (
    <div className="text-center mb-8">
      <div className="flex items-center justify-center space-x-3 mb-4">
        <BookOpen className="w-10 h-10 text-blue-600" />
        <h1 className="text-3xl font-bold text-gray-900">文献一括検証システム</h1>
      </div>
      <p className="text-lg text-gray-600 max-w-2xl mx-auto">
        複数の学術文献データベースから文献情報を一括検証・修正するシステムです。CrossRef、Semantic Scholar、CiNiiから正確な情報を取得し、適切な引用形式に変換します。
      </p>
    </div>
  );
};

export default Header;