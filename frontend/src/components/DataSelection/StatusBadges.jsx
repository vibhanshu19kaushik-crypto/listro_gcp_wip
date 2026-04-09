import React from 'react';
import { CheckCircle, XCircle, Clock, Check, Timer, Lock } from 'lucide-react';

export const StatusBadge = ({ status }) => {
  const statusLower = (status || '').toLowerCase();

  if (statusLower.includes('active')) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        <CheckCircle className="w-3 h-3 mr-1" />
        Active
      </span>
    );
  } else if (statusLower.includes('inactive')) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
        <XCircle className="w-3 h-3 mr-1" />
        Inactive
      </span>
    );
  } else {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
        <Clock className="w-3 h-3 mr-1" />
        {status || 'Unknown'}
      </span>
    );
  }
};

export const ClaimStatusBadge = ({ listingId, claimedStatus, claimedBy, endTime, startTime, userEmail }) => {
  const isClaimedByUser = (claimedBy || '').toLowerCase() === (userEmail || '').toLowerCase();
  const isClaimed = claimedStatus === 'Claimed' || claimedStatus === 'In Progress';
  
  let displayStatus = 'Available';
  if (isClaimed) {
    if (endTime && endTime.trim() !== '') displayStatus = 'Completed';
    else if (startTime && startTime.trim() !== '') displayStatus = 'In Progress';
    else displayStatus = 'Claimed';
  }

  if (displayStatus === 'Completed') {
    return (
      <div className="flex flex-col space-y-1">
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <Check className="w-3 h-3 mr-1" />
          Completed
        </span>
        <span className="text-xs text-gray-500 italic">Optimization finished</span>
      </div>
    );
  }

  if (displayStatus === 'In Progress' && isClaimedByUser) {
    return (
      <div className="flex flex-col space-y-1">
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          <Clock className="w-3 h-3 mr-1" />
          In Progress
        </span>
        <span className="text-xs text-gray-500 italic">Currently being optimized</span>
      </div>
    );
  }

  if (isClaimed && !isClaimedByUser) {
    return (
      <div className="flex flex-col space-y-1">
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-800">
          <Lock className="w-3 h-3 mr-1" />
          Claimed by Others
        </span>
        <span className="text-xs text-gray-500 italic">Not available</span>
      </div>
    );
  }

  return <span className="text-gray-400 text-xs">-</span>;
};

export const CompletionBadge = ({ endTime }) => {
  if (!endTime || endTime.trim() === '') {
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
        <Timer className="w-3 h-3 mr-1" />
        In Progress
      </span>
    );
  } else {
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
        <Check className="w-3 h-3 mr-1" />
        Completed
      </span>
    );
  }
};
