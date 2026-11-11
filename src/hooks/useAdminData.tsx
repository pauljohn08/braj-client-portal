/**
 * Everything the admin console needs. Unlike the client portal this reads the
 * whole book of business — every order, every file, every receipt, and the
 * financial rows in `transactions`, which only an admin is permitted to read.
 *
 * The admin is also the only role that can see the part-timer roster and the
 * queue of part-timer applications waiting on a decision.
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
import { fetchPartTimerRatings } from "@/lib/parttimer-ratings";
import {
  buildActivity,
  displayName,
  type ActivityItem,
  type Order,
  type OrderFile,
  type OrderRating,
  type PaymentReceipt,
  type Profile,
  type Transaction,
} from "@/lib/orders";

export type ClientSummary = {
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  gcashNumber: string | null;
  gcashName: string | null;
  orderCount: number;
  activeCount: number;
  completedCount: number;
  /** Sum of agreed amounts across this client's orders. */
  billedTotal: number;
  /** Sum of confirmed payments. */
  settledTotal: number;
  lastOrderAt: string | null;
};

export type PartTimerSummary = {
  userId: string;
  name: string;
  email: string;
  gcashNumber: string | null;
  gcashName: string | null;
  allowedServices: string[];
  activeCount: number;
  completedCount: number;
  rating: { avg: number; count: number } | null;
};

export type PendingPartTimer = {
  userId: string;
  name: string;
  email: string;
};

