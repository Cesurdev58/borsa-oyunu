/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Terimlerin yanında duran küçük "?" düğmesi. Dokununca tek cümlelik Türkçe
 * açıklama açılır. Teknik terim bilmeyen oyuncular içindir.
 */

import React, { useState } from 'react';

interface HelpTipProps {
  text: string;
  className?: string;
}

export const HelpTip: React.FC<HelpTipProps> = ({ text, className = '' }) => {
  const [open, setOpen] = useState(false);
  return (
    <span className={`inline ${className}`}>
      <button
        type="button"
        aria-label="Bu ne demek?"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="inline-flex items-center justify-center w-6 h-6 ml-1 rounded-full bg-sky-100 text-sky-700 text-[13px] font-extrabold align-middle active:scale-90"
      >
        ?
      </button>
      {open && (
        <span
          role="note"
          className="block mt-1.5 mb-1 rounded-xl bg-sky-50 border border-sky-200 px-3 py-2 text-[13px] font-medium normal-case tracking-normal text-sky-900"
        >
          {text}
        </span>
      )}
    </span>
  );
};
