import { X } from 'lucide-react';
import type { InsuranceProduct } from '../../types';

interface ProductGuidelinesModalProps {
  product: InsuranceProduct;
  onClose: () => void;
}

// Helper to safely get field value from extracted data
function getFieldValue(data: Record<string, unknown>, key: string): string | null {
  const field = data[key];
  if (field === null || field === undefined) return null;
  if (typeof field === 'string') return field;
  if (typeof field === 'number') return String(field);
  if (Array.isArray(field)) return field.join(', ');
  if (typeof field === 'object' && 'value' in field) {
    const val = (field as { value: unknown }).value;
    if (val === null || val === undefined) return null;
    if (Array.isArray(val)) return val.join(', ');
    return String(val);
  }
  return null;
}

// Format currency
function formatCurrency(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return 'N/A';
  const num = typeof value === 'string' ? parseFloat(value.replace(/[,$]/g, '')) : value;
  if (isNaN(num)) return String(value);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

// Format percentage
function formatPercent(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return 'N/A';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return 'N/A';
  return `${(num * 100).toFixed(1)}%`;
}

export default function ProductGuidelinesModal({ product, onClose }: ProductGuidelinesModalProps) {
  const data = product.extracted_data || {};

  // Extract specific fields
  const productDescription = getFieldValue(data, 'product_description');
  const maxAnnualPremium = getFieldValue(data, 'max_annual_premium');
  const ratingBasis = getFieldValue(data, 'rating_basis');
  const targetOperations = getFieldValue(data, 'target_operations');
  const eligibleRisks = getFieldValue(data, 'eligible_classes') || getFieldValue(data, 'target_classes');
  const maxLiabilityLimit = getFieldValue(data, 'max_limits_of_liability') || getFieldValue(data, 'max_policy_limit');
  const maxPolicyPeriod = getFieldValue(data, 'max_policy_period');
  const exclusions = getFieldValue(data, 'exclusions');
  const permittedStates = getFieldValue(data, 'permitted_states');
  const excludedStates = getFieldValue(data, 'excluded_states');
  const cancellationProvisions = getFieldValue(data, 'cancellation_provisions');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[85vh] overflow-hidden"
        style={{ border: '1px solid var(--slate-200)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-5 border-b"
          style={{ borderColor: 'var(--slate-200)' }}
        >
          <h2 className="text-xl font-semibold" style={{ color: 'var(--slate-900)' }}>
            Product Details
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5" style={{ color: 'var(--slate-500)' }} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 140px)' }}>
          {/* Product Info Header */}
          <div
            className="p-4 rounded-lg mb-6"
            style={{ backgroundColor: 'var(--slate-50)', border: '1px solid var(--slate-200)' }}
          >
            <h3 className="font-semibold text-lg mb-1" style={{ color: 'var(--slate-900)' }}>
              {product.product_name}
            </h3>
            {productDescription && (
              <p className="text-sm mb-3" style={{ color: 'var(--slate-600)' }}>
                {productDescription}
              </p>
            )}
            {!productDescription && <div className="mb-2" />}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm" style={{ color: 'var(--slate-500)' }}>Line of Business</span>
                <p className="font-medium" style={{ color: 'var(--slate-900)' }}>{product.lob_name}</p>
              </div>
              <div>
                <span className="text-sm" style={{ color: 'var(--slate-500)' }}>Class of Business</span>
                <p className="font-medium" style={{ color: 'var(--slate-900)' }}>{product.cob_name}</p>
              </div>
              <div>
                <span className="text-sm" style={{ color: 'var(--slate-500)' }}>Premium Volume</span>
                <p className="font-medium" style={{ color: 'var(--slate-900)' }}>
                  {formatCurrency(product.premium_volume)}
                </p>
              </div>
              <div>
                <span className="text-sm" style={{ color: 'var(--slate-500)' }}>Loss Ratio</span>
                <p className="font-medium" style={{ color: 'var(--slate-900)' }}>
                  {formatPercent(product.loss_ratio)}
                </p>
              </div>
            </div>
          </div>

          {/* Underwriting Guidelines */}
          <h3 className="font-semibold text-lg mb-4" style={{ color: 'var(--slate-900)' }}>
            Underwriting Guidelines
          </h3>

          <div
            className="rounded-lg p-4 space-y-6"
            style={{ backgroundColor: 'var(--slate-50)', border: '1px solid var(--slate-200)' }}
          >
            {/* Premium Information */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-3" style={{ color: 'var(--slate-800)' }}>
                  Premium Information
                </h4>
                <div className="space-y-2">
                  <div>
                    <span className="text-sm" style={{ color: 'var(--slate-500)' }}>Maximum Annual Premium</span>
                    <p className="font-medium" style={{ color: 'var(--slate-900)' }}>
                      {maxAnnualPremium ? formatCurrency(maxAnnualPremium) : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm" style={{ color: 'var(--slate-500)' }}>Rating Basis</span>
                    <p className="font-medium" style={{ color: 'var(--slate-900)' }}>
                      {ratingBasis || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-3" style={{ color: 'var(--slate-800)' }}>
                  Liability Information
                </h4>
                <div className="space-y-2">
                  <div>
                    <span className="text-sm" style={{ color: 'var(--slate-500)' }}>Maximum Liability Limit</span>
                    <p className="font-medium" style={{ color: 'var(--slate-900)' }}>
                      {maxLiabilityLimit ? formatCurrency(maxLiabilityLimit) : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm" style={{ color: 'var(--slate-500)' }}>Maximum Policy Period</span>
                    <p className="font-medium" style={{ color: 'var(--slate-900)' }}>
                      {maxPolicyPeriod || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Target Operations */}
            {targetOperations && (
              <div>
                <h4 className="font-medium mb-2" style={{ color: 'var(--slate-800)' }}>
                  Target Operations
                </h4>
                <p className="text-sm" style={{ color: 'var(--slate-700)' }}>{targetOperations}</p>
              </div>
            )}

            {/* Eligible Risks */}
            {eligibleRisks && (
              <div>
                <h4 className="font-medium mb-2" style={{ color: 'var(--slate-800)' }}>
                  Eligible Risks
                </h4>
                <p className="text-sm" style={{ color: 'var(--slate-700)' }}>{eligibleRisks}</p>
              </div>
            )}

            {/* Exclusions */}
            {exclusions && (
              <div>
                <h4 className="font-medium mb-2" style={{ color: 'var(--slate-800)' }}>
                  Exclusions
                </h4>
                <p className="text-sm" style={{ color: 'var(--slate-700)' }}>{exclusions}</p>
              </div>
            )}

            {/* Territorial Coverage */}
            {(permittedStates || excludedStates) && (
              <div>
                <h4 className="font-medium mb-2" style={{ color: 'var(--slate-800)' }}>
                  Territorial Coverage
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  {permittedStates && (
                    <div>
                      <span className="text-sm" style={{ color: 'var(--slate-500)' }}>Permitted Territories</span>
                      <p className="text-sm" style={{ color: 'var(--slate-700)' }}>{permittedStates}</p>
                    </div>
                  )}
                  {excludedStates && (
                    <div>
                      <span className="text-sm" style={{ color: 'var(--slate-500)' }}>Excluded Territories</span>
                      <p className="text-sm" style={{ color: 'var(--slate-700)' }}>{excludedStates}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Cancellation Provisions */}
            {cancellationProvisions && (
              <div>
                <h4 className="font-medium mb-2" style={{ color: 'var(--slate-800)' }}>
                  Cancellation Provisions
                </h4>
                <p className="text-sm" style={{ color: 'var(--slate-700)' }}>{cancellationProvisions}</p>
              </div>
            )}

            {/* Show message if no guidelines data */}
            {!maxAnnualPremium && !ratingBasis && !maxLiabilityLimit && !targetOperations && !eligibleRisks && !exclusions && !permittedStates && !cancellationProvisions && (
              <p className="text-center py-4" style={{ color: 'var(--slate-500)' }}>
                No underwriting guidelines available for this product.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex justify-end p-4 border-t"
          style={{ borderColor: 'var(--slate-200)', backgroundColor: 'var(--slate-50)' }}
        >
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg font-medium transition-colors"
            style={{
              backgroundColor: 'var(--slate-200)',
              color: 'var(--slate-700)',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
