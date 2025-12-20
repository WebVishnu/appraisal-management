'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  className?: string;
  rowClassName?: (item: T) => string;
}

export function DataTable<T extends { _id: string }>({
  data,
  columns,
  onRowClick,
  emptyMessage = 'No data available',
  className,
  rowClassName,
}: DataTableProps<T>) {
  return (
    <div className={cn('rounded-md border', className)}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b bg-muted/50">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    'px-2 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-medium text-muted-foreground',
                    column.className
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-xs sm:text-sm text-muted-foreground"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((item) => (
                <tr
                  key={item._id}
                  onClick={() => onRowClick?.(item)}
                  className={cn(
                    'border-b transition-colors',
                    onRowClick && 'cursor-pointer hover:bg-muted/50',
                    rowClassName?.(item)
                  )}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn('px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm', column.className)}
                      onClick={(e) => {
                        // Prevent row click if clicking on actions
                        if (column.key === 'actions') {
                          e.stopPropagation();
                        }
                      }}
                    >
                      {column.render
                        ? column.render(item)
                        : (item as any)[column.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
