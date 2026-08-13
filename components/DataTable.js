'use client';

import { useMemo, useState } from 'react';

// Builds a windowed list of page numbers around the current page, e.g.
// [1, '...', 4, 5, 6, '...', 12] — keeps the pager usable even with a lot
// of pages, without listing every single one.
const buildPageWindow = (current, total) => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages = new Set([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);

  const withGaps = [];
  sorted.forEach((p, idx) => {
    if (idx > 0 && p - sorted[idx - 1] > 1) withGaps.push('...');
    withGaps.push(p);
  });
  return withGaps;
};

// Shared list UI for every dashboard page: a card with a toolbar (title on
// the left, filter controls on the right, above the table), the table
// itself, and a footer with a page-size selector + prev/next pager. Purely
// presentational/client-side — callers own their own data fetching and
// filtering, and just hand this component the already-filtered `rows`.
export default function DataTable({
  columns,
  rows,
  loading = false,
  title,
  toolbar,
  emptyMessage = 'No records found.',
  pageSizeOptions = [5, 10, 20, 50],
  defaultPageSize = 10,
  getRowKey = (row) => row.id,
  onRowClick,
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const totalItems = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(page, totalPages);

  const startIdx = (currentPage - 1) * pageSize;
  const pageRows = useMemo(() => rows.slice(startIdx, startIdx + pageSize), [rows, startIdx, pageSize]);

  const pageWindow = useMemo(() => buildPageWindow(currentPage, totalPages), [currentPage, totalPages]);

  const goToPage = (p) => setPage(Math.max(1, Math.min(totalPages, p)));

  return (
    <div className="data-table-card">
      <div className="data-table-toolbar">
        {title && (
          <div className="data-table-toolbar-title">
            {title}
            <span className="count">({totalItems})</span>
          </div>
        )}
        {toolbar && <div className="data-table-filters">{toolbar}</div>}
      </div>

      <div className="data-table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} style={col.width ? { width: col.width } : undefined}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="data-table-empty">
                  Loading...
                </td>
              </tr>
            ) : pageRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="data-table-empty">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              pageRows.map((row) => (
                <tr
                  key={getRowKey(row)}
                  className={onRowClick ? 'clickable' : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((col) => (
                    <td key={col.key} data-label={col.header}>
                      {col.render ? col.render(row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="data-table-footer">
        <div className="data-table-pagesize">
          Show
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
          >
            {pageSizeOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          per page
        </div>

        <div className="data-table-range">
          {totalItems === 0
            ? '0 of 0'
            : `${startIdx + 1}–${Math.min(startIdx + pageSize, totalItems)} of ${totalItems}`}
        </div>

        <div className="data-table-pager">
          <button type="button" disabled={currentPage <= 1} onClick={() => goToPage(currentPage - 1)}>
            ‹ Prev
          </button>
          {pageWindow.map((p, idx) =>
            p === '...' ? (
              <span key={`gap-${idx}`} style={{ padding: '0 4px', color: 'var(--color-text-muted)', fontSize: 12.5 }}>
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                className={p === currentPage ? 'active' : ''}
                onClick={() => goToPage(p)}
              >
                {p}
              </button>
            )
          )}
          <button type="button" disabled={currentPage >= totalPages} onClick={() => goToPage(currentPage + 1)}>
            Next ›
          </button>
        </div>
      </div>
    </div>
  );
}
