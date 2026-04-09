import React from 'react';

const FilterGrid = ({
  filterColumns,
  filterOptions,
  filters,
  onFilterChange
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {filterColumns.map((column) => (
        <div key={column} className="flex flex-col">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 ml-0.5">
            {column}
          </label>
          <div className="relative">
            <select
              className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none transition-all hover:border-gray-400"
              value={filters[column] || `Select ${column}`}
              onChange={(e) => onFilterChange(column, e.target.value)}
            >
              {(filterOptions[column] || [`Select ${column}`]).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-gray-500">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default FilterGrid;
