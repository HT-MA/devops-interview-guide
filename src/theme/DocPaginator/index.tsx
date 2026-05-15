import React from 'react';
import type { ComponentProps } from '@docusaurus/types';

type Props = ComponentProps<'DocPaginator'];

export default function DocPaginator(props: Props): JSX.Element {
  return (
    <nav className="pagination-nav" aria-label="文档分页">
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
        {props.previous && (
          <a className="pagination-nav__link" href={props.previous.permalink}>
            <div className="pagination-nav__label">← 上一页</div>
            <div className="pagination-nav__sublabel">{props.previous.label}</div>
          </a>
        )}
        {props.next && (
          <a className="pagination-nav__link" href={props.next.permalink}>
            <div className="pagination-nav__label">下一页 →</div>
            <div className="pagination-nav__sublabel">{props.next.label}</div>
          </a>
        )}
      </div>
    </nav>
  );
}
