import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Users,
  DollarSign,
  FileText,
  Loader2,
  Tag,
  Plus,
  X,
} from 'lucide-react';
import { membersApi, contractsApi } from '../api/client';

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

interface ProductCombination {
  id: string;
  cob: { code: string; name: string };
  lob: { code: string; name: string };
  product: { code: string; name: string };
  sub_product: { code: string; name: string };
  mpp: { code: string; name: string };
  total_gwp: string;
  loss_ratio?: string;
}

export default function MemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'combinations' | 'contracts'>('combinations');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: member, isLoading: memberLoading } = useQuery({
    queryKey: ['member', id],
    queryFn: () => membersApi.get(id!),
    enabled: !!id,
  });

  const { data: gwpTree, isLoading: treeLoading } = useQuery({
    queryKey: ['memberGwpTree', id],
    queryFn: () => membersApi.getGWPTree(id!),
    enabled: !!id && activeTab === 'combinations',
  });

  const { data: contracts, isLoading: contractsLoading } = useQuery({
    queryKey: ['memberContracts', id],
    queryFn: () => membersApi.getContracts(id!),
    enabled: !!id,
  });

  // Extract flat product combinations from the tree
  const productCombinations: ProductCombination[] = [];
  if (gwpTree?.tree) {
    // Flatten the tree into combinations
    // The tree structure is: LOB -> COB -> Product -> SubProduct -> MPP
    // But COB is "higher" than LOB, so we'll display COB first
    const flattenTree = (
      lobNode: { code: string; name: string; children?: unknown[]; total_gwp?: string },
    ) => {
      if (!lobNode.children) return;
      for (const cobNode of lobNode.children as { code: string; name: string; children?: unknown[]; total_gwp?: string }[]) {
        if (!cobNode.children) continue;
        for (const productNode of cobNode.children as { code: string; name: string; children?: unknown[]; total_gwp?: string }[]) {
          if (!productNode.children) continue;
          for (const subProductNode of productNode.children as { code: string; name: string; children?: unknown[]; total_gwp?: string; gwp_breakdown_ids?: string[] }[]) {
            if (!subProductNode.children) continue;
            for (const mppNode of subProductNode.children as { code: string; name: string; total_gwp?: string; loss_ratio?: string; gwp_breakdown_ids?: string[] }[]) {
              productCombinations.push({
                id: mppNode.gwp_breakdown_ids?.[0] || `${lobNode.code}-${cobNode.code}-${productNode.code}-${subProductNode.code}-${mppNode.code}`,
                cob: { code: cobNode.code, name: cobNode.name },
                lob: { code: lobNode.code, name: lobNode.name },
                product: { code: productNode.code, name: productNode.name },
                sub_product: { code: subProductNode.code, name: subProductNode.name },
                mpp: { code: mppNode.code, name: mppNode.name },
                total_gwp: mppNode.total_gwp || '0',
                loss_ratio: mppNode.loss_ratio,
              });
            }
          }
        }
      }
    };
    gwpTree.tree.forEach(flattenTree);
  }

  // Sort by GWP descending
  const sortedCombinations = [...productCombinations].sort((a, b) => {
    const gwpA = parseFloat(a.total_gwp) || 0;
    const gwpB = parseFloat(b.total_gwp) || 0;
    return gwpB - gwpA;
  });

  // Upload contract mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const uploadResult = await contractsApi.upload(file);
      // Link the contract to this member
      await membersApi.linkContract(id!, uploadResult.id);
      return uploadResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memberContracts', id] });
      setIsUploading(false);
    },
    onError: () => {
      setIsUploading(false);
    },
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIsUploading(true);
      uploadMutation.mutate(file);
    }
  };

  // Unlink contract mutation
  const unlinkMutation = useMutation({
    mutationFn: (contractId: string) => membersApi.unlinkContract(id!, contractId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memberContracts', id] });
    },
  });

  const handleUnlink = (contractId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click navigation
    if (confirm('Are you sure you want to unlink this contract?')) {
      unlinkMutation.mutate(contractId);
    }
  };

  const isLoading = memberLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-2 text-slate-500">Loading member details...</span>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          Member not found.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/members')}
          className="flex items-center gap-1 text-slate-500 hover:text-slate-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Members
        </button>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="page-title flex items-center gap-2">
              <Users className="w-6 h-6" />
              {member.name}
            </h1>
            <p className="text-slate-500 mt-1 font-mono">{member.member_id}</p>
          </div>

          <div className="text-right">
            <div className="text-2xl font-bold text-green-600 flex items-center gap-1">
              <DollarSign className="w-6 h-6" />
              {formatCurrency(member.total_gwp)}
            </div>
            <p className="text-slate-500 text-sm">2025 GWP</p>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="card p-4">
          <div className="text-2xl font-bold text-slate-800">{member.gwp_row_count}</div>
          <div className="text-slate-500 text-sm">Product Combinations</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-slate-800">{contracts?.total || 0}</div>
          <div className="text-slate-500 text-sm">Linked Contracts</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 mb-4">
        <div className="flex gap-4">
          <button
            className={`py-2 px-4 border-b-2 transition-colors ${
              activeTab === 'combinations'
                ? 'border-blue-500 text-blue-600 font-medium'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
            onClick={() => setActiveTab('combinations')}
          >
            <Tag className="w-4 h-4 inline mr-1" />
            Product Combinations
          </button>
          <button
            className={`py-2 px-4 border-b-2 transition-colors ${
              activeTab === 'contracts'
                ? 'border-blue-500 text-blue-600 font-medium'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
            onClick={() => setActiveTab('contracts')}
          >
            <FileText className="w-4 h-4 inline mr-1" />
            Contracts ({contracts?.total || 0})
          </button>
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'combinations' && (
        <div className="card">
          <div className="p-4 border-b border-slate-200">
            <h2 className="font-semibold text-slate-800">Product Combinations</h2>
            <p className="text-sm text-slate-500">
              Each row represents a unique combination of product tags with associated GWP (sorted by GWP descending)
            </p>
          </div>

          {treeLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              <span className="ml-2 text-slate-500">Loading product combinations...</span>
            </div>
          ) : sortedCombinations.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="table-header text-left py-3 px-4">COB</th>
                    <th className="table-header text-left py-3 px-4">LOB</th>
                    <th className="table-header text-left py-3 px-4">Product</th>
                    <th className="table-header text-left py-3 px-4">Sub Product</th>
                    <th className="table-header text-left py-3 px-4">Member Program</th>
                    <th className="table-header text-right py-3 px-4">2025 GWP</th>
                    <th className="table-header text-right py-3 px-4">Loss Ratio</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCombinations.map((combo) => (
                    <tr
                      key={combo.id}
                      className="border-b border-slate-100 hover:bg-slate-50"
                    >
                      <td className="py-3 px-4">
                        <span className="text-slate-800" title={combo.cob.code}>
                          {combo.cob.name}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-slate-800" title={combo.lob.code}>
                          {combo.lob.name}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-slate-800" title={combo.product.code}>
                          {combo.product.name}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-slate-800" title={combo.sub_product.code}>
                          {combo.sub_product.name}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-slate-800" title={combo.mpp.code}>
                          {combo.mpp.name}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-slate-700">
                          {formatCurrency(combo.total_gwp)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-slate-700">
                          {combo.loss_ratio
                            ? `${(parseFloat(combo.loss_ratio) * 100).toFixed(1)}%`
                            : '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-500">
              No product combinations available.
            </div>
          )}
        </div>
      )}

      {activeTab === 'contracts' && (
        <div className="card">
          {/* Upload button */}
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-800">Linked Contracts</h2>
              <p className="text-sm text-slate-500">
                Contracts associated with this member
              </p>
            </div>
            <div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".pdf,.docx,.doc"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="btn-primary flex items-center gap-2"
              >
                {isUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Upload Contract
              </button>
            </div>
          </div>

          {contractsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              <span className="ml-2 text-slate-500">Loading contracts...</span>
            </div>
          ) : contracts?.contracts && contracts.contracts.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="table-header text-left py-3 px-4">Contract</th>
                  <th className="table-header text-left py-3 px-4">Version</th>
                  <th className="table-header text-left py-3 px-4">Effective Date</th>
                  <th className="table-header text-center py-3 px-4">Status</th>
                  <th className="table-header text-left py-3 px-4">Linked</th>
                  <th className="table-header text-center py-3 px-4 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {contracts.contracts.map((contract) => (
                  <tr
                    key={contract.id}
                    className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                    onClick={() => navigate(`/contracts/${contract.contract_id}`)}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-slate-400" />
                        <span className="font-medium text-slate-800">
                          {contract.contract_filename || 'Unknown'}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="badge bg-blue-100 text-blue-700">
                        {contract.version_number}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {contract.effective_date || '—'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {contract.is_current ? (
                        <span className="badge bg-green-100 text-green-700">Current</span>
                      ) : (
                        <span className="badge bg-slate-100 text-slate-600">Previous</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-sm">
                      {new Date(contract.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={(e) => handleUnlink(contract.contract_id, e)}
                        className="p-1 hover:bg-red-100 rounded transition-colors"
                        title="Unlink contract"
                      >
                        <X className="w-4 h-4 text-red-500" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="py-12 text-center text-slate-500">
              <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>No contracts linked to this member yet.</p>
              <p className="text-sm mt-1">
                Click "Upload Contract" to add the first one.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
