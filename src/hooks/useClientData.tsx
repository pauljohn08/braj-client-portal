/**
 * Everything a signed-in client needs, loaded once and shared by every page in
 * the client portal.
 *
 * The client portal is built on four tables — orders, order_files,
 * payment_receipts and order_ratings. `transactions` is intentionally absent:
 * row-level security only allows admins and the assigned part-timer to read it,
 * so a client query for it would return nothing and the owner/part-timer split
 * is not the client's business anyway.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  buildActivity,
  countUnseen,
  getActivitySeenAt,
  getClientActions,
  setActivitySeenAt,
  type ActivityItem,
  type ClientAction,
  type Order,
  type OrderFile,
  type OrderRating,
  type PaymentReceipt,
  type Profile,
} from "@/lib/orders";

type ClientData = {
  orders: Order[];
  files: OrderFile[];
  receipts: PaymentReceipt[];
  ratings: OrderRating[];
  profile: Profile | null;
  /** Uploader display names, keyed by user id. */
  uploaderNames: Map<string, string>;
  /** Output files per order id — the milestone rail needs the count. */
  outputCounts: Map<string, number>;
  activity: ActivityItem[];
  actions: ClientAction[];
  unseenCount: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /** Clears the "new" badge on the activity feed. */
  markActivitySeen: () => void;
  /** Applies a local edit so the UI updates without a refetch. */
  setOrderLocally: (orderId: string, patch: Partial<Order>) => void;
  addReceiptLocally: (receipt: PaymentReceipt) => void;
  addRatingLocally: (rating: OrderRating) => void;
  removeOrderLocally: (orderId: string) => void;
};

const ClientDataContext = createContext<ClientData | undefined>(undefined);

export function ClientDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;

  const [orders, setOrders] = useState<Order[]>([]);
  const [files, setFiles] = useState<OrderFile[]>([]);
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
  const [ratings, setRatings] = useState<OrderRating[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [uploaderNames, setUploaderNames] = useState<Map<string, string>>(
    new Map(),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seenAt, setSeenAt] = useState(0);

  // Guards the state updates of a fetch that has been superseded by a newer one.
  const requestId = useRef(0);

  const load = useCallback(async () => {
    if (!userId) {
      setOrders([]);
      setFiles([]);
      setReceipts([]);
      setRatings([]);
      setProfile(null);
      setUploaderNames(new Map());
      setLoading(false);
      return;
    }

    const id = ++requestId.current;
    const isStale = () => id !== requestId.current;

    setError(null);
    try {
      const [profileRes, ordersRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
        supabase
          .from("orders")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
      ]);

      if (isStale()) return;
      setProfile(profileRes.data ?? null);

      const orderRows = ordersRes.data ?? [];
      setOrders(orderRows);

      if (orderRows.length === 0) {
        setFiles([]);
        setReceipts([]);
        setRatings([]);
        setUploaderNames(new Map());
        return;
      }

      const orderIds = orderRows.map((o) => o.id);
      const [filesRes, receiptsRes, ratingsRes] = await Promise.all([
        supabase.from("order_files").select("*").in("order_id", orderIds),
        supabase.from("payment_receipts").select("*").in("order_id", orderIds),
        supabase.from("order_ratings").select("*").in("order_id", orderIds),
      ]);

      if (isStale()) return;
      const fileRows = filesRes.data ?? [];
      setFiles(fileRows);
      setReceipts(receiptsRes.data ?? []);
      setRatings(ratingsRes.data ?? []);

      // Names of whoever uploaded each file, so a client can see that a
      // consultant delivered something rather than an anonymous system.
      const uploaderIds = [
        ...new Set(
          fileRows.map((f) => f.uploaded_by).filter((v): v is string => !!v),
        ),
      ];
      if (uploaderIds.length > 0) {
        const { data: names } = await supabase
          .from("profiles")
          .select("user_id, full_name, email")
          .in("user_id", uploaderIds);
        if (isStale()) return;
        setUploaderNames(
          new Map(
            (names ?? []).map((p) => [
              p.user_id,
              p.full_name?.trim() || p.email || "BRAJ",
            ]),
          ),
        );
      } else {
        setUploaderNames(new Map());
      }
    } catch (err) {
      if (isStale()) return;
      setError(
        err instanceof Error ? err.message : "Could not load your projects.",
      );
    } finally {
      if (!isStale()) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  // The "new" badge is a local marker, not server state — nothing is written
  // back, so it costs nothing and cannot fail.
  useEffect(() => {
    if (userId) setSeenAt(getActivitySeenAt(userId));
  }, [userId]);

  const outputCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const file of files) {
      if (file.file_type !== "output") continue;
      counts.set(file.order_id, (counts.get(file.order_id) ?? 0) + 1);
    }
    return counts;
  }, [files]);

  const activity = useMemo(
    () => buildActivity({ orders, files, receipts, ratings, transactions: [] }),
    [orders, files, receipts, ratings],
  );

  const actions = useMemo(
    () => getClientActions(orders, receipts, ratings),
    [orders, receipts, ratings],
  );

  const unseenCount = useMemo(
    () => countUnseen(activity, seenAt),
    [activity, seenAt],
  );

  const markActivitySeen = useCallback(() => {
    if (!userId) return;
    const now = Date.now();
    setActivitySeenAt(userId, now);
    setSeenAt(now);
  }, [userId]);

  const refresh = useCallback(async () => {
    await load();
  }, [load]);

  const setOrderLocally = useCallback(
    (orderId: string, patch: Partial<Order>) => {
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, ...patch } : o)),
      );
    },
    [],
  );

  const addReceiptLocally = useCallback((receipt: PaymentReceipt) => {
    setReceipts((prev) => [
      ...prev.filter((r) => r.order_id !== receipt.order_id),
      receipt,
    ]);
  }, []);

  const addRatingLocally = useCallback((rating: OrderRating) => {
    setRatings((prev) => [...prev, rating]);
  }, []);

  const removeOrderLocally = useCallback((orderId: string) => {
    setOrders((prev) => prev.filter((o) => o.id !== orderId));
    setFiles((prev) => prev.filter((f) => f.order_id !== orderId));
    setReceipts((prev) => prev.filter((r) => r.order_id !== orderId));
    setRatings((prev) => prev.filter((r) => r.order_id !== orderId));
  }, []);

  const value = useMemo<ClientData>(
    () => ({
      orders,
      files,
      receipts,
      ratings,
      profile,
      uploaderNames,
      outputCounts,
      activity,
      actions,
      unseenCount,
      loading,
      error,
      refresh,
      markActivitySeen,
      setOrderLocally,
      addReceiptLocally,
      addRatingLocally,
      removeOrderLocally,
    }),
    [
      orders,
      files,
      receipts,
      ratings,
      profile,
      uploaderNames,
      outputCounts,
      activity,
      actions,
      unseenCount,
      loading,
      error,
      refresh,
      markActivitySeen,
      setOrderLocally,
      addReceiptLocally,
      addRatingLocally,
      removeOrderLocally,
    ],
  );

  return (
    <ClientDataContext.Provider value={value}>
      {children}
    </ClientDataContext.Provider>
  );
}

export function useClientData() {
  const context = useContext(ClientDataContext);
  if (!context) {
    throw new Error("useClientData must be used within ClientDataProvider");
  }
  return context;
}
