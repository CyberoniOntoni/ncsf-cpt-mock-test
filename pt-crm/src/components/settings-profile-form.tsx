"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  changePasswordAction,
  updateProfileAction,
} from "@/app/actions/auth";
import { Alert, Button, Input, Label } from "@/components/ui";

export function SettingsProfileForm({
  initial,
}: {
  initial: {
    name: string;
    email: string;
    phone: string;
    title: string;
  };
}) {
  const router = useRouter();
  const [profilePending, startProfile] = useTransition();
  const [pwPending, startPw] = useTransition();
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(
    null
  );
  const [name, setName] = useState(initial.name);
  const [email, setEmail] = useState(initial.email);
  const [phone, setPhone] = useState(initial.phone);
  const [title, setTitle] = useState(initial.title);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Keep form in sync after server refresh
  useEffect(() => {
    setName(initial.name);
    setEmail(initial.email);
    setPhone(initial.phone);
    setTitle(initial.title);
  }, [initial.name, initial.email, initial.phone, initial.title]);

  useEffect(() => {
    if (!msg || msg.tone !== "ok") return;
    const t = window.setTimeout(() => setMsg(null), 3200);
    return () => window.clearTimeout(t);
  }, [msg]);

  function onSaveProfile(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    startProfile(async () => {
      const res = await updateProfileAction({ name, email, phone, title });
      if ("error" in res && res.error) {
        setMsg({ tone: "err", text: res.error });
        return;
      }
      setMsg({ tone: "ok", text: "Profile saved" });
      router.refresh();
    });
  }

  function onChangePassword(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (newPassword !== confirmPassword) {
      setMsg({ tone: "err", text: "New passwords do not match" });
      return;
    }
    if (newPassword.length < 8) {
      setMsg({ tone: "err", text: "Password must be at least 8 characters" });
      return;
    }
    startPw(async () => {
      const res = await changePasswordAction({
        currentPassword,
        newPassword,
      });
      if ("error" in res && res.error) {
        setMsg({ tone: "err", text: res.error });
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMsg({ tone: "ok", text: "Password updated" });
    });
  }

  const busy = profilePending || pwPending;

  return (
    <div className="space-y-6">
      {msg && (
        <Alert tone={msg.tone === "ok" ? "success" : "error"}>{msg.text}</Alert>
      )}

      <form onSubmit={onSaveProfile} className="space-y-3">
        <h3 className="text-sm font-medium text-zinc-200">Your profile</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="profile-name">Name</Label>
            <Input
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              disabled={busy}
              className="mt-0.5"
              autoComplete="name"
            />
          </div>
          <div>
            <Label htmlFor="profile-title">Credentials / title</Label>
            <Input
              id="profile-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={busy}
              placeholder="e.g. NCSF-CPT"
              className="mt-0.5"
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="profile-email">Email</Label>
            <Input
              id="profile-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={busy}
              className="mt-0.5"
              autoComplete="email"
            />
          </div>
          <div>
            <Label htmlFor="profile-phone">Phone</Label>
            <Input
              id="profile-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={busy}
              className="mt-0.5"
              autoComplete="tel"
            />
          </div>
        </div>
        <Button
          type="submit"
          size="sm"
          loading={profilePending}
          disabled={busy}
          className="min-h-11"
        >
          Save profile
        </Button>
      </form>

      <form
        onSubmit={onChangePassword}
        className="space-y-3 border-t border-zinc-800 pt-5"
      >
        <h3 className="text-sm font-medium text-zinc-200">Change password</h3>
        <p className="text-[11px] text-zinc-600">
          At least 8 characters. You’ll stay signed in after changing.
        </p>
        <div>
          <Label htmlFor="current-password">Current password</Label>
          <Input
            id="current-password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            disabled={busy}
            className="mt-0.5"
            autoComplete="current-password"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              disabled={busy}
              className="mt-0.5"
              autoComplete="new-password"
            />
          </div>
          <div>
            <Label htmlFor="confirm-new-password">Confirm new</Label>
            <Input
              id="confirm-new-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              disabled={busy}
              className="mt-0.5"
              autoComplete="new-password"
            />
          </div>
        </div>
        <Button
          type="submit"
          size="sm"
          variant="secondary"
          loading={pwPending}
          disabled={busy}
          className="min-h-11"
        >
          Update password
        </Button>
      </form>
    </div>
  );
}
