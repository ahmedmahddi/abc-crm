"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch, ApiError } from "@/lib/api";

type PublicKeyResponse = { data: { enabled: boolean; publicKey: string | null } };
type PushTestResponse = { data: { failed?: number; sent: number; skipped?: boolean } };

export function PushNotificationSettings() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);
  const [serverEnabled, setServerEnabled] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setIsSupported(supported);
    if (!supported) {
      setIsConfigLoaded(true);
      return;
    }

    void apiFetch<PublicKeyResponse>("/notifications/push/public-key", { cache: "no-store" })
      .then((response) => {
        if (cancelled) return;
        setServerEnabled(response.data.enabled);
        setPublicKey(response.data.publicKey);
        setIsConfigLoaded(true);
        void getCurrentSubscription()
          .then((subscription) => {
            if (!cancelled) setIsSubscribed(Boolean(subscription));
          })
          .catch(() => {
            if (!cancelled) setIsSubscribed(false);
          });
      })
      .catch(() => {
        if (cancelled) return;
        setServerEnabled(false);
        setPublicKey(null);
        setIsConfigLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const enable = async () => {
    setIsPending(true);
    setError(null);
    setMessage(null);
    try {
      if (!isSupported) throw new Error("Ce navigateur ne supporte pas les notifications push.");
      if (!serverEnabled || !publicKey) throw new Error("Les cles VAPID ne sont pas configurees cote serveur.");

      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Autorisation refusee par le navigateur.");

      const registration = await getReadyServiceWorker();
      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) {
        await apiFetch("/notifications/push/subscriptions", {
          method: "DELETE",
          body: JSON.stringify({ endpoint: existingSubscription.endpoint }),
        }).catch(() => undefined);
        await existingSubscription.unsubscribe();
      }
      const subscription = await registration.pushManager.subscribe({
        applicationServerKey: urlBase64ToUint8Array(publicKey),
        userVisibleOnly: true,
      });

      await apiFetch("/notifications/push/subscriptions", {
        method: "POST",
        body: JSON.stringify(subscription.toJSON()),
      });
      setIsSubscribed(true);
      setMessage("Notifications activees sur cet appareil.");
    } catch (caught) {
      setError(getErrorMessage(caught, "Impossible d'activer les notifications."));
    } finally {
      setIsPending(false);
    }
  };

  const disable = async () => {
    setIsPending(true);
    setError(null);
    setMessage(null);
    try {
      const registration = await getReadyServiceWorker();
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await apiFetch("/notifications/push/subscriptions", {
          method: "DELETE",
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setIsSubscribed(false);
      setMessage("Notifications desactivees sur cet appareil.");
    } catch (caught) {
      setError(getErrorMessage(caught, "Impossible de desactiver les notifications."));
    } finally {
      setIsPending(false);
    }
  };

  const test = async () => {
    setIsPending(true);
    setError(null);
    setMessage(null);
    try {
      const response = await apiFetch<PushTestResponse>("/notifications/push/test", { method: "POST" });
      if (response.data.skipped) {
        setError("Les notifications push ne sont pas configurees cote serveur.");
      } else if (response.data.sent > 0) {
        setMessage("Notification de test envoyee sur cet appareil.");
      } else {
        setError(
          response.data.failed
            ? "La notification a ete refusee par le service push. Reactivez les notifications sur cet appareil."
            : "Aucun appareil actif n'a ete trouve pour ce compte. Reactivez les notifications.",
        );
      }
    } catch (caught) {
      setError(getErrorMessage(caught, "Impossible d'envoyer la notification de test."));
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isSubscribed ? <Bell className="size-4 text-brand-700" aria-hidden="true" /> : <BellOff className="size-4 text-muted-foreground" aria-hidden="true" />}
          Notifications push
        </CardTitle>
        <CardDescription>
          Recevez les alertes de mission sur ce telephone ou cet ordinateur, meme quand l'application est installee.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!isSupported ? (
          <p className="rounded-md border border-warning/30 bg-white px-3 py-2 text-sm text-muted-foreground" role="status">
            Ce navigateur ne supporte pas les notifications push PWA.
          </p>
        ) : null}
        {isSupported && !isConfigLoaded ? (
          <p className="rounded-md border bg-white px-3 py-2 text-sm text-muted-foreground" role="status">
            Verification de la configuration des notifications...
          </p>
        ) : null}
        {isSupported && isConfigLoaded && !serverEnabled ? (
          <p className="rounded-md border border-warning/30 bg-white px-3 py-2 text-sm text-muted-foreground" role="status">
            Les cles VAPID doivent etre configurees avant activation.
          </p>
        ) : null}
        {message ? <p className="border-l-2 border-primary pl-3 text-sm" role="status">{message}</p> : null}
        {error ? <p className="border-l-2 border-danger pl-3 text-sm text-danger" role="alert">{error}</p> : null}
        <div className="flex flex-wrap gap-2">
          {isSubscribed ? (
            <Button disabled={isPending} onClick={() => void disable()} type="button" variant="outline">
              Desactiver sur cet appareil
            </Button>
          ) : (
            <Button disabled={isPending || !isSupported || !isConfigLoaded || !serverEnabled} onClick={() => void enable()} type="button">
              Activer sur cet appareil
            </Button>
          )}
          <Button disabled={isPending || !isSubscribed} onClick={() => void test()} type="button" variant="outline">
            Envoyer un test
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

function getCurrentSubscription() {
  return getReadyServiceWorker().then((registration) => registration.pushManager.getSubscription());
}

function getReadyServiceWorker() {
  return withTimeout(
    navigator.serviceWorker.ready,
    8000,
    "Le service worker PWA n'est pas encore pret. Rechargez l'application puis reessayez.",
  );
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => window.clearTimeout(timeout));
  });
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}
