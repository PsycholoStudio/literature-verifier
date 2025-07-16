import { useState, useEffect, useRef } from 'react';

/**
 * 要素の可視性を検知するカスタムフック
 * @param {Object} options - Intersection Observer のオプション
 * @param {number} options.threshold - 可視性の閾値 (0-1)
 * @param {string} options.rootMargin - ルートマージン
 * @returns {[React.RefObject, boolean]} - [要素への参照, 可視性の状態]
 */
const useElementVisibility = (options = {}) => {
  const [isVisible, setIsVisible] = useState(true); // 初期値をtrueに戻す（最初は見えている想定）
  const elementRef = useRef(null);

  useEffect(() => {
    const element = elementRef.current;
    console.log('useElementVisibility - Element check:', element);
    if (!element) {
      console.log('useElementVisibility - No element to observe');
      return;
    }

    // Intersection Observer がサポートされていない場合はデフォルトで可視と判定
    if (!window.IntersectionObserver) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          console.log('useElementVisibility - Visibility changed:', {
            isIntersecting: entry.isIntersecting,
            boundingClientRect: {
              top: entry.boundingClientRect.top,
              bottom: entry.boundingClientRect.bottom,
              isAboveViewport: entry.boundingClientRect.bottom < 0,
              isBelowViewport: entry.boundingClientRect.top > window.innerHeight
            }
          });
          setIsVisible(entry.isIntersecting);
        });
      },
      {
        threshold: options.threshold || 0.1,
        rootMargin: options.rootMargin || '0px'
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [options.threshold, options.rootMargin]);

  return [elementRef, isVisible];
};

export default useElementVisibility;