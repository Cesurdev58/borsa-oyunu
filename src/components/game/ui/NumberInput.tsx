/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Sayı kutusu: yazarken silinip baştan yazılabilir.
 * Kutu boşken ya da yarım yazılmışken üst bileşene boş/yanlış değer gitmez;
 * kutudan çıkınca (blur) değer üst bileşenin kabul ettiği sayıya döner.
 */

import React, { useEffect, useRef, useState } from 'react';

type NativeProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'onChange'
>;

interface NumberInputProps extends NativeProps {
  value: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const NumberInput: React.FC<NumberInputProps> = ({
  value,
  onChange,
  onBlur,
  onFocus,
  ...rest
}) => {
  const [text, setText] = useState<string>(String(value));
  const focused = useRef(false);

  // Dışarıdan değer değişirse (düğmeyle) ve kutu seçili değilse metni güncelle.
  useEffect(() => {
    if (!focused.current) setText(String(value));
  }, [value]);

  return (
    <input
      {...rest}
      type="number"
      inputMode="decimal"
      value={text}
      onFocus={(e) => {
        focused.current = true;
        onFocus?.(e);
      }}
      onChange={(e) => {
        setText(e.target.value);
        if (e.target.value.trim() === '' || !Number.isFinite(Number(e.target.value))) {
          return; // boşken üst bileşene gönderme
        }
        onChange(e);
      }}
      onBlur={(e) => {
        focused.current = false;
        setText(String(value));
        onBlur?.(e);
      }}
    />
  );
};
