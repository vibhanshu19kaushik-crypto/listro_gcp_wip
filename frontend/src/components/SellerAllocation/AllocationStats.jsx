import React from 'react';
import { UserPlus, Mail, Check, AlertCircle, Users } from 'lucide-react';

const AllocationStats = ({ 
  sellersCount, 
  emailsCount, 
  allocatedCount, 
  unallocatedCount,
  totalCategories,
  allocatedCategoriesCount
}) => {
  const stats = [
    { 
      label: 'Total Sellers', 
      value: sellersCount, 
      sub: 'From GCP BigQuery', 
      icon: UserPlus, 
      color: 'blue',
      bg: 'bg-blue-100',
      text: 'text-blue-600'
    },
    { 
      label: 'Available KAMs', 
      value: emailsCount, 
      sub: 'From Google Sheets', 
      icon: Mail, 
      color: 'purple',
      bg: 'bg-purple-100',
      text: 'text-purple-600'
    },
    { 
      label: 'Allocated Sellers', 
      value: allocatedCount, 
      sub: sellersCount > 0 ? `${Math.round((allocatedCount / sellersCount) * 100)}% complete` : '0%', 
      icon: Check, 
      color: 'green',
      bg: 'bg-green-100',
      text: 'text-green-600'
    },
    { 
      label: 'Unallocated', 
      value: unallocatedCount, 
      sub: unallocatedCount > 0 ? 'Needs attention' : 'All clear', 
      icon: AlertCircle, 
      color: 'orange',
      bg: 'bg-orange-100',
      text: 'text-orange-600'
    }
  ];

  const categoryStats = [
    { label: 'Total Categories', value: totalCategories, icon: Users, color: 'blue' },
    { label: 'Allocated Categories', value: allocatedCategoriesCount, icon: Check, color: 'emerald' }
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                <p className={`text-3xl font-bold mt-2 ${stat.text || 'text-gray-900'}`}>{stat.value}</p>
                <p className="text-xs text-gray-500 mt-1">{stat.sub}</p>
              </div>
              <div className={`w-14 h-14 ${stat.bg} rounded-full flex items-center justify-center`}>
                <stat.icon className={`h-7 w-7 ${stat.text}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Category Coverage</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {categoryStats.map((stat, i) => (
            <div key={i} className={`bg-white rounded-xl shadow-lg border border-gray-200 p-6`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                  <p className={`text-3xl font-bold mt-2 text-${stat.color}-600`}>{stat.value}</p>
                </div>
                <div className={`w-14 h-14 bg-${stat.color}-100 rounded-full flex items-center justify-center`}>
                  <stat.icon className={`h-7 w-7 text-${stat.color}-600`} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AllocationStats;
