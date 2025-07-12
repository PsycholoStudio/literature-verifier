import React from 'react';
import { CheckCircle, AlertCircle, XCircle } from 'lucide-react';

const StatisticsDisplay = ({ statistics }) => {
  const total = statistics.found + statistics.similar + statistics.notFound;

  if (total === 0) {
    return null;
  }

  const getPercentage = (value) => {
    return total > 0 ? Math.round((value / total) * 100) : 0;
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">検証統計</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <div className="flex items-center space-x-2 mb-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <span className="text-sm font-medium text-green-800">一致</span>
          </div>
          <div className="text-2xl font-bold text-green-800">
            {statistics.found}
          </div>
          <div className="text-sm text-green-600">
            {getPercentage(statistics.found)}%
          </div>
        </div>

        <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
          <div className="flex items-center space-x-2 mb-2">
            <AlertCircle className="w-5 h-5 text-yellow-500" />
            <span className="text-sm font-medium text-yellow-800">類似</span>
          </div>
          <div className="text-2xl font-bold text-yellow-800">
            {statistics.similar}
          </div>
          <div className="text-sm text-yellow-600">
            {getPercentage(statistics.similar)}%
          </div>
        </div>

        <div className="bg-red-50 rounded-lg p-4 border border-red-200">
          <div className="flex items-center space-x-2 mb-2">
            <XCircle className="w-5 h-5 text-red-500" />
            <span className="text-sm font-medium text-red-800">未発見</span>
          </div>
          <div className="text-2xl font-bold text-red-800">
            {statistics.notFound}
          </div>
          <div className="text-sm text-red-600">
            {getPercentage(statistics.notFound)}%
          </div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex justify-between items-center text-sm text-gray-600">
          <span>総検証数:</span>
          <span className="font-medium">{total}件</span>
        </div>
      </div>
    </div>
  );
};

export default StatisticsDisplay;