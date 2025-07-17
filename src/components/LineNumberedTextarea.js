import React, { useRef, useEffect, useState } from 'react';

const LineNumberedTextarea = ({ 
  value = '', 
  onChange, 
  placeholder = '例を入力してください...',
  disabled = false,
  className = '',
  id,
  ...props 
}) => {
  const editorRef = useRef(null);
  const [isFirstEdit, setIsFirstEdit] = useState(true);

  // 行要素を作成
  const createLine = (text = '') => {
    const line = document.createElement('div');
    line.className = 'line';
    line.textContent = text;
    return line;
  };

  // 適切な構造を確保
  const ensureProperStructure = () => {
    const editor = editorRef.current;
    if (!editor) return;

    const lines = Array.from(editor.children);
    
    // 空のエディタの場合は1行追加
    if (lines.length === 0) {
      editor.appendChild(createLine());
      return;
    }

    // 最後の行が空でない場合は空行を追加
    const lastLine = lines[lines.length - 1];
    if (lastLine && lastLine.textContent.trim() !== '') {
      editor.appendChild(createLine());
    }
  };

  // エディタの内容を取得
  const getEditorValue = () => {
    const editor = editorRef.current;
    if (!editor) return '';
    
    const lines = Array.from(editor.children);
    return lines
      .map(line => line.textContent || '')
      .join('\n')
      .replace(/\n$/, ''); // 最後の改行を除去
  };

  // エディタの内容を設定
  const setEditorValue = (newValue) => {
    const editor = editorRef.current;
    if (!editor) return;

    editor.innerHTML = '';
    
    if (newValue) {
      const lines = newValue.split('\n');
      lines.forEach(lineText => {
        editor.appendChild(createLine(lineText));
      });
    } else {
      // 空の場合はプレースホルダーを表示
      const placeholderLine = createLine(placeholder);
      placeholderLine.classList.add('placeholder');
      editor.appendChild(placeholderLine);
      setIsFirstEdit(true);
    }
    
    ensureProperStructure();
  };

  // valueが変更されたときの処理
  useEffect(() => {
    const currentValue = getEditorValue();
    if (value !== currentValue) {
      setEditorValue(value);
    }
  }, [value, placeholder]);

  // 初期化時に行番号を正しく表示
  useEffect(() => {
    const editor = editorRef.current;
    if (editor) {
      // 最初の行の構造を確保
      if (editor.children.length === 0) {
        if (value) {
          setEditorValue(value);
        } else {
          const placeholderLine = createLine(placeholder);
          placeholderLine.classList.add('placeholder');
          editor.appendChild(placeholderLine);
          setIsFirstEdit(true);
        }
      }
    }
  }, []);

  // キーダウンイベントの処理
  const handleKeyDown = (e) => {
    const editor = editorRef.current;
    if (!editor) return;

    // キーボードショートカット
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'a':
          // 全選択
          e.preventDefault();
          const range = document.createRange();
          const selection = window.getSelection();
          range.selectNodeContents(editor);
          selection.removeAllRanges();
          selection.addRange(range);
          return;
        case 'z':
          // 元に戻す（デフォルトの動作を許可）
          return;
        case 'y':
          // やり直し（デフォルトの動作を許可）
          return;
        case 'Enter':
          // Ctrl+Enter で検証開始
          e.preventDefault();
          const submitButton = document.querySelector('button[type="submit"]');
          if (submitButton && !submitButton.disabled) {
            submitButton.click();
          }
          return;
      }
    }

    // プレースホルダーを削除
    if (isFirstEdit) {
      const placeholder = editor.querySelector('.placeholder');
      if (placeholder) {
        placeholder.remove();
        editor.appendChild(createLine());
        
        // カーソルを新しい行に移動
        const range = document.createRange();
        const selection = window.getSelection();
        range.setStart(editor.firstChild, 0);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      setIsFirstEdit(false);
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      
      const selection = window.getSelection();
      const range = selection.getRangeAt(0);
      const currentLine = range.startContainer.nodeType === Node.TEXT_NODE 
        ? range.startContainer.parentNode
        : range.startContainer;
      
      // 現在の行内での位置を取得
      const currentText = currentLine.textContent;
      const offset = range.startOffset;
      
      // 現在の行のテキストを分割
      const beforeText = currentText.substring(0, offset);
      const afterText = currentText.substring(offset);
      
      // 現在の行を更新
      currentLine.textContent = beforeText;
      
      // 新しい行を作成
      const newLine = createLine(afterText);
      
      // 新しい行を挿入
      if (currentLine.nextSibling && editor.contains(currentLine.nextSibling)) {
        editor.insertBefore(newLine, currentLine.nextSibling);
      } else {
        editor.appendChild(newLine);
      }
      
      // カーソルを新しい行の適切な位置に移動
      const newRange = document.createRange();
      if (afterText) {
        newRange.setStart(newLine.firstChild, 0);
      } else {
        newRange.setStart(newLine, 0);
      }
      newRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(newRange);
      
      ensureProperStructure();
      
      // 値を更新
      if (onChange) {
        onChange({ target: { value: getEditorValue() } });
      }
    }
  };

  // 入力イベントの処理
  const handleInput = () => {
    const editor = editorRef.current;
    if (!editor) return;

    // プレースホルダーを削除
    if (isFirstEdit) {
      const placeholder = editor.querySelector('.placeholder');
      if (placeholder) {
        placeholder.classList.remove('placeholder');
      }
      setIsFirstEdit(false);
    }

    // 構造を正規化
    setTimeout(() => {
      const lines = Array.from(editor.children);
      lines.forEach(line => {
        if (!line.classList.contains('line')) {
          line.className = 'line';
        }
      });
      ensureProperStructure();
      
      // 値を更新
      if (onChange) {
        onChange({ target: { value: getEditorValue() } });
      }
    }, 0);
  };

  // ペーストイベントの処理
  const handlePaste = (e) => {
    e.preventDefault();
    
    let text = e.clipboardData.getData('text/plain');
    
    // PDFからコピーしたときの頭とお尻の引用符を自動削除
    text = text.replace(/^[""]|[""]$/g, ''); // 開始と終了の引用符を削除
    text = text.replace(/^["']|["']$/g, ''); // 通常の引用符も削除
    
    const lines = text.split('\n').map(line => {
      // 各行からも引用符を削除（より厳密に）
      let cleanLine = line.trim();
      // 文頭の引用符を削除
      cleanLine = cleanLine.replace(/^[""]/, '').replace(/^["']/, '');
      // 文末の引用符を削除
      cleanLine = cleanLine.replace(/[""]$/, '').replace(/["']$/, '');
      cleanLine = cleanLine.trim();
      
      // PDFの文字化けによる日本語文字間の不要なスペースを修正
      // 「日本語文字」+「スペース」+「日本語文字」の連続パターンを検出し、
      // 各文字が1文字単位で区切られている場合のみスペースを削除
      cleanLine = cleanLine.replace(/([ぁ-んァ-ヶ一-龯])(\s+[ぁ-んァ-ヶ一-龯])+/g, (match) => {
        // スペースで分割して各部分をチェック
        const parts = match.split(/\s+/);
        
        // 全ての部分が1文字の日本語文字の場合のみスペースを削除
        const allSingleJapanese = parts.every(part => 
          part.length === 1 && /[ぁ-んァ-ヶ一-龯]/.test(part)
        );
        
        if (allSingleJapanese) {
          return parts.join(''); // スペースを削除して結合
        }
        return match; // そのまま残す
      });
      
      // 区切り文字の後ろにスペースがない場合を修正
      // ピリオド、カンマ、コロン、セミコロン、右括弧の後ろにスペースを追加
      cleanLine = cleanLine.replace(/([.,;:)](?!\s))(?![.,;:)\]}\s])/g, '$1 ');
      
      // 日本語の句読点（。、）の後ろにもスペースを追加
      cleanLine = cleanLine.replace(/([。、](?!\s))(?![。、\s])/g, '$1 ');
      
      return cleanLine;
    });
    
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    
    // 全選択の場合は全体を置き換え
    const editor = editorRef.current;
    if (selection.toString() === getEditorValue() || range.toString() === getEditorValue()) {
      // 全選択されている場合：全体を置き換え
      editor.innerHTML = '';
      lines.forEach(lineText => {
        editor.appendChild(createLine(lineText));
      });
      
      // 行番号カウンターをリセット
      editor.style.counterReset = 'line-counter 0';
      
    } else {
      // 部分選択の場合：従来の処理
      const currentLine = range.startContainer.nodeType === Node.TEXT_NODE 
        ? range.startContainer.parentNode
        : range.startContainer;
      
      // 最初の行を現在の行に挿入
      if (lines.length > 0) {
        const currentText = currentLine.textContent;
        const offset = range.startOffset;
        const beforeText = currentText.substring(0, offset);
        const afterText = currentText.substring(offset);
        
        currentLine.textContent = beforeText + lines[0] + afterText;
        
        // 残りの行を新しい行として追加
        let insertAfter = currentLine;
        for (let i = 1; i < lines.length; i++) {
          const newLine = createLine(lines[i]);
          if (insertAfter.nextSibling && editor.contains(insertAfter.nextSibling)) {
            editor.insertBefore(newLine, insertAfter.nextSibling);
          } else {
            editor.appendChild(newLine);
          }
          insertAfter = newLine;
        }
      }
    }
    
    ensureProperStructure();
    
    // 値を更新
    if (onChange) {
      onChange({ target: { value: getEditorValue() } });
    }
  };

  return (
    <div 
      id={id}
      className={`editor-container border border-gray-300 rounded-lg overflow-hidden focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-opacity-50 transition-all duration-200 ${className}`}
      style={{ position: 'relative', background: 'white', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}
    >
      {/* 行番号の背景 */}
      <div 
        className="line-numbers-bg"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '50px',
          height: '100%',
          background: '#f9fafb',
          borderRight: '1px solid #e5e7eb',
          zIndex: 0
        }}
      />
      
      {/* エディタ */}
      <div
        ref={editorRef}
        className="editor"
        contentEditable={!disabled}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        onPaste={handlePaste}
        style={{
          width: '100%',
          minHeight: '200px',
          maxHeight: '500px',
          padding: '12px 12px 12px 55px',
          boxSizing: 'border-box',
          fontFamily: "'Yu Mincho', '游明朝', YuMincho, 'Hiragino Mincho Pro', serif",
          fontSize: '15px',
          lineHeight: '1.6',
          border: 'none',
          outline: 'none',
          resize: 'vertical',
          counterReset: 'line-counter',
          background: 'transparent',
          overflowY: 'auto',
          position: 'relative',
          zIndex: 1,
          color: '#374151',
          textAlign: 'justify',
          transition: 'all 0.2s ease-in-out'
        }}
        {...props}
      />
      
      <style dangerouslySetInnerHTML={{
        __html: `
          .editor .line {
            position: relative;
            counter-increment: line-counter;
            min-height: 1.6em;
            margin: 0 0 0.8em 0;
            padding: 2px 0;
            border-radius: 4px;
            transition: background-color 0.2s ease;
          }
          
          .editor .line:hover {
            background-color: rgba(59, 130, 246, 0.05);
          }
          
          .editor .line::before {
            content: counter(line-counter);
            position: absolute;
            left: -47px;
            top: 2px;
            width: 38px;
            text-align: right;
            color: #9ca3af;
            padding-right: 8px;
            font-size: 13px;
            user-select: none;
            font-weight: 500;
          }
          
          .editor .line:empty::after {
            content: '';
            display: inline-block;
            width: 0;
          }
          
          .editor .line br {
            display: none;
          }
          
          .editor .placeholder {
            color: #9ca3af;
            font-style: italic;
          }
          
          @media (max-width: 640px) {
            .editor-container {
              border-radius: 8px;
            }
            
            .editor .line {
              margin: 0 0 1em 0;
            }
            
            .editor .line::before {
              font-size: 12px;
            }
          }
        `
      }} />
    </div>
  );
};

export default LineNumberedTextarea;