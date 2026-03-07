import type { NeedsTableSkeletonProps } from "./types";

export default function NeedsTableSkeleton({ rows = 5 }: NeedsTableSkeletonProps) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm" aria-hidden="true">
          <thead className="bg-muted/40">
            <tr>
              {Array.from({ length: 5 }).map((_, index) => (
                <th key={index} className="px-4 py-3">
                  <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <tr key={rowIndex} className="border-b">
                <td className="px-4 py-4">
                  <div className="h-6 w-24 animate-pulse rounded-full bg-muted" />
                </td>
                <td className="px-4 py-4">
                  <div className="space-y-2">
                    <div className="h-4 w-56 animate-pulse rounded bg-muted" />
                    <div className="h-4 w-72 animate-pulse rounded bg-muted" />
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="h-6 w-20 animate-pulse rounded-full bg-muted" />
                </td>
                <td className="px-4 py-4">
                  <div className="space-y-2">
                    <div className="h-4 w-36 animate-pulse rounded bg-muted" />
                    <div className="h-2 w-full max-w-[16rem] animate-pulse rounded bg-muted" />
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex justify-end gap-2">
                    <div className="h-8 w-20 animate-pulse rounded bg-muted" />
                    <div className="h-8 w-24 animate-pulse rounded bg-muted" />
                    <div className="h-8 w-20 animate-pulse rounded bg-muted" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
