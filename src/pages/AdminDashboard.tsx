import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext";
import {
  db,
  collection,
  getDocs,
  doc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  addDoc,
  serverTimestamp,
  handleFirestoreError,
  limit,
  startAfter,
  increment,
} from "../firebase";
import { StreamSession, UserProfile, OperationType } from "../types";
import {
  Shield,
  Users,
  Video,
  Trash2,
  UserCog,
  AlertTriangle,
  Newspaper,
  Plus,
  Save,
  ExternalLink,
  CheckCircle2,
  Settings as SettingsIcon,
  Wifi,
  Bell,
  ChevronLeft,
  ChevronRight,
  Coins,
  Gift,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Modal from "../components/Modal";

import ImageUpload from "../components/ImageUpload";

import Toast from "../components/Toast";

const AdminDashboard = () => {
  const { user } = useAuth();
  const [streams, setStreams] = useState<StreamSession[]>([]);
  const [totalStreams, setTotalStreams] = useState(0);
  const [streamsPage, setStreamsPage] = useState(1);
  const [lastVisibleDoc, setLastVisibleDoc] = useState<any>(null);
  const [firstVisibleDoc, setFirstVisibleDoc] = useState<any>(null);
  const [hasNextPage, setHasNextPage] = useState(true);
  const STREAMS_PER_PAGE = 8;
  const [pageHistory, setPageHistory] = useState<any[]>([null]); // Stores starting cursors

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [news, setNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "streams" | "users" | "news" | "alerts"
  >("streams");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    confirmVariant?: "danger" | "primary";
  } | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
    isVisible: boolean;
  }>({
    message: "",
    type: "success",
    isVisible: false,
  });

  const showConfirm = (config: any) => {
    setModalConfig(config);
    setIsModalOpen(true);
  };

  // News form state
  const [newsTitle, setNewsTitle] = useState("");
  const [newsContent, setNewsContent] = useState("");
  const [newsImage, setNewsImage] = useState("");
  const [savingNews, setSavingNews] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Alerts state
  const [alerts, setAlerts] = useState<any[]>([]);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [alertLink, setAlertLink] = useState("");
  const [savingAlert, setSavingAlert] = useState(false);

  // Coin gifting state
  const [selectedUserForGifting, setSelectedUserForGifting] = useState<UserProfile | null>(null);
  const [giftCoinsAmount, setGiftCoinsAmount] = useState<string>("100");
  const [giftingCoinsLoading, setGiftingCoinsLoading] = useState(false);

  const [testingLiveKit, setTestingLiveKit] = useState(false);
  const [liveKitStatus, setLiveKitStatus] = useState<{
    type: "success" | "error";
    message: string;
    debug?: any;
    hint?: string;
  } | null>(null);

  useEffect(() => {
    if (!user || user.role !== "admin") return;

    // Separate effect for streams with pagination
    let streamsQuery = query(
      collection(db, "streams"),
      orderBy("startedAt", "desc"),
      limit(STREAMS_PER_PAGE + 1),
    );

    // Apply cursor if we are not on the first page
    const currentCursor = pageHistory[streamsPage - 1];
    if (currentCursor) {
      streamsQuery = query(
        collection(db, "streams"),
        orderBy("startedAt", "desc"),
        startAfter(currentCursor),
        limit(STREAMS_PER_PAGE + 1),
      );
    }

    const unsubscribeStreams = onSnapshot(
      streamsQuery,
      (snapshot) => {
        const docs = snapshot.docs;
        const hasMore = docs.length > STREAMS_PER_PAGE;
        const visibleDocs = hasMore ? docs.slice(0, STREAMS_PER_PAGE) : docs;

        setStreams(
          visibleDocs.map(
            (doc) => ({ id: doc.id, ...doc.data() }) as StreamSession,
          ),
        );
        setHasNextPage(hasMore);

        // Store the last doc of the current PAGE for next button
        if (visibleDocs.length > 0) {
          setLastVisibleDoc(visibleDocs[visibleDocs.length - 1]);
        }
      },
      (error) => {
        console.error("Firestore Error (streams):", error);
        setToast({
          message: "Error cargando transmisiones",
          type: "error",
          isVisible: true,
        });
      },
    );

    // Fetch total count for stats (Note: if volume is huge, use a counter doc or count())
    getDocs(collection(db, "streams")).then((snap) => {
      setTotalStreams(snap.size);
    });

    // Fetch all users
    const unsubscribeUsers = onSnapshot(
      collection(db, "users"),
      (snapshot) => {
        setUsers(
          snapshot.docs.map(
            (doc) => ({ uid: doc.id, ...doc.data() }) as UserProfile,
          ),
        );
      },
      (error) => {
        console.error("Firestore Error (users):", error);
      },
    );

    // Fetch all news
    const newsQuery = query(
      collection(db, "news"),
      orderBy("createdAt", "desc"),
    );
    const unsubscribeNews = onSnapshot(
      newsQuery,
      (snapshot) => {
        setNews(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      },
      (error) => {
        console.error("Firestore Error (news):", error);
      },
    );

    // Fetch all alerts
    const alertsQuery = query(
      collection(db, "alerts"),
      orderBy("createdAt", "desc"),
    );
    const unsubscribeAlerts = onSnapshot(
      alertsQuery,
      (snapshot) => {
        setAlerts(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      },
      (error) => {
        console.error("Firestore Error (alerts):", error);
        setLoading(false);
      },
    );

    return () => {
      unsubscribeStreams();
      unsubscribeUsers();
      unsubscribeNews();
      unsubscribeAlerts();
    };
  }, [user, streamsPage, pageHistory]);

  const handleNextPage = () => {
    if (!hasNextPage || !lastVisibleDoc) return;
    setPageHistory((prev) => {
      const next = [...prev];
      next[streamsPage] = lastVisibleDoc;
      return next;
    });
    setStreamsPage((p) => p + 1);
  };

  const handlePrevPage = () => {
    if (streamsPage === 1) return;
    setStreamsPage((p) => p - 1);
  };

  const handleCreateNews = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newsTitle || !newsContent) return;

    showConfirm({
      title: "¿Publicar noticia?",
      message:
        "¿Estás seguro de que deseas publicar esta noticia? Será visible para todos los usuarios.",
      confirmText: "Publicar",
      confirmVariant: "primary",
      onConfirm: async () => {
        setSavingNews(true);
        try {
          await addDoc(collection(db, "news"), {
            title: newsTitle,
            content: newsContent,
            imageUrl: newsImage,
            authorId: user.uid,
            authorName: user.displayName,
            createdAt: serverTimestamp(),
          });
          setNewsTitle("");
          setNewsContent("");
          setNewsImage("");
          setToast({
            message: "Noticia publicada con éxito",
            type: "success",
            isVisible: true,
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, "news");
        } finally {
          setSavingNews(false);
        }
      },
    });
  };

  const handleDeleteNews = (newsId: string) => {
    showConfirm({
      title: "¿Eliminar noticia?",
      message:
        "Esta acción no se puede deshacer. La noticia será eliminada permanentemente.",
      confirmText: "Eliminar",
      confirmVariant: "danger",
      onConfirm: async () => {
        try {
          const newsItem = news.find((n) => n.id === newsId);
          await deleteDoc(doc(db, "news", newsId));

          // Local uploads will expire naturally
          setToast({
            message: "Noticia eliminada",
            type: "success",
            isVisible: true,
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `news/${newsId}`);
        }
      },
    });
  };

  const handleDeleteStream = (streamId: string) => {
    showConfirm({
      title: "¿Eliminar transmisión?",
      message:
        "¿Estás seguro de que deseas eliminar el registro de esta transmisión?",
      confirmText: "Eliminar",
      confirmVariant: "danger",
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, "streams", streamId));
          setToast({
            message: "Transmisión eliminada",
            type: "success",
            isVisible: true,
          });
        } catch (error) {
          handleFirestoreError(
            error,
            OperationType.DELETE,
            `streams/${streamId}`,
          );
        }
      },
    });
  };

  const toggleUserRole = (targetUser: UserProfile) => {
    const newRole = targetUser.role === "admin" ? "user" : "admin";
    showConfirm({
      title: "Cambiar rol de usuario",
      message: `¿Estás seguro de cambiar el rol de ${targetUser.displayName} a ${newRole}?`,
      confirmText: "Cambiar Rol",
      onConfirm: async () => {
        try {
          await updateDoc(doc(db, "users", targetUser.uid), {
            role: newRole,
          });
          setToast({
            message: `Rol actualizado a ${newRole}`,
            type: "success",
            isVisible: true,
          });
        } catch (error) {
          handleFirestoreError(
            error,
            OperationType.UPDATE,
            `users/${targetUser.uid}`,
          );
        }
      },
    });
  };

  const handleGiftCoins = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForGifting) return;
    const amount = parseInt(giftCoinsAmount);
    if (isNaN(amount) || amount <= 0) {
      setToast({
        message: "Por favor, ingresa una cantidad válida de monedas.",
        type: "error",
        isVisible: true,
      });
      return;
    }

    setGiftingCoinsLoading(true);
    try {
      await updateDoc(doc(db, "users", selectedUserForGifting.uid), {
        coins: increment(amount),
      });

      // Send them a system notification inside Ayuuk to celebrate!
      try {
        await addDoc(collection(db, "notifications"), {
          recipientId: selectedUserForGifting.uid,
          senderId: "system",
          senderName: "Sistema Ayuuk",
          senderPhoto: `https://api.dicebear.com/7.x/identicon/svg?seed=system`,
          type: "system",
          title: "¡Has recibido Monedas!",
          description: `El administrador te ha regalado ${amount} Monedas Ayuuk (M.A.). ¡Disfrútalas!`,
          link: "",
          read: false,
          createdAt: serverTimestamp()
        });
      } catch (notifErr) {
        console.error("Could not send system notification for gifted coins:", notifErr);
      }

      setToast({
        message: `¡Se han regalado ${amount} monedas a ${selectedUserForGifting.displayName} con éxito!`,
        type: "success",
        isVisible: true,
      });
      setSelectedUserForGifting(null);
    } catch (error) {
      console.error("Error gifting coins:", error);
      setToast({
        message: "Error al regalar monedas",
        type: "error",
        isVisible: true,
      });
    } finally {
      setGiftingCoinsLoading(false);
    }
  };

  const handleCreateAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !alertTitle || !alertMessage) return;

    setSavingAlert(true);
    try {
      await addDoc(collection(db, "alerts"), {
        title: alertTitle,
        message: alertMessage,
        link: alertLink,
        active: true,
        createdAt: serverTimestamp(),
      });
      setAlertTitle("");
      setAlertMessage("");
      setAlertLink("");
      setToast({
        message: "Alerta enviada a todos los usuarios",
        type: "success",
        isVisible: true,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "alerts");
    } finally {
      setSavingAlert(false);
    }
  };

  const toggleAlertStatus = async (alertId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, "alerts", alertId), {
        active: !currentStatus,
      });
      setToast({
        message: `Alerta ${!currentStatus ? "activada" : "desactivada"}`,
        type: "success",
        isVisible: true,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `alerts/${alertId}`);
    }
  };

  const handleDeleteAlert = (alertId: string) => {
    showConfirm({
      title: "¿Eliminar alerta?",
      message: "Esta alerta se eliminará permanentemente de los registros.",
      confirmText: "Eliminar",
      confirmVariant: "danger",
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, "alerts", alertId));
          setToast({
            message: "Alerta eliminada",
            type: "success",
            isVisible: true,
          });
        } catch (error) {
          handleFirestoreError(
            error,
            OperationType.DELETE,
            `alerts/${alertId}`,
          );
        }
      },
    });
  };

  const formatDuration = (start: any, end: any) => {
    if (!start) return "--:--";

    const startTime = start.toDate
      ? start.toDate().getTime()
      : typeof start === "number"
        ? start
        : new Date(start).getTime();
    const endTime = end
      ? end.toDate
        ? end.toDate().getTime()
        : typeof end === "number"
          ? end
          : new Date(end).getTime()
      : Date.now();

    const diffMs = Math.max(0, endTime - startTime);
    const totalSeconds = Math.floor(diffMs / 1000);

    const seconds = totalSeconds % 60;
    const totalMinutes = Math.floor(totalSeconds / 60);
    const minutes = totalMinutes % 60;
    const hours = Math.floor(totalMinutes / 60);

    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  };

  const testLiveKit = async () => {
    setTestingLiveKit(true);
    setLiveKitStatus(null);
    try {
      const res = await fetch("/api/livekit/test");
      const contentType = res.headers.get("content-type");

      if (!res.ok) {
        if (contentType && contentType.includes("application/json")) {
          const data = await res.json();
          setLiveKitStatus({
            type: "error",
            message: data.message || "Error del servidor",
            debug: data.debug,
            hint: data.hint,
          });
          return;
        }
        throw new Error(`Servidor respondió con status: ${res.status}`);
      }

      if (!contentType || !contentType.includes("application/json")) {
        const text = await res.text();
        throw new Error(
          `Respuesta no válida (esperado JSON, recibido HTML/Texto). Verifica la ruta de la API.`,
        );
      }

      const data = await res.json();
      if (data.status === "ok") {
        setLiveKitStatus({
          type: "success",
          message:
            data.message ||
            "¡Conexión exitosa! Tus credenciales de LiveKit son correctas.",
          debug: data.debug,
        });
      } else {
        setLiveKitStatus({
          type: "error",
          message: data.message || "Credenciales inválidas",
          debug: data.debug,
          hint: data.hint,
        });
      }
    } catch (err) {
      setLiveKitStatus({
        type: "error",
        message:
          err instanceof Error
            ? err.message
            : "No se pudo contactar con el servidor de prueba.",
      });
    } finally {
      setTestingLiveKit(false);
    }
  };

  if (user?.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <AlertTriangle className="w-16 h-16 text-yellow-500" />
        <h1 className="text-2xl font-bold uppercase italic">Acceso Denegado</h1>
        <p className="text-black/50 italic">
          No tienes permisos para ver esta página.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-12 relative">
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={modalConfig?.title || ""}
        onConfirm={modalConfig?.onConfirm}
        confirmText={modalConfig?.confirmText}
        confirmVariant={modalConfig?.confirmVariant}
      >
        <p className="text-black/60 italic">{modalConfig?.message}</p>
      </Modal>

      <Modal
        isOpen={!!selectedUserForGifting}
        onClose={() => setSelectedUserForGifting(null)}
        title="Regalar Monedas Ayuuk"
      >
        {selectedUserForGifting && (
          <form onSubmit={handleGiftCoins} className="space-y-6">
            <div className="flex items-center gap-4 bg-white/[0.03] p-4 rounded-2xl border border-white/[0.05]">
              <div className="w-14 h-14 rounded-xl bg-black/40 p-0.5 border border-white/10 shrink-0">
                <img
                  src={
                    selectedUserForGifting.photoURL ||
                    `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedUserForGifting.uid}`
                  }
                  className="w-full h-full rounded-[0.5rem] bg-[#f5f5f0]"
                  alt="avatar"
                />
              </div>
              <div className="space-y-0.5 min-w-0">
                <p className="font-display font-bold text-lg text-white leading-tight truncate">
                  {selectedUserForGifting.displayName}
                </p>
                <p className="text-xs text-white/50 truncate">
                  {selectedUserForGifting.email}
                </p>
                <div className="flex items-center gap-1 text-[10px] font-mono font-semibold text-brand tracking-wider mt-1">
                  <Coins className="w-3.5 h-3.5 fill-current shrink-0" />
                  <span>SALDO ACTUAL: {selectedUserForGifting.coins ?? 0} M.A.</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/60 ml-1 block">
                Cantidad a regalar
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  placeholder="Cantidad de monedas"
                  value={giftCoinsAmount}
                  onChange={(e) => setGiftCoinsAmount(e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/10 text-white rounded-xl py-4 pl-12 pr-6 text-sm font-semibold focus:border-brand focus:bg-white/[0.05] transition-all outline-none"
                  required
                />
                <Coins className="w-4 h-4 text-brand fill-current absolute left-4 top-1/2 -locate-y-1/2 -translate-y-1/2" />
              </div>
            </div>

            {/* Quick Gifting Packages Shortcut Buttons */}
            <div className="grid grid-cols-4 gap-3">
              {["100", "500", "1000", "5000"].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setGiftCoinsAmount(preset)}
                  className={`py-2 px-3 rounded-lg text-xs font-bold font-mono border transition-all ${
                    giftCoinsAmount === preset
                      ? "bg-brand text-white border-brand shadow-sm shadow-brand/40"
                      : "bg-white/[0.02] text-white/60 border-white/10 hover:bg-white/[0.05] hover:text-white"
                  }`}
                >
                  +{preset}
                </button>
              ))}
            </div>

            <div className="pt-4 flex gap-4">
              <button
                type="button"
                onClick={() => setSelectedUserForGifting(null)}
                className="flex-1 px-6 py-4 rounded-xl bg-white/[0.05] hover:bg-white/10 text-white font-bold transition-all text-sm uppercase tracking-wider"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={giftingCoinsLoading || !giftCoinsAmount}
                className="flex-1 bg-brand hover:bg-brand/90 text-white px-6 py-4 rounded-xl font-bold uppercase tracking-wider text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-brand/20 disabled:opacity-50 active:scale-95"
              >
                {giftingCoinsLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Gift className="w-5 h-5 z-10" />
                )}
                <span>Regalar</span>
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={() => setToast({ ...toast, isVisible: false })}
      />

      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-brand">
            <Shield className="w-5 h-5" />
            <span className="text-xs font-semibold uppercase tracking-[0.15em]">
              Administración
            </span>
          </div>
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-black flex items-center gap-4">
              <span>Panel de Control</span>
            </h1>

            <button
              onClick={testLiveKit}
              disabled={testingLiveKit}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold uppercase tracking-wider text-[10px] transition-all border shrink-0 ${
                testingLiveKit
                  ? "opacity-50 cursor-not-allowed border-black/[0.04] bg-black/[0.02]"
                  : "bg-brand text-white hover:opacity-90 border-transparent shadow-md shadow-brand/20 active:scale-95"
              }`}
            >
              {testingLiveKit ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{
                      repeat: Infinity,
                      duration: 1,
                      ease: "linear",
                    }}
                    className="w-3 h-3 border-2 border-brand border-t-transparent rounded-full"
                  />
                  <span>Verificando...</span>
                </>
              ) : (
                <>
                  <Wifi className="w-4 h-4" />
                  <span>Probar LiveKit</span>
                </>
              )}
            </button>
          </div>
          <p className="text-black/50 text-sm font-medium italic max-w-md">
            <span>
              Gestiona usuarios, transmisiones y el contenido de noticias de la
              plataforma.
            </span>
          </p>

          {liveKitStatus && (
            <div className="space-y-4 max-w-2xl">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className={`p-4 rounded-xl border ${
                  liveKitStatus.type === "success"
                    ? "bg-green-500/10 border-green-500/20 text-green-500"
                    : "bg-rose-500/10 border-rose-500/20 text-rose-500"
                } flex items-center gap-3 font-mono text-[10px] uppercase tracking-wider font-bold`}
              >
                {liveKitStatus.type === "success" ? (
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                ) : (
                  <AlertTriangle className="w-4 h-4" />
                )}
                {liveKitStatus.message}
              </motion.div>

              {liveKitStatus.debug && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-black/40 border border-black/5 rounded-xl p-4 font-mono text-[9px] text-black/50 space-y-2"
                >
                  <p className="text-black/60 font-bold mb-2 uppercase tracking-widest">
                    Información de Depuración:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p>
                        URL Detectada:{" "}
                        <span
                          className={
                            liveKitStatus.debug.urlFound
                              ? "text-green-500"
                              : "text-rose-500"
                          }
                        >
                          {liveKitStatus.debug.urlFound ? "SÍ" : "NO"}
                        </span>
                      </p>
                      <p>
                        API Key Detectada:{" "}
                        <span
                          className={
                            liveKitStatus.debug.keyFound
                              ? "text-green-500"
                              : "text-rose-500"
                          }
                        >
                          {liveKitStatus.debug.keyFound ? "SÍ" : "NO"}
                        </span>
                      </p>
                      <p>
                        Secret Detectado:{" "}
                        <span
                          className={
                            liveKitStatus.debug.secretFound
                              ? "text-green-500"
                              : "text-rose-500"
                          }
                        >
                          {liveKitStatus.debug.secretFound ? "SÍ" : "NO"}
                        </span>
                      </p>
                    </div>
                    <div className="space-y-1 text-right sm:text-left">
                      <p>
                        Host:{" "}
                        <span className="text-black/60 truncate max-w-[120px] inline-block align-bottom">
                          {liveKitStatus.debug.url}
                        </span>
                      </p>
                      <p>
                        Clave:{" "}
                        <span className="text-black/60">
                          {liveKitStatus.debug.keyPrefix}...
                          {liveKitStatus.debug.keySuffix}
                        </span>
                      </p>
                      <p>
                        Longitud:{" "}
                        <span className="text-black/60">
                          {liveKitStatus.debug.keyLength} /{" "}
                          {liveKitStatus.debug.secretLength} ch
                        </span>
                      </p>
                    </div>
                  </div>

                  {liveKitStatus.type === "error" && (
                    <div className="mt-4 pt-4 border-t border-black/5 space-y-2">
                      <p className="text-brand font-bold uppercase">
                        Sugerencia:
                      </p>
                      <p className="text-black/80 italic">
                        {liveKitStatus.hint ||
                          "Revisa tus credenciales en el panel de Secrets."}
                      </p>
                      <ul className="list-disc list-inside space-y-1 text-black/50 text-[9px] mt-2">
                        {liveKitStatus.debug.keyLength > 0 &&
                          !liveKitStatus.debug.keyPrefix?.startsWith("API") &&
                          liveKitStatus.debug.isCloud && (
                            <li>
                              Tu API Key no empieza por 'API'. Copia la 'API
                              Key' de LiveKit Cloud (en Settings {">"} Keys), no
                              el 'Project ID'.
                            </li>
                          )}
                        {liveKitStatus.debug.secretLength < 10 &&
                          liveKitStatus.debug.secretFound && (
                            <li>Tu Secret parece demasiado corto.</li>
                          )}
                        <li>
                          Verifica que no haya espacios extras en el panel de
                          Secrets.
                        </li>
                      </ul>
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          )}
        </div>

        <div className="flex bg-black/[0.02] p-1.5 rounded-xl border-black/[0.04] shadow-lg shadow-black/[0.03] overflow-x-auto custom-scrollbar">
          {(["streams", "users", "news", "alerts"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-2.5 rounded-[10px] text-[10px] font-semibold uppercase tracking-wider transition-all duration-300 shrink-0 ${
                activeTab === tab
                  ? "bg-white text-black shadow-sm"
                  : "text-black/50 hover:text-black hover:bg-white/50"
              }`}
            >
              {tab === "streams"
                ? "Transmisiones"
                : tab === "users"
                  ? "Usuarios"
                  : tab === "news"
                    ? "Noticias"
                    : "Alertas"}
            </button>
          ))}
          <Link
            to="/settings"
            className="px-6 py-2.5 rounded-[10px] text-[10px] font-semibold uppercase tracking-wider text-black/50 hover:text-black hover:bg-white/50 transition-all duration-300 flex items-center gap-2 shrink-0"
          >
            <SettingsIcon className="w-4 h-4" /> Ajustes
          </Link>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
          {
            label: "Total Usuarios",
            value: users.length,
            icon: Users,
            color: "text-blue-500",
          },
          {
            label: "Total Streams",
            value: totalStreams,
            icon: Video,
            color: "text-purple-500",
          },
          {
            label: "Streams Activos",
            value: streams.filter((s) => s.status === "live").length,
            icon: Video,
            color: "text-rose-500",
            live: true,
          },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, duration: 0.8 }}
            className="bg-white rounded-3xl p-8 flex items-center justify-between group border border-black/[0.04] shadow-sm hover:bg-black/[0.02] transition-all duration-500 shadow-lg shadow-black/[0.03]"
          >
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-black/50">
                {stat.label}
              </p>
              <p
                className={`text-5xl font-display font-bold tracking-tighter ${stat.live ? "text-rose-500" : "text-black"}`}
              >
                {stat.value}
              </p>
            </div>
            <div
              className={`w-16 h-16 rounded-xl bg-black/[0.02] flex items-center justify-center group-hover:scale-110 transition-transform duration-500  ${stat.live ? "animate-pulse" : ""}`}
            >
              <stat.icon
                className={`w-8 h-8 ${stat.color} opacity-40 group-hover:opacity-100 transition-opacity`}
              />
            </div>
          </motion.div>
        ))}
      </div>

      {loading ? (
        <div className="py-32 flex flex-col items-center justify-center gap-6 bg-white rounded-3xl border border-black/[0.04] shadow-sm">
          <div className="w-16 h-16 border-4 border-brand/20 border-t-[#ff4e00] rounded-full animate-spin" />
          <p className="text-black/50 font-display text-xl italic">
            <span>Cargando datos del panel...</span>
          </p>
        </div>
      ) : (
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white rounded-3xl overflow-hidden border border-black/[0.04] shadow-sm"
        >
          {activeTab === "streams" ? (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-black/[0.04] bg-black/[0.02]">
                    <th className="p-8 text-[10px] font-semibold uppercase tracking-[0.15em] text-black/50">
                      Stream
                    </th>
                    <th className="p-8 text-[10px] font-semibold uppercase tracking-[0.15em] text-black/50">
                      Streamer
                    </th>
                    <th className="p-8 text-[10px] font-semibold uppercase tracking-[0.15em] text-black/50">
                      Estado
                    </th>
                    <th className="p-8 text-[10px] font-semibold uppercase tracking-[0.15em] text-black/50">
                      Duración
                    </th>
                    <th className="p-8 text-[10px] font-semibold uppercase tracking-[0.15em] text-black/50">
                      Espectadores
                    </th>
                    <th className="p-8 text-[10px] font-semibold uppercase tracking-[0.15em] text-black/50">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04]">
                  {streams.map((s) => (
                    <tr
                      key={s.id}
                      className="hover:bg-black/[0.02] transition-colors group"
                    >
                      <td className="p-8">
                        <div className="flex items-center gap-5">
                          <div className="w-14 h-14 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center ">
                            <Video className="w-7 h-7 text-brand" />
                          </div>
                          <div className="space-y-1">
                            <p className="font-display font-bold text-lg leading-none">
                              {s.title}
                            </p>
                            <p className="text-[10px] text-black/30 font-semibold uppercase tracking-wider">
                              {s.id}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-8">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-black/[0.02] p-0.5 border border-black/[0.04]">
                            <img
                              src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${s.userId}`}
                              className="w-full h-full rounded-[0.5rem] bg-[#f5f5f0]"
                              alt="avatar"
                            />
                          </div>
                          <span className="text-sm font-bold text-black/60">
                            {s.userName}
                          </span>
                        </div>
                      </td>
                      <td className="p-8">
                        <div
                          className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                            s.status === "live"
                              ? "bg-rose-500/10 text-rose-500"
                              : "bg-black/[0.02] text-black/30"
                          }`}
                        >
                          {s.status === "live" && (
                            <div className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse" />
                          )}
                          <span>
                            {s.status === "live" ? "En Vivo" : "Finalizado"}
                          </span>
                        </div>
                      </td>
                      <td className="p-8">
                        <div className="text-sm font-mono font-bold text-black/50">
                          {formatDuration(s.startedAt, s.endedAt)}
                        </div>
                      </td>
                      <td className="p-8">
                        <div className="flex items-center gap-2 text-sm font-mono font-bold text-black/50">
                          <Users className="w-4 h-4 text-brand" />
                          <span>{s.viewerCount}</span>
                        </div>
                      </td>
                      <td className="p-8">
                        <button
                          onClick={() => handleDeleteStream(s.id)}
                          className="p-3 bg-rose-500/5 hover:bg-rose-500 hover:text-white text-rose-500 rounded-xl transition-all duration-300"
                          title="Eliminar registro"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination Controls */}
              <div className="p-8 border-t border-black/5 flex items-center justify-between bg-black/[0.02]">
                <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-black/30 italic">
                  Página <span className="text-black/60">{streamsPage}</span> de{" "}
                  {Math.ceil(totalStreams / STREAMS_PER_PAGE) || 1}
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={handlePrevPage}
                    disabled={streamsPage === 1}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold uppercase tracking-wider text-[10px] transition-all border border-black/[0.04] bg-black/[0.02] hover:bg-black/[0.06] text-black/50 hover:text-black disabled:opacity-20 active:scale-95"
                  >
                    <ChevronLeft className="w-3 h-3" />
                    <span>Anterior</span>
                  </button>
                  <button
                    onClick={handleNextPage}
                    disabled={!hasNextPage}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold uppercase tracking-wider text-[10px] transition-all border border-black/[0.04] bg-black/[0.02] hover:bg-black/[0.06] text-black/50 hover:text-black disabled:opacity-20 active:scale-95"
                  >
                    <span>Siguiente</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ) : activeTab === "alerts" ? (
            <div className="p-10 lg:p-16 space-y-16">
              <form
                onSubmit={handleCreateAlert}
                className="space-y-10 bg-white p-10 rounded-3xl border border-black/[0.04] shadow-sm"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-rose-500/10 rounded-xl flex items-center justify-center">
                    <Bell className="w-6 h-6 text-rose-500 animate-pulse" />
                  </div>
                  <h3 className="text-2xl font-display font-bold uppercase italic">
                    Enviar Nueva Alerta Global
                  </h3>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  <div className="space-y-8">
                    <div className="space-y-3">
                      <label className="text-[10px] font-semibold uppercase tracking-[0.15em] text-black/50 ml-1">
                        Título de la alerta
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: Transmisión especial en 10 min o Mantenimiento"
                        value={alertTitle}
                        onChange={(e) => setAlertTitle(e.target.value)}
                        className="w-full bg-black/[0.02] border border-black/[0.04] rounded-xl py-4 px-6 text-sm font-medium focus:border-brand focus:bg-black/[0.06] transition-all outline-none"
                        required
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-semibold uppercase tracking-[0.15em] text-black/50 ml-1">
                        Mensaje
                      </label>
                      <textarea
                        placeholder="Escribe el mensaje que verán todos los usuarios..."
                        value={alertMessage}
                        onChange={(e) => setAlertMessage(e.target.value)}
                        className="w-full bg-black/[0.02] border border-black/[0.04] rounded-xl py-4 px-6 text-sm font-medium focus:border-brand focus:bg-black/[0.06] transition-all outline-none min-h-[120px] resize-none leading-relaxed"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-8">
                    <div className="space-y-3">
                      <label className="text-[10px] font-semibold uppercase tracking-[0.15em] text-black/50 ml-1">
                        Enlace opcional (Ruta interna)
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: /news o /stream/ID"
                        value={alertLink}
                        onChange={(e) => setAlertLink(e.target.value)}
                        className="w-full bg-black/[0.02] border border-black/[0.04] rounded-xl py-4 px-6 text-sm font-medium focus:border-brand focus:bg-black/[0.06] transition-all outline-none"
                      />
                    </div>

                    <div className="pt-4">
                      <button
                        type="submit"
                        disabled={savingAlert}
                        className="w-full bg-rose-500 text-white px-10 py-5 rounded-xl font-semibold uppercase tracking-wider flex items-center justify-center gap-4 hover:bg-red-700 transition-all duration-500 shadow-lg shadow-black/[0.03] shadow-black/[0.04] shadow-red-600/20 disabled:opacity-50 active:scale-95"
                      >
                        {savingAlert ? (
                          <div className="w-5 h-5 border-2 border-black/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <Bell className="w-5 h-5" />
                        )}
                        <span>Emitir Alerta Global</span>
                      </button>
                    </div>
                  </div>
                </div>
              </form>

              <div className="space-y-10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-black/[0.02] rounded-xl flex items-center justify-center">
                    <Bell className="w-6 h-6 text-black/30" />
                  </div>
                  <h3 className="text-2xl font-display font-bold uppercase italic">
                    Historial de Alertas
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {alerts.map((a) => (
                    <div
                      key={a.id}
                      className={`flex items-center justify-between p-6 bg-white rounded-2xl border border-black/[0.04] shadow-sm group transition-all duration-500 shadow-lg shadow-black/[0.03] ${a.active ? "border-rose-500/20" : "opacity-60"}`}
                    >
                      <div className="flex items-center gap-6 overflow-hidden">
                        <div
                          className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${a.active ? "bg-rose-500/10 text-rose-500" : "bg-black/[0.06] text-black/30"}`}
                        >
                          <Bell
                            className={`w-6 h-6 ${a.active ? "animate-pulse" : ""}`}
                          />
                        </div>
                        <div className="space-y-1 min-w-0">
                          <p className="font-display font-bold text-lg leading-tight truncate group-hover:text-brand transition-colors">
                            {a.title}
                          </p>
                          <p className="text-[10px] text-black/30 font-semibold uppercase tracking-wider truncate">
                            {a.message}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleAlertStatus(a.id, a.active)}
                          className={`p-3 rounded-xl transition-all duration-300 ${a.active ? "bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-black" : "bg-black/[0.02] text-black/30 hover:bg-black/[0.06] hover:text-black"}`}
                          title={a.active ? "Desactivar" : "Activar"}
                        >
                          <CheckCircle2 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDeleteAlert(a.id)}
                          className="p-3 bg-rose-500/5 hover:bg-rose-500 hover:text-white text-rose-500 rounded-xl transition-all duration-300"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {alerts.length === 0 && (
                    <div className="col-span-full py-24 text-center bg-white rounded-3xl border border-dashed border-black/[0.08] shadow-sm flex flex-col items-center justify-center gap-6">
                      <div className="w-20 h-20 bg-black/[0.02] rounded-full flex items-center justify-center">
                        <Bell className="w-10 h-10 text-black/10" />
                      </div>
                      <div className="space-y-2">
                        <p className="text-black/50 font-display text-2xl italic uppercase font-bold">
                          No hay alertas
                        </p>
                        <p className="text-black/30 text-sm max-w-xs mx-auto">
                          Las alertas globales que envíes aparecerán aquí para
                          que puedas gestionarlas.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : activeTab === "users" ? (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-black/[0.04] bg-black/[0.02]">
                    <th className="p-8 text-[10px] font-semibold uppercase tracking-[0.15em] text-black/50">
                      Usuario
                    </th>
                    <th className="p-8 text-[10px] font-semibold uppercase tracking-[0.15em] text-black/50">
                      Email
                    </th>
                    <th className="p-8 text-[10px] font-semibold uppercase tracking-[0.15em] text-black/50">
                      Monedas
                    </th>
                    <th className="p-8 text-[10px] font-semibold uppercase tracking-[0.15em] text-black/50">
                      Rol
                    </th>
                    <th className="p-8 text-[10px] font-semibold uppercase tracking-[0.15em] text-black/50">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04]">
                  {users.map((u) => (
                    <tr
                      key={u.uid}
                      className="hover:bg-black/[0.02] transition-colors group"
                    >
                      <td className="p-8">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-black/[0.02] p-0.5 border border-black/[0.04]">
                            <img
                              src={
                                u.photoURL ||
                                `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.uid}`
                              }
                              className="w-full h-full rounded-[0.7rem] bg-[#f5f5f0]"
                              alt="avatar"
                            />
                          </div>
                          <span className="font-display font-bold text-lg leading-none">
                            {u.displayName}
                          </span>
                        </div>
                      </td>
                      <td className="p-8 text-sm font-medium text-black/50">
                        {u.email}
                      </td>
                      <td className="p-8">
                        <div className="flex items-center gap-2 text-sm font-mono font-bold text-black/60">
                          <Coins className="w-4 h-4 text-brand fill-current animate-pulse shrink-0" />
                          <span>{u.coins ?? 0} M.A.</span>
                        </div>
                      </td>
                      <td className="p-8">
                        <div
                          className={`inline-flex px-4 py-1.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                            u.role === "admin"
                              ? "bg-brand/10 text-brand"
                              : "bg-black/[0.02] text-black/30"
                          }`}
                        >
                          {u.role}
                        </div>
                      </td>
                      <td className="p-8">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleUserRole(u)}
                            className="p-3 bg-black/[0.02] hover:bg-brand text-black/50 hover:text-white rounded-xl transition-all duration-300"
                            title="Cambiar Rol"
                          >
                            <UserCog className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedUserForGifting(u);
                              setGiftCoinsAmount("100");
                            }}
                            className="p-3 bg-brand/5 hover:bg-brand text-brand hover:text-white rounded-xl transition-all duration-300 flex items-center justify-center"
                            title="Regalar Monedas"
                          >
                            <Gift className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-10 lg:p-16 space-y-16">
              <form
                onSubmit={handleCreateNews}
                className="space-y-10 bg-white p-10 rounded-3xl border border-black/[0.04] shadow-sm"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-brand/10 rounded-xl flex items-center justify-center">
                    <Plus className="w-6 h-6 text-brand" />
                  </div>
                  <h3 className="text-2xl font-display font-bold uppercase italic">
                    Publicar Nueva Noticia
                  </h3>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  <div className="space-y-8">
                    <div className="space-y-3">
                      <label className="text-[10px] font-semibold uppercase tracking-[0.15em] text-black/50 ml-1">
                        Título de la noticia
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: Gran Festival Mixe 2026"
                        value={newsTitle}
                        onChange={(e) => setNewsTitle(e.target.value)}
                        className="w-full bg-black/[0.02] border border-black/[0.04] rounded-xl py-4 px-6 text-sm font-medium focus:border-brand focus:bg-black/[0.06] transition-all outline-none"
                        required
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-semibold uppercase tracking-[0.15em] text-black/50 ml-1">
                        Contenido
                      </label>
                      <textarea
                        placeholder="Escribe aquí el cuerpo de la noticia..."
                        value={newsContent}
                        onChange={(e) => setNewsContent(e.target.value)}
                        className="w-full bg-black/[0.02] border border-black/[0.04] rounded-xl py-4 px-6 text-sm font-medium focus:border-brand focus:bg-black/[0.06] transition-all outline-none min-h-[250px] resize-none leading-relaxed"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-8">
                    <div className="space-y-3">
                      <label className="text-[10px] font-semibold uppercase tracking-[0.15em] text-black/50 ml-1">
                        Imagen de portada
                      </label>
                      <div className="bg-black/[0.02] rounded-3xl p-6 border border-dashed border-black/[0.08]">
                        <ImageUpload
                          onUploadComplete={(url) => setNewsImage(url)}
                          onUploading={(uploading) => setIsUploadingImage(uploading)}
                          label="Selecciona una imagen de impacto"
                          folder="news"
                          currentImageUrl={newsImage}
                        />
                      </div>
                    </div>
 
                    <div className="pt-4">
                      <button
                        type="submit"
                        disabled={savingNews || isUploadingImage}
                        className="w-full bg-brand text-white px-10 py-5 rounded-xl font-semibold uppercase tracking-wider hover:opacity-90 border-transparent shadow-md flex items-center justify-center gap-4 hover:bg-brand/90 transition-all duration-500 shadow-brand/20 disabled:opacity-50 active:scale-95"
                      >
                        {savingNews ? (
                          <div className="w-5 h-5 border-2 border-black/30 border-t-white rounded-full animate-spin" />
                        ) : isUploadingImage ? (
                          <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Save className="w-5 h-5" />
                        )}
                        <span>{isUploadingImage ? 'Subiendo Imagen...' : 'Publicar Noticia'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </form>

              <div className="space-y-10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-black/[0.02] rounded-xl flex items-center justify-center">
                    <Newspaper className="w-6 h-6 text-black/30" />
                  </div>
                  <h3 className="text-2xl font-display font-bold uppercase italic">
                    Noticias Publicadas
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {news.map((n) => (
                    <div
                      key={n.id}
                      className="flex items-center justify-between p-6 bg-white rounded-2xl border border-black/[0.04] shadow-sm group hover:bg-black/[0.02] transition-all duration-500 shadow-lg shadow-black/[0.03]"
                    >
                      <div className="flex items-center gap-6">
                        <div className="w-20 h-20 rounded-xl bg-black/[0.06] overflow-hidden ">
                          <img
                            src={
                              n.imageUrl ||
                              `https://picsum.photos/seed/${n.id}/200/200`
                            }
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                            alt="news"
                          />
                        </div>
                        <div className="space-y-1">
                          <p className="font-display font-bold text-lg leading-tight line-clamp-1 group-hover:text-brand transition-colors">
                            {n.title}
                          </p>
                          <p className="text-[10px] text-black/30 font-semibold uppercase tracking-wider">
                            Por {n.authorName}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteNews(n.id)}
                        className="p-4 bg-rose-500/5 hover:bg-rose-500 hover:text-white text-rose-500 rounded-xl transition-all duration-300"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                  {news.length === 0 && (
                    <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-dashed border-black/[0.08] shadow-sm">
                      <p className="text-black/50 font-display text-xl italic">
                        <span>No hay noticias publicadas aún.</span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default AdminDashboard;
