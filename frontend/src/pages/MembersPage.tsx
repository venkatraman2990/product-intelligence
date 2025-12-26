import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Search, Users, FileText, ChevronRight, Loader2, Tag } from 'lucide-react';
import { membersApi } from '../api/client';
import type { Member } from '../types';

export default function MembersPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search input
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    // Simple debounce
    setTimeout(() => {
      setDebouncedSearch(value);
    }, 300);
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ['members', debouncedSearch],
    queryFn: () => membersApi.list(0, 100, debouncedSearch || undefined),
  });

  const members = data?.members || [];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Users className="w-6 h-6" />
            Members
          </h1>
          <p className="text-slate-500 mt-1">
            {data?.total || 0} members in the system
          </p>
        </div>
      </div>

      {/* Search bar */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name or member ID..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="search-input pl-10 w-full"
          />
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <span className="ml-2 text-slate-500">Loading members...</span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          Failed to load members. Please try again.
        </div>
      )}

      {/* Members list */}
      {!isLoading && !error && (
        <div className="card">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="table-header text-left py-3 px-4">Member</th>
                <th className="table-header text-left py-3 px-4">Member ID</th>
                <th className="table-header text-center py-3 px-4">Product Combinations</th>
                <th className="table-header text-center py-3 px-4">Contracts</th>
                <th className="table-header text-right py-3 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {members.map((member: Member) => (
                <tr
                  key={member.id}
                  className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/members/${member.id}`)}
                >
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-900">{member.name}</div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="badge bg-slate-100 text-slate-700 font-mono text-sm">
                      {member.member_id}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="flex items-center justify-center gap-1 text-slate-600">
                      <Tag className="w-4 h-4 text-slate-400" />
                      {member.gwp_row_count}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="flex items-center justify-center gap-1">
                      <FileText className="w-4 h-4 text-slate-400" />
                      {member.contract_count}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {members.length === 0 && (
            <div className="py-12 text-center text-slate-500">
              {searchQuery ? 'No members found matching your search.' : 'No members in the system.'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