type AdminData = {
  orders: Order[];
  files: OrderFile[];
  receipts: PaymentReceipt[];
  transactions: Transaction[];
  profiles: Map<string, Profile>;
  ratings: Map<string, { avg: number; count: number }>;
  clients: ClientSummary[];
  partTimers: PartTimerSummary[];
  pendingPartTimers: PendingPartTimer[];
  activity: ActivityItem[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /** Name for a user id, falling back to something readable. */
  nameFor: (userId: string | null | undefined) => string;
  setOrderLocally: (orderId: string, patch: Partial<Order>) => void;
  setPartTimerServicesLocally: (userId: string, services: string[]) => void;
  removePartTimerLocally: (userId: string) => void;
  removePendingPartTimerLocally: (userId: string) => void;
  setTransactionLocally: (transactionId: string, patch: Partial<Transaction>) => void;
  addTransactionLocally: (transaction: Transaction) => void;
};

const AdminDataContext = createContext<AdminData | undefined>(undefined);

export function AdminDataProvider({ children }: { children: ReactNode }) {
  const { user, isAdmin } = useAuth();
  const enabled = !!user && isAdmin;

  const [orders, setOrders] = useState<Order[]>([]);
  const [files, setFiles] = useState<OrderFile[]>([]);
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [profileMap, setProfileMap] = useState<Map<string, Profile>>(new Map());
  const [ratingMap, setRatingMap] = useState<
    Map<string, { avg: number; count: number }>
  >(new Map());
  const [pendingPartTimers, setPendingPartTimers] = useState<
    PendingPartTimer[]
  >([]);
  const [partTimerMeta, setPartTimerMeta] = useState<
    { userId: string; name: string; allowedServices: string[] }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const requestId = useRef(0);

  const load = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    const id = ++requestId.current;
    const isStale = () => id !== requestId.current;

    setError(null);
    try {
      const [ordersRes, txRes, pendingRolesRes, parttimerRolesRes] =
        await Promise.all([
          supabase
            .from("orders")
            .select("*")
            .order("created_at", { ascending: false }),
          supabase
            .from("transactions")
            .select("*")
            .order("created_at", { ascending: false }),
          supabase
            .from("user_roles")
            .select("user_id, name")
            .eq("role", "pending_parttimer"),
          supabase
            .from("user_roles")
            .select("user_id, name")
            .eq("role", "parttimer"),
        ]);

      if (isStale()) return;

      const orderRows = ordersRes.data ?? [];
      setOrders(orderRows);
      setTransactions(txRes.data ?? []);

      const pendingRows = pendingRolesRes.data ?? [];
      const partTimerRows = parttimerRolesRes.data ?? [];

      const relevantUserIds = new Set<string>();
      for (const o of orderRows) {
        relevantUserIds.add(o.user_id);
        if (o.assigned_to) relevantUserIds.add(o.assigned_to);
      }
      for (const t of txRes.data ?? []) {
        if (t.assigned_to) relevantUserIds.add(t.assigned_to);
      }
      for (const r of pendingRows) relevantUserIds.add(r.user_id);
      for (const r of partTimerRows) relevantUserIds.add(r.user_id);

      const [profilesRes, allowedRes] = await Promise.all([
        relevantUserIds.size > 0
          ? supabase
              .from("profiles")
              .select("*")
              .in("user_id", [...relevantUserIds])
          : Promise.resolve({ data: [] as Profile[] }),
        partTimerRows.length > 0
          ? supabase
              .from("parttimer_allowed_services")
              .select("parttimer_id, service_type")
              .in(
                "parttimer_id",
                partTimerRows.map((r) => r.user_id),
              )
          : Promise.resolve({
              data: [] as { parttimer_id: string; service_type: string }[],
            }),
      ]);

      if (isStale()) return;

      const profileRows = (profilesRes.data ?? []) as Profile[];
      const map = new Map(profileRows.map((p) => [p.user_id, p]));
      setProfileMap(map);

      const allowedByPartTimer = new Map<string, string[]>();
      for (const row of allowedRes.data ?? []) {
        const current = allowedByPartTimer.get(row.parttimer_id) ?? [];
        current.push(row.service_type);
        allowedByPartTimer.set(row.parttimer_id, current);
      }

      setPartTimerMeta(
        partTimerRows.map((r) => ({
          userId: r.user_id,
          name: displayName(map.get(r.user_id), r.name || "Part-timer"),
          allowedServices: allowedByPartTimer.get(r.user_id) ?? [],
        })),
      );

      setPendingPartTimers(
        pendingRows.map((r) => {
          const p = map.get(r.user_id);
          return {
            userId: r.user_id,
            name: displayName(p, r.name || "Applicant"),
            email: p?.email ?? "",
          };
        }),
      );

      // Orders, files and receipts for the whole book.
      if (orderRows.length > 0) {
        const orderIds = orderRows.map((o) => o.id);
        const [filesRes, receiptsRes, orderRatingsRes] = await Promise.all([
          supabase.from("order_files").select("*").in("order_id", orderIds),
          supabase.from("payment_receipts").select("*").in("order_id", orderIds),
          supabase.from("order_ratings").select("*").in("order_id", orderIds),
        ]);
        if (isStale()) return;
        setFiles(filesRes.data ?? []);
        setReceipts(receiptsRes.data ?? []);
        void orderRatingsRes;

        const assigneeIds = [
          ...new Set(
            orderRows
              .map((o) => o.assigned_to)
              .filter((v): v is string => !!v),
          ),
        ];
        const ratings = await fetchPartTimerRatings(assigneeIds);
        if (isStale()) return;
        setRatingMap(ratings);
      } else {
        setFiles([]);
        setReceipts([]);
        setRatingMap(new Map());
      }
    } catch (err) {
      if (isStale()) return;
      setError(
        err instanceof Error ? err.message : "Could not load the admin console.",
      );
    } finally {
      if (!isStale()) setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    setLoading(true);
    void load();
  }, [enabled, load]);

  const clients = useMemo<ClientSummary[]>(() => {
    const byClient = new Map<string, Order[]>();
    for (const order of orders) {
      const list = byClient.get(order.user_id) ?? [];
      list.push(order);
      byClient.set(order.user_id, list);
    }

    return [...byClient.entries()]
      .map(([userId, list]) => {
        const profile = profileMap.get(userId);
        const sorted = [...list].sort((a, b) =>
          b.created_at.localeCompare(a.created_at),
        );
        return {
          userId,
          name: displayName(profile, "Unknown client"),
          email: profile?.email ?? "",
          phone: profile?.phone ?? null,
          gcashNumber: profile?.gcash_number ?? null,
          gcashName: profile?.gcash_name ?? null,
          orderCount: list.length,
          activeCount: list.filter((o) => o.status !== "completed").length,
          completedCount: list.filter((o) => o.status === "completed").length,
          billedTotal: list.reduce((sum, o) => sum + Number(o.amount ?? 0), 0),
          settledTotal: list
            .filter((o) => o.payment_received)
            .reduce((sum, o) => sum + Number(o.amount ?? 0), 0),
          lastOrderAt: sorted[0]?.created_at ?? null,
        };
      })
      .sort((a, b) => (b.lastOrderAt ?? "").localeCompare(a.lastOrderAt ?? ""));
  }, [orders, profileMap]);

  const partTimers = useMemo<PartTimerSummary[]>(
    () =>
      partTimerMeta
        .map((meta) => {
          const mine = orders.filter((o) => o.assigned_to === meta.userId);
          const profile = profileMap.get(meta.userId);
          return {
            userId: meta.userId,
            name: meta.name,
            email: profile?.email ?? "",
            gcashNumber: profile?.gcash_number ?? null,
            gcashName: profile?.gcash_name ?? null,
            allowedServices: meta.allowedServices,
            activeCount: mine.filter((o) => o.status === "in_progress").length,
            completedCount: mine.filter((o) => o.status === "completed").length,
            rating: ratingMap.get(meta.userId) ?? null,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
    [partTimerMeta, orders, profileMap, ratingMap],
  );

  const activity = useMemo(
    () => buildActivity({ orders, files, receipts, ratings: [], transactions }),
    [orders, files, receipts, transactions],
  );

  const nameFor = useCallback(
    (userId: string | null | undefined) =>
      userId ? displayName(profileMap.get(userId), "Unknown") : "Unassigned",
    [profileMap],
  );

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

  const setPartTimerServicesLocally = useCallback(
    (userId: string, services: string[]) => {
      setPartTimerMeta((prev) =>
        prev.map((p) =>
          p.userId === userId ? { ...p, allowedServices: services } : p,
        ),
      );
    },
    [],
  );

  const removePartTimerLocally = useCallback((userId: string) => {
    setPartTimerMeta((prev) => prev.filter((p) => p.userId !== userId));
    // Their in-progress work returns to the queue, exactly as the RPC does.
    setOrders((prev) =>
      prev.map((o) =>
        o.assigned_to === userId && o.status === "in_progress"
          ? { ...o, assigned_to: null, status: "pending" }
          : o,
      ),
    );
  }, []);

  const removePendingPartTimerLocally = useCallback((userId: string) => {
    setPendingPartTimers((prev) => prev.filter((p) => p.userId !== userId));
  }, []);

  const setTransactionLocally = useCallback(
    (transactionId: string, patch: Partial<Transaction>) => {
      setTransactions((prev) =>
        prev.map((t) => (t.id === transactionId ? { ...t, ...patch } : t)),
      );
    },
    [],
  );

  const addTransactionLocally = useCallback((transaction: Transaction) => {
    setTransactions((prev) => [transaction, ...prev]);
  }, []);

  const value = useMemo<AdminData>(
    () => ({
      orders,
      files,
      receipts,
      transactions,
      profiles: profileMap,
      ratings: ratingMap,
      clients,
      partTimers,
      pendingPartTimers,
      activity,
      loading,
      error,
      refresh,
      nameFor,
      setOrderLocally,
      setPartTimerServicesLocally,
      removePartTimerLocally,
      removePendingPartTimerLocally,
      setTransactionLocally,
      addTransactionLocally,
    }),
    [
      orders,
      files,
      receipts,
      transactions,
      profileMap,
      ratingMap,
      clients,
      partTimers,
      pendingPartTimers,
      activity,
      loading,
      error,
      refresh,
      nameFor,
      setOrderLocally,
      setPartTimerServicesLocally,
      removePartTimerLocally,
      removePendingPartTimerLocally,
      setTransactionLocally,
      addTransactionLocally,
    ],
  );

  return (
    <AdminDataContext.Provider value={value}>
      {children}
    </AdminDataContext.Provider>
  );
}

export function useAdminData() {
  const context = useContext(AdminDataContext);
  if (!context) {
    throw new Error("useAdminData must be used within AdminDataProvider");
  }
  return context;
}
