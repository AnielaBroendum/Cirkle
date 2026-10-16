'use client';

import { useState } from 'react';
import { Check, Copy, Send } from 'lucide-react';
import { Button, Field, Input, Modal } from '@/components/ds';

type InviteStoreModalProps = {
  open: boolean;
  onClose: () => void;
  /** Called after an invitation was created, e.g. to reload partnerships. */
  onInvited?: () => void;
};

// The invite form from the partnerships page (same API call and defaults),
// shown as the Figma "+ Invite store" dialog.
export function InviteStoreModal({ open, onClose, onInvited }: InviteStoreModalProps) {
  const [email, setEmail] = useState('');
  const [commDirect, setCommDirect] = useState(25);
  const [commDeferred, setCommDeferred] = useState(15);
  const [commTier2, setCommTier2] = useState(10);
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setInviteError('');
    setInviteSuccess(null);
    setInviting(true);

    const res = await fetch('/api/partnerships/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.trim(),
        commission_direct: commDirect * 100,
        commission_deferred: commDeferred * 100,
        commission_tier2: commTier2 * 100,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setInviteError(data.error ?? 'Something went wrong');
      setInviting(false);
      return;
    }

    setInviteSuccess(data.invitation_url);
    setEmail('');
    setInviting(false);
    onInvited?.();
  }

  function copyUrl(url: string) {
    navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  }

  function close() {
    setInviteError('');
    setInviteSuccess(null);
    onClose();
  }

  return (
    <Modal open={open} onClose={close} title="Invite store" variant="sheet">
      <form onSubmit={handleInvite} className="space-y-4">
        <p className="text-muted">We email the store a link to join Flaym and partner with you.</p>
        <Field label="Store email *" htmlFor="invite-email">
          <Input
            id="invite-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="store@example.com"
          />
        </Field>

        <div>
          <p className="mb-1.5 text-label uppercase text-muted">Store commission</p>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Direct %" htmlFor="invite-direct">
              <Input id="invite-direct" type="number" min={0} max={100} value={commDirect} onChange={(e) => setCommDirect(Number(e.target.value))} />
            </Field>
            <Field label="Deferred %" htmlFor="invite-deferred">
              <Input id="invite-deferred" type="number" min={0} max={100} value={commDeferred} onChange={(e) => setCommDeferred(Number(e.target.value))} />
            </Field>
            <Field label="Tier-2 %" htmlFor="invite-tier2">
              <Input id="invite-tier2" type="number" min={0} max={100} value={commTier2} onChange={(e) => setCommTier2(Number(e.target.value))} />
            </Field>
          </div>
        </div>

        {inviteError && (
          <p role="alert" className="border border-accent bg-accent-subtle px-4 py-3 text-accent-strong">
            {inviteError}
          </p>
        )}

        {inviteSuccess && (
          <div className="space-y-2 border border-success bg-success-subtle px-4 py-3">
            <p className="font-medium text-success">Invitation sent</p>
            <div className="flex items-center gap-2">
              <Input readOnly value={inviteSuccess} aria-label="Invitation link" className="h-9 text-caption" />
              <Button type="button" variant="secondary" size="sm" onClick={() => copyUrl(inviteSuccess)} aria-label="Copy link">
                {copiedUrl ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}

        <Button type="submit" fullWidth disabled={inviting || !email.trim()} loading={inviting} leftIcon={<Send className="h-4 w-4" />}>
          {inviting ? 'Sending…' : 'Send invitation'}
        </Button>
      </form>
    </Modal>
  );
}
