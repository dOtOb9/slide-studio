// アイコンだけのボタン（view）。UI の方針（AGENTS.md）: 説明の文字はボタンに並べず、ツールチップに書く。
// label はツールチップ（title）と読み上げ（aria-label）の両方に使う。
// 見た目は index.css の .icon-button（プラグインの部品も同じクラスを使える）。

import type { ReactNode } from 'react';

export function IconButton({
  label,
  onClick,
  disabled,
  type = 'button',
  children,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  /** フォームの送信ボタンにするときは 'submit' */
  type?: 'button' | 'submit';
  children: ReactNode;
}) {
  return (
    <button type={type} className="icon-button" onClick={onClick} disabled={disabled} title={label} aria-label={label}>
      {children}
    </button>
  );
}
