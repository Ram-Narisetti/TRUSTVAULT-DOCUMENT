import React from 'react';

export const SkeletonCard = () => (
  <div className="p-5 rounded-2xl bg-[#15161A] border border-[#282A33] space-y-3.5 shadow-lg">
    <div className="flex items-center justify-between">
      <div className="w-24 h-4 rounded-md skeleton-shimmer" />
      <div className="w-8 h-8 rounded-xl skeleton-shimmer" />
    </div>
    <div className="w-20 h-7 rounded-md skeleton-shimmer" />
    <div className="w-36 h-3 rounded-md skeleton-shimmer" />
  </div>
);

export const SkeletonGrid = ({ count = 4 }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonCard key={i} />
    ))}
  </div>
);

export const SkeletonTableRow = ({ columns = 5 }) => (
  <tr className="border-b border-[#282A33]/50">
    <td className="py-4 px-5">
      <div className="flex items-center gap-3.5">
        <div className="w-9 h-9 rounded-xl skeleton-shimmer flex-shrink-0" />
        <div className="space-y-1.5 flex-1">
          <div className="w-36 h-3.5 rounded skeleton-shimmer" />
          <div className="w-24 h-2.5 rounded skeleton-shimmer" />
        </div>
      </div>
    </td>
    {Array.from({ length: columns - 1 }).map((_, i) => (
      <td key={i} className="py-4 px-4">
        <div className="w-16 h-4 rounded-full skeleton-shimmer" />
      </td>
    ))}
  </tr>
);

export const SkeletonTable = ({ rows = 5, columns = 6 }) => (
  <div className="w-full rounded-2xl border border-[#282A33] bg-[#15161A] overflow-hidden shadow-xl">
    <table className="w-full text-left">
      <thead className="bg-[#101114] border-b border-[#282A33]">
        <tr>
          {Array.from({ length: columns }).map((_, i) => (
            <th key={i} className="py-4 px-4">
              <div className="w-20 h-3 rounded skeleton-shimmer" />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonTableRow key={i} columns={columns} />
        ))}
      </tbody>
    </table>
  </div>
);
