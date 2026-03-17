import { AnimatePresence, motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Users } from "lucide-react";
import { useState, useEffect } from "react";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import { Button } from "@/shared/components/ui/button";

export type DiscoveryDemoShortcut = {
  demoUserKey: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  isCurrentUser: boolean;
  canResetPair?: boolean;
};

interface DiscoveryDemoPanelProps {
  demoShortcuts: DiscoveryDemoShortcut[];
  activeDemoShortcutKey: string | null;
  onOpenShortcut: (key: string) => void;
  onCloseShortcut: () => void;
  onResetShortcut?: (key: string) => void;
  isResettingShortcut?: boolean;
}

export function DiscoveryDemoPanel({
  demoShortcuts,
  activeDemoShortcutKey,
  onOpenShortcut,
  onCloseShortcut,
  onResetShortcut,
  isResettingShortcut = false,
}: DiscoveryDemoPanelProps) {
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const [isDemoPanelExpanded, setIsDemoPanelExpanded] = useState(false);
  const [isDemoPanelVisible, setIsDemoPanelVisible] = useState(() => !isMobile);

  useEffect(() => {
    if (!isMobile) {
      setIsDemoPanelVisible(true);
    }
  }, [isMobile]);

  if (demoShortcuts.length === 0) return null;

  return (
    <AnimatePresence initial={false} mode="wait">
      {isDemoPanelVisible ? (
        <motion.aside
          key="demo-panel"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className={[
            "absolute z-40",
            isMobile ? "left-3 right-3 top-3" : "left-5 top-5",
          ].join(" ")}
        >
          <div className="overflow-hidden rounded-3xl border border-white/70 bg-white/85 shadow-[0_18px_50px_rgba(15,23,42,0.10)] backdrop-blur-xl">
            <div className="px-2 py-2">
              <button
                type="button"
                onClick={() => {
                  if (isMobile) {
                    setIsDemoPanelExpanded(false);
                    setIsDemoPanelVisible(false);
                    return;
                  }
                  setIsDemoPanelExpanded((current) => !current);
                }}
                className="flex w-full min-w-0 items-center justify-between gap-3 rounded-[20px] px-2 py-1 text-left transition hover:bg-white/60"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-sky-500/12 text-sky-600">
                    <Users className="size-4.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-500">
                      {t("discovery.demo_panel_badge")}
                    </p>
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {t("discovery.demo_panel_title")}
                    </p>
                  </div>
                </div>
                {isMobile || isDemoPanelExpanded ? (
                  <ChevronLeft className="size-4 shrink-0 text-slate-400" />
                ) : (
                  <ChevronRight className="size-4 shrink-0 text-slate-400" />
                )}
              </button>
            </div>

            <AnimatePresence initial={false}>
              {isDemoPanelExpanded ? (
                <motion.div
                  key="expanded"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  className="border-t border-slate-100"
                >
                  <div className="max-h-[52vh] space-y-2 overflow-y-auto px-3 py-3">
                    {demoShortcuts.map((shortcut) => {
                      const isActive = activeDemoShortcutKey === shortcut.demoUserKey;
                      return (
                        <div
                          key={shortcut.demoUserKey}
                          className={[
                            "flex w-full items-center gap-2 rounded-2xl text-left transition",
                            shortcut.isCurrentUser
                              ? "bg-slate-50 text-slate-400"
                              : isActive
                                ? "bg-slate-900 text-white shadow-[0_14px_30px_rgba(15,23,42,0.22)]"
                                : "bg-slate-50 text-slate-700",
                          ].join(" ")}
                        >
                          <button
                            type="button"
                            disabled={shortcut.isCurrentUser}
                            onClick={() => {
                              if (isActive) {
                                onCloseShortcut();
                              } else {
                                onOpenShortcut(shortcut.demoUserKey);
                              }
                            }}
                            className={[
                              "flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-3 py-3 text-left transition",
                              shortcut.isCurrentUser
                                ? "cursor-not-allowed"
                                : isActive
                                  ? "hover:bg-white/5"
                                  : "hover:bg-slate-100",
                            ].join(" ")}
                          >
                            {shortcut.avatarUrl ? (
                              <img
                                src={shortcut.avatarUrl}
                                alt={shortcut.displayName}
                                className="size-11 rounded-2xl object-cover"
                              />
                            ) : (
                              <div className="flex size-11 items-center justify-center rounded-2xl bg-white/80 text-sm font-semibold">
                                {shortcut.displayName.slice(0, 1)}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">
                                {shortcut.displayName}
                              </p>
                              <p
                                className={[
                                  "truncate text-xs",
                                  isActive ? "text-slate-300" : "text-slate-500",
                                ].join(" ")}
                              >
                                {shortcut.isCurrentUser
                                  ? t("discovery.demo_panel_you")
                                  : shortcut.bio || t("discovery.demo_panel_open_card")}
                              </p>
                            </div>
                          </button>
                          {shortcut.canResetPair ? (
                            <Button
                              type="button"
                              variant={isActive ? "secondary" : "outline"}
                              size="xs"
                              className="mr-3 shrink-0 rounded-full"
                              disabled={isResettingShortcut}
                              onClick={(event) => {
                                event.stopPropagation();
                                onResetShortcut?.(shortcut.demoUserKey);
                              }}
                            >
                              {t("discovery.demo_panel_reset")}
                            </Button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </motion.aside>
      ) : isMobile ? (
        <motion.button
          key="demo-panel-toggle-mobile"
          type="button"
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          onClick={() => {
            setIsDemoPanelVisible(true);
            setIsDemoPanelExpanded(true);
          }}
          className="absolute left-3 top-3 z-40 flex size-12 items-center justify-center rounded-2xl border border-white/70 bg-white/90 text-sky-600 shadow-[0_18px_50px_rgba(15,23,42,0.10)] backdrop-blur-xl transition hover:bg-white"
        >
          <ChevronRight className="size-4" />
          <span className="sr-only">{t("discovery.demo_panel_title")}</span>
        </motion.button>
      ) : (
        <motion.button
          key="demo-panel-toggle-desktop"
          type="button"
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          onClick={() => setIsDemoPanelVisible(true)}
          className="absolute left-5 top-5 z-40 inline-flex items-center gap-3 rounded-2xl border border-white/70 bg-white/88 px-4 py-3 text-left shadow-[0_18px_50px_rgba(15,23,42,0.10)] backdrop-blur-xl transition hover:bg-white"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-sky-500/12 text-sky-600">
            <Users className="size-4.5" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-500">
              {t("discovery.demo_panel_badge")}
            </p>
            <p className="truncate text-sm font-semibold text-slate-900">
              {t("discovery.demo_panel_title")}
            </p>
          </div>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
