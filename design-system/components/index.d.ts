// Integral — props sugeridas para los componentes React (documentación; las clases están en bundle.css)
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface ButtonProps {
  /** primary: una por vista · edit: solo "Editar" en Stock */
  variant?: 'primary' | 'secondary' | 'ghost' | 'edit' | 'danger';
  /** sm 32 · md 40 · lg 48 · xl 64 (solo APROBAR VENTA) */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  icon?: LucideIcon;
  /** Muestra un Kbd a la derecha, p. ej. "F2" */
  shortcut?: string;
  disabled?: boolean;
  /** Obligatorio si el botón es solo ícono */
  ariaLabel?: string;
  onClick?: () => void;
  children?: ReactNode;
}

export interface KbdProps { children: string }
export interface ShortcutBarProps { items: { keys: string[]; label: string }[] }

export interface FieldProps {
  label: string;
  required?: boolean;
  help?: string;
  /** Mensaje de error: qué pasó + qué hacer */
  error?: string;
  readOnly?: boolean;
}
export interface AmountFieldProps extends FieldProps {
  value: number | null;
  /** Se llama al confirmar (blur/Enter) con el valor parseado es-AR; null si vacío */
  onCommit: (value: number | null) => void;
  min?: number;
  max?: number;
  prefix?: '$';
  suffix?: '%';
}
export interface IntegerFieldProps extends FieldProps { value: number; onCommit: (v: number) => void; allowNegative?: boolean; nonZero?: boolean }
export interface DateFieldProps extends FieldProps { value: string | null; onCommit: (isoDate: string | null) => void }
export interface BarcodeFieldProps extends FieldProps { value: string; onChange: (digits: string) => void; maxLength?: 20 }

export interface EntityPickerProps<T extends { id: number; name: string }> {
  label: string;
  required?: boolean;
  items: T[];
  value: T | null;
  onChange: (item: T) => void;
  /** Alta en el momento. Proveedor pasa extraFields: ['phone','notes'] */
  onCreate: (name: string, extra?: { phone?: string; notes?: string }) => Promise<T>;
  extraFields?: ('phone' | 'notes')[];
  meta?: (item: T) => string;
  entityName: 'categoría' | 'proveedor';
}

export interface Column<R> { key: string; header: string; align?: 'left' | 'right' | 'center'; mono?: boolean; render?: (row: R) => ReactNode; width?: number | string }
export interface DataTableProps<R> {
  columns: Column<R>[];
  rows: R[];
  rowKey: (r: R) => string | number;
  activeKey?: string | number;
  onActiveChange?: (key: string | number) => void;
  /** Enter / doble click */
  onActivate?: (row: R) => void;
  state?: 'ready' | 'loading' | 'error' | 'empty';
  empty?: ReactNode;
  footer?: ReactNode;
  rowTone?: (r: R) => 'negative' | 'low' | undefined;
}

export interface BadgeProps { tone: 'neutral' | 'danger' | 'warning' | 'success' | 'info'; icon?: LucideIcon; children: ReactNode }
export interface SegmentedProps<V extends string> { options: { value: V; label: string; icon?: LucideIcon }[]; value: V; onChange: (v: V) => void; ariaLabel: string }

export interface AppHeaderProps { section: 'stock' | 'ventas' | 'estadisticas'; onNavigate: (s: AppHeaderProps['section']) => void; expiry?: ExpiryCounts }
export interface ExpiryCounts { expired: number; today: number }
export interface ExpiryLot { lotId: number; productName: string; expiresOn: string; loadedOn: string; units: number; status: 'expired' | 'today' }
export interface ExpiryAlertProps { counts: ExpiryCounts; lots: ExpiryLot[]; onDismissForever: (lotId: number) => void; onRemindLater: (lotId: number) => void }

export interface ModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  size?: 'sm' | 'md' | 'lg';
  onClose: () => void;
  /** Formularios con datos: false (no cierra por click fuera) */
  closeOnOverlay?: boolean;
  shortcuts?: ShortcutBarProps['items'];
  footer?: ReactNode;
  children: ReactNode;
}

export interface ToastOptions { tone: 'danger' | 'warning' | 'success' | 'info'; title: string; detail?: string; durationMs?: number }
export interface InlineAlertProps { tone: 'danger' | 'warning' | 'success' | 'info'; title?: string; children?: ReactNode; action?: ReactNode }
export interface EmptyStateProps { icon: LucideIcon; title: string; description?: string; action?: ReactNode; tone?: 'neutral' | 'danger' }

export interface CartLine { id: string; productId: number | null; name: string; qty: number; unitPrice: number; listPrice?: number; stockWarning?: boolean; isGeneral?: boolean }
export interface CartTableProps {
  lines: CartLine[];
  activeId?: string;
  onActiveChange: (id: string | null) => void;
  onQtyCommit: (id: string, qty: number) => void;
  onPriceCommit: (id: string, price: number) => void;
  onRemove: (id: string) => void;
  /** Esc desde la tabla → devolver foco al BarcodeInput */
  onExit: () => void;
}

export type PaymentMethod = 'efectivo' | 'debito' | 'credito' | 'transferencia' | 'otros';
export interface PaymentPanelProps {
  subtotal: number;
  discountPct: number;
  onDiscountCommit: (pct: number) => void;
  payments: Record<PaymentMethod, number>;
  onPaymentCommit: (m: PaymentMethod, amount: number) => void;
  /** Click en etiqueta: completa con lo que falta */
  onFillRemaining: (m: PaymentMethod) => void;
  canApprove: boolean;
  disabledReason?: string;
  onApprove: () => void;
  saving?: boolean;
}
export interface ChangeIndicatorProps { /** pagado − total */ diff: number }

export interface StatCardProps { label: string; icon: LucideIcon; value: string; deltaPct: number | null; comparedTo: string }
export interface RankingListProps { items: { name: string; value: number }[]; format: (v: number) => string }
