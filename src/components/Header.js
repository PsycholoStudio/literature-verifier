import { BookOpen } from 'lucide-react';

const Header = () => {
  return (
    <div className="text-center mb-8">
      <div className="flex items-center justify-center space-x-3 mb-4">
        <BookOpen className="w-10 h-10 text-blue-600" />
        <h1 className="text-3xl font-bold text-gray-900">Citation Checker</h1>
      </div>
      <p className="text-lg text-gray-600 max-w-2xl mx-auto">
        引用文献の正確性を4つの学術データベースから検証するツールです。CrossRef、CiNii、Google Books、NDL Searchを横断検索し、適切な引用形式に変換します。
      </p>
    </div>
  );
};

export default Header;