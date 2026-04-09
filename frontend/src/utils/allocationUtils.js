/**
 * Permission checks for Lead/Admin
 */
export const isLeadOrAdmin = () => {
  try {
    const userRaw = localStorage.getItem('user');
    if (!userRaw) return false;
    const u = JSON.parse(userRaw);
    if (!u) return false;
    const roleStr = (u.role || '').toString().toLowerCase();
    const rolesArr = Array.isArray(u.roles) ? u.roles.map(r => r.toString().toLowerCase()) : [];
    
    if (roleStr.includes('lead') || roleStr.includes('admin')) return true;
    if (rolesArr.some(r => r.includes('lead') || r.includes('admin'))) return true;
    if (u.isLead || u.isAdmin) return true;
    return false;
  } catch (e) {
    return false;
  }
};

/**
 * IST Timestamp Helper
 */
export const getISTTimestamp = () => {
  return new Date(Date.now() + 19800000)
    .toISOString()
    .replace("T", " ")
    .split(".")[0];
};

/**
 * Generic CSV Export Helper
 */
export const exportToCSV = (headers, rows, filename) => {
  const csv = [
    headers.join(','),
    ...rows.map(r => r.map(c => `"${(c || '').toString().replace(/"/g, '""')}"`).join(','))
  ].join('\n');
  
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

/**
 * Statistics Calculators
 */
export const calculateAllocationStats = (sellers, dbAllocations) => {
  const getAllocatedEmailsForSeller = (sellerId) => {
    return Array.from(new Set(
      (dbAllocations || [])
        .filter(r => (r.Allocation_Status || '').toUpperCase().trim() === 'ALLOCATED' && (r.Seller_ID == sellerId || r.sellerId == sellerId))
        .map(r => r.Resource_Email || r.resourceEmail || '').filter(Boolean)
    ));
  };

  const allocatedCount = sellers.filter(s => getAllocatedEmailsForSeller(s.id).length > 0).length;
  const unallocatedCount = sellers.length - allocatedCount;

  const totalAssignments = dbAllocations.filter(r => 
    (r.Allocation_Status || '').toUpperCase().trim() === 'ALLOCATED'
  ).length;

  const avgAssignmentsPerSeller = allocatedCount > 0 
    ? (totalAssignments / allocatedCount).toFixed(1) 
    : '0.0';

  const uniqueCategories = new Set(sellers.map(s => s.category).filter(c => c && c !== 'Unknown'));
  const allocatedCategories = new Set(
    sellers.filter(s => getAllocatedEmailsForSeller(s.id).length > 0).map(s => s.category).filter(c => c && c !== 'Unknown')
  );

  return {
    allocatedCount,
    unallocatedCount,
    totalAssignments,
    avgAssignmentsPerSeller,
    totalCategories: uniqueCategories.size,
    allocatedCategoriesCount: allocatedCategories.size
  };
};
